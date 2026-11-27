import { createFileRoute, redirect } from "@tanstack/react-router"

// Signing in and signing up share the welcome page; old links to /signin land there.
export const Route = createFileRoute("/signin")({
  beforeLoad: () => {
    throw redirect({ to: "/welcome", replace: true })
  }
})
