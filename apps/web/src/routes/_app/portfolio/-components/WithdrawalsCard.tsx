import { shortAddress } from "@bluechip/ui/bluechip/address-chip"
import { formatDate, formatMoney } from "@bluechip/ui/lib/format"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { withdrawalsAtom } from "../../../../atoms/portfolio.ts"
import { usdcDollars } from "../../../../market/amounts.ts"

const STATUS_LABEL = { pending: "Sending", confirmed: "Sent", failed: "Failed" } as const

/** Your latest withdrawals and where each one stands. Nothing shows until there is one. */
export function WithdrawalsCard() {
  const withdrawals = useAtomValue(withdrawalsAtom)
  if (!AsyncResult.isSuccess(withdrawals) || withdrawals.value.items.length === 0) return null

  return (
    <section aria-labelledby="withdrawals-title" className="overflow-hidden rounded-lg bg-white shadow-e2">
      <h2 id="withdrawals-title" className="border-b border-g-100 px-4 py-[11px] text-body-sm font-semibold">
        Withdrawals
      </h2>
      <ul className="grid">
        {withdrawals.value.items.map((transfer) => (
          <li
            key={transfer.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-g-100 px-4 py-2.5 last:border-b-0"
          >
            <b className="text-body-sm font-[550] tabular-nums">
              {formatMoney(usdcDollars(transfer.amount))} to {shortAddress(transfer.to)}
            </b>
            <span
              className={transfer.status === "failed" ? "text-label-sm text-loss" : "text-label-sm text-g-500"}
            >
              {STATUS_LABEL[transfer.status]}
            </span>
            <span className="text-label-sm text-g-500">{formatDate(DateTime.toDateUtc(transfer.createdAt))}</span>
            {transfer.txHash === null ?
              null :
              (
                <a
                  href={`https://basescan.org/tx/${transfer.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-label-sm font-medium text-blue hover:underline"
                >
                  View on BaseScan
                </a>
              )}
          </li>
        ))}
      </ul>
    </section>
  )
}
