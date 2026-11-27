import { buttonVariants } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { Link } from "@tanstack/react-router"
import { HeroStage } from "./HeroStage.tsx"

const LINES = ["Hire an agent.", "Set its limits.", "Let it trade."] as const

const PROMISES: ReadonlyArray<readonly [IllustrationName, string]> = [
  ["passkey", "Face ID, no seed phrase"],
  ["wallet", "Your cash, in your account"],
  ["paper-plane", "Withdraw anytime"]
]

const rise = "animate-[landing-rise_1000ms_var(--ease-brand)_both] motion-reduce:animate-none"

/**
 * The first screen: the promise in three short lines beside the warp, the line-halftone streaks bluechip shows when
 * a trade leaves, with an agent at work and a trade its limits stopped floating over it.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="landing-title"
      className="relative isolate overflow-hidden bg-[radial-gradient(ellipse_70%_60%_at_72%_40%,var(--color-blue-50),#fff_70%)] px-4 pt-24 pb-16 sm:px-6 sm:pt-28 lg:pb-24"
    >
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-6">
        <div className="grid justify-items-center gap-7 text-center lg:justify-items-start lg:text-left">
          <span
            className={`${rise} inline-flex items-center gap-2 rounded-full bg-white py-1 pr-3.5 pl-1 text-label font-medium text-g-700 shadow-e2 [animation-delay:150ms]`}
          >
            <span className="grid size-6 place-items-center rounded-full bg-blue-50">
              <Illustration name="rising-chip" size={18} aria-hidden />
            </span>
            Tokenized US stocks on Base
          </span>

          <h1
            id="landing-title"
            className="grid text-[clamp(44px,7.4vw,84px)] leading-[.98] font-semibold tracking-[-0.055em]"
          >
            {LINES.map((line, index) => (
              <span
                key={line}
                className={`${rise} block pb-[.05em] ${index === 2 ? "text-blue" : ""}`}
                style={{ animationDelay: `${300 + index * 130}ms` }}
              >
                {line}
                {" "}
              </span>
            ))}
          </h1>

          <p
            className={`${rise} max-w-[40ch] text-[17px] leading-[1.55] text-pretty text-g-600 [animation-delay:760ms] sm:text-[19px]`}
          >
            AI agents trade Apple, Nvidia, Tesla and more for you, only inside the limits you lock with Face ID.
          </p>

          <div
            className={`${rise} flex w-full flex-col gap-2.5 [animation-delay:880ms] min-[440px]:w-auto min-[440px]:flex-row`}
          >
            <Link to="/welcome" className={buttonVariants({ size: "lg", className: "group" })}>
              Create an account
              <Icon
                name="arrow-right"
                size={16}
                className="transition-transform duration-base ease-brand group-hover:translate-x-0.5"
              />
            </Link>
            <Link to="/signin" className={buttonVariants({ size: "lg", variant: "secondary" })}>Sign in</Link>
          </div>

          <ul
            className={`${rise} flex flex-wrap justify-center gap-x-5 gap-y-2.5 text-label text-g-600 [animation-delay:1000ms] lg:justify-start`}
          >
            {PROMISES.map(([art, promise]) => (
              <li key={promise} className="inline-flex items-center gap-2">
                <Illustration name={art} size={20} aria-hidden />
                {promise}
              </li>
            ))}
          </ul>
        </div>

        <HeroStage />
      </div>
    </section>
  )
}
