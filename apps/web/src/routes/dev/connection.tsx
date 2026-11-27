import { createFileRoute } from "@tanstack/react-router"
import { ConnectionScreen } from "../../features/dev/screens/ConnectionScreen.tsx"
import { pageHead } from "../../lib/seo/head.ts"

// The API is reached through the browser's origin; nothing here renders on the server.
export const Route = createFileRoute("/dev/connection")({
  head: () => pageHead({ title: "Connection" }),
  ssr: false,
  component: ConnectionScreen
})
