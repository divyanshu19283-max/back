import { createFileRoute } from "@tanstack/react-router";
import { CharterDecision } from "@/screens/CharterDecision";

export const Route = createFileRoute("/charter")({ component: CharterDecision });
