import { createFileRoute } from "@tanstack/react-router";
import { CommandCenter } from "@/screens/CommandCenter";

export const Route = createFileRoute("/")({ component: CommandCenter });
