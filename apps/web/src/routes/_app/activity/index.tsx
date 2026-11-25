import { createFileRoute } from "@tanstack/react-router"
import { ActivityScreen } from "../../../features/activity/screens/ActivityScreen.tsx"

export const Route = createFileRoute("/_app/activity/")({ component: ActivityScreen })
