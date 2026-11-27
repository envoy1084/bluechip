// What every network's deployment must satisfy, so a new network (or a regenerated one) is checked by being listed.
import { deploymentOf } from "@bluechip/chain/ChainDeployment"
import { baseDeployment } from "@bluechip/chain/deployments/Base"
import { networks } from "@bluechip/chain/Network"
import { StockSymbol } from "@bluechip/domain/market/Market"
import { assert, describe, it } from "@effect/vitest"
import { isAddress, zeroAddress } from "viem"

describe("deploymentOf", () => {
  it.each(networks)("%s: its own network, on its chain", (network) => {
    const deployment = deploymentOf(network)

    assert.deepStrictEqual(
      { network: deployment.network, chainId: deployment.chainId },
      { network, chainId: deployment.chain.id }
    )
  })

  it.each(networks)("%s: every address is well formed", (network) => {
    const deployment = deploymentOf(network)
    const addresses = [
      deployment.usdc,
      deployment.entryPoint,
      deployment.sequencerFeed,
      ...Object.values(deployment.exchange),
      ...Object.values(deployment.policies),
      ...deployment.stocks.flatMap((stock) => [stock.token, stock.feed, stock.pool?.address ?? zeroAddress]),
      ...(deployment.paper === null ? [] : [deployment.paper.operator, deployment.paper.feedWriter])
    ]

    const malformed = addresses.filter((address) => !isAddress(address, { strict: false }))

    assert.deepStrictEqual(malformed, [])
  })

  it.each(networks)("%s: every stock bluechip supports, in the guard's market order, each with a pool", (network) => {
    const stocks = deploymentOf(network).stocks

    assert.deepStrictEqual(stocks.map((stock) => stock.symbol), [...StockSymbol.literals])
    assert.deepStrictEqual(stocks.filter((stock) => stock.pool === null || stock.pool.tickSpacing <= 0), [])
  })

  it.each(networks)("%s: each stock's name and logo are Base's", (network) => {
    const named = deploymentOf(network).stocks.map(({ logoUrl, name, symbol }) => ({ symbol, name, logoUrl }))

    assert.deepStrictEqual(
      named,
      baseDeployment.stocks.map(({ logoUrl, name, symbol }) => ({ symbol, name, logoUrl }))
    )
  })

  it("local: Base's deployment, chain and explorer", () => {
    assert.deepStrictEqual({ ...deploymentOf("local"), network: "base" }, baseDeployment)
  })

  it("base: Base mainnet, no address left zero, no paper operator", () => {
    const deployment = deploymentOf("base")

    assert.deepStrictEqual(
      {
        chainId: deployment.chainId,
        explorerUrl: deployment.explorerUrl,
        // Every address but the chain's own, as written.
        zeroLeft: JSON.stringify({ ...deployment, chain: null }).toLowerCase().includes(zeroAddress),
        paper: deployment.paper
      },
      { chainId: 8453, explorerUrl: "https://basescan.org", zeroLeft: false, paper: null }
    )
  })

  it("sepolia: Base Sepolia, with its explorer, no address left zero and a paper operator", () => {
    const deployment = deploymentOf("sepolia")

    assert.deepStrictEqual(
      {
        chainId: deployment.chainId,
        explorerUrl: deployment.explorerUrl,
        zeroLeft: JSON.stringify({ ...deployment, chain: null }).toLowerCase().includes(zeroAddress),
        paper: deployment.paper !== null
      },
      { chainId: 84532, explorerUrl: "https://sepolia.basescan.org", zeroLeft: false, paper: true }
    )
  })
})
