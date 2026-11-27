import { Badge } from "@bluechip/ui/components/badge"
import { Icon } from "@bluechip/ui/icons/icon"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { Halftone } from "@bluechip/ui/motion/halftone"
import { BigTicker, Headline, Lede, Lockup, OgFrame } from "./frame.tsx"

const WASH = "bg-[radial-gradient(90%_120%_at_82%_45%,var(--color-blue-50)_0%,#fff_62%)]"

/** The landing's preview: the hero's promise, the stocks, and the rising chip turning in halftone. */
export function DefaultCard() {
  return (
    <OgFrame capture="og/default" className={WASH}>
      <Halftone
        scene="logo"
        cell={10}
        still
        interactive={false}
        className="absolute top-0 right-[-70px] h-full w-[540px]"
      />
      <div className="relative grid h-full w-[800px] content-between px-[72px] py-[60px]">
        <Lockup />
        <div className="grid gap-6">
          <Headline className="text-[72px]">
            Agents trade stocks.<br />
            <span className="text-blue">You set the limits.</span>
          </Headline>
          <Lede className="max-w-[600px]">
            AI agents trade tokenized US stocks on Base, inside limits you lock with Face ID.
          </Lede>
        </div>
        <div className="flex gap-3">
          {["NVDA", "AAPL", "MSFT", "TSLA", "AMZN"].map((symbol) => <BigTicker key={symbol} symbol={symbol} />)}
        </div>
      </div>
    </OgFrame>
  )
}

/** Paper money's preview: the same promise, marked as test money everywhere it's shared. */
export function PaperCard() {
  return (
    <OgFrame
      capture="og/paper"
      className="bg-[radial-gradient(90%_120%_at_82%_45%,var(--color-warn-wash)_0%,#fff_62%)]"
    >
      <div className="absolute top-[100px] right-[80px] grid size-[430px] place-items-center rounded-full bg-[radial-gradient(circle_at_50%_55%,var(--color-yellow-soft),var(--color-warn-wash)_58%,transparent_72%)]">
        <Illustration name="coins" variant="halftone" size={340} cell={7} />
      </div>
      <div className="relative grid h-full w-[720px] content-between px-[72px] py-[64px]">
        <div className="flex items-center gap-4">
          <Lockup />
          <Badge variant="warning" className="h-[38px] rounded-[10px] px-3.5 text-[21px]">Paper money</Badge>
        </div>
        <div className="grid gap-6">
          <Headline>
            Try bluechip<br />
            <span className="text-blue">with test money.</span>
          </Headline>
          <Lede className="max-w-[600px]">
            Agents, limits, automations and the assistant at live prices, with test USDC on Base Sepolia.
          </Lede>
        </div>
        <span className="inline-flex items-center gap-3 text-[22px] font-medium text-g-600">
          <Icon name="info" size={26} strokeWidth={1.8} className="text-warn" />
          Nothing here is worth real money
        </span>
      </div>
    </OgFrame>
  )
}

/** The legal pages' preview: plain words, signed off. */
export function LegalCard() {
  return (
    <OgFrame capture="og/legal" className="bg-[linear-gradient(180deg,var(--color-g-50),#fff)]">
      <div className="absolute top-[90px] right-[90px] grid size-[450px] place-items-center rounded-full bg-[radial-gradient(circle_at_50%_55%,var(--color-blue-100),var(--color-blue-50)_58%,transparent_72%)]">
        <Illustration name="certificate" variant="halftone" size={360} cell={7} />
      </div>
      <div className="relative grid h-full w-[700px] content-between px-[72px] py-[64px]">
        <Lockup />
        <div className="grid gap-6">
          <Headline>
            Terms, privacy<br />
            <span className="text-blue">and risk.</span>
          </Headline>
          <Lede className="max-w-[560px]">
            What bluechip does, what it keeps about you, and the risks of investing onchain, in plain words.
          </Lede>
        </div>
        <div className="flex gap-3">
          {["Terms of use", "Privacy policy", "Risk disclosure"].map((name) => (
            <span
              key={name}
              className="rounded-[12px] bg-white px-4 py-2 text-[21px] font-medium text-g-700 shadow-e2"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </OgFrame>
  )
}
