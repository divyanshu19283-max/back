// Shared HTTP client for the Freight Intelligence frontend.
// All API modules should use request() from this file.
//
// By default every call is same-origin (`/api/...`, `/health`). The Vite dev
// server proxies those paths to the local FastAPI backend on port 8000
// (see vite.config.ts), so there is no CORS surface and no backend host baked
// into the client bundle. Set VITE_API_BASE_URL only when the backend is
// hosted somewhere other than the app origin.
const RAW_BASE = import.meta.env["VITE_API_BASE_URL"] || "";

export const BASE = String(RAW_BASE).replace(/\/+$/, "");

export class ApiClientError extends Error {
  kind: "offline" | "error" | "no-data" | "validation" | "server" | "unknown";

  constructor(kind: ApiClientError["kind"], message: string) {
    super(message);
    this.kind = kind;
    this.name = "ApiClientError";
  }
}

export const isOffline = (e: unknown): boolean =>
  e instanceof ApiClientError && (e.kind === "offline" || e.kind === "unknown");

function extractMessage(body: unknown): string | null {
  if (!body) return null;

  if (typeof body === "string") {
    return body;
  }

  if (typeof body === "object" && body !== null) {
    const b = body as Record<string, unknown>;

    for (const key of ["detail", "message", "error", "error_description"]) {
      const value = b[key];

      if (typeof value === "string") {
        return value;
      }

      if (
        Array.isArray(value) &&
        value.length > 0 &&
        typeof value[0] === "object" &&
        value[0] !== null &&
        "msg" in value[0]
      ) {
        return String((value[0] as Record<string, unknown>)["msg"]);
      }
    }
  }

  return null;
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 15000,
): Promise<T> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${BASE}${cleanPath}`;

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      let body: unknown = null;

      try {
        body = await response.json();
      } catch {
        // Response was not JSON.
      }

      const message = extractMessage(body) || `Request failed with status ${response.status}.`;

      if (response.status >= 500) {
        throw new ApiClientError("server", "The freight backend could not complete this request.");
      }

      if (response.status === 404) {
        throw new ApiClientError("no-data", `API endpoint not found: ${cleanPath}`);
      }

      if (response.status === 400 || response.status === 422) {
        throw new ApiClientError("validation", message);
      }

      throw new ApiClientError("error", message);
    }

    // Handle empty successful responses.
    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const text = await response.text();

      if (!text) {
        return undefined as T;
      }

      return text as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiClientError("offline", "Backend request timed out. Please try again.");
    }

    if (error instanceof TypeError) {
      throw new ApiClientError("offline", "Unable to connect to the freight backend.");
    }

    throw new ApiClientError("unknown", "Something went wrong while processing this request.");
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Checks whether the deployed Render backend is reachable.
 */
export async function probeBackend(): Promise<"online" | "offline"> {
  try {
    await request("/health", undefined, 5000);
    return "online";
  } catch {
    return "offline";
  }
}
