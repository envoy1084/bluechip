import { createFileRoute } from "@tanstack/react-router"
import { DepositScreen } from "../../features/funding/screens/DepositScreen.tsx"
import { pageHead } from "../../lib/seo/head.ts"

export const Route = createFileRoute("/welcome/deposit")({
  head: () => pageHead({ title: "Add cash" }),
  ssr: false,
  component: DepositScreen
})
