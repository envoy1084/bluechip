import { Group } from "../agents/layout.tsx"
import { HoldingSection, PortfolioSection, ReceiptSection, StatSection } from "./summaries.tsx"

export function KitTrading() {
  return (
    <div className="mx-auto grid max-w-5xl px-4 pt-12 pb-24 md:px-10">
      <div className="grid gap-3">
        <span className="text-label font-medium text-blue">bluechip</span>
        <h1 className="text-display-3 font-semibold">Portfolio & trading</h1>
        <p className="max-w-[64ch] text-body-lg text-g-600">
          What you own and how it moves: the portfolio at a glance, one holding up close, a kept trade, and the empty
          and loading states around them. Every amount is an example.
        </p>
      </div>
      <Group n="01" title="Your money">
        <PortfolioSection />
        <HoldingSection />
        <ReceiptSection />
      </Group>
      <Group n="02" title="Building blocks">
        <StatSection />
      </Group>
    </div>
  )
}
