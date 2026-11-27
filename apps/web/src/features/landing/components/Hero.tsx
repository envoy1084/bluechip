import { buttonVariants } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Halftone } from "@bluechip/ui/motion/halftone"
import { Link } from "@tanstack/react-router"

const rise = "animate-[landing-rise_1000ms_var(--ease-brand)_both] motion-reduce:animate-none"

/**
 * The first screen, edge to edge: the warp (the halftone scene bluechip plays when a trade leaves) fills it, the
 * pointer steering its centre, and the promise and the way in sit in its bright middle.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="landing-title"
      className="relative isolate grid min-h-[max(600px,100dvh)] place-items-center overflow-hidden bg-white px-4"
    >
      <Halftone scene="warp" cell={10} className="absolute inset-0 -z-20 size-full" />
      {/* Clearings in the streaks: in the middle, so the words read, and under the bar and above the stocks. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_46%_38%_at_50%_50%,#fff_0%,rgba(255,255,255,.9)_45%,transparent_100%)] max-sm:bg-[radial-gradient(ellipse_90%_42%_at_50%_50%,#fff_0%,rgba(255,255,255,.9)_55%,transparent_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,#fff_0,rgba(255,255,255,0)_140px,rgba(255,255,255,0)_calc(100%-120px),#fff_100%)]"
      />

      <div className="grid justify-items-center gap-9 pt-16 text-center">
        <h1
          id="landing-title"
          className="grid text-[clamp(46px,9vw,112px)] leading-[.94] font-semibold tracking-[-0.06em]"
        >
          <span className={`${rise} block [animation-delay:250ms]`}>Agents trade stocks.{" "}</span>
          <span className={`${rise} block pb-[.06em] text-blue [animation-delay:400ms]`}>You set the limits.</span>
        </h1>

        <div
          className={`${rise} flex w-full flex-col gap-2.5 [animation-delay:650ms] min-[440px]:w-auto min-[440px]:flex-row`}
        >
          <Link to="/welcome" className={buttonVariants({ size: "lg", className: "group" })}>
            Get started
            <Icon
              name="arrow-right"
              size={16}
              className="transition-transform duration-base ease-brand group-hover:translate-x-0.5"
            />
          </Link>
          <a href="#how" className={buttonVariants({ size: "lg", variant: "secondary" })}>How it works</a>
        </div>
      </div>
    </section>
  )
}
