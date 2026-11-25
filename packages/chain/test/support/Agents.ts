// An agent locked onto a new account, as bluechip locks one, on the devnet or a fork of Base.
import { sessionPolicies } from "@bluechip/chain/agents/Policies"
import { lockCalls, lockedGrant } from "@bluechip/chain/agents/Sessions"
import { ChainClient } from "@bluechip/chain/ChainClient"
import type { ChainError } from "@bluechip/chain/ChainError"
import type { Stock } from "@bluechip/chain/Contracts"
import { DevChain } from "@bluechip/chain/DevChain"
import { swapCalls } from "@bluechip/chain/market/Swaps"
import { type PolicyConfig, policyConfig } from "@bluechip/domain/agents/PolicyConfig"
import { draftLimits } from "@bluechip/domain/agents/Templates"
import { Grant, KernelAccount, Session, SessionKey } from "@namera-ai/sdk"
import * as Effect from "effect/Effect"
import { type Address, type Chain, erc20Abi, http, parseEther, type Transport } from "viem"
import { type BundlerClient, createBundlerClient, type SmartAccount } from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

/** A balanced Stock picker for NVDA and AAPL: $100 a trade, $250 a day, 30% in one stock, 10% cash, 1% collar. */
export const LIMITS = draftLimits({
  template: "stockPicker",
  preset: "balanced",
  stocks: ["NVDA", "AAPL"],
  targets: []
})

/** What operations pay per gas: under the session's daily gas budget, over the chain's base fee. */
export interface Fees {
  readonly maxFeePerGas: bigint
  readonly maxPriorityFeePerGas: bigint
}

/** An account's address, and its agent sending operations through the bundler. */
export interface Agent {
  readonly address: Address
  readonly agent: BundlerClient<Transport, Chain | undefined, SmartAccount>
}

/** A new Kernel account (an ECDSA owner) with $1,000 and gas, and an agent locked onto it (`LIMITS` by default). */
export const agentOnNewAccount: (options: {
  readonly bundlerUrl: string
  readonly fees: Fees
  readonly config?: PolicyConfig | undefined
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
  const agent = privateKeyToAccount(generatePrivateKey())
  const session = Session.from({
    signer: SessionKey.ecdsa(agent.address),
    validUntil: Session.expiresIn({ days: 90 }),
    policies: sessionPolicies(options.config ?? policyConfig(LIMITS))
  })

  // The owner deploys the account and locks the session in one operation, as bluechip does; the agent's trades
  // then use the enabled session.
  const owned = bundler(account)
  yield* Effect.promise(async () =>
    owned.waitForUserOperationReceipt({ hash: await owned.sendUserOperation({ calls: [...lockCalls(session)] }) })
  )
  const grant = yield* lockedGrant(account, session)
  const agentAccount = yield* Effect.promise(() =>
    Grant.toAccount(chain.client, { grant, signer: agent, check: false })
  )
  return { address: account.address, agent: bundler(agentAccount as typeof account) }
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
