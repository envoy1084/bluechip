// An agent's card in the list at a glance: what it does in a word with its stocks, and the one thing worth knowing
// about it now: today's budget used, or what its state asks of you.
import type { Agent } from "@bluechip/domain/agents/Agent"
import { formatDollars } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import { dailyResetText } from "../../../lib/localTime.ts"
import type { ListedAgent } from "./agentList.ts"
import { dayLabel } from "./fieldText.ts"

/** How it trades, in a word or two before its stocks: "Buys and sells", "Rebalances"; `null` when it trades nothing. */
export const tradesWord = (agent: Pick<Agent, "spec">): string | null => {
  const config = configOf(agent.spec.policies, trade)
  if (config === undefined) return null
  switch (config.direction) {
    case "both":
      return "Buys and sells"
    case "buy":
      return "Buys"
    case "sell":
      return "Sells"
    case "rebalance":
      return "Rebalances"
  }
}

/** Today's budget used, as a bar with its words, or a line saying what the agent's state means now. */
export type Glance =
  | { readonly _tag: "budget"; readonly used: bigint; readonly limit: bigint; readonly text: string }
  | { readonly _tag: "line"; readonly text: string; readonly tone: "quiet" | "attention" }

const line = (text: string, tone: "quiet" | "attention" = "quiet"): Glance => ({ _tag: "line", text, tone })

const plural = (count: bigint | number, one: string, many: string) => `${count} ${Number(count) === 1 ? one : many}`

/** The one signal its card shows. */
export const glanceOf = ({ agent, state, usage, awaiting }: ListedAgent): Glance => {
  switch (state) {
    case "unlocked":
      return line("Lock its rules with Face ID to start it")
    case "sending":
      return line(
        agent.status === "locking" ?
          "Its rules are on their way to Base" :
          agent.status === "removing" ?
          "Its removal is on its way to Base" :
          "Its new rules are on their way to Base"
      )
    case "expired":
      return line(agent.lockedUntil === null ? "Its rules ran out" : `Ran out on ${dayLabel(agent.lockedUntil)}`)
    case "paused":
      return line("Won't trade until you resume it")
    case "needs-approval":
      return line(`${plural(awaiting, "trade waits", "trades wait")} for your approval`, "attention")
    case "stopped":
      return line(`Starts again at ${dailyResetText(new Date())}`)
    case "removed":
      return line("Removed for good")
    case "active":
      break
  }

  const budget = usage?.policies.find((counted) => counted.policy === "trade")
  if (budget !== undefined && budget.limit !== null && budget.limit > BigInt(0)) {
    return {
      _tag: "budget",
      used: budget.used,
      limit: budget.limit,
      text: `${formatDollars(budget.used)} of ${formatDollars(budget.limit)} today`
    }
  }

  const trades = usage?.policies.find((counted) => counted.policy === "tradesPerDay")
  if (trades !== undefined && trades.limit !== null) {
    return line(`${trades.used} of ${plural(trades.limit, "trade", "trades")} today`)
  }
  return line("Trading within its limits")
}
