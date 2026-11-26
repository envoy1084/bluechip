// An agent's card in the list at a glance: what it does in a word with its stocks, and the one thing worth knowing
// about it now: today's budget used, or what its state asks of you.
import type { Agent } from "@bluechip/domain/agents/Agent"
import { compareSpecs } from "@bluechip/domain/policies/Catalog"
import { formatDollars } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import { dailyResetText } from "../../../lib/localTime.ts"
import type { ListedAgent } from "./agentList.ts"
import { dayLabel, DIRECTION_WORDS } from "./fieldText.ts"
import { limitOf } from "./usage.ts"

/** How it trades, in a word or two before its stocks: "Buys and sells", "Only buys"; `null` when it trades nothing. */
export const tradesWord = (agent: Pick<Agent, "spec">): string | null => {
  const config = configOf(agent.spec.policies, trade)
  return config === undefined ? null : DIRECTION_WORDS[config.direction]
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
          // A renewal locks the same policies again; anything else on its way is a change of them.
          agent.pendingSpec !== null && compareSpecs(agent.spec, agent.pendingSpec).policies.length === 0 ?
          "Its renewal is on its way to Base" :
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
  const tradeLimit = trades === undefined ? null : limitOf(trades)
  if (trades !== undefined && tradeLimit !== null) {
    return line(`${trades.used} of ${plural(tradeLimit, "trade", "trades")} today`)
  }
  return line("Trading within its limits")
}
