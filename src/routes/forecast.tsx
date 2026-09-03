import { createFileRoute } from "@tanstack/react-router";
import { Forecast } from "@/screens/Forecast";

export const Route = createFileRoute("/forecast")({ component: Forecast });
