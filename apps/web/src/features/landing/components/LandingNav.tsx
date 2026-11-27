import { Logo } from "@bluechip/ui/bluechip/logo"
import { buttonVariants } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useEffect, useState } from "react"
import { meAtom } from "../../../atoms/account.ts"

/** The page's sections, in order, for the nav and the footer. */
export const LANDING_SECTIONS = [
  { id: "how", label: "How it works" },
  { id: "limits", label: "Limits" },
  { id: "agents", label: "Agents" },
  { id: "automations", label: "Automations" },
  { id: "safety", label: "Safety" },
  { id: "faq", label: "FAQ" }
] as const

/**
 * The bar over the page: the lockup, the sections, then Sign in and Create an account, or Open bluechip for someone
 * already signed in. It frosts once the page scrolls.
 */
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const signedIn = AsyncResult.isSuccess(useAtomValue(meAtom))

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8)
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [])

  return (
    <header
      data-scrolled={scrolled || undefined}
      className={cn(
        "fixed inset-x-0 top-0 z-30 transition-[background-color,box-shadow,backdrop-filter] duration-slow ease-brand",
        "data-scrolled:bg-white/80 data-scrolled:shadow-[0_1px_0_rgba(10,11,13,.06)] data-scrolled:backdrop-blur-xl"
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" aria-label="bluechip home" className="rounded-sm">
          <Logo size={24} />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-0.5 md:flex">
          {LANDING_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-sm px-3 py-1.5 text-label font-medium text-g-600 transition-colors duration-base hover:bg-g-100/70 hover:text-ink"
            >
              {section.label}
            </a>
          ))}
        </nav>
        {signedIn ?
          (
            <Link to="/home" className={buttonVariants({ size: "sm" })}>
              Open bluechip<Icon name="arrow-right" size={14} />
            </Link>
          ) :
          (
            <div className="flex items-center gap-1.5">
              <Link to="/signin" className={buttonVariants({ variant: "ghost", size: "sm" })}>Sign in</Link>
              <Link to="/welcome" className={buttonVariants({ size: "sm" })}>Create an account</Link>
            </div>
          )}
      </div>
    </header>
  )
}
