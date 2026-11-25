import { createFileRoute } from "@tanstack/react-router"
import { ChainScreen } from "../../features/dev/screens/ChainScreen.tsx"

// Wallet state lives in the browser; nothing here renders on the server.
export const Route = createFileRoute("/dev/chain")({ ssr: false, component: ChainScreen })
