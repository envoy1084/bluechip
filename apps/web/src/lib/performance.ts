// Performance in words: what trades cost beyond the stock, as the portfolio, stock, agent and automation pages say it.
import type { Costs } from "@bluechip/domain/performance/Performance"
import { formatMoney } from "@bluechip/ui/lib/format"
import { usdcDollars } from "./amounts.ts"

/** Gas in ETH, to four significant digits: "0.001768 ETH"; "No gas" for none. */
export const gasEth = (wei: bigint): string => {
  if (wei === BigInt(0)) return "No gas"
  return `${Number((Number(wei) / 1e18).toPrecision(4))} ETH`
}

/**
 * What trades cost beyond the stock, in one sentence, in dollars first: "$0.07 in pool fees and $0.04 of slippage,
 * plus 0.001768 ETH of gas". Gas is paid in ETH and bluechip has no ETH price to turn it into dollars, so it comes
 * last, as itself. Slippage that beat Chainlink's price says so.
 */
export const costsSentence = (costs: Costs): string => {
  const slippage = costs.slippage < BigInt(0) ?
    `${formatMoney(usdcDollars(-costs.slippage))} better than Chainlink` :
    `${formatMoney(usdcDollars(costs.slippage))} of slippage`
  const gas = costs.gasWei === BigInt(0) ? "no gas" : `plus ${gasEth(costs.gasWei)} of gas`
  return `${formatMoney(usdcDollars(costs.fees))} in pool fees and ${slippage}, ${gas}`
}

/** Profit or loss as a share of what it cost, in percent; `null` when nothing was paid. */
export const returnPercent = (profit: bigint, cost: bigint): number | null =>
  cost === BigInt(0) ? null : (Number(profit) / Number(cost)) * 100
