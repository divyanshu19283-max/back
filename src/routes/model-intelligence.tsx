import { createFileRoute } from "@tanstack/react-router";
import { ModelIntelligence } from "@/screens/ModelIntelligence";

export const Route = createFileRoute("/model-intelligence")({ component: ModelIntelligence });
