// An agent's guarded trade on a fork of Base: Base's own Namera contracts, pools, Chainlink feeds and sequencer feed,
// with bluechip's policies deployed by `pnpm test:fork` (`contracts deploy`). Needs the fork and its bundler
// (`docker compose --profile chain up -d`); not part of `pnpm check`.
import { ChainClient } from "@bluechip/chain/ChainClient"
import { localDeployment } from "@bluechip/chain/deployments/Base"
import { DevChain } from "@bluechip/chain/DevChain"
import { quoteExactIn } from "@bluechip/chain/market/Quotes"
import { encodeGuardConfig, guardConfig } from "@bluechip/chain/policies/Guard"
import { compileSession, guardedTradeCallGas } from "@bluechip/chain/policies/Session"
import { rpc } from "@bluechip/devnet/Controls"
import { assert, layer } from "@effect/vitest"
import { Policy } from "@namera-ai/sdk"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { erc20Abi } from "viem"
import { nvda, tradeCalls } from "../test/fixtures/Market.ts"
import { PICKER } from "../test/fixtures/Specs.ts"
import { type Agent, TestAgents } from "../test/utils/TestAgents.ts"

const ForkChain = Layer.provideMerge(
  DevChain.layer,
  Layer.succeed(ChainClient, ChainClient.make("local", "http://localhost:8545"))
)

// The fork is pinned inside market hours on a past day, and Alto checks an operation's validity (the daily budget's
// day) against the wall clock: the fork moves to now, so Chainlink's prices are as old as the fork, and the agent
// trades on paused prices of any age.
const { policies: { tradeGuard }, usdc } = localDeployment
const defaults = guardConfig(localDeployment, PICKER)
const guard = encodeGuardConfig({ ...defaults, prices: { ...defaults.prices, pausedAge: 2 ** 32 - 1 } })
const policies = compileSession(localDeployment, PICKER).map((policy) =>
  policy.type === "execution" ? Policy.execution({ address: tradeGuard, initData: guard }) : policy
)

// Setting up an account (deploying it and enabling the session) is two operations through a bundler that prices each
// op-stack fee on the fork: the agent the test trades with is locked as the layer builds, untimed. A first trade by
// another agent, also untimed, fetches from Base every contract a trade touches, so the test's trade reads only
// local state.
class ForkAgent extends Context.Service<ForkAgent, Agent>()("ForkAgent") {
  static readonly layer = Layer.effect(
    ForkAgent,
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const node = rpc(chain.rpcUrl)
      yield* chain.use(
        "evm_setNextBlockTimestamp",
        () => node("evm_setNextBlockTimestamp", [Math.floor(Date.now() / 1000)])
      )
      yield* chain.use("evm_mine", () => node("evm_mine"))

      // Base's base fee at the fork's block, doubled, with a tip of 0.001 gwei: well under the session's gas budget.
      const block = yield* chain.use("getBlock", (client) => client.getBlock())
      const tip = BigInt(1_000_000)
      const agents = yield* TestAgents.make({
        bundlerUrl: "http://localhost:4337",
        fees: { maxFeePerGas: block.baseFeePerGas! * BigInt(2) + tip, maxPriorityFeePerGas: tip }
      })

      const first = yield* agents.lock({ policies })
      const amountIn = BigInt(50_000_000)
      const quoted = yield* quoteExactIn(chain, { pool: nvda.pool!.address, tokenIn: usdc, amountIn })
      yield* first.trade(
        tradeCalls(nvda, "buy", amountIn, first.address, (quoted * BigInt(99)) / BigInt(100)),
        guardedTradeCallGas
      )

      return yield* agents.lock({ policies })
    })
  ).pipe(Layer.provideMerge(ForkChain))
}

layer(ForkAgent.layer, { timeout: "120 seconds" })("an agent's session on Base", (it) => {
  it.effect("a buy of $50 of NVDA fills on Base's pool, inside Chainlink's paused collar", () =>
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const { address, trade } = yield* ForkAgent
      const amountIn = BigInt(50_000_000)
      const quoted = yield* quoteExactIn(chain, { pool: nvda.pool!.address, tokenIn: usdc, amountIn })

      const receipt = yield* trade(
        tradeCalls(nvda, "buy", amountIn, address, (quoted * BigInt(99)) / BigInt(100)),
        guardedTradeCallGas
      )

      const held = yield* chain.use(
        "balanceOf",
        (client) =>
          client.readContract({ address: nvda.token, abi: erc20Abi, functionName: "balanceOf", args: [address] })
      )
      assert.isTrue(receipt.success)
      assert.strictEqual(held, quoted)
    }))
})
