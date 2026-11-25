import { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks } from "@bluechip/chain/Contracts"
import { swapCalls } from "@bluechip/chain/market/Swaps"
import { simulateAsAgent } from "@bluechip/chain/policies/Simulate"
import type { Decision, Leg } from "@bluechip/domain/intents/Intent"
import type { Quote } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { fairPrice } from "@bluechip/domain/policies/FairPrice"
import { configOf } from "@bluechip/domain/policies/Policy"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import * as Grant from "@namera-ai/sdk/Grant"
import { eq } from "drizzle-orm"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import type { Address, Hex } from "viem"
import { getUserOperationHash } from "viem/account-abstraction"
import { privateKeyToAccount } from "viem/accounts"
import { decodeSpec, type SessionRow } from "../agents/AgentRecords.ts"
import { decryptKey } from "../agents/Keys.ts"
import { AppConfig } from "../Config.ts"
import { Database } from "../db/Database.ts"
import { sessionKeys } from "../db/schema/agents.ts"
import { quote as quoteTrade } from "../market/Quoter.ts"
import { Namera } from "../Namera.ts"

// How long until an intent that waits is decided again.
const RETRY = {
  pricesPaused: Duration.minutes(15),
  pricesStale: Duration.minutes(15),
  noGas: Duration.minutes(10),
  unavailable: Duration.minutes(1)
} as const

// Bundlers refuse an operation whose daily limits roll over before it lands: nothing is sent in a UTC day's last
// minute.
const DAY_END_MARGIN_SECONDS = 60

// The swap's own deadline, so a decided trade can't fill at an old price much later.
const SWAP_DEADLINE = { minutes: 3 }

/** A trade decided for an agent: what the pipeline decided, and, when it passes, the quote and calls to send. */
export interface Decided {
  readonly decision: Decision
  readonly quote?: Quote | undefined
  readonly calls?: ReadonlyArray<{ readonly to: Address; readonly data: Hex }> | undefined
}

/** The agent's account, signing with its session key: a bundler client for its user operations. */
export const agentClient = Effect.fnUntraced(function*(agentId: string, session: SessionRow) {
  const db = yield* Database
  const config = yield* AppConfig
  const chain = yield* ChainClient
  const namera = yield* Namera

  const [key] = yield* db.select().from(sessionKeys).where(eq(sessionKeys.address, session.sessionKey)).pipe(
    Effect.orDie
  )
  const signer = privateKeyToAccount(decryptKey(config.agentKeyEncryptionKey, agentId, key!.ciphertext))
  const account = yield* chain.use(
    "agent account",
    () => Grant.toAccount(chain.client, { grant: Grant.parse(session.grant!), signer, check: false })
  )
  return namera.bundlerClient(account as never)
})

const waitFor = (reason: keyof typeof RETRY | "dayEnding", until: DateTime.Utc): Decided => ({
  decision: { _tag: "Wait", reason, until }
})

/**
 * What the pipeline decides for an agent's trade, without sending it. A trade over the agent's largest trade goes to
 * you (routing, not enforcement: the contract would refuse the agent anyway); then the waits (the day's last minute,
 * prices bluechip can't trade on, no ETH for gas); then the agent's onchain policies, by simulating the operation as
 * the agent.
 */
export const decide = Effect.fnUntraced(function*(options: {
  readonly agentId: string
  readonly account: Address
  readonly session: SessionRow
  readonly leg: Leg
}) {
  const chain = yield* ChainClient
  const now = yield* DateTime.now
  const spec: AgentSpec = decodeSpec(options.session.spec)
  const { leg } = options

  const seconds = Math.floor(DateTime.toEpochMillis(now) / 1000)
  const intoDay = seconds % 86_400
  if (86_400 - intoDay <= DAY_END_MARGIN_SECONDS) {
    return waitFor("dayEnding", DateTime.makeUnsafe((seconds - intoDay + 86_400 + 5) * 1000))
  }

  const quoted = yield* quoteTrade(
    "usdc" in leg.amount
      ? { symbol: leg.symbol, side: "buy", usdc: leg.amount.usdc }
      : { symbol: leg.symbol, side: "sell", shares: leg.amount.shares }
  ).pipe(Effect.result)
  if (quoted._tag === "Failure") return waitFor("unavailable", DateTime.addDuration(now, RETRY.unavailable))
  const quote = quoted.success

  const largest = configOf(spec.policies, tradeSize)?.maxPerTrade
  if (largest !== undefined && quote.usdc > largest) {
    return { decision: { _tag: "OverLargestTrade", maxPerTrade: largest } } satisfies Decided
  }

  const tradesWhilePaused = configOf(spec.policies, fairPrice)?.tradeWhilePaused ?? false
  if (quote.reference.status === "stale") return waitFor("pricesStale", DateTime.addDuration(now, RETRY.pricesStale))
  if (quote.reference.status === "paused" && !tradesWhilePaused) {
    return waitFor("pricesPaused", DateTime.addDuration(now, RETRY.pricesPaused))
  }

  const eth = yield* chain.use("balance", (client) => client.getBalance({ address: options.account })).pipe(
    Effect.orElseSucceed(() => BigInt(1))
  )
  if (eth === BigInt(0)) return waitFor("noGas", DateTime.addDuration(now, RETRY.noGas))

  const stock = stocks.find((candidate) => candidate.symbol === leg.symbol)!
  const deadline = DateTime.toEpochMillis(DateTime.add(now, SWAP_DEADLINE))
  const calls = swapCalls({
    stock,
    side: leg.side,
    amountIn: "usdc" in leg.amount ? leg.amount.usdc : leg.amount.shares,
    minimumOut: quote.minimumOut,
    recipient: options.account,
    deadline: BigInt(Math.floor(deadline / 1000))
  })

  const client = yield* agentClient(options.agentId, options.session)
  const simulated = yield* simulateAsAgent(client as never, calls)
  switch (simulated._tag) {
    case "Passes":
      return { decision: { _tag: "Passes", callGasLimit: simulated.callGasLimit }, quote, calls } satisfies Decided
    case "Refused":
      return { decision: { _tag: "Refused", ...simulated.refusal } } satisfies Decided
    case "Retry":
      yield* Effect.logWarning(`Agent ${options.agentId}: simulation failed, retrying: ${simulated.reason}`)
      return waitFor("unavailable", DateTime.addDuration(now, RETRY.unavailable))
  }
})

/**
 * Signs the agent's operation and returns its hash before sending it, so the hash is stored first and a restart
 * waits for that operation instead of sending another; then sends it.
 */
export const signForAgent = Effect.fnUntraced(function*(
  agentId: string,
  session: SessionRow,
  calls: ReadonlyArray<{ readonly to: Address; readonly data: Hex }>,
  callGasLimit: bigint
) {
  const chain = yield* ChainClient
  const client = yield* agentClient(agentId, session)
  const account = client.account!

  const prepared = yield* chain.use(
    "prepare agent operation",
    () => client.prepareUserOperation({ account, calls: [...calls], callGasLimit })
  )
  const signature = yield* chain.use("sign agent operation", () => account.signUserOperation(prepared as never))
  const hash = getUserOperationHash({
    chainId: chain.client.chain.id,
    entryPointAddress: account.entryPoint.address,
    entryPointVersion: account.entryPoint.version,
    userOperation: { ...prepared, signature } as never
  })

  const send = chain.use(
    "send agent operation",
    () => client.sendUserOperation({ ...(prepared as object), account, signature } as never)
  )
  const wait = chain.use(
    "agent operation receipt",
    () => client.waitForUserOperationReceipt({ hash, timeout: 120_000 })
  ).pipe(
    Effect.map((receipt) => ({
      success: receipt.success,
      txHash: receipt.receipt.transactionHash,
      logs: receipt.logs
    })),
    Effect.orElseSucceed(() => undefined)
  )
  return { hash, send, wait }
})

/** Waits for an agent operation already sent, after a restart. */
export const waitForAgentOperation = Effect.fnUntraced(function*(agentId: string, session: SessionRow, hash: Hex) {
  const chain = yield* ChainClient
  const client = yield* agentClient(agentId, session)
  return yield* chain.use(
    "agent operation receipt",
    () => client.waitForUserOperationReceipt({ hash, timeout: 120_000 })
  )
    .pipe(
      Effect.map((receipt) => ({
        success: receipt.success,
        txHash: receipt.receipt.transactionHash,
        logs: receipt.logs
      })),
      Effect.orElseSucceed(() => undefined)
    )
})
