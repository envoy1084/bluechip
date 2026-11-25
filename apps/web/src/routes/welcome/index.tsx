import { createFileRoute } from "@tanstack/react-router"
import { WelcomeScreen } from "../../features/auth/screens/WelcomeScreen.tsx"

export const Route = createFileRoute("/welcome/")({ ssr: false, component: WelcomeScreen })
