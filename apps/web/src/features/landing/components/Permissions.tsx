import { VISIBLE_POLICIES } from "@bluechip/domain/policies/SpecEdits"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { Reveal } from "./Reveal.tsx"
import { SectionIntro } from "./SectionIntro.tsx"
import { TradeCheckDemo } from "./TradeCheckDemo.tsx"

const POLICY_ICON: Readonly<Record<(typeof VISIBLE_POLICIES)[number]["id"], IconName>> = {
  trade: "stocks",
  tradeSize: "coins",
  fairPrice: "scales",
  stockCap: "pie",
  cashReserve: "cash",
  rebalance: "refresh",
  stopLossFloor: "chart-down",
  slippageBudget: "chart-line",
  tradesPerDay: "calendar",
  // Hidden from the catalog people see, so never listed here.
  gasBudget: "zap",
  anyCall: "grid"
}

/**
 * The permissions story: an agent is a key that carries its limits onchain. The policy catalog on one side, written
 * from the same catalog the app edits, and the limits at work on the other.
 */
export function Permissions() {
  return (
    <section
      id="limits"
      aria-labelledby="landing-limits"
      className="relative scroll-mt-20 overflow-hidden bg-[linear-gradient(180deg,var(--color-blue-50),#fff_70%)] px-4 py-24 sm:px-6 sm:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(42,91,255,.12)_1px,transparent_1.2px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_70%_60%_at_70%_30%,#000,transparent)]"
      />
      <div className="relative mx-auto grid max-w-[1200px] items-start gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-16">
        <div className="grid gap-10">
          <SectionIntro
            kicker="Limits it can't break"
            title={<span id="landing-limits">You set the rules. Base enforces them.</span>}
          >
            An agent is a key on your account that carries its limits. Base checks every trade it sends against them, so
            nothing bluechip runs can make it go past them. Changing them takes your Face ID.
          </SectionIntro>

          <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {VISIBLE_POLICIES.map((policy, index) => (
              <Reveal as="li" key={policy.id} delay={index * 60} className="grid grid-cols-[36px_1fr] gap-3">
                <span className="grid size-9 place-items-center rounded-[10px] bg-white text-blue shadow-e2">
                  <Icon name={POLICY_ICON[policy.id]} size={17} />
                </span>
                <span className="grid content-start gap-0.5">
                  <b className="text-body-sm font-semibold">{policy.title}</b>
                  <span className="text-label text-g-600">{policy.summary}</span>
                </span>
              </Reveal>
            ))}
          </ul>

          <Reveal className="flex items-start gap-3 rounded-lg bg-white p-4 shadow-e2">
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] surface-primary">
              <Icon name="lock" size={17} />
            </span>
            <p className="self-center text-body-sm text-g-700">
              <b className="font-semibold text-ink">Whatever its limits, an agent can never</b>{" "}
              send money out of your account or change its own limits.
            </p>
          </Reveal>
        </div>

        <Reveal delay={150} className="lg:sticky lg:top-24">
          <TradeCheckDemo />
        </Reveal>
      </div>
    </section>
  )
}
