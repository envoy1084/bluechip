import { createFileRoute } from "@tanstack/react-router"
import { KitCards } from "../pages/cards/page.tsx"

export const Route = createFileRoute("/cards")({ component: KitCards })
