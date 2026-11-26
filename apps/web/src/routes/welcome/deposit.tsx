import { createFileRoute } from "@tanstack/react-router"
import { DepositScreen } from "../../features/funding/screens/DepositScreen.tsx"

export const Route = createFileRoute("/welcome/deposit")({ ssr: false, component: DepositScreen })
