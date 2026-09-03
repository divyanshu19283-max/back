import { createFileRoute } from "@tanstack/react-router";
import { ScenarioHistory } from "@/screens/ScenarioHistory";

export const Route = createFileRoute("/scenarios")({ component: ScenarioHistory });
