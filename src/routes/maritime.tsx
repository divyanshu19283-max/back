import { createFileRoute } from "@tanstack/react-router";
import { MaritimeOperations } from "@/screens/MaritimeOperations";

export const Route = createFileRoute("/maritime")({ component: MaritimeOperations });
