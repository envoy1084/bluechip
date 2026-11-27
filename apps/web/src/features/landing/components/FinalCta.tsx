import { buttonVariants } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Halftone, type Palette } from "@bluechip/ui/motion/halftone"
import { Scramble } from "@bluechip/ui/motion/scramble"
import { Link } from "@tanstack/react-router"
import { useRef } from "react"
import { useInView } from "../hooks/useInView.ts"

const TITLE = "Your agents are waiting."

// The halftone's inks turned inside out for the blue panel: the darker a cell, the closer to white.
const ON_BLUE: Palette = ["#4c76ff", "#7f9dff", "#c6d3ff", "#ffffff"]

/**
 * The last word, on a panel of brand blue: the line resolves out of glyphs as it arrives, and the butterflies, one per
 * agent, fly in white halftone beside the way in.
 */
export function FinalCta() {
  const root = useRef<HTMLDivElement>(null)
  const seen = useInView(root)

  return (
    <section aria-labelledby="landing-final" className="bg-white px-4 py-20 sm:px-6 sm:py-28">
      <div
        ref={root}
        className="relative mx-auto grid max-w-[1200px] items-center overflow-hidden rounded-[32px] bg-[radial-gradient(ellipse_80%_90%_at_80%_50%,var(--color-blue-hi),var(--color-blue)_55%,var(--color-blue-deep))] text-white shadow-e4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      >
        <div className="relative z-10 grid justify-items-center gap-6 px-6 py-14 text-center sm:px-12 lg:justify-items-start lg:py-20 lg:text-left">
          <h2
            id="landing-final"
            className="max-w-[12ch] text-[clamp(38px,5.6vw,68px)] leading-[1] font-semibold tracking-[-0.05em]"
          >
            {seen ? <Scramble text={TITLE} duration={900} /> : TITLE}
          </h2>
          <p className="max-w-[34ch] text-body-lg text-blue-100">
            Make your account with Face ID in seconds. Add cash when you're ready.
          </p>
          <div className="flex w-full flex-col gap-2.5 min-[440px]:w-auto min-[440px]:flex-row">
            <Link to="/welcome" className={buttonVariants({ size: "lg", variant: "secondary", className: "group" })}>
              Get started
              <Icon
                name="arrow-right"
                size={16}
                className="transition-transform duration-base ease-brand group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </div>
        <div aria-hidden className="relative h-[260px] sm:h-[320px] lg:h-full lg:min-h-[440px]">
          <Halftone scene="butterflies" palette={ON_BLUE} cell={9} className="absolute inset-0 size-full" />
        </div>
      </div>
    </section>
  )
}
