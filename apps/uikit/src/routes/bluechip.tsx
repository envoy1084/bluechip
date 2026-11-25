import { createFileRoute } from "@tanstack/react-router"
import { KitBluechip } from "../pages/bluechip/page.tsx"

export const Route = createFileRoute("/bluechip")({ component: KitBluechip })
