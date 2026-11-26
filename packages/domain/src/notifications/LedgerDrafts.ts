/**
 * Balances that moved outside bluechip, in words: what reconciliation found that no trade, deposit or withdrawal
 * explains.
 *
 * @since 0.0.0
 */
import type { AdjustmentReason } from "../ledger/Reconcile.ts"
import { formatShareCount } from "../policies/Format.ts"
import type { NotificationDraft } from "./Notification.ts"

const centsFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

/**
 * A balance that changed outside bluechip: a stock that arrived or left (added to your ledger at the market price,
 * flagged), or cash nothing explains. `name` is the stock's name; an opening balance tells nothing.
 *
 * **Example** (A share of Microsoft sent to the account from a wallet)
 *
 * ```ts import.meta.vitest
 * import { notificationOfAdjustment } from "@bluechip/domain/notifications/LedgerDrafts"
 *
 * notificationOfAdjustment({ id: "adjustment_01", asset: "MSFT", amount: 100_000_000n, reason: "transferIn" }, "Microsoft")
 *   ?.title
 * // => "1 share of Microsoft arrived from outside bluechip"
 * ```
 *
 * @stability unstable
 * @category drafts
 * @since 0.0.0
 */
export const notificationOfAdjustment = (
  adjustment: {
    readonly id: string
    readonly asset: string
    readonly amount: bigint
    readonly reason: AdjustmentReason
  },
  name: string
): NotificationDraft | undefined => {
  if (adjustment.reason === "opening") return undefined

  const size = adjustment.amount < BigInt(0) ? -adjustment.amount : adjustment.amount
  const base = {
    kind: "balanceUnexplained" as const,
    link: "/portfolio",
    subjectType: "adjustment",
    subjectId: adjustment.id,
    dedupeKey: `balanceUnexplained:${adjustment.id}`
  }

  if (adjustment.reason === "unexplained") {
    const cash = `${centsFormat.format(Number(size) / 1e6)} of USDC`
    return {
      ...base,
      title: adjustment.amount > BigInt(0) ? `${cash} appeared in your account` : `${cash} left your account`,
      body: "No trade, deposit or withdrawal of yours explains it. If you didn't do this, pause your agents and " +
        "check your passkeys in Security."
    }
  }

  const shares = `${formatShareCount(Number(size) / 1e8)} of ${name}`
  return {
    ...base,
    title: adjustment.reason === "transferIn" ?
      `${shares} arrived from outside bluechip` :
      `${shares} left your account outside bluechip`,
    body: "Your ledger counts it at the market price, marked as found outside bluechip. If you didn't do this, " +
      "pause your agents and check your passkeys in Security."
  }
}
