// What each stock and agent added to your results, in the line under its name.
import type { AgentLine, StockLine } from "@bluechip/domain/performance/Performance"
import { formatChange, formatMoney } from "@bluechip/ui/lib/format"
import { usdcDollars } from "../../../lib/amounts.ts"

/** "Cost $500.00, worth $540.00" while you hold it; "Sold, realised −$1,273.28" once you sold it all. */
export const stockLineDetail = (line: Pick<StockLine, "shares" | "cost" | "value" | "realised">): string =>
  line.shares === BigInt(0) ?
    `Sold, realised ${formatChange(usdcDollars(line.realised))}` :
    `Cost ${formatMoney(usdcDollars(line.cost))}, worth ${formatMoney(usdcDollars(line.value))}`

/** "6 trades, +$12.40 realised", or just its trades while nothing was realised. */
export const agentLineDetail = (line: Pick<AgentLine, "trades" | "realised">): string => {
  const trades = `${line.trades} ${line.trades === 1 ? "trade" : "trades"}`
  return line.realised === BigInt(0) ? trades : `${trades}, ${formatChange(usdcDollars(line.realised))} realised`
}
