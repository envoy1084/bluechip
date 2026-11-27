import { createFileRoute } from "@tanstack/react-router"
import { ActivityScreen } from "../../../features/activity/screens/ActivityScreen.tsx"
import { pageHead } from "../../../lib/seo/head.ts"

export const Route = createFileRoute("/_app/activity/")({
  head: () => pageHead({ title: "Activity" }),
  component: ActivityScreen
})
