import { buttonVariants } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { TICKERS } from "@bluechip/ui/lib/tickers"
import { WarpField, type WarpFieldControls } from "@bluechip/ui/motion/warp-field"
import { Link } from "@tanstack/react-router"
import { type PointerEvent, useRef } from "react"
import { HeroCards } from "./HeroCards.tsx"

const SYMBOLS = TICKERS.map((ticker) => ticker.symbol)

const LINES = [
  { text: "Your money.", className: "" },
  { text: "Your agents.", className: "" },
  {
    text: "Your limits.",
    className:
      "bg-[linear-gradient(100deg,var(--color-blue-deep),var(--color-blue)_45%,var(--color-cerulean))] bg-clip-text text-transparent"
  }
] as const

const PROMISES = ["No password or seed phrase", "Cash in USDC on Base", "Withdraw anytime"] as const

/**
 * The first screen: the warp launches and settles into the headline, the example cards arrive out of it, and the
 * field leans toward the pointer. Reaching for Create an account surges it.
 */
export function Hero() {
  const warp = useRef<WarpFieldControls>(null)
  const stage = useRef<HTMLElement>(null)

  // The cards drift against the pointer, a layer nearer than the streaks. Written to CSS variables, not state.
  const lean = (event: PointerEvent<HTMLElement>) => {
    const element = stage.current
    if (!element || event.pointerType !== "mouse") return
    const rect = element.getBoundingClientRect()
    element.style.setProperty("--lean-x", (((event.clientX - rect.left) / rect.width) * 2 - 1).toFixed(3))
    element.style.setProperty("--lean-y", (((event.clientY - rect.top) / rect.height) * 2 - 1).toFixed(3))
  }

  return (
    <section
      ref={stage}
      aria-labelledby="landing-title"
      onPointerMove={lean}
      className="relative isolate flex min-h-[max(640px,min(100svh,940px))] items-center overflow-hidden bg-[radial-gradient(ellipse_80%_60%_at_50%_46%,#fff_0%,var(--color-blue-50)_100%)] pt-24 pb-16 sm:pt-28"
    >
      <WarpField ref={warp} symbols={SYMBOLS} className="-z-20" />
      {/* A soft clearing behind the words, so they read over the streaks. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_38%_34%_at_50%_47%,rgba(255,255,255,.96)_0%,rgba(255,255,255,.7)_55%,transparent_100%)] max-sm:bg-[radial-gradient(ellipse_75%_40%_at_50%_47%,rgba(255,255,255,.96)_0%,rgba(255,255,255,.75)_60%,transparent_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-[linear-gradient(180deg,transparent,#fff)]"
      />

      <HeroCards />

      <div className="mx-auto grid w-full max-w-[760px] justify-items-center gap-6 px-4 text-center">
        <span className="inline-flex animate-[landing-rise_900ms_var(--ease-brand)_both] items-center gap-2 rounded-full bg-white/85 py-1 pr-3 pl-1.5 text-label font-medium max-sm:text-label-sm text-g-700 shadow-e2 backdrop-blur [animation-delay:200ms] motion-reduce:animate-none">
          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-caption font-semibold text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]">
            On Base
          </span>
          Tokenized US stocks, traded by your agents
        </span>

        <h1
          id="landing-title"
          className="grid text-[clamp(46px,12vw,96px)] leading-[.95] font-semibold tracking-[-0.058em]"
        >
          {LINES.map((line, index) => (
            <span
              key={line.text}
              className="block animate-[landing-rise_1100ms_var(--ease-brand)_both] pb-[.06em] motion-reduce:animate-none"
              style={{ animationDelay: `${420 + index * 140}ms` }}
            >
              <span className={line.className}>{line.text}</span>
              {" "}
            </span>
          ))}
        </h1>

        <p className="max-w-[54ch] animate-[landing-rise_1000ms_var(--ease-brand)_both] text-[17px] leading-[1.55] text-pretty text-g-600 [animation-delay:900ms] motion-reduce:animate-none sm:text-[18px]">
          Hire AI agents to trade Apple, Nvidia, Tesla and more for you. You lock what each one may do with Face ID, and
          Base checks every trade against it. Not even bluechip can go past your limits.
        </p>

        <div className="flex w-full animate-[landing-rise_1000ms_var(--ease-brand)_both] flex-col justify-center gap-2.5 [animation-delay:1050ms] motion-reduce:animate-none min-[440px]:w-auto min-[440px]:flex-row">
          <Link
            to="/welcome"
            className={buttonVariants({ size: "lg", className: "group" })}
            onPointerEnter={() => warp.current?.surge()}
            onFocus={() => warp.current?.surge()}
          >
            Create an account
            <Icon
              name="arrow-right"
              size={16}
              className="transition-transform duration-base ease-brand group-hover:translate-x-0.5"
            />
          </Link>
          <Link to="/signin" className={buttonVariants({ size: "lg", variant: "secondary" })}>
            <Icon name="face-id" size={18} />Sign in
          </Link>
        </div>

        <ul className="flex animate-[landing-rise_1000ms_var(--ease-brand)_both] flex-wrap justify-center gap-x-5 gap-y-2 text-label text-g-600 [animation-delay:1200ms] motion-reduce:animate-none">
          {PROMISES.map((promise) => (
            <li key={promise} className="inline-flex items-center gap-1.5">
              <Icon name="check" size={14} className="text-gain" />
              {promise}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
