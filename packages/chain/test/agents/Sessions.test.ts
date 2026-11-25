import { guardedTradeCallGas, sessionPolicies } from "@bluechip/chain/agents/Policies"
import { agentSession, lockCalls, lockedGrant, readUsage } from "@bluechip/chain/agents/Sessions"
import { refusalFrom } from "@bluechip/chain/agents/Violations"
import { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks } from "@bluechip/chain/Contracts"
import { DevChain } from "@bluechip/chain/DevChain"
import { BASE_FEES } from "@bluechip/devnet/Controls"
import { Devnet } from "@bluechip/devnet/Devnet"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { Limits } from "@bluechip/domain/agents/Limits"
import { policyConfig } from "@bluechip/domain/agents/PolicyConfig"
import { assert, describe, layer } from "@effect/vitest"
import { Grant, KernelAccount, Session } from "@namera-ai/sdk"
import * as Effect from "effect/Effect"
import { http, parseEther } from "viem"
import { createBundlerClient } from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { LIMITS, trade } from "../support/Agents.ts"

const nvda = stocks.find((stock) => stock.symbol === "NVDA")!

/** A new account with $1,000, and an agent whose session its owner locked with `lockCalls`. */
const lockedAgent = Effect.fnUntraced(function*() {
  const chain = yield* ChainClient
  const dev = yield* DevChain
  const devnet = yield* Devnet

  const account = yield* Effect.promise(() =>
    KernelAccount.from({ client: chain.client, owner: privateKeyToAccount(generatePrivateKey()) })
  )
  yield* dev.setEthBalance(account.address, parseEther("1"))
  yield* dev.setUsdcBalance(account.address, BigInt(1_000_000_000))
  const bundler = (signer: typeof account) =>
    createBundlerClient({
      account: signer,
      client: chain.client,
      transport: http(devnet.bundlerUrl),
      pollingInterval: 50,
      userOperation: { estimateFeesPerGas: async () => BASE_FEES }
    })
  const owner = bundler(account)
  const send = (
    calls: ReadonlyArray<
      { readonly to: `0x${string}`; readonly data?: `0x${string}` | undefined; readonly value?: bigint | undefined }
    >
  ) =>
    Effect.promise(async () =>
      owner.waitForUserOperationReceipt({ hash: await owner.sendUserOperation({ calls: [...calls] }) })
    )

  const key = privateKeyToAccount(generatePrivateKey())
  const session = agentSession({ limits: LIMITS, signer: key.address, validUntil: Session.expiresIn({ days: 90 }) })
  const locked = yield* send(lockCalls(session))
  const grant = yield* lockedGrant(account, session)

  const agent = (current: Grant.Grant) =>
    Effect.promise(async () =>
      bundler((await Grant.toAccount(chain.client, { grant: current, signer: key, check: false })) as typeof account)
    )
  const buy = (current: Grant.Grant) =>
    Effect.flatMap(agent(current), (client) =>
      Effect.tryPromise(async () => {
        const calls = trade(nvda, "buy", BigInt(50_000_000), account.address)
        const hash = await client.sendUserOperation({ calls, callGasLimit: guardedTradeCallGas })
        return client.waitForUserOperationReceipt({ hash })
      }).pipe(Effect.result))

  return { address: account.address, grant, locked, send, buy }
})

layer(DevnetTest.layer)("an agent's session", (it) => {
  describe("lockCalls", () => {
    it.effect("the owner's call enables the session", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        const { grant, locked } = yield* lockedAgent()

        assert.isTrue(locked.success)
        assert.isTrue(yield* Effect.promise(() => Grant.isEnabled(chain.client, { grant })))
      }))
  })

  describe("readUsage", () => {
    it.effect("a $50 buy counts as spent today and loses a little to prices", () =>
      Effect.gen(function*() {
        const { address, buy, grant } = yield* lockedAgent()
        yield* buy(grant)

        const usage = yield* readUsage({
          account: address,
          permissionId: grant.id,
          now: Math.floor(Date.now() / 1000)
        })

        assert.strictEqual(usage.spentToday, BigInt(50_000_000))
        assert.isTrue(usage.slippageThisWeek > BigInt(0) && usage.slippageThisWeek < BigInt(500_000))
      }))
  })

  describe("Grant.updateCalls", () => {
    it.effect("a change to sell only refuses the agent's next buy, before it reaches the chain", () =>
      Effect.gen(function*() {
        const { buy, grant, send } = yield* lockedAgent()
        const sellOnly = new Limits({ ...LIMITS, mode: "sell", dailyBudget: LIMITS.dailyBudget })
        const [, ...before] = sessionPolicies(policyConfig(LIMITS))
        const [, ...after] = sessionPolicies(policyConfig(sellOnly))

        const update = Grant.updateCalls(grant, { remove: before, add: after })
        const changed = yield* send(update.calls)
        const outcome = yield* buy({ ...grant, session: update.session })

        assert.isTrue(changed.success)
        assert.deepStrictEqual(
          outcome._tag === "Failure" ? refusalFrom(outcome.failure.cause) : undefined,
          { layer: "validation" }
        )
      }))
  })

  describe("Grant.revokeCalls", () => {
    it.effect("a revoked session is no longer enabled", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        const { grant, send } = yield* lockedAgent()

        const revoked = yield* send(Grant.revokeCalls(grant))

        assert.isTrue(revoked.success)
        assert.isFalse(yield* Effect.promise(() => Grant.isEnabled(chain.client, { grant })))
      }))
  })
})
