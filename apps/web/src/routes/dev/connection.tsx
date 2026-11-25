import { createFileRoute } from "@tanstack/react-router"
import { ConnectionScreen } from "../../features/dev/screens/ConnectionScreen.tsx"

// The API is reached through the browser's origin; nothing here renders on the server.
export const Route = createFileRoute("/dev/connection")({ ssr: false, component: ConnectionScreen })
