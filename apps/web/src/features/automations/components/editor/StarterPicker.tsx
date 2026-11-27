import { RadioCard, RadioGroup } from "@bluechip/ui/components/radio-group"
import { Icon } from "@bluechip/ui/icons/icon"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { useId } from "react"
import type { Starter, StarterId } from "../../model/starters.ts"

const ILLUSTRATIONS: Readonly<Record<StarterId, IllustrationName>> = {
  weeklyBuy: "calendar",
  buyTheDip: "seedling",
  stopLoss: "stop-sign",
  takeProfit: "rising-chip",
  priceAlert: "bell",
  badNews: "magnifier"
}

/**
 * Ideas to start from, each with its picture and what it does: picking one fills in the three steps, which stay
 * yours to change. The one the steps still follow is marked.
 */
export function StarterPicker(
  { value, starters, onPick }: Readonly<{
    value: StarterId | null
    starters: ReadonlyArray<Starter>
    onPick: (id: StarterId) => void
  }>
) {
  const id = useId()
  if (starters.length === 0) return null

  return (
    <section aria-labelledby={id} className="grid gap-3.5 rounded-lg bg-white p-[18px] shadow-e2">
      <div className="grid gap-0.5">
        <h2 id={id} className="text-[16px] font-semibold tracking-[-0.01em]">Start from an idea</h2>
        <p className="text-label text-g-500">It fills in the steps below, and you can change anything after.</p>
      </div>
      <div className="@container">
        <RadioGroup
          aria-labelledby={id}
          value={value}
          onValueChange={(picked) => typeof picked === "string" && onPick(picked as StarterId)}
          className="grid grid-cols-2 gap-2 @xl:grid-cols-3"
        >
          {starters.map((starter) => (
            <RadioCard
              key={starter.id}
              value={starter.id}
              className="relative min-w-0 flex-col gap-2.5 p-3 [&>span:last-child]:hidden"
            >
              <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[linear-gradient(180deg,#f7f8fa,#eef0f3)] shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)] group-data-checked/radio-card:bg-[linear-gradient(180deg,#eef1ff,#e3e8ff)]"
              >
                <Illustration name={ILLUSTRATIONS[starter.id]} size={28} label="" />
              </span>
              <span className="grid min-w-0 gap-0.5 pr-4">
                <b className="text-body-sm font-semibold text-ink">{starter.title}</b>
                <span className="text-label-sm leading-snug text-g-500">{starter.summary}</span>
              </span>
              <Icon
                name="check-circle"
                size={16}
                className="absolute top-2.5 right-2.5 text-blue opacity-0 transition-opacity duration-fast ease-brand group-data-checked/radio-card:opacity-100"
              />
            </RadioCard>
          ))}
        </RadioGroup>
      </div>
    </section>
  )
}
