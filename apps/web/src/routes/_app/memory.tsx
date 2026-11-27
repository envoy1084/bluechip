import { createFileRoute } from "@tanstack/react-router"
import { MemoryScreen } from "../../features/assistant/screens/MemoryScreen.tsx"
import { pageHead } from "../../lib/seo/head.ts"

export const Route = createFileRoute("/_app/memory")({
  head: () => pageHead({ title: "Memory", image: "assistant" }),
  component: MemoryScreen
})
