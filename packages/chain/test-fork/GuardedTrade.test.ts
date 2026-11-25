// An agent's guarded trade on a fork of Base: Base's own Namera contracts, pools, Chainlink feeds and sequencer feed,
// with bluechip's policies deployed by `pnpm test:fork` (`contracts deploy`). Needs the fork and its bundler
// (`docker compose --profile chain up -d`); not part of `pnpm check`.
import { guardedTradeCallGas } from "@bluechip/chain/agents/Policies"
import { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks, usdc } from "@bluechip/chain/Contracts"
import { DevChain } from "@bluechip/chain/DevChain"
import { quoteExactIn } from "@bluechip/chain/market/Quotes"
import { rpc } from "@bluechip/devnet/Controls"
import { policyConfig } from "@bluechip/domain/agents/PolicyConfig"
import { assert, beforeAll, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { type Agent, agentOnNewAccount, balanceOf, LIMITS, trade } from "../test/support/Agents.ts"

const ForkChain = Layer.provideMerge(
  DevChain.layer,
  Layer.succeed(ChainClient, ChainClient.make("local", "http://localhost:8545"))
)

const nvda = stocks.find((stock) => stock.symbol === "NVDA")!

// Base's base fee at the fork's block, doubled, with a tip of 0.001 gwei: well under the session's gas budget.
const forkFees = Effect.fnUntraced(function*() {
  const block = yield* (yield* ChainClient).use("getBlock", (client) => client.getBlock())
  const tip = BigInt(1_000_000)
  return { maxFeePerGas: block.baseFeePerGas! * BigInt(2) + tip, maxPriorityFeePerGas: tip }
})

// The fork is pinned inside market hours on a past day, and Alto checks an operation's validity (the daily budget's
// day) against the wall clock: the fork moves to now, so Chainlink's prices are as old as the fork, and the agent
// trades on paused prices of any age.
const defaults = policyConfig(LIMITS)
const config = { ...defaults, guard: { ...defaults.guard, tradeWhilePaused: true, pausedAgeSeconds: 2 ** 32 - 1 } }

const newAgent = Effect.gen(function*() {
  return yield* agentOnNewAccount({ bundlerUrl: "http://localhost:4337", fees: yield* forkFees(), config })
}).pipe(Effect.provide(ForkChain))

const buyNvda = Effect.fnUntraced(function*({ address, agent }: Agent) {
  const amountIn = BigInt(50_000_000)
  const quoted = yield* quoteExactIn(yield* ChainClient, { pool: nvda.pool!.address, tokenIn: usdc, amountIn })

  const receipt = yield* Effect.promise(async () => {
    const calls = trade(nvda, "buy", amountIn, address, (quoted * BigInt(99)) / BigInt(100))
    const hash = await agent.sendUserOperation({ calls, callGasLimit: guardedTradeCallGas })
    return agent.waitForUserOperationReceipt({ hash })
  })

  return { receipt, quoted, held: yield* balanceOf(nvda.token, address) }
})

// Setting up an account (deploying it and enabling the session) is two operations through a bundler that prices each
// op-stack fee on the fork: one agent here, untimed. A first trade, also untimed, fetches from Base every contract a
// trade touches, so the test's trade reads only local state.
let agent: Agent

beforeAll(async () => {
  const node = rpc("http://localhost:8545")
  await node("evm_setNextBlockTimestamp", [Math.floor(Date.now() / 1000)])
  await node("evm_mine")
  await Effect.runPromise(newAgent.pipe(Effect.flatMap(buyNvda), Effect.provide(ForkChain)))
  agent = await Effect.runPromise(newAgent)
}, 120_000)

layer(ForkChain)("an agent's session on Base", (it) => {
  it.effect("a buy of $50 of NVDA fills on Base's pool, inside Chainlink's paused collar", () =>
    Effect.gen(function*() {
      const { held, quoted, receipt } = yield* buyNvda(agent)

      assert.isTrue(receipt.success)
      assert.strictEqual(held, quoted)
    }))
})
