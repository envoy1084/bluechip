import { Logo } from "@bluechip/ui/bluechip/logo"
import { Link } from "@tanstack/react-router"
import { AppLink } from "../../../components/AppLink.tsx"
import { track } from "../../../lib/analytics.ts"
import { LANDING_SECTIONS } from "./LandingNav.tsx"

const link = "rounded-sm text-body-sm text-g-600 transition-colors duration-base hover:text-ink"

/** The sections again, the way into an account, the help center and the legal pages. */
export function LandingFooter() {
  return (
    <footer className="border-t border-g-100 bg-g-50 px-4 pt-14 pb-10 sm:px-6">
      <div className="mx-auto grid max-w-[1200px] gap-10">
        <div className="flex flex-wrap justify-between gap-10">
          <div className="grid content-start gap-3">
            <Logo size={24} />
            <p className="max-w-[30ch] text-body-sm text-g-600">
              Agents that trade tokenized US stocks within your limits.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-16 gap-y-8">
            <nav aria-label="Product" className="grid content-start gap-2.5">
              <b className="text-label-sm font-semibold text-g-500">Product</b>
              {LANDING_SECTIONS.map((section) => (
                <a key={section.id} href={`#${section.id}`} className={link}>{section.label}</a>
              ))}
            </nav>
            <nav aria-label="Account" className="grid content-start gap-2.5">
              <b className="text-label-sm font-semibold text-g-500">Account</b>
              <AppLink
                to="/welcome"
                className={link}
                onClick={() => track({ _tag: "landing_cta_clicked", cta: "get_started", section: "footer" })}
              >
                Get started or sign in
              </AppLink>
              <AppLink to="/recover" className={link}>Recover your account</AppLink>
            </nav>
            <nav aria-label="Help" className="grid content-start gap-2.5">
              <b className="text-label-sm font-semibold text-g-500">Help</b>
              <Link to="/help" className={link}>Help center</Link>
              <Link to="/help/$slug" params={{ slug: "getting-started" }} className={link}>Getting started</Link>
              <Link to="/help/$slug" params={{ slug: "policies" }} className={link}>Agent rules</Link>
            </nav>
            <nav aria-label="Legal" className="grid content-start gap-2.5">
              <b className="text-label-sm font-semibold text-g-500">Legal</b>
              <Link to="/legal/terms" className={link}>Terms</Link>
              <Link to="/legal/risk" className={link}>Risk disclosure</Link>
              <Link to="/legal/privacy" className={link}>Privacy policy</Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}
