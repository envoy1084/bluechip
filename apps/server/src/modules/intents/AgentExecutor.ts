import { ChainClient } from "@bluechip/chain/ChainClient"
import { ChainDeployment } from "@bluechip/chain/ChainDeployment"
import type { ChainError } from "@bluechip/chain/ChainError"
import { swapCalls } from "@bluechip/chain/market/Swaps"
import { simulateAsAgent } from "@bluechip/chain/policies/Simulate"
import type { Decision, Leg } from "@bluechip/domain/intents/Intent"
import type { Quote } from "@bluechip/domain/market/Market"
import { fairPrice } from "@bluechip/domain/policies/FairPrice"
import { configOf } from "@bluechip/domain/policies/Policy"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import * as Grant from "@namera-ai/sdk/Grant"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { Address, Hex } from "viem"
import { getUserOperationHash } from "viem/account-abstraction"
import { Namera } from "../../platform/namera/Namera.ts"
import { AgentSessions, type SessionRow } from "../agents/AgentSessions.ts"
import { Quoter } from "../market/Quoter.ts"
import { type Receipt, toReceipt } from "../signing/OwnerOperations.ts"

// How long until an intent that waits is decided again.
const RETRY = {
  pricesPaused: Duration.minutes(15),
  pricesStale: Duration.minutes(15),
  noGas: Duration.minutes(10),
  gasPrice: Duration.minutes(10),
  unavailable: Duration.minutes(1)
} as const

// Bundlers refuse an operation whose daily limits roll over before it lands: nothing is sent in a UTC day's last
// minute.
const DAY_END_MARGIN_SECONDS = 60

// The swap's own deadline, so a decided trade can't fill at an old price much later. Counted from the chain's latest
// block, since the swap checks it against `block.timestamp`, not the server's clock.
const SWAP_DEADLINE_SECONDS = BigInt(180)

// The tip an agent's operation offers: 0.001 gwei, Base's usual.
const AGENT_TIP = BigInt(1_000_000)

/** The gas an agent's operation is sent with, from its simulation. */
export interface AgentGas {
  readonly callGasLimit: bigint
  readonly verificationGasLimit: bigint
  readonly preVerificationGas: bigint
}

/**
 * Trades decided for an agent, together: what the pipeline decided, and, when they pass, a quote per leg, the calls of
 * them all and the gas to send them with in one operation.
 */
export interface Decided {
  readonly decision: Decision
  readonly quotes?: ReadonlyArray<Quote> | undefined
  readonly calls?: ReadonlyArray<{ readonly to: Address; readonly data: Hex }> | undefined
  readonly gas?: AgentGas | undefined
}

/** An agent's operation, signed and hashed: `send` hands it to the bundler, `wait` follows it to its receipt. */
export interface SignedOperation {
  readonly hash: Hex
  readonly send: Effect.Effect<Hex, ChainError>
  readonly wait: Effect.Effect<Receipt | undefined>
}

/** Agents' trades: decided against their policies, then signed and sent with their session keys. */
export class AgentExecutor extends Context.Service<AgentExecutor, {
  /**
   * What the pipeline decides for an agent's trades sent in one operation (one leg per stock), without sending them.
   * A leg over the agent's largest trade goes to you (routing, not enforcement: the contract would refuse the agent
   * anyway); then the waits (the day's last minute, prices bluechip can't trade on, no ETH for gas); then the agent's
   * onchain policies, by simulating the operation as the agent, which judge its legs' net result.
   */
  readonly decide: (options: {
    readonly agentId: string
    readonly account: Address
    readonly session: SessionRow
    readonly legs: ReadonlyArray<Leg>
  }) => Effect.Effect<Decided, ChainError>
  /**
   * Signs the agent's operation and returns its hash before sending it, so the hash is stored first and a restart
   * waits for that operation instead of sending another.
   */
  readonly sign: (
    agentId: string,
    session: SessionRow,
    calls: ReadonlyArray<{ readonly to: Address; readonly data: Hex }>,
    gas: AgentGas
  ) => Effect.Effect<SignedOperation, ChainError>
  /** Waits for an agent operation already sent, after a restart. */
  readonly wait: (agentId: string, session: SessionRow, hash: Hex) => Effect.Effect<Receipt | undefined, ChainError>
}>()("@bluechip/server/AgentExecutor") {
  static readonly layer = Layer.effect(
    AgentExecutor,
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const deployment = yield* ChainDeployment
      const namera = yield* Namera
      const quoter = yield* Quoter
      const sessions = yield* AgentSessions

      // The agent's account, signing with its session key: a bundler client for its user operations.
      // Twice the latest base fee plus a small tip, as Base prices blocks. Namera's gas policy charges an operation's
      // maximum cost (gas × the most per gas) against the agent's daily gas budget, so a bundler's generous default
      // would spend it in one trade.
      const agentFees = async () => {
        const block = await chain.client.getBlock()
        return {
          maxFeePerGas: (block.baseFeePerGas ?? BigInt(0)) * BigInt(2) + AGENT_TIP,
          maxPriorityFeePerGas: AGENT_TIP
        }
      }

      const agentClient = Effect.fnUntraced(function*(agentId: string, session: SessionRow) {
        const signer = yield* sessions.signer(agentId, session)
        const account = yield* chain.use(
          "agent account",
          () => Grant.toAccount(chain.client, { grant: Grant.parse(session.grant!), signer, check: false })
        )
        return namera.bundlerClient(account as never, { estimateFeesPerGas: agentFees })
      })

      const receiptOf = (client: Effect.Success<ReturnType<typeof agentClient>>, hash: Hex) =>
        chain.use("agent operation receipt", () => client.waitForUserOperationReceipt({ hash, timeout: 120_000 }))
          .pipe(
            Effect.map(toReceipt),
            Effect.orElseSucceed(() => undefined)
          )

      const decide = Effect.fn("AgentExecutor.decide")(function*(options: {
        readonly agentId: string
        readonly account: Address
        readonly session: SessionRow
        readonly legs: ReadonlyArray<Leg>
      }) {
        const now = yield* DateTime.now
        const spec = options.session.spec
        const waitFor = (reason: keyof typeof RETRY | "dayEnding" | "gasSpent", until: DateTime.Utc): Decided => ({
          decision: { _tag: "Wait", reason, until }
        })

        const seconds = Math.floor(DateTime.toEpochMillis(now) / 1000)
        const intoDay = seconds % 86_400
        if (86_400 - intoDay <= DAY_END_MARGIN_SECONDS) {
          return waitFor("dayEnding", DateTime.makeUnsafe((seconds - intoDay + 86_400 + 5) * 1000))
        }

        const quoted = yield* Effect.forEach(options.legs, (leg) =>
          quoter.quote(
            "usdc" in leg.amount
              ? { symbol: leg.symbol, side: "buy", usdc: leg.amount.usdc }
              : { symbol: leg.symbol, side: "sell", shares: leg.amount.shares }
          )).pipe(Effect.result)
        if (quoted._tag === "Failure") return waitFor("unavailable", DateTime.addDuration(now, RETRY.unavailable))
        const quotes = quoted.success

        const largest = configOf(spec.policies, tradeSize)?.maxPerTrade
        if (largest !== undefined && quotes.some((quote) => quote.usdc > largest)) {
          return { decision: { _tag: "OverLargestTrade", maxPerTrade: largest } } satisfies Decided
        }

        const tradesWhilePaused = configOf(spec.policies, fairPrice)?.tradeWhilePaused ?? false
        if (quotes.some((quote) => quote.reference.status === "stale")) {
          return waitFor("pricesStale", DateTime.addDuration(now, RETRY.pricesStale))
        }
        if (quotes.some((quote) => quote.reference.status === "paused") && !tradesWhilePaused) {
          return waitFor("pricesPaused", DateTime.addDuration(now, RETRY.pricesPaused))
        }

        const eth = yield* chain.use("balance", (client) => client.getBalance({ address: options.account })).pipe(
          Effect.orElseSucceed(() => BigInt(1))
        )
        if (eth === BigInt(0)) return waitFor("noGas", DateTime.addDuration(now, RETRY.noGas))

        const block = yield* chain.use("block", (client) => client.getBlock()).pipe(Effect.result)
        if (block._tag === "Failure") return waitFor("unavailable", DateTime.addDuration(now, RETRY.unavailable))

        const calls = options.legs.flatMap((leg, index) =>
          swapCalls(deployment, {
            stock: deployment.stocks.find((candidate) => candidate.symbol === leg.symbol)!,
            side: leg.side,
            amountIn: "usdc" in leg.amount ? leg.amount.usdc : leg.amount.shares,
            minimumOut: quotes[index]!.minimumOut,
            recipient: options.account,
            deadline: block.success.timestamp + SWAP_DEADLINE_SECONDS
          })
        )

        const client = yield* agentClient(options.agentId, options.session)
        const simulated = yield* simulateAsAgent(deployment, client as never, calls)
        switch (simulated._tag) {
          case "Passes": {
            const gas = {
              callGasLimit: simulated.callGasLimit,
              verificationGasLimit: simulated.verificationGasLimit,
              // Base's share of the L1 data fee moves with fees between the simulation and the send: a tenth more.
              preVerificationGas: simulated.preVerificationGas + simulated.preVerificationGas / BigInt(10)
            }

            // The simulation doesn't price gas, but the gas policy charges the operation's maximum cost: when that
            // is more than the agent's gas budget has left, the trade waits instead of failing at the bundler.
            const fees = yield* chain.use("agent fees", agentFees)
            const maxCost = (gas.callGasLimit + gas.verificationGasLimit + gas.preVerificationGas) * fees.maxFeePerGas
            const status = yield* chain.use(
              "agent gas budget",
              (client) => Grant.getStatus(client, { grant: Grant.parse(options.session.grant!) })
            )
            const budget = status.limits.find((limit) => limit.kind === "gas")
            if (budget !== undefined && maxCost > budget.remaining) {
              return maxCost > budget.budget || budget.resetsAt === undefined
                ? waitFor("gasPrice", DateTime.addDuration(now, RETRY.gasPrice))
                : waitFor("gasSpent", DateTime.makeUnsafe(budget.resetsAt * 1000))
            }

            return {
              decision: { _tag: "Passes", callGasLimit: gas.callGasLimit },
              quotes,
              calls,
              gas
            } satisfies Decided
          }
          case "Refused":
            return { decision: { _tag: "Refused", ...simulated.refusal } } satisfies Decided
          case "Retry":
            yield* Effect.logWarning(`Agent ${options.agentId}: simulation failed, retrying: ${simulated.reason}`)
            return waitFor("unavailable", DateTime.addDuration(now, RETRY.unavailable))
        }
      })

      const sign = Effect.fn("AgentExecutor.sign")(function*(
        agentId: string,
        session: SessionRow,
        calls: ReadonlyArray<{ readonly to: Address; readonly data: Hex }>,
        gas: AgentGas
      ) {
        const client = yield* agentClient(agentId, session)
        const account = client.account!

        const prepared = yield* chain.use(
          "prepare agent operation",
          // With every gas limit given, viem doesn't ask the bundler to estimate again.
          () => client.prepareUserOperation({ account, calls: [...calls], ...gas })
        )
        const signature = yield* chain.use("sign agent operation", () => account.signUserOperation(prepared as never))
        const hash = getUserOperationHash({
          chainId: chain.client.chain.id,
          entryPointAddress: account.entryPoint.address,
          entryPointVersion: account.entryPoint.version,
          userOperation: { ...prepared, signature } as never
        })

        // Sent exactly as signed: given no account, viem doesn't prepare the operation again.
        const send = chain.use(
          "send agent operation",
          () =>
            client.sendUserOperation(
              {
                ...(prepared as object),
                account: null,
                signature,
                entryPointAddress: account.entryPoint.address
              } as never
            )
        )
        return { hash, send, wait: receiptOf(client, hash) }
      })

      const wait = Effect.fn("AgentExecutor.wait")(function*(agentId: string, session: SessionRow, hash: Hex) {
        return yield* receiptOf(yield* agentClient(agentId, session), hash)
      })

      return AgentExecutor.of({ decide, sign, wait })
    })
  )
}
