import { aggregatorAbi } from "@bluechip/chain/Abis"
import { paperTokenAbi } from "@bluechip/chain/deployments/PaperAbis"
import { metaquoterAbi, swapRouterAbi } from "@bluechip/chain/market/Aerodrome"
import { NodeServices } from "@effect/platform-node"
import { assert, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Instance } from "prool"
import { createWalletClient, decodeEventLog, erc20Abi, http, isAddressEqual, publicActions } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"

import { readArtifact } from "../../../commands/contracts.ts"
import { CONTRACTS } from "../../../contracts/artifacts.ts"
import { deployPaper } from "../../../contracts/paper.ts"

// A fresh Anvil with Base Sepolia's chain id, empty but for the deterministic deployer it has at genesis.
const anvil = Instance.anvil({ chainId: 84_532, port: 18_649 })

// Anvil's first prefunded account, standing in for the operator.
const operator = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
const client = createWalletClient({ account: operator, chain: baseSepolia, transport: http("http://localhost:18649") })
  .extend(publicActions)

const FreshAnvil = Layer.effectDiscard(
  Effect.acquireRelease(Effect.promise(() => anvil.start()), () => Effect.promise(() => anvil.stop()))
)

const stocks = [
  { symbol: "NVDA", name: "NVIDIA", price: BigInt(150e8) },
  { symbol: "AAPL", name: "Apple", price: BigInt(200e8) }
]

const bytecodeOf = Effect.gen(function*() {
  const names = [
    "TestUsdc",
    "TestStock",
    "PaperFeed",
    "PaperFeedWriter",
    "SequencerUptimeStub",
    "PaperFactory",
    "PaperRouter",
    "PaperQuoter",
    ...CONTRACTS.map((spec) => spec.name)
  ]
  const artifacts = yield* Effect.forEach(names, (name) => readArtifact(process.cwd(), name))
  return Object.fromEntries(names.map((name, index) => [name, artifacts[index]!.bytecode]))
})

layer(Layer.merge(NodeServices.layer, FreshAnvil))("deployPaper", (it) => {
  it.effect("deploys everything once, then finds it all present", () =>
    Effect.gen(function*() {
      const bytecode = yield* bytecodeOf

      const first = yield* Effect.promise(() => deployPaper(client, bytecode, stocks))
      const second = yield* Effect.promise(() => deployPaper(client, bytecode, stocks))

      assert.deepStrictEqual(first.steps.map((step) => [step.name, step.status]), [
        ["TestUsdc", "deployed"],
        ["PaperFeedWriter", "deployed"],
        ["SequencerUptimeStub", "deployed"],
        ["PaperFactory", "deployed"],
        ["PaperRouter", "deployed"],
        ["PaperQuoter", "deployed"],
        ["TestStock NVDA", "deployed"],
        ["PaperFeed NVDA", "deployed"],
        ["TestStock AAPL", "deployed"],
        ["PaperFeed AAPL", "deployed"],
        ["seed NVDA", "deployed"],
        ["seed AAPL", "deployed"],
        ["PaperPool NVDA", "deployed"],
        ["minter USDC NVDA pool", "deployed"],
        ["minter NVDA NVDA pool", "deployed"],
        ["PaperPool AAPL", "deployed"],
        ["minter USDC AAPL pool", "deployed"],
        ["minter AAPL AAPL pool", "deployed"],
        ["AerodromeTradePolicy", "deployed"],
        ["TradeGuard", "deployed"],
        ["RecoveryDelayPolicy", "deployed"],
        ["TradeSizeRule", "deployed"],
        ["FairPriceRule", "deployed"],
        ["StockCapRule", "deployed"],
        ["CashReserveRule", "deployed"],
        ["RebalanceRule", "deployed"],
        ["StopLossFloorRule", "deployed"],
        ["SlippageBudgetRule", "deployed"]
      ])
      assert.deepStrictEqual(second.steps.map((step) => step.status), Array(28).fill("present"))
      assert.deepStrictEqual(second.addresses, first.addresses)
    }))

  it.effect("a buy through the router, with bluechip's ABIs, fills from the pool at the quote", () =>
    Effect.gen(function*() {
      const bytecode = yield* bytecodeOf
      const { addresses } = yield* Effect.promise(() => deployPaper(client, bytecode, stocks))
      const nvda = addresses.stocks[0]!

      const [, answer] = yield* Effect.promise(() =>
        client.readContract({ address: nvda.feed, abi: aggregatorAbi, functionName: "latestRoundData" })
      )
      const { result: [quoted] } = yield* Effect.promise(() =>
        client.simulateContract({
          address: addresses.exchange.quoter,
          abi: metaquoterAbi,
          functionName: "quoteExactInputSingleV3",
          args: [nvda.pool, addresses.usdc, BigInt(100e6), BigInt(0)]
        })
      )
      const receipt = yield* Effect.promise(async () => {
        const send = async (hash: Promise<`0x${string}`>) => client.waitForTransactionReceipt({ hash: await hash })
        await send(client.writeContract({
          address: addresses.usdc,
          abi: paperTokenAbi,
          functionName: "mint",
          args: [operator.address, BigInt(100e6)]
        }))
        await send(client.writeContract({
          address: addresses.usdc,
          abi: erc20Abi,
          functionName: "approve",
          args: [addresses.exchange.router, BigInt(100e6)]
        }))
        const block = await client.getBlock()
        return send(client.writeContract({
          address: addresses.exchange.router,
          abi: swapRouterAbi,
          functionName: "exactInputSingle",
          args: [{
            tokenIn: addresses.usdc,
            tokenOut: nvda.token,
            tickSpacing: 10,
            recipient: operator.address,
            deadline: block.timestamp + BigInt(120),
            amountIn: BigInt(100e6),
            amountOutMinimum: quoted,
            sqrtPriceLimitX96: BigInt(0)
          }]
        }))
      })
      const transfers = receipt.logs.flatMap((log) => {
        try {
          const event = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics })
          return event.eventName === "Transfer" ? [{ token: log.address, ...event.args }] : []
        } catch {
          return []
        }
      }).filter((transfer) =>
        isAddressEqual(transfer.from, operator.address) || isAddressEqual(transfer.to, operator.address)
      )

      assert.strictEqual(answer, BigInt(150e8))
      // $100 at $150, less the 0.03% fee.
      assert.strictEqual(quoted, BigInt(66_646_666))
      assert.deepStrictEqual(
        transfers.map(({ from, to, token, value }) => [token.toLowerCase(), from, to, value]),
        [
          [addresses.usdc.toLowerCase(), operator.address, nvda.pool, BigInt(100e6)],
          [nvda.token.toLowerCase(), nvda.pool, operator.address, BigInt(66_646_666)]
        ]
      )
    }))
})
