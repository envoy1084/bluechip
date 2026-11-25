// An agent locked onto a new account, as bluechip locks one, on the devnet or a fork of Base.
import { ChainClient } from "@bluechip/chain/ChainClient"
import type { ChainError } from "@bluechip/chain/ChainError"
import type { Stock } from "@bluechip/chain/Contracts"
import { DevChain } from "@bluechip/chain/DevChain"
import { swapCalls } from "@bluechip/chain/market/Swaps"
import { compileSession, lockCalls, lockedGrant } from "@bluechip/chain/policies/Session"
import { AgentSpec, type PolicyEntry, type PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import { Grant, KernelAccount, type Policy, Session, SessionKey } from "@namera-ai/sdk"
import * as Effect from "effect/Effect"
import { type Address, type Chain, erc20Abi, type Hex, http, parseEther, type Transport } from "viem"
import { type BundlerClient, createBundlerClient, type SmartAccount } from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

/** A balanced Stock picker for NVDA and AAPL: $100 a trade, $250 a day, 30% in one stock, 10% cash, 1% collar. */
export const PICKER = draftSpec({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

/** `spec` with each entry's configuration changed, or added. */
export const changed = (spec: AgentSpec, ...changes: ReadonlyArray<{ id: PolicyId; config: object }>) =>
  new AgentSpec({
    policies: [
      ...spec.policies.map((entry) => {
        const change = changes.find((candidate) => candidate.id === entry.id)
        return (change === undefined
          ? entry
          : { id: entry.id, config: { ...entry.config, ...change.config } }) as PolicyEntry
      }),
      ...changes.filter((change) => !spec.policies.some((entry) => entry.id === change.id)) as Array<PolicyEntry>
    ]
  })

/** `spec` without these policies. */
export const without = (spec: AgentSpec, ...ids: ReadonlyArray<PolicyId>) =>
  new AgentSpec({ policies: spec.policies.filter((entry) => !ids.includes(entry.id)) })

/** What operations pay per gas: under the session's daily gas budget, over the chain's base fee. */
export interface Fees {
  readonly maxFeePerGas: bigint
  readonly maxPriorityFeePerGas: bigint
}

type Calls = ReadonlyArray<
  { readonly to: Address; readonly data?: Hex | undefined; readonly value?: bigint | undefined }
>

/** An account, its agent sending operations through the bundler, its grant, and its owner sending calls. */
export interface Agent {
  readonly address: Address
  readonly agent: BundlerClient<Transport, Chain | undefined, SmartAccount>
  readonly grant: Grant.Grant
  readonly agentFor: (grant: Grant.Grant) => Effect.Effect<BundlerClient<Transport, Chain | undefined, SmartAccount>>
  readonly send: (calls: Calls) => Effect.Effect<{ readonly success: boolean }>
}

/**
 * A new Kernel account (an ECDSA owner) with $1,000 and gas, and an agent locked onto it with `spec` (`PICKER` by
 * default), or with `policies` compiled by the caller.
 */
export const agentOnNewAccount: (options: {
  readonly bundlerUrl: string
  readonly fees: Fees
  readonly spec?: AgentSpec | undefined
  readonly policies?: ReadonlyArray<Policy.Policy> | undefined
}) => Effect.Effect<Agent, ChainError, ChainClient | DevChain> = Effect.fnUntraced(function*(options) {
  const chain = yield* ChainClient
  const dev = yield* DevChain

  const owner = privateKeyToAccount(generatePrivateKey())
  const account = yield* Effect.promise(() => KernelAccount.from({ client: chain.client, owner }))
  yield* dev.setEthBalance(account.address, parseEther("1"))
  yield* dev.setUsdcBalance(account.address, BigInt(1_000_000_000))

  const bundler = (signer: typeof account) =>
    createBundlerClient({
      account: signer,
      client: chain.client,
      transport: http(options.bundlerUrl),
      // Alto bundles within 50 ms; viem's default poll (1 s) would make each receipt wait for it.
      pollingInterval: 50,
      userOperation: { estimateFeesPerGas: async () => options.fees }
    })
  const key = privateKeyToAccount(generatePrivateKey())
  const session = Session.from({
    signer: SessionKey.ecdsa(key.address),
    validUntil: Session.expiresIn({ days: 90 }),
    policies: options.policies ?? compileSession(options.spec ?? PICKER)
  })

  // The owner deploys the account and locks the session in one operation, as bluechip does; the agent's trades
  // then use the enabled session.
  const owned = bundler(account)
  const send = (calls: Calls) =>
    Effect.promise(async () =>
      owned.waitForUserOperationReceipt({ hash: await owned.sendUserOperation({ calls: [...calls] }) })
    )
  yield* send(lockCalls(session))
  const grant = yield* lockedGrant(account, session)
  const agentFor = (current: Grant.Grant) =>
    Effect.promise(async () =>
      bundler((await Grant.toAccount(chain.client, { grant: current, signer: key, check: false })) as typeof account)
    )
  return { address: account.address, agent: yield* agentFor(grant), grant, agentFor, send }
})

/** An account's balance of `token`. */
export const balanceOf = Effect.fnUntraced(function*(token: Address, account: Address) {
  return yield* (yield* ChainClient).use(
    "balanceOf",
    (client) => client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [account] })
  )
})

/** The calls of one trade on the stock's pool, valid for two minutes. */
export const trade = (
  stock: Stock,
  side: "buy" | "sell",
  amountIn: bigint,
  recipient: Address,
  minimumOut = BigInt(1)
) =>
  swapCalls({
    stock,
    side,
    amountIn,
    minimumOut,
    recipient,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 120)
  })
