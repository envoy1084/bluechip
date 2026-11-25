import type { Trade } from "@bluechip/domain/trading/Trade"
import { TransactionStatus } from "@bluechip/ui/bluechip/transaction-status"
import { Button } from "@bluechip/ui/components/button"
import { formatMoney, formatShares } from "@bluechip/ui/lib/format"
import { shareCount, usdcDollars } from "../../../../lib/amounts.ts"

/** Where a sent trade is, then what it did, with the way to the next one. */
export function TradeProgress(
  { trade, name, onDone }: Readonly<{ trade: Trade; name: string; onDone: () => void }>
) {
  const buying = trade.side === "buy"
  const state = trade.status === "sending" ? "sending" : trade.status

  return (
    <div className="grid gap-3.5">
      <TransactionStatus
        state={state}
        orientation="vertical"
        failureReason={`Base didn't take it. ${
          buying ? "Nothing was bought" : "Nothing was sold"
        }; your money is where it was.`}
      />

      {trade.status === "filled" && (
        <p className="text-body-sm text-g-600">
          {buying ? "Bought" : "Sold"} {formatShares(shareCount(trade.shares))} shares of {name} for{" "}
          {formatMoney(usdcDollars(trade.usdc))}.
        </p>
      )}

      {trade.txHash !== null && (
        <a
          href={`https://basescan.org/tx/${trade.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="text-label-sm font-medium text-blue hover:underline"
        >
          View on BaseScan
        </a>
      )}

      {(trade.status === "filled" || trade.status === "failed") && (
        <Button variant="secondary" size="lg" onClick={onDone}>
          {trade.status === "failed" ? "Try again" : buying ? "Bought. Buy more" : "Sold. Trade again"}
        </Button>
      )}
    </div>
  )
}
