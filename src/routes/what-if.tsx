import { createFileRoute } from "@tanstack/react-router";
import { WhatIf } from "@/screens/WhatIf";

export const Route = createFileRoute("/what-if")({ component: WhatIf });
