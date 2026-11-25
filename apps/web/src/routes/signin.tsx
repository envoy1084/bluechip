import { createFileRoute } from "@tanstack/react-router"
import { SignInScreen } from "../features/auth/screens/SignInScreen.tsx"

export const Route = createFileRoute("/signin")({ ssr: false, component: SignInScreen })
