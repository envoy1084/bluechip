import { createFileRoute } from "@tanstack/react-router"
import { LandingScreen } from "../features/landing/screens/LandingScreen.tsx"

export const Route = createFileRoute("/")({ component: LandingScreen })
