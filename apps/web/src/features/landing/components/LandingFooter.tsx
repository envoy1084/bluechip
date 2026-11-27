import { Logo } from "@bluechip/ui/bluechip/logo"
import { Link } from "@tanstack/react-router"
import { LANDING_SECTIONS } from "./LandingNav.tsx"

const link = "rounded-sm text-body-sm text-g-600 transition-colors duration-base hover:text-ink"

/** The sections again, the ways into an account, the legal pages and the lines every footer carries. */
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
              <Link to="/welcome" className={link}>Create an account</Link>
              <Link to="/signin" className={link}>Sign in</Link>
              <Link to="/recover" className={link}>Lost your passkey? Recover your account</Link>
            </nav>
            <nav aria-label="Legal" className="grid content-start gap-2.5">
              <b className="text-label-sm font-semibold text-g-500">Legal</b>
              <Link to="/legal/terms" className={link}>Terms</Link>
              <Link to="/legal/risk" className={link}>Risk disclosure</Link>
            </nav>
          </div>
        </div>
        <div className="grid gap-1.5 border-t border-g-200/70 pt-6 text-caption text-g-500">
          <p>
            Coinbase stock tokens are only available to eligible users outside the US. bluechip asks where you live
            before you add cash.
          </p>
          <p>
            Tokenized stocks carry risk, and prices go down as well as up. Nothing on bluechip is financial advice.
          </p>
          <p>bluechip is not affiliated with Coinbase, Base or any token named BLUECHIP.</p>
        </div>
      </div>
    </footer>
  )
}
