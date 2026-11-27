import { ChainClient } from "@bluechip/chain/ChainClient"
import type * as AccountError from "@namera-ai/sdk/effect/accounts/AccountError"
import * as KernelAccount from "@namera-ai/sdk/effect/accounts/KernelAccount"
import type * as ChainError from "@namera-ai/sdk/effect/ChainError"
import * as Bundler from "@namera-ai/sdk/effect/infra/Bundler"
import * as Compat from "@namera-ai/sdk/effect/infra/Compat"
import * as Paymaster from "@namera-ai/sdk/effect/infra/Paymaster"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import {
  type BundlerClient,
  createBundlerClient,
  type SmartAccount,
  type WebAuthnAccount
} from "viem/account-abstraction"

/**
 * Who pays gas: the account itself in ETH (`none`, the only option on the local fork), Alchemy's bundler
 * (`alchemy-bso`), or Alchemy's Gas Manager paymaster (`alchemy-paymaster`); both Alchemy options draw on the Gas
 * Manager policy's balance.
 */
type GasSponsorship = "none" | "alchemy-bso" | "alchemy-paymaster"

interface Setup {
  readonly provider: "alto" | "alchemy"
  readonly gas: GasSponsorship
  readonly bundler: Bundler.Bundler
  readonly paymaster: Paymaster.Paymaster | undefined
}

const setupFromConfig = Effect.gen(function*() {
  const bundler = yield* Config.Literals(["local", "alchemy"], "BUNDLER").pipe(Config.withDefault("local"))
  const gas: GasSponsorship = yield* Config.Literals(["none", "alchemy-bso", "alchemy-paymaster"], "GAS_SPONSORSHIP")
    .pipe(Config.withDefault("none"))
  if (bundler === "local") {
    if (gas !== "none") return yield* Effect.die(new Error(`GAS_SPONSORSHIP=${gas} needs BUNDLER=alchemy`))
    const url = yield* Config.String("BUNDLER_URL").pipe(Config.withDefault("http://localhost:4337"))
    return { provider: "alto", gas, bundler: Bundler.from({ url }), paymaster: undefined } satisfies Setup
  }
  const apiKey = Redacted.value(yield* Config.Redacted("ALCHEMY_API_KEY"))
  if (gas === "none") {
    return { provider: "alchemy", gas, bundler: Bundler.alchemy({ apiKey }), paymaster: undefined } satisfies Setup
  }
  const policyId = yield* Config.String("ALCHEMY_GAS_POLICY_ID")
  return gas === "alchemy-bso"
    ? {
      provider: "alchemy",
      gas,
      bundler: Bundler.alchemy({ apiKey, sponsorship: { policyId } }),
      paymaster: undefined
    } satisfies Setup
    : {
      provider: "alchemy",
      gas,
      bundler: Bundler.alchemy({ apiKey }),
      paymaster: Paymaster.alchemy({ apiKey, policyId })
    } satisfies Setup
})

/**
 * Namera v2 for the server: Kernel 3.3 accounts owned by passkeys, and bundler clients that send their user
 * operations with the configured bundler and gas sponsorship. Startup fails when Namera's compatibility matrix says
 * the bundler and paymaster don't work together.
 */
export class Namera extends Context.Service<Namera, {
  /**
   * Who pays gas (`GAS_SPONSORSHIP`): anything but `none` means an account needs no ETH to send; with `alchemy-bso`
   * an operation's fees must be zero.
   */
  readonly sponsorship: GasSponsorship
  /** Whose bundler sends operations: Alto (`BUNDLER=local`) or Alchemy's; named in bundler spans and metrics. */
  readonly provider: "alto" | "alchemy"
  /**
   * The user's Kernel account owned by `owner`: at the address the sign-up passkey fixed (computed from `owner` when
   * no `address` is given), whether or not it is deployed yet. Any of the account's passkeys signs for it.
   */
  readonly kernelAccount: (
    owner: WebAuthnAccount,
    address?: `0x${string}` | undefined
  ) => Effect.Effect<KernelAccount.KernelAccount, AccountError.AccountError | ChainError.ChainError>
  /** A bundler client for `account`; `estimateFeesPerGas` replaces the bundler's own fee estimate. */
  readonly bundlerClient: (
    account: SmartAccount,
    options?: {
      readonly estimateFeesPerGas?:
        | (() => Promise<{ readonly maxFeePerGas: bigint; readonly maxPriorityFeePerGas: bigint }>)
        | undefined
    }
  ) => BundlerClient
}>()("@bluechip/server/Namera") {
  static readonly layer = Layer.effect(
    Namera,
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const setup = yield* setupFromConfig
      const compat = Compat.check({
        bundler: setup.bundler,
        paymaster: setup.paymaster,
        chainId: chain.deployment.chainId
      })
      for (const warning of compat.warnings) yield* Effect.logWarning(`Namera: ${warning.message}`)
      if (!compat.ok) {
        return yield* Effect.die(new Error(`Namera: ${compat.problems.map((problem) => problem.message).join("; ")}`))
      }
      return {
        sponsorship: setup.gas,
        provider: setup.provider,
        kernelAccount: (owner, address) =>
          KernelAccount.from({ client: chain.client, owner, ...(address === undefined ? {} : { address }) }),
        bundlerClient: (account, options) =>
          createBundlerClient({
            account,
            client: chain.client,
            // The local fork mines every second; production bundlers include in a block or two (2 s on Base).
            pollingInterval: chain.network === "local" ? 250 : 1000,
            ...setup.bundler,
            ...(setup.paymaster === undefined ? {} : { paymaster: setup.paymaster }),
            // After the bundler's settings, which carry its own fee estimate.
            ...(options?.estimateFeesPerGas === undefined ? {} : {
              userOperation: { estimateFeesPerGas: async () => ({ ...(await options.estimateFeesPerGas!()) }) }
            })
          })
      }
    })
  )
}
