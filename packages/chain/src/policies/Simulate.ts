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
import { callBundler } from "../ChainTelemetry.ts"
import type { Deployment } from "../Deployment.ts"
import { type Refusal, refusalFrom } from "./Refusals.ts"
import { guardedCallGas } from "./Session.ts"

/**
 * What the chain said: the operation passes every policy (with its gas), a policy refused it, or the answer couldn't
 * be had (the bundler, the node, or a contract outside the session failed) and the question can be asked again.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Decision =
  | {
    readonly _tag: "Passes"
    readonly callGasLimit: bigint
    readonly verificationGasLimit: bigint
    readonly preVerificationGas: bigint
  }
  | { readonly _tag: "Refused"; readonly refusal: Refusal }
  | { readonly _tag: "Retry"; readonly reason: string }

/**
 * Whether the agent's session lets it send `calls` (one or more approve-and-swap pairs, judged together), by
 * estimating them as the agent through `provider`'s bundler. It asks for at least `guardedCallGas` for its swaps, as it
 * will when sent. The gas it passes with is what to send it with, so sending needs no second estimate. Traced as
 * `simulateAsAgent` with `simulation.result` (`passes`, `refused`, `retry`) over the bundler's
 * `eth_estimateUserOperationGas`.
 *
 * @stability unstable
 * @category simulation
 * @since 0.0.0
 */
export const simulateAsAgent = (
  deployment: Deployment,
  agent: BundlerClient<Transport, Chain | undefined, SmartAccount>,
  calls: ReadonlyArray<{ readonly to: Address; readonly data?: Hex | undefined; readonly value?: bigint | undefined }>,
  provider = "alto"
): Effect.Effect<Decision> => {
  // Each swap is an approval and the swap it pays for.
  const least = guardedCallGas(calls.length / 2)
  return callBundler(
    "eth_estimateUserOperationGas",
    provider,
    () => agent.estimateUserOperationGas({ calls: [...calls], callGasLimit: least })
  ).pipe(
    Effect.map((estimate): Decision => ({
      _tag: "Passes",
      callGasLimit: estimate.callGasLimit > least ? estimate.callGasLimit : least,
      verificationGasLimit: estimate.verificationGasLimit,
      preVerificationGas: estimate.preVerificationGas
    })),
    Effect.catch((failure) => {
      const refusal = refusalFrom(deployment, failure.cause)
      return Effect.succeed<Decision>(
        refusal === undefined ?
          { _tag: "Retry", reason: failure.cause instanceof Error ? failure.cause.message : String(failure.cause) } :
          { _tag: "Refused", refusal }
      )
    }),
    Effect.tap((decision) => Effect.annotateCurrentSpan("simulation.result", decision._tag.toLowerCase())),
    Effect.withSpan("simulateAsAgent", { attributes: { "simulation.calls": calls.length } })
  )
}
