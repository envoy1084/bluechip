import { formatMoney } from "@bluechip/ui/lib/format"
import { usdcDollars } from "../../../lib/amounts.ts"

export interface WithdrawalOutcomeText {
  readonly tone: "pending" | "success" | "failure"
  readonly title: string
  readonly description: string
}

/**
 * A sent withdrawal's end state in words: on its way while Base takes it, sent once confirmed, or that it didn't go
 * and the cash stayed. `to` is the whole address, said under the title, where it has room to wrap.
 */
export const withdrawalOutcome = (
  status: "pending" | "confirmed" | "failed",
  amount: bigint,
  to: string
): WithdrawalOutcomeText => {
  const money = formatMoney(usdcDollars(amount))

  if (status === "confirmed") {
    return { tone: "success", title: `${money} sent`, description: `The USDC is at ${to} on Base.` }
  }
  if (status === "failed") {
    return {
      tone: "failure",
      title: "Your withdrawal didn't go through",
      description: "Base didn't take it. Your cash is still in your account."
    }
  }
  return {
    tone: "pending",
    title: `Sending ${money}`,
    description: `To ${to}. Base confirms it in a couple of seconds.`
  }
}
