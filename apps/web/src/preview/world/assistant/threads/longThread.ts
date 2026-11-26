// "Planning my portfolio": a long conversation over days, so the thread scrolls and every stop shows: long answers
// with tables, a renewal and a removal for Face ID, a pause left as it was, an automation change and a memory
// forgotten, then turns that failed, were stopped, dropped, ran out of steps and ran out of budget.
import type { Card } from "@bluechip/domain/assistant/Card"
import type { CardId } from "@bluechip/domain/Ids"
import { agentFor, castAutomationDraft, makeCard, roundOf, STOPPED } from "../cards.ts"
import { agentControlCard, policyChangeCard } from "../cards/agentCards.ts"
import { automationCard } from "../cards/automationCards.ts"
import { agentOf, nameOf, priceOf } from "../castRecords.ts"
import { getQuote, listAgents, listMemories, searchHelp } from "../reads.ts"
import { failed, own, say, shows, type ThreadContext, type Turn } from "../rounds.ts"

const money = (dollars: number) => `$${Math.round(dollars).toLocaleString("en-US")}`

export const longThread = ({ mint, memories }: ThreadContext): ReadonlyArray<Turn> => {
  const { agents, automations, holdings } = mint.cast
  const expired = agentFor(mint, agents.find((agent) => agent.state === "expired") ?? null)
  const retired = agentFor(mint, agents.find((agent) => agent.state === "removed") ?? null)
  const failing = automations.find((automation) => automation.state === "failing") ?? automations[0]
  const stopped = (reason: keyof typeof STOPPED): Card => ({
    _tag: "Error",
    id: mint.id("card") as CardId,
    reason,
    message: STOPPED[reason]
  })

  const rows = holdings.map((holding) => {
    const value = holding.shares * Number(priceOf(holding.symbol)) / 1e8
    return { ...holding, value, gain: value - holding.shares * holding.costPerShare }
  })
  const total = rows.reduce((sum, row) => sum + row.value, 0) + mint.cast.cash
  const table = "| Stock | Shares | Value | Share of portfolio | Gain |\n| --- | ---: | ---: | ---: | ---: |\n" +
    rows.map((row) =>
      `| [[${row.symbol}]] | ${row.shares} | ${money(row.value)} | ${(row.value / total * 100).toFixed(1)}% | ` +
      `${row.gain >= 0 ? "+" : "-"}${money(Math.abs(row.gain))} |`
    ).join("\n") +
    `\n| Cash |  | ${money(mint.cast.cash)} | ${(mint.cast.cash / total * 100).toFixed(1)}% |  |`

  return [
    {
      you: "Help me plan my portfolio for next year. Where am I now?",
      rounds: [[listAgents(mint)], [
        say(
          `You're at about **${money(total)}** across ${rows.length} stocks and cash, run by ${agents.length} ` +
            `agents.\n\n${table}\n\nTwo things stand out:\n\n` +
            "1. **Nvidia is your biggest bet.** It's grown into the largest single holding, which is great while it " +
            "rises and painful if it falls.\n2. **Cash is healthy.** You're above the $5,000 you said you always " +
            "keep.\n\nWant me to sketch a target mix?"
        )
      ]]
    },
    {
      you: "What would 60% big tech, 20% Amazon and Alphabet, 20% cash look like?",
      rounds: [[
        say(
          "Here's that mix against today:\n\n| Group | Target | Now | Move |\n| --- | ---: | ---: | ---: |\n" +
            "| Apple, Microsoft, Nvidia, Meta | 60% | 66% | sell about $3,100 |\n" +
            "| Amazon, Alphabet | 20% | 15% | buy about $2,600 |\n| Cash | 20% | 19% | about the same |\n\n" +
            "A **Rebalancer** agent could hold you there, trading only when a stock drifts more than 5% off. Your " +
            "Index keeper already does this for four stocks, so the simplest step is to add Meta and Alphabet to it."
        )
      ]]
    },
    {
      you: `${expired.name} ran out. Can you renew it?`,
      rounds: [[
        shows(
          mint,
          "renewAgent",
          { agentId: expired.id },
          policyChangeCard(mint, expired, agentOf(mint, expired), "renew")
        ),
        say("Approve with Face ID and it runs for another 90 days with the same rules.")
      ]]
    },
    {
      you: `And remove ${retired.name}, I don't use it`,
      rounds: [[
        shows(
          mint,
          "removeAgent",
          { agentId: retired.id },
          policyChangeCard(mint, retired, agentOf(mint, retired), "remove")
        ),
        say("Removing it revokes its key onchain. Your stocks and cash stay in your account.")
      ]]
    },
    {
      you: "There's a scary headline about chip stocks. Pause everything?",
      rounds: [[
        say("I can. This pauses every agent until you resume them:"),
        shows(
          mint,
          "pauseAll",
          {},
          agentControlCard(mint, "pauseAll", agents.map((agent) => agentOf(mint, agent)), "dismissed")
        )
      ], [say("Left as it was. Your agents keep trading inside their rules.")]]
    },
    ...(failing === undefined ? [] : [{
      you: `"${failing.name}" keeps failing. Make it run on the 1st of the month instead`,
      rounds: [[
        shows(
          mint,
          "createAutomation",
          { automationId: failing.id },
          automationCard(mint, castAutomationDraft(mint, failing).draft, {
            status: "pending",
            automationId: failing.id
          })
        ),
        say("It failed because the agent's daily budget was used up by the time it ran. Earlier in the month helps.")
      ]]
    }]),
    {
      you: "What do you remember about me?",
      rounds: [[listMemories(mint, memories)], [
        say(
          `${memories.length} things. The ones I use most: you keep at least $5,000 in cash, you like short ` +
            "answers with a table, and you're aiming for $250,000 by 45. See and edit them all on the " +
            "[memory page](/memory)."
        )
      ]]
    },
    {
      you: "Forget that I only buy on Mondays, that's not true anymore",
      rounds: [roundOf(mint, makeCard(mint, "memoryForgotten", "applied", null))]
    },
    {
      you: "What's the difference between a stop-loss guard and a stop-loss automation?",
      rounds: [
        [searchHelp(mint, "stop-loss guard vs automation", [
          ["agents", "How agents work", "Stop-loss guard", "A Stop-loss guard only sells, to protect what you hold."],
          ["automations", "Automations", "Price moves", "A price move trigger fires when a stock falls from its high."]
        ])],
        [
          say(
            "They work together:\n\n- A **Stop-loss guard** is an agent: a key that may only *sell*, inside its " +
              "rules. On its own it does nothing.\n- A **stop-loss automation** is what tells it when: \"if Tesla " +
              "falls 10% from its high, sell half\".\n\nSo the guard is *who* may sell and the automation is *when*. " +
              "See [How agents work](/help/agents#stop-loss-guard) and [Automations](/help/automations#price-moves)."
          )
        ]
      ]
    },
    {
      you: "Compare my agents this month",
      rounds: [[listAgents(mint), own(stopped("unavailable")), failed(STOPPED.unavailable)]]
    },
    {
      you: "Try again",
      rounds: [[listAgents(mint)], [
        say(
          "| Agent | Trades | Result |\n| --- | ---: | ---: |\n| Tech picker | 14 | +$412 |\n" +
            "| Weekly buyer | 4 | +$38 |\n| Index keeper | 9 | +$120 |\n| Tesla guard | 1 | -$64 |\n\n" +
            "Tech picker did best, mostly from Nvidia's run in the first week."
        )
      ]]
    },
    {
      you: "Walk me through every trade Tech picker made",
      rounds: [[
        say("Sure. On the 3rd it bought **$100 of Nvidia** at $171.20, then on the 5th it"),
        own(stopped("cancelled"))
      ]]
    },
    {
      you: "Just the summary then",
      rounds: [[
        say("In short: 14 trades, 11 buys and 3 sells, and most of the gain came from"),
        own(stopped("interrupted"))
      ]]
    },
    {
      you: "Check every automation, every agent and every price, then tell me what to change",
      rounds: [
        [listAgents(mint), getQuote(mint, "NVDA", 100), getQuote(mint, "AAPL", 100)],
        [getQuote(mint, "TSLA", 100), getQuote(mint, "META", 100), own(stopped("rounds"))]
      ]
    },
    {
      you: `Can you look at ${nameOf("AMZN")} too?`,
      rounds: [[own(stopped("budget"))]]
    },
    {
      you: "Thanks, that's all for today",
      rounds: [[say("Any time. Your agents keep to their rules while you're away.")]]
    }
  ]
}
