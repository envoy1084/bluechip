import { ChainClient } from "@bluechip/chain/ChainClient"
import type { ChainError } from "@bluechip/chain/ChainError"
import { assets, readBalances } from "@bluechip/chain/funding/Balances"
import * as Cache from "effect/Cache"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { Address } from "viem"

/** An account's balance of each asset, by symbol (`USDC` or a stock), in base units. */
export type Holdings = ReadonlyMap<string, bigint>

/** One account's balances, from a read of every account's (in the order of `assets`). */
export const holdingsFrom = (balances: ReadonlyArray<bigint>): Holdings =>
  new Map(assets.map((asset, index) => [asset.symbol, balances[index] ?? BigInt(0)]))

/**
 * Accounts' balances read from the chain when a page needs them, kept for 15 seconds so refreshes and several tabs
 * share one read. Nothing watches accounts in the background; whatever moves money here invalidates the account.
 */
export class AccountBalances extends Context.Service<AccountBalances, {
  readonly of: (account: Address) => Effect.Effect<Holdings, ChainError>
  readonly invalidate: (account: Address) => Effect.Effect<void>
}>()("@bluechip/server/AccountBalances") {
  static readonly layer = Layer.effect(
    AccountBalances,
    Effect.gen(function*() {
      const chain = yield* ChainClient

      const cache = yield* Cache.make({
        lookup: (account: Address) =>
          Effect.map(readBalances(chain, [account]), ({ balances }) => holdingsFrom(balances.get(account)!)),
        capacity: 10_000,
        timeToLive: "15 seconds"
      })

      return {
        of: (account) => Cache.get(cache, account),
        invalidate: (account) => Cache.invalidate(cache, account)
      }
    })
  )
}
