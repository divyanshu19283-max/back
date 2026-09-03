import { createFileRoute } from "@tanstack/react-router";
import { Optimization } from "@/screens/Optimization";

export const Route = createFileRoute("/optimization")({ component: Optimization });
