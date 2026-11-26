// "How am I doing?": the portfolio, prices, results for you, a stock, an agent and an automation, the week's trades
// and a daily brief, each answered from what a tool read, with tables and ticker chips.
import {
  getActivity,
  getAgentPerformance,
  getAutomationPerformance,
  getPerformance,
  getPortfolio,
  getPrices,
  getStockPerformance
} from "../../accountReads.ts"
import { agentFor } from "../../cards.ts"
import { nameOf, priceOf } from "../../castRecords.ts"
import { say, type ThreadContext, type Turn } from "../../rounds.ts"

const money = (dollars: number) => `$${dollars.toLocaleString("en-US", { maximumFractionDigits: 2 })}`

export const portfolioAndPerformance = ({ mint }: ThreadContext): ReadonlyArray<Turn> => {
  const { holdings, cash, automations } = mint.cast
  const agent = agentFor(mint, null)
  const rows = holdings.map((holding) => {
    const value = holding.shares * Number(priceOf(holding.symbol)) / 1e8
    return `| [[${holding.symbol}]] | ${holding.shares} | ${money(value)} | ${
      money(value - holding.shares * holding.costPerShare)
    } |`
  })
  const top = holdings[0]?.symbol ?? "AAPL"

  return [
    {
      you: "How's my portfolio?",
      rounds: [[getPortfolio(mint)], [
        say(
          rows.length === 0 ?
            `You have ${money(cash)} in cash and no stocks yet.` :
            `| Stock | Shares | Value | Gain |\n| --- | ---: | ---: | ---: |\n${rows.join("\n")}\n| Cash |  | ${
              money(cash)
            } |  |\n\n` +
            "Up **1.25%** today."
        )
      ]]
    },
    {
      you: "How did I do this week?",
      rounds: [[getPerformance(mint, 412)], [
        say("**+$412** this week, most of it unrealised. Fees and slippage cost $1.62.")
      ]]
    },
    {
      you: `And ${nameOf(top)} on its own?`,
      rounds: [[getStockPerformance(mint, top, 38.5)], [say(`[[${top}]] is up **$38.50** for you over 5 trades.`)]]
    },
    {
      you: `How did ${agent.name} do?`,
      rounds: [[getAgentPerformance(mint, agent.id, 120)], [
        say(`${agent.name}: **+$120** over 9 trades. Its rules refused 3: Max in one stock twice, Trade size once.`)
      ]]
    },
    ...(automations[0] === undefined ? [] : [{
      you: `Is "${automations[0].name}" doing anything?`,
      rounds: [[getAutomationPerformance(mint, automations[0].id, 4)], [say("It ran 4 times and skipped once.")]]
    }]),
    {
      you: "What did I trade this week?",
      rounds: [[getActivity(mint, 3)], [say("Three trades, all filled. The [activity page](/activity) has every one.")]]
    },
    {
      you: "Prices of what I own?",
      rounds: [[getPrices(mint, holdings.slice(0, 3).map((holding) => holding.symbol))], [
        say(
          holdings.slice(0, 3).map((holding) => `[[${holding.symbol}]] ${money(Number(priceOf(holding.symbol)) / 1e8)}`)
            .join(", ") || "You don't own any stocks yet."
        )
      ]]
    },
    {
      you: "Give me today's brief",
      rounds: [[getPortfolio(mint), getActivity(mint, 2)], [
        say(
          "### Today\n\n- **Portfolio:** up 1.25%, led by [[NVDA]].\n- **Agents:** 2 trades sent, 1 waiting for your " +
            "approval.\n- **Automations:** the weekly buy ran at 10:00.\n- **Coming up:** the market opens at 9:30 New " +
            "York time.\n\nNothing needs you right now except the approval."
        )
      ]]
    }
  ]
}
