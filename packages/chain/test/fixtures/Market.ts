import type { Stock } from "@bluechip/chain/Deployment"
import { localDeployment } from "@bluechip/chain/deployments/Base"
import { swapCalls } from "@bluechip/chain/market/Swaps"
import type { Address } from "viem"

const { stocks } = localDeployment

export const nvda = stocks.find((stock) => stock.symbol === "NVDA")!
export const aapl = stocks.find((stock) => stock.symbol === "AAPL")!
export const tsla = stocks.find((stock) => stock.symbol === "TSLA")!

// The calls of one trade on the stock's pool, valid for two minutes.
export const tradeCalls = (
  stock: Stock,
  side: "buy" | "sell",
  amountIn: bigint,
  recipient: Address,
  minimumOut = BigInt(1)
) =>
  swapCalls(localDeployment, {
    stock,
    side,
    amountIn,
    minimumOut,
    recipient,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 120)
  })
