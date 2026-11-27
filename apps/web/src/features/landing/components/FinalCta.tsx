import { buttonVariants } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { DotGrid } from "@bluechip/ui/motion/dot-grid"
import { Link } from "@tanstack/react-router"
import { Reveal } from "./Reveal.tsx"

const GRID_COLOR = [198, 211, 255] as const
const GRID_ACCENT = [42, 91, 255] as const

/** The last word: the promise again over the reactive grid, and the way in. */
export function FinalCta() {
  return (
    <section
      aria-labelledby="landing-final"
      className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#fff,var(--color-blue-50))] px-4 py-28 sm:py-36"
    >
      <DotGrid cell={18} gap={6} color={GRID_COLOR} accent={GRID_ACCENT} className="-z-10 opacity-70" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_45%_50%_at_50%_50%,rgba(255,255,255,.95),transparent)]"
      />
      <Reveal className="mx-auto grid max-w-[720px] justify-items-center gap-6 text-center">
        <h2
          id="landing-final"
          className="text-[clamp(34px,5.4vw,60px)] leading-[1.02] font-semibold tracking-[-0.05em] text-balance"
        >
          Let agents invest for you, inside your limits.
        </h2>
        <p className="max-w-[46ch] text-body-lg text-g-600">
          Make your account with Face ID in a few seconds. Add cash when you're ready.
        </p>
        <div className="flex w-full flex-col justify-center gap-2.5 min-[440px]:w-auto min-[440px]:flex-row">
          <Link to="/welcome" className={buttonVariants({ size: "lg" })}>
            Create an account<Icon name="arrow-right" size={16} />
          </Link>
          <Link to="/signin" className={buttonVariants({ size: "lg", variant: "secondary" })}>
            <Icon name="face-id" size={18} />Sign in
          </Link>
        </div>
      </Reveal>
    </section>
  )
}
