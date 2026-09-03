import { createFileRoute } from "@tanstack/react-router";
import { MarketData } from "@/screens/MarketData";

export const Route = createFileRoute("/market-data")({ component: MarketData });
