import type { Transfer } from "@bluechip/domain/portfolio/Transfer"
import { shortAddress } from "@bluechip/ui/bluechip/address-chip"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { toast } from "@bluechip/ui/components/toast"
import { CopyIcon } from "@bluechip/ui/icons/copy-icon"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { formatDate, formatMoney } from "@bluechip/ui/lib/format"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useEffect, useState } from "react"
import { withdrawalsAtom } from "../../../atoms/portfolio.ts"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { transferStatus } from "../../../lib/activityText.ts"
import { usdcDollars } from "../../../lib/amounts.ts"

const SHOWN = 3

/** Your latest withdrawals, newest first: the last few, the rest a tap away, each with where it stands. */
export function WithdrawalList() {
  const withdrawals = useAtomValue(withdrawalsAtom)
  const refresh = useAtomRefresh(withdrawalsAtom)
  const [expanded, setExpanded] = useState(false)

  const items = AsyncResult.isSuccess(withdrawals) ? withdrawals.value.items : []
  const shown = expanded ? items : items.slice(0, SHOWN)

  return (
    <section aria-labelledby="withdrawals-title" className="grid border-t border-g-100 pb-2">
      <div className="flex items-center justify-between gap-2 px-5 pt-3.5 pb-1">
        <h3 id="withdrawals-title" className="text-label font-semibold">Withdrawals</h3>
        {items.length > SHOWN && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
            className="cursor-pointer rounded-xs text-label-sm font-medium text-blue hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
          >
            {expanded ? "Show fewer" : `Show all ${items.length}`}
          </button>
        )}
      </div>

      {AsyncResult.isInitial(withdrawals) && (
        <div aria-busy className="grid gap-2 px-5 py-2">
          <SkeletonBlock className="h-9 w-full" />
        </div>
      )}

      {AsyncResult.isFailure(withdrawals) && <LoadProblem what="your withdrawals" onRetry={refresh} size="sm" />}

      {AsyncResult.isSuccess(withdrawals) && items.length === 0 && (
        <div className="mx-5 mt-1 mb-2 flex items-center gap-3 rounded-[12px] px-3.5 py-3 surface-well">
          <Icon name="upload" size={16} className="shrink-0 text-g-400" />
          <p className="text-label-sm text-g-600">
            No withdrawals yet. When you send cash out, each one shows here as it goes.
          </p>
        </div>
      )}

      {shown.length > 0 && (
        <ul className="grid">
          {shown.map((transfer) => <WithdrawalRow key={transfer.id} transfer={transfer} />)}
        </ul>
      )}
    </section>
  )
}

function WithdrawalRow({ transfer }: Readonly<{ transfer: Transfer }>) {
  const status = transferStatus(transfer)

  return (
    <li className="flex items-center gap-3 px-5 py-2">
      <span
        aria-hidden
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full",
          transfer.status === "failed" ? "bg-loss-wash text-loss" : "bg-g-50 text-g-600"
        )}
      >
        <Icon name="upload" size={15} />
      </span>

      <span className="grid min-w-0 flex-1">
        <b className="text-body-sm font-semibold tabular-nums">{formatMoney(usdcDollars(transfer.amount))}</b>
        <span className="flex min-w-0 items-center gap-1 text-label-sm text-g-500">
          <span className="truncate">
            {formatDate(DateTime.toDateUtc(transfer.createdAt), { time: false })}, to{" "}
            <span title={transfer.to} className="font-mono tracking-[-0.01em]">{shortAddress(transfer.to)}</span>
          </span>
          <CopyAddress address={transfer.to} />
        </span>
      </span>

      <StatusPill tone={status.tone}>{status.label}</StatusPill>
      {transfer.txHash === null ?
        <span aria-hidden className="size-7 shrink-0" /> :
        (
          <a
            href={`https://basescan.org/tx/${transfer.txHash}`}
            target="_blank"
            rel="noreferrer"
            aria-label="View on BaseScan"
            title="View on BaseScan"
            className="grid size-7 shrink-0 place-items-center rounded-full text-g-400 transition-colors duration-fast ease-brand hover:bg-g-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue"
          >
            <Icon name="external" size={14} />
          </a>
        )}
    </li>
  )
}

/** A quiet copy button for an address in a line of text; a check shows for a moment once it's copied. */
function CopyAddress({ address }: Readonly<{ address: string }>) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <button
      type="button"
      aria-label={copied ? "Address copied" : "Copy address"}
      onClick={() =>
        navigator.clipboard.writeText(address).then(
          () => setCopied(true),
          () => toast.error("Couldn't copy the address", { description: "Select it and copy it by hand." })
        )}
      className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-g-400 hover:bg-g-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-blue"
    >
      <CopyIcon copied={copied} size={12} />
    </button>
  )
}
