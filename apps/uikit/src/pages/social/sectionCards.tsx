import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { LogoMark } from "@bluechip/ui/bluechip/logo"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"
import { Headline, Kicker, Lede, Lockup, OgFrame } from "./frame.tsx"

/** A surface floating on the card, as the landing's demos. */
function Panel({ className, children }: Readonly<{ className?: string; children: ReactNode }>) {
  return <div className={cn("rounded-[28px] bg-white shadow-e4", className)}>{children}</div>
}

/** A text column: kicker, headline, lede, and the lockup at its foot. */
function Copy(
  { kicker, icon, title, lede }: Readonly<{ kicker: string; icon: IconName; title: ReactNode; lede: string }>
) {
  return (
    <div className="relative grid h-full w-[560px] content-between py-[64px] pl-[72px]">
      <Lockup size={36} />
      <div className="grid gap-5">
        <Kicker icon={icon}>{kicker}</Kicker>
        <Headline className="text-[64px]">{title}</Headline>
        <Lede className="text-[24px]">{lede}</Lede>
      </div>
    </div>
  )
}

const CAN = [
  "Trade only the stocks you pick",
  "Spend up to its budget for the day",
  "Ask you before its biggest trades"
]
const NEVER = ["Send money out of your account", "Change its own limits", "Trade far from Chainlink's price"]

/** Agents: hire one, and the rules it can never break. */
export function AgentsCard() {
  return (
    <OgFrame capture="og/agents" className="grid grid-cols-[430px_1fr]">
      <div className="relative grid place-items-center overflow-hidden bg-[linear-gradient(160deg,var(--color-blue-hi),var(--color-blue)_45%,var(--color-blue-deep))]">
        <div className="absolute top-[60px] left-1/2 size-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.22)_0%,rgba(255,255,255,.08)_45%,transparent_70%)]" />
        <div className="relative grid justify-items-center gap-7 text-center text-white">
          <AgentAvatar agentId="Index fund" size="xl" className="scale-[2.4] shadow-e4" />
          <div className="mt-14 grid gap-2">
            <span className="text-[58px] leading-none font-semibold tracking-[-0.05em]">Hire an agent.</span>
            <span className="text-[24px] text-white/80">It trades US stocks for you</span>
          </div>
        </div>
      </div>
      <div className="grid content-between px-[64px] py-[60px]">
        <Kicker icon="shield">The rules it can never break</Kicker>
        <div className="grid grid-cols-2 gap-10">
          <Rules title="It can" items={CAN} tone="can" />
          <Rules title="It can never" items={NEVER} tone="never" />
        </div>
        <div className="flex items-center justify-between border-t border-g-100 pt-7">
          <span className="inline-flex items-center gap-3 text-[22px] font-medium text-g-600">
            <Icon name="face-id" size={28} className="text-blue" />
            Locked with Face ID. Checked onchain.
          </span>
          <Lockup size={32} />
        </div>
      </div>
    </OgFrame>
  )
}

function Rules(
  { title, items, tone }: Readonly<{ title: string; items: ReadonlyArray<string>; tone: "can" | "never" }>
) {
  return (
    <div className="grid content-start gap-5">
      <span className="text-[22px] font-medium text-g-500">{title}</span>
      <ul className="grid gap-5">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3.5 text-[25px] leading-[1.25] font-medium tracking-[-0.015em]"
          >
            <span
              className={cn(
                "mt-0.5 grid size-9 shrink-0 place-items-center rounded-[10px]",
                tone === "can" ?
                  "bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]" :
                  "bg-loss-wash text-loss shadow-[inset_0_0_0_1px_var(--color-loss-line)]"
              )}
            >
              <Icon name={tone === "can" ? "check" : "close"} size={22} strokeWidth={2.2} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

const STEPS: ReadonlyArray<
  { readonly word: string; readonly art: IllustrationName; readonly tone: string; readonly text: ReactNode }
> = [
  {
    word: "When",
    art: "price-move",
    tone: "text-blue",
    text: (
      <>
        <TickerChip symbol="NVDA" className="rounded-[9px] px-2.5 pt-[7px] pb-[5px] text-[19px]" />{" "}
        falls 5% from its close
      </>
    )
  },
  { word: "If", art: "calendar", tone: "text-[#9a6a00]", text: "the market is open" },
  { word: "Then", art: "coins", tone: "text-gain", text: "buy $100 of Nvidia" }
]

/** Automations: a rule in three steps, and what it did. */
export function AutomationsCard() {
  return (
    <OgFrame capture="og/automations" className="bg-[linear-gradient(180deg,var(--color-g-50),#fff)]">
      <Copy
        kicker="Automations"
        icon="zap"
        title={
          <>
            Say when.<br />It does the rest.
          </>
        }
        lede="Schedules, price moves and news start trades inside your limits."
      />
      <Panel className="absolute top-[80px] right-[64px] grid w-[520px] gap-0 p-7">
        {STEPS.map((step, index) => (
          <div key={step.word} className="grid grid-cols-[64px_1fr] gap-5">
            <div className="grid justify-items-center">
              <span className="grid size-16 place-items-center rounded-[18px] bg-[linear-gradient(180deg,#fff,var(--color-g-50))] shadow-e2">
                <Illustration name={step.art} size={44} />
              </span>
              {index < STEPS.length - 1 && <span className="my-1.5 h-full min-h-6 w-0.5 rounded-full bg-g-200" />}
            </div>
            <div className="grid content-start gap-1.5 pt-1 pb-5">
              <span className={cn("text-[19px] font-semibold tracking-[.02em] uppercase", step.tone)}>
                {step.word}
              </span>
              <span className="inline-flex flex-wrap items-center gap-2 text-[25px] leading-[1.3] font-medium tracking-[-0.015em]">
                {step.text}
              </span>
            </div>
          </div>
        ))}
        <div className="flex justify-start border-t border-g-100 pt-5">
          <StatusPill tone="positive" icon="check" className="h-9 px-3.5 text-[19px] [&_svg]:size-5">
            Bought $100.00 of Nvidia
          </StatusPill>
        </div>
      </Panel>
    </OgFrame>
  )
}

/** The assistant: a request in plain words, its draft, and Telegram. */
export function AssistantCard() {
  return (
    <OgFrame
      capture="og/assistant"
      className="bg-[radial-gradient(90%_120%_at_80%_40%,var(--color-blue-50)_0%,#fff_65%)]"
    >
      <Copy
        kicker="Assistant"
        icon="chat"
        title="Say what you want, in plain words."
        lede="It drafts agents, automations and trades. Money moves only with Face ID."
      />
      <div className="absolute top-[70px] right-[64px] grid w-[520px] gap-5">
        <div className="justify-self-end rounded-[24px_24px_8px_24px] bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] px-6 py-4 text-[24px] leading-[1.3] font-medium text-white shadow-e3">
          Make me an agent that buys tech stocks, $200 a day at most
        </div>
        <Panel className="grid gap-4 rounded-[24px_24px_24px_8px] p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-blue-50 shadow-[inset_0_0_0_1px_var(--color-info-line)]">
              <LogoMark size={24} />
            </span>
            <b className="text-[22px] font-semibold">Here's a draft to review</b>
          </div>
          <div className="flex items-center gap-4 rounded-[18px] bg-g-50 p-4 shadow-[inset_0_0_0_1px_var(--color-g-100)]">
            <AgentAvatar agentId="Tech picker" size="lg" />
            <div className="grid gap-1.5">
              <b className="text-[23px] font-semibold tracking-[-0.02em]">Tech picker</b>
              <span className="flex gap-1.5">
                {["NVDA", "AAPL", "MSFT", "META"].map((symbol) => <TickerChip key={symbol} symbol={symbol} />)}
              </span>
            </div>
          </div>
          <StatusPill
            tone="pending"
            icon="face-id"
            className="h-9 justify-self-start px-3.5 text-[19px] [&_svg]:size-5"
          >
            Lock its limits with Face ID
          </StatusPill>
        </Panel>
        <div className="flex items-center gap-3 justify-self-start rounded-[18px] bg-[#eef3f8] px-5 py-3.5 text-[20px] font-medium text-g-700 shadow-e2">
          <Icon name="send" size={24} className="text-[#229ed9]" />
          Also in Telegram
        </div>
      </div>
    </OgFrame>
  )
}

const GUARANTEES: ReadonlyArray<
  { readonly art: IllustrationName; readonly title: string; readonly text: string }
> = [
  { art: "passkey", title: "Only your Face ID moves money", text: "No password, no seed phrase" },
  { art: "fence", title: "Limits hold onchain", text: "Base refuses a trade past them" },
  { art: "scales", title: "Fair prices, from Chainlink", text: "Every trade is checked against them" },
  { art: "hourglass", title: "Recovery waits 48 hours", text: "Cancel it from any device or Telegram" },
  { art: "emergency-stop", title: "Pause every agent in one tap", text: "Your cash is USDC you can send anywhere" }
]

/** Safety: the guarantees, each one something the app or the chain does today. */
export function SafetyCard() {
  return (
    <OgFrame capture="og/safety" className="bg-[linear-gradient(180deg,var(--color-g-50),#fff)]">
      <Copy
        kicker="Safety"
        icon="shield"
        title="Your account answers only to you."
        lede="Agents trade inside limits only your Face ID can change."
      />
      <Panel className="absolute top-[56px] right-[64px] grid w-[540px] px-7 py-3">
        {GUARANTEES.map((guarantee, index) => (
          <div
            key={guarantee.title}
            className={cn("flex items-center gap-5 py-[15px]", index > 0 && "border-t border-g-100")}
          >
            <span className="grid size-[60px] shrink-0 place-items-center rounded-[16px] bg-[linear-gradient(180deg,#fff,var(--color-blue-50))] shadow-[inset_0_0_0_1px_var(--color-info-line)]">
              <Illustration name={guarantee.art} size={40} />
            </span>
            <div className="grid gap-0.5">
              <b className="text-[23px] leading-tight font-semibold tracking-[-0.02em]">{guarantee.title}</b>
              <span className="text-[19px] text-g-500">{guarantee.text}</span>
            </div>
          </div>
        ))}
      </Panel>
    </OgFrame>
  )
}
