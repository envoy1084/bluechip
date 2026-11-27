import { createFileRoute } from "@tanstack/react-router"
import { ChainScreen } from "../../features/dev/screens/ChainScreen.tsx"
import { pageHead } from "../../lib/seo/head.ts"

// Wallet state lives in the browser; nothing here renders on the server.
export const Route = createFileRoute("/dev/chain")({
  head: () => pageHead({ title: "Chain" }),
  ssr: false,
  component: ChainScreen
})
