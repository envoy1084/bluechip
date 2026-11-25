import { createFileRoute } from "@tanstack/react-router"
import { AddCashScreen } from "../../features/funding/screens/AddCashScreen.tsx"

export const Route = createFileRoute("/welcome/cash")({ ssr: false, component: AddCashScreen })
