import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatMoney } from "@bluechip/ui/lib/format"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { cashDialogAtom } from "../../../../funding/cashDialog.ts"
import { usdcDollars } from "../../../../lib/amounts.ts"

/** Cash ready to invest, with the ways to add more or take it out. */
export function CashCard({ cash }: Readonly<{ cash: bigint }>) {
  const openCash = useAtomSet(cashDialogAtom)

  return (
    <section className="grid content-start gap-3 rounded-lg bg-white px-5 py-[18px] shadow-e2">
      <div className="flex items-center justify-between gap-2.5">
        <b className="text-[14.5px] font-semibold tracking-[-0.01em]">Cash</b>
        <TickerChip symbol="USDC" size="sm" />
      </div>
      <b className="text-[26px] font-semibold tracking-[-0.035em] tabular-nums">{formatMoney(usdcDollars(cash))}</b>
      <p className="text-label text-g-600">USDC on Base, ready to invest or withdraw.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => openCash("add")}>
          <Icon name="plus" size={14} />Add cash
        </Button>
        <Button variant="ghost" size="sm" disabled={cash === BigInt(0)} onClick={() => openCash("withdraw")}>
          <Icon name="face-id" size={14} />Withdraw
        </Button>
      </div>
    </section>
  )
}
