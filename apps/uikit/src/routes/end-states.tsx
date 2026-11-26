import { createFileRoute } from "@tanstack/react-router"
import { KitEndStates } from "../pages/end-states/page.tsx"

export const Route = createFileRoute("/end-states")({ component: KitEndStates })
