import { FaucetLimitReached } from "@bluechip/domain/Errors"
import { Usdc } from "@bluechip/domain/market/Units"
import { DEFAULT_AMOUNT } from "@bluechip/domain/paper/Faucet"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatMoney } from "@bluechip/ui/lib/format"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { claimTestMoneyAtom, faucetAllowanceAtom } from "../atoms/faucet.ts"
import { usdcDollars } from "../lib/amounts.ts"
import { track } from "../lib/analytics.ts"
import { portfolioReactivityKey } from "../lib/api/client.ts"
import { yourTime } from "../lib/localTime.ts"
import { network } from "../lib/network.ts"

// Whole dollars without cents: "$1,000".
const formatUsd = (usdc: bigint) => formatMoney(usdcDollars(usdc)).replace(/\.00$/, "")

/** Whether this network's money is pretend, so the faucet exists: the local chain and paper money. */
export const hasTestMoney = network !== "base"

/**
 * "Get test money": $1,000 of test USDC a tap (less when less is left), with what's left of today's allowance under
 * it. Nothing on Base.
 */
export function TestMoney({ className }: Readonly<{ className?: string }>) {
  const allowance = useAtomValue(faucetAllowanceAtom)
  const claim = useAtomSet(claimTestMoneyAtom, { mode: "promise" })
  const [state, setState] = useState<"idle" | "adding" | "added" | "failed">("idle")
  if (!hasTestMoney) return null

  const left = AsyncResult.isSuccess(allowance) ? allowance.value : undefined
  const amount = left === undefined || left.remaining >= DEFAULT_AMOUNT ? DEFAULT_AMOUNT : Usdc.make(left.remaining)

  const add = () => {
    setState("adding")
    track({ _tag: "faucet_requested", usd: usdcDollars(amount) })
    claim({ payload: { amount }, reactivityKeys: [portfolioReactivityKey] }).then(
      () => setState("added"),
      (error: unknown) => setState(error instanceof FaucetLimitReached ? "idle" : "failed")
    )
  }

  const note = state === "failed" ?
    "The test money didn't arrive. Try again." :
    left === undefined ?
    "Test USDC only exists on this test network." :
    left.remaining === BigInt(0) ?
    `You've had today's ${formatUsd(left.limit)} of test money. More at ${
      yourTime(DateTime.toDateUtc(left.resetsAt))
    }.` :
    `${state === "added" ? `${formatUsd(amount)} is on its way. ` : ""}You can get ${
      formatUsd(left.remaining)
    } more today.`

  return (
    <div className={className}>
      <Button
        variant="secondary"
        size="sm"
        loading={state === "adding"}
        disabled={left?.remaining === BigInt(0)}
        onClick={add}
      >
        <Icon name="play" size={14} />Get {formatUsd(amount)} test money
      </Button>
      <p className="mt-1.5 text-caption text-g-500" aria-live="polite">{note}</p>
    </div>
  )
}
