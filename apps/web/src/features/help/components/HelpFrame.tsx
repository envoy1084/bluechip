import { Logo } from "@bluechip/ui/bluechip/logo"
import { buttonVariants } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { AppLink } from "../../../components/AppLink.tsx"
import { PaperBadge } from "../../../components/layout/PaperBadge.tsx"

const footerLink = "rounded-sm text-body-sm text-g-600 transition-colors duration-base hover:text-ink"

/** The help center's page: the lockup and Help, the way into the app, the page, then the legal pages. */
export function HelpFrame({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_70%_30%_at_50%_0%,var(--color-blue-50),transparent_70%),var(--color-canvas)] text-ink">
      <header className="sticky top-0 z-20 border-b border-g-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Link to="/" aria-label="bluechip home" className="flex rounded-sm">
              <Logo size={22} />
            </Link>
            <span aria-hidden className="h-4 w-px bg-g-200" />
            <Link to="/help" className="rounded-sm text-label font-semibold text-g-600 hover:text-ink">Help</Link>
            <PaperBadge />
          </div>
          <AppLink to="/home" className={buttonVariants({ size: "sm", variant: "secondary" })}>
            Open bluechip<Icon name="arrow-right" size={14} />
          </AppLink>
        </div>
      </header>
      <main className="flex-1 px-4 pt-8 pb-16 [view-transition-name:page] sm:px-6 sm:pt-12">{children}</main>
      <footer className="border-t border-g-100 bg-g-50 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-start justify-between gap-6">
          <nav aria-label="bluechip" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link to="/" className={footerLink}>bluechip</Link>
            <Link to="/help" className={footerLink}>Help</Link>
            <Link to="/legal/terms" className={footerLink}>Terms</Link>
            <Link to="/legal/risk" className={footerLink}>Risk disclosure</Link>
            <Link to="/legal/privacy" className={footerLink}>Privacy policy</Link>
          </nav>
          <p className="max-w-[60ch] text-caption text-g-500">
            Not available to people in the United States. bluechip is not affiliated with Coinbase, Base or any token
            named BLUECHIP.
          </p>
        </div>
      </footer>
    </div>
  )
}
