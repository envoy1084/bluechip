// What an agent has used of its limits today, in words: which limits show, how each stands, and how much room is
// left before its onchain counts start again at midnight UTC.
import type { AgentUsage, PolicyUsage } from "@bluechip/domain/agents/Agent"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { formatDollars, listNames } from "@bluechip/domain/policies/Format"

/** How a limit stands: room left, from 80% nearly used, used up, or open when it has no limit. */
export type Standing = "room" | "nearly" | "used" | "open"

const DAY = 86_400_000

/** The limits the Usage page shows: none bluechip keeps to itself (gas), nor a sell-only agent's daily budget of $0. */
export const shownLimits = (usage: AgentUsage): ReadonlyArray<PolicyUsage> =>
  usage.policies.filter((counted) =>
    !policyOf(counted.policy).hidden && !(counted.policy === "trade" && counted.limit === BigInt(0))
  )

/** How much of a limit is used, as a standing. */
export const standingOf = (counted: Pick<PolicyUsage, "used" | "limit">): Standing => {
  if (counted.limit === null || counted.limit === BigInt(0)) return "open"
  if (counted.used >= counted.limit) return "used"
  return counted.used * BigInt(5) >= counted.limit * BigInt(4) ? "nearly" : "room"
}

/** The next midnight UTC, when the daily counts start again. */
export const nextReset = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))

/** How much of the UTC day has gone, 0 to 1. */
export const dayGone = (now: Date): number => (now.getTime() % DAY) / DAY

/** The time left until the next reset, as a clock that ticks: "5:42:13", "0:00:09". */
export const countdown = (now: Date): string => {
  const seconds = Math.ceil((nextReset(now).getTime() - now.getTime()) / 1000)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${Math.floor(seconds / 3600)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`
}

/** Today in a headline and a sentence: how it stands across its daily limits, and how much of each is left. */
export interface TodayRoom {
  readonly standing: Standing
  readonly headline: string
  readonly detail: string
}

const STANDINGS: ReadonlyArray<Standing> = ["open", "room", "nearly", "used"]

const tradesText = (count: bigint) => `${count} ${count === BigInt(1) ? "trade" : "trades"}`

/** How much room `name` has left today under its daily budget and its trades per day. */
export const todayRoom = (usage: AgentUsage, name: string, now: Date): TodayRoom => {
  const shown = shownLimits(usage)
  const budget = shown.find((counted) => counted.policy === "trade" && counted.limit !== null)
  const trades = shown.find((counted) => counted.policy === "tradesPerDay" && counted.limit !== null)
  const daily = [budget, trades].filter((counted) => counted !== undefined)
  const standing = daily.map(standingOf).reduce<Standing>(
    (worst, next) => STANDINGS.indexOf(next) > STANDINGS.indexOf(worst) ? next : worst,
    "open"
  )

  if (budget === undefined && trades === undefined) {
    return {
      standing,
      headline: "No daily limits",
      detail: `Nothing caps what ${name} spends or how many trades it makes in a day.`
    }
  }

  if (standing === "used") {
    const spent = budget !== undefined && standingOf(budget) === "used"
    return {
      standing,
      headline: "Done for today",
      detail: spent ?
        `${name} used all of today's ${formatDollars(budget.limit!)} budget, so it waits for midnight UTC.` :
        `${name} made all ${tradesText(trades!.limit!)} it may today, so it waits for midnight UTC.`
    }
  }

  const left = (counted: PolicyUsage) => counted.limit! > counted.used ? counted.limit! - counted.used : BigInt(0)
  const done = listNames([
    ...(budget === undefined
      ? []
      : [`spent ${formatDollars(budget.used)} of its ${formatDollars(budget.limit!)} budget`]),
    ...(trades === undefined ? [] : [`made ${trades.used} of its ${tradesText(trades.limit!)}`])
  ])
  return {
    standing,
    headline: budget === undefined ?
      `${tradesText(left(trades!))} left today` :
      `${formatDollars(left(budget))} left to spend today`,
    detail: `${name} has ${done}, with ${Math.round(dayGone(now) * 100)}% of the day gone.`
  }
}
