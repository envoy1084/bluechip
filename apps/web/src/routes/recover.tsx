import { createFileRoute } from "@tanstack/react-router"
import { RecoverScreen } from "../features/recover/screens/RecoverScreen.tsx"

export const Route = createFileRoute("/recover")({ ssr: false, component: RecoverScreen })
