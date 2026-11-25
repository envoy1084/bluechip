/**
 * bluechip's decision on an agent's operation: estimate it as the agent through the bundler, which runs the session's
 * validation policies and simulates its execution with `TradeGuard`, and read the chain's answer. No rule is checked
 * offchain.
 *
 * @since 0.0.0
 */
import * as Effect from "effect/Effect"
import type { Address, Chain, Hex, Transport } from "viem"
import type { BundlerClient, SmartAccount } from "viem/account-abstraction"
import { type Refusal, refusalFrom } from "./Refusals.ts"
import { guardedTradeCallGas } from "./Session.ts"

/**
 * What the chain said: the operation passes every policy (with its gas), a policy refused it, or the answer couldn't
 * be had (the bundler, the node, or a contract outside the session failed) and the question can be asked again.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Decision =
  | { readonly _tag: "Passes"; readonly callGasLimit: bigint }
  | { readonly _tag: "Refused"; readonly refusal: Refusal }
  | { readonly _tag: "Retry"; readonly reason: string }

/**
 * Whether the agent's session lets it send `calls`, by estimating them as the agent. A trade asks for at least
 * `guardedTradeCallGas`, as it will when sent.
 *
 * @stability unstable
 * @category simulation
 * @since 0.0.0
 */
export const simulateAsAgent = (
  agent: BundlerClient<Transport, Chain | undefined, SmartAccount>,
  calls: ReadonlyArray<{ readonly to: Address; readonly data?: Hex | undefined; readonly value?: bigint | undefined }>
): Effect.Effect<Decision> =>
  Effect.tryPromise(() => agent.estimateUserOperationGas({ calls: [...calls], callGasLimit: guardedTradeCallGas }))
    .pipe(
      Effect.map((estimate): Decision => ({
        _tag: "Passes",
        callGasLimit: estimate.callGasLimit > guardedTradeCallGas ? estimate.callGasLimit : guardedTradeCallGas
      })),
      Effect.catch((failure) => {
        const refusal = refusalFrom(failure.cause)
        return Effect.succeed<Decision>(
          refusal === undefined ?
            { _tag: "Retry", reason: failure.cause instanceof Error ? failure.cause.message : String(failure.cause) } :
            { _tag: "Refused", refusal }
        )
      })
    )
