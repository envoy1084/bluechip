// Agents locked onto new accounts as bluechip locks them, on the devnet or a fork of Base.
import { ChainClient } from "@bluechip/chain/ChainClient"
import type { ChainError } from "@bluechip/chain/ChainError"
import { DevChain } from "@bluechip/chain/DevChain"
import { compileSession, lockCalls, lockedGrant } from "@bluechip/chain/policies/Session"
import { BASE_FEES } from "@bluechip/devnet/Controls"
import { Devnet } from "@bluechip/devnet/Devnet"
import { softwarePasskey } from "@bluechip/devnet/Passkeys"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { Grant, KernelAccount, type Policy, Session, SessionKey } from "@namera-ai/sdk"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  type Address,
  type Chain,
  createPublicClient,
  custom,
  type Hex,
  http,
  type LocalAccount,
  parseEther,
  toHex,
  type Transport
} from "viem"
import {
  type BundlerClient,
  createBundlerClient,
  type SmartAccount,
  type WebAuthnAccount
} from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"
import { PICKER } from "../fixtures/Specs.ts"

type Calls = ReadonlyArray<
  { readonly to: Address; readonly data?: Hex | undefined; readonly value?: bigint | undefined }
>

type Bundler = BundlerClient<Transport, Chain | undefined, SmartAccount>

/** An account owned by a passkey, its agent sending operations through the bundler, its grant, and its owner. */
export interface Agent {
  readonly address: Address
  /** The passkey that owns the account (on Namera's `WebAuthnValidator`, threshold 1). */
  readonly owner: WebAuthnAccount
  /** The account as its owner sends from it. */
  readonly account: KernelAccount.KernelAccount
  readonly agent: Bundler
  readonly grant: Grant.Grant
  /** The agent sending operations with another grant of the same key. */
  readonly agentFor: (grant: Grant.Grant) => Effect.Effect<Bundler, ChainError>
  /** The owner's operation of `calls`, once it landed. */
  readonly send: (calls: Calls) => Effect.Effect<{ readonly success: boolean }, ChainError>
  /** The operation of `calls` from `account` (another signer of the same account), once it landed. */
  readonly sendAs: (
    account: SmartAccount,
    calls: Calls
  ) => Effect.Effect<{ readonly success: boolean }, ChainError>
  /** The agent's operation of `calls`, once it landed. */
  readonly trade: (calls: Calls, callGasLimit?: bigint) => Effect.Effect<{ readonly success: boolean }, ChainError>
}

export class TestAgents extends Context.Service<TestAgents, {
  /**
   * A new Kernel account (a passkey owner) with $1,000 and gas, and an agent locked onto it with `spec` (`PICKER` by
   * default), or with `policies` compiled by the caller.
   */
  /**
   * Operations under `grant` signed by `signer` (a session key: a local key or a passkey), through the bundler. With
   * `secondsAhead`, they are prepared as they would be that long from now: Namera states the time of each operation
   * from the latest block (its policies' periods count from it), so the session reads blocks stamped that much later.
   */
  readonly sessionFor: (
    grant: Grant.Grant,
    signer: LocalAccount | WebAuthnAccount,
    options?: { readonly secondsAhead?: number }
  ) => Effect.Effect<Bundler, ChainError>
  readonly lock: (options?: {
    readonly spec?: AgentSpec | undefined
    readonly policies?: ReadonlyArray<Policy.Policy> | undefined
  }) => Effect.Effect<Agent, ChainError>
}>()("@bluechip/chain/test/TestAgents") {
  /** Agents sending through `bundlerUrl`, paying `fees` per gas: under the session's gas budget, over the base fee. */
  static readonly make = Effect.fnUntraced(function*(options: {
    readonly bundlerUrl: string
    readonly fees: { readonly maxFeePerGas: bigint; readonly maxPriorityFeePerGas: bigint }
  }) {
    const chain = yield* ChainClient
    const dev = yield* DevChain

    const bundler = (account: SmartAccount): Bundler =>
      createBundlerClient({
        account,
        client: chain.client,
        transport: http(options.bundlerUrl),
        // Alto bundles within 50 ms; viem's default poll (1 s) would make each receipt wait for it.
        pollingInterval: 50,
        userOperation: { estimateFeesPerGas: async () => options.fees }
      })

    const sendThrough = (client: Bundler) =>
      Effect.fnUntraced(function*(calls: Calls, callGasLimit?: bigint) {
        const hash = yield* chain.use(
          "sendUserOperation",
          () => client.sendUserOperation({ calls: [...calls], callGasLimit })
        )
        return yield* chain.use("waitForUserOperationReceipt", () => client.waitForUserOperationReceipt({ hash }))
      })

    const lock = Effect.fnUntraced(function*(lockOptions: {
      readonly spec?: AgentSpec | undefined
      readonly policies?: ReadonlyArray<Policy.Policy> | undefined
    } = {}) {
      const owner = softwarePasskey()
      const account = yield* chain.use("KernelAccount.from", (client) => KernelAccount.from({ client, owner }))
      yield* dev.setEthBalance(account.address, parseEther("1"))
      yield* dev.setUsdcBalance(account.address, BigInt(1_000_000_000))

      const key = privateKeyToAccount(generatePrivateKey())
      const session = Session.from({
        signer: SessionKey.ecdsa(key.address),
        validUntil: Session.expiresIn({ days: 90 }),
        policies: lockOptions.policies ?? compileSession(lockOptions.spec ?? PICKER)
      })

      // The owner deploys the account and locks the session in one operation, as bluechip does; the agent's trades
      // then use the enabled session.
      const send = sendThrough(bundler(account))
      yield* send(lockCalls(session))
      const grant = yield* lockedGrant(account, session).pipe(Effect.provideService(ChainClient, chain))

      const agentFor = (current: Grant.Grant) =>
        chain.use(
          "Grant.toAccount",
          async (client) => bundler(await Grant.toAccount(client, { grant: current, signer: key, check: false }))
        )
      const agent = yield* agentFor(grant)

      return {
        address: account.address,
        owner,
        account,
        agent,
        grant,
        agentFor,
        send,
        sendAs: (from: SmartAccount, calls: Calls) => sendThrough(bundler(from))(calls),
        trade: sendThrough(agent)
      }
    })

    const later = (seconds: number) =>
      createPublicClient({
        chain: base,
        transport: custom({
          request: async ({ method, params }) => {
            const answer = await chain.client.request({ method, params } as never) as Record<string, unknown> | null
            if (method !== "eth_getBlockByNumber" || answer === null) return answer
            return { ...answer, timestamp: toHex(BigInt(answer["timestamp"] as Hex) + BigInt(seconds)) }
          }
        })
      })

    const sessionFor = (
      grant: Grant.Grant,
      signer: LocalAccount | WebAuthnAccount,
      sessionOptions: { readonly secondsAhead?: number } = {}
    ) =>
      chain.use("Grant.toAccount", async (client) =>
        bundler(
          await Grant.toAccount(
            sessionOptions.secondsAhead === undefined ? client : later(sessionOptions.secondsAhead),
            { grant, signer, check: false }
          )
        ))

    return TestAgents.of({ lock, sessionFor })
  })

  /** Agents on this worker's devnet, paying Base's base fee. */
  static readonly layer = Layer.effect(
    TestAgents,
    Effect.gen(function*() {
      const devnet = yield* Devnet
      return yield* TestAgents.make({ bundlerUrl: devnet.bundlerUrl, fees: BASE_FEES })
    })
  )
}
