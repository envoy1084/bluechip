// "How was my day?" as one card, from what the turn already read: the portfolio's value and its move since the previous
// close, what each agent (and you) traded in the day before it was read, and the trades waiting for your Face ID.
import type { ActivityItem } from "@bluechip/domain/activity/Activity"
import type { AgentId } from "@bluechip/domain/Ids"
import type { Intent } from "@bluechip/domain/intents/Intent"
import type { Portfolio } from "@bluechip/domain/portfolio/Portfolio"
import { formatMoney } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { activityAt } from "../../../lib/activityText.ts"
import { usdcDollars } from "../../../lib/amounts.ts"

/** What one agent (or you, `null`) traded in the day. */
export interface BriefActor {
  readonly agentId: AgentId | null
  readonly bought: number
  readonly sold: number
  /** Spent on buys and got from sales, in USDC units. */
  readonly spent: bigint
  readonly got: bigint
  /** Trades that didn't go through. */
  readonly failed: number
}

export interface DailyBrief {
  readonly value: bigint
  readonly change: bigint
  /** The change against the value before it, in percent. */
  readonly changePercent: number
  /** In the order they first traded, newest first. */
  readonly actors: ReadonlyArray<BriefActor>
  /** Deposits and withdrawals in the day. */
  readonly transfers: number
  /** Trades waiting for your Face ID, once each. */
  readonly waiting: ReadonlyArray<Intent>
}

const DAY_MS = 24 * 60 * 60 * 1000
const ZERO = BigInt(0)

/** A day's move against the value before it, in percent: $40 on $1,000 now is 4.16%. 0 for an empty account. */
export const dayChangePercent = (value: bigint, change: bigint): number => {
  const before = value - change
  return before <= ZERO ? 0 : Number(change * BigInt(10_000) / before) / 100
}

/** The brief of `portfolio`, the `activity` of the day before it was read, and the trades `waiting` for you. */
export const dailyBrief = (
  portfolio: Portfolio,
  activity: ReadonlyArray<ActivityItem>,
  waiting: ReadonlyArray<Intent>
): DailyBrief => {
  const asOf = DateTime.toEpochMillis(portfolio.asOf)
  const today = activity.filter((item) => {
    const at = DateTime.toEpochMillis(activityAt(item))
    return at <= asOf && asOf - at < DAY_MS
  })

  const actors = new Map<AgentId | null, BriefActor>()
  for (const item of today) {
    if (item._tag !== "Trade") continue
    const { agentId, side, status, usdc } = item.trade
    const actor = actors.get(agentId) ?? { agentId, bought: 0, sold: 0, spent: ZERO, got: ZERO, failed: 0 }
    actors.set(
      agentId,
      status === "failed" ?
        { ...actor, failed: actor.failed + 1 } :
        side === "buy" ?
        { ...actor, bought: actor.bought + 1, spent: actor.spent + usdc } :
        { ...actor, sold: actor.sold + 1, got: actor.got + usdc }
    )
  }

  const forYou = waiting.filter((intent) => intent.status === "needsApproval" || intent.status === "awaitingSignature")

  return {
    value: portfolio.value,
    change: portfolio.change24h,
    changePercent: dayChangePercent(portfolio.value, portfolio.change24h),
    actors: [...actors.values()],
    transfers: today.filter((item) => item._tag === "Withdrawal").length,
    waiting: forYou.filter((intent, index) => forYou.findIndex((other) => other.id === intent.id) === index)
  }
}

/** Nothing traded, moved or waiting: the brief says it was a quiet day. */
export const isQuietDay = (brief: DailyBrief): boolean =>
  brief.actors.length === 0 && brief.transfers === 0 && brief.waiting.length === 0

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** What one actor did, after its name: "2 buys for $100.00 and 1 sale for $40.00", "1 trade didn't go through". */
export const actorLine = (actor: BriefActor): string => {
  const parts = [
    ...(actor.bought === 0
      ? []
      : [`${count(actor.bought, "buy", "buys")} for ${formatMoney(usdcDollars(actor.spent))}`]),
    ...(actor.sold === 0 ? [] : [`${count(actor.sold, "sale", "sales")} for ${formatMoney(usdcDollars(actor.got))}`]),
    ...(actor.failed === 0 ? [] : [`${count(actor.failed, "trade", "trades")} didn't go through`])
  ]
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`
}
