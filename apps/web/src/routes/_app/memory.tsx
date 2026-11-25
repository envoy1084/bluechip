import { createFileRoute } from "@tanstack/react-router"
import { MemoryScreen } from "../../features/assistant/screens/MemoryScreen.tsx"

export const Route = createFileRoute("/_app/memory")({ component: MemoryScreen })
