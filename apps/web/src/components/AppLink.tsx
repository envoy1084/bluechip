import { Link } from "@tanstack/react-router"
import type { MouseEventHandler, ReactNode } from "react"
import { appHref, landingOnly } from "../lib/appUrl.ts"

/** The app's pages that the landing, the help center and the legal pages link to. */
type AppPath = "/welcome" | "/recover" | "/home"

/**
 * A link into the app: the router's link when the app is on this site, a plain link to the app's site when this build
 * is the landing alone (`VITE_APP_URL`).
 */
export function AppLink({ to, className, onClick, children }: Readonly<{
  to: AppPath
  className?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  children: ReactNode
}>) {
  if (landingOnly) return <a href={appHref(to)} className={className} onClick={onClick}>{children}</a>
  return <Link to={to} className={className} onClick={onClick}>{children}</Link>
}
