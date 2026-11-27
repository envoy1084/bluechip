/**
 * Paper money on Base Sepolia: the addresses `contracts deploy` wrote (`Sepolia.ts`) with each stock's name and logo
 * from Base's record. Its pools are the paper exchange's, which takes Slipstream's calls at tick spacing 10.
 *
 * @since 0.0.0
 */
import { baseSepolia } from "viem/chains"
import type { Deployment } from "../Deployment.ts"
import { baseDeployment } from "./Base.ts"
import { sepoliaAddresses } from "./Sepolia.ts"

const PAPER_TICK_SPACING = 10

/**
 * Base Sepolia, for paper money.
 *
 * @stability unstable
 * @category deployments
 * @since 0.0.0
 */
export const sepoliaDeployment: Deployment = {
  network: "sepolia",
  chain: baseSepolia,
  chainId: baseSepolia.id,
  usdc: sepoliaAddresses.usdc,
  // The canonical EntryPoint v0.7 is at the same address on every chain.
  entryPoint: baseDeployment.entryPoint,
  sequencerFeed: sepoliaAddresses.sequencerFeed,
  exchange: sepoliaAddresses.exchange,
  stocks: sepoliaAddresses.stocks.map((paper) => {
    const stock = baseDeployment.stocks.find((candidate) => candidate.symbol === paper.symbol)
    return {
      symbol: paper.symbol,
      name: stock?.name ?? paper.symbol,
      token: paper.token,
      feed: paper.feed,
      pool: { address: paper.pool, tickSpacing: PAPER_TICK_SPACING },
      logoUrl: stock?.logoUrl ?? null
    }
  }),
  policies: sepoliaAddresses.policies,
  explorerUrl: "https://sepolia.basescan.org",
  paper: { operator: sepoliaAddresses.operator, feedWriter: sepoliaAddresses.feedWriter }
}
