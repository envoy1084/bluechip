import { createFileRoute } from "@tanstack/react-router"
import { WelcomeScreen } from "../../features/auth/screens/WelcomeScreen.tsx"
import { pageHead } from "../../lib/seo/head.ts"

export const Route = createFileRoute("/welcome/")({
  head: () => pageHead({ title: "Get started" }),
  ssr: false,
  component: WelcomeScreen
})
