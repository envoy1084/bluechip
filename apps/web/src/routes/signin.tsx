import { createFileRoute, redirect } from "@tanstack/react-router"

// Signing in happens where people arrive (the landing and welcome pages); old links to /signin land there.
export const Route = createFileRoute("/signin")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true })
  }
})
