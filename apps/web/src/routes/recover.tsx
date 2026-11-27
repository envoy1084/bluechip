import { createFileRoute } from "@tanstack/react-router"
import { RecoverScreen } from "../features/recover/screens/RecoverScreen.tsx"
import { pageHead } from "../lib/seo/head.ts"

export const Route = createFileRoute("/recover")({
  head: () => pageHead({ title: "Recover your account", image: "safety" }),
  ssr: false,
  component: RecoverScreen
})
