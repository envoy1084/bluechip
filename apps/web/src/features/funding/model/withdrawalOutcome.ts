import { formatMoney } from "@bluechip/ui/lib/format"
import { usdcDollars } from "../../../lib/amounts.ts"

export interface WithdrawalOutcomeText {
  readonly tone: "pending" | "success" | "failure"
  readonly title: string
  readonly description: string
}

/**
 * A sent withdrawal's end state in words: on its way while Base takes it, sent once confirmed, or that it didn't go
 * and the cash stayed. `to` is the address as shown (shortened).
 */
export const withdrawalOutcome = (
  status: "pending" | "confirmed" | "failed",
  amount: bigint,
  to: string
): WithdrawalOutcomeText => {
  const money = formatMoney(usdcDollars(amount))

  if (status === "confirmed") {
    return { tone: "success", title: `${money} sent to ${to}`, description: "The USDC is at the address on Base." }
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
    title: `Sending ${money} to ${to}`,
    description: "Base confirms it in a couple of seconds."
  }
}
