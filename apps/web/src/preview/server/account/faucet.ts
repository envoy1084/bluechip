// The faucet as paper money's would answer: test USDC arrives as a deposit, up to the day's allowance.
import { BluechipApi } from "@bluechip/domain/Api"
import { FaucetLimitReached, InvalidRequest } from "@bluechip/domain/Errors"
import { Usdc } from "@bluechip/domain/market/Units"
import { notificationOfTransfer } from "@bluechip/domain/notifications/Drafts"
import { allowanceAt, FaucetGrant } from "@bluechip/domain/paper/Faucet"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { nextNumber, notify, portfolioChanged } from "../../world/account/changes.ts"
import { transferOf } from "../../world/account/history.ts"
import { stockName } from "../../world/account/notifications.ts"
import { Preview } from "../Preview.ts"
import { changeNow } from "./ceremonies.ts"

export const FaucetHandlers = HttpApiBuilder.group(
  BluechipApi,
  "faucet",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview
    // What this preview session got today; the cash shown comes from the money slice, which this doesn't change.
    let granted = { day: "", amount: BigInt(0) }

    const grantedToday = (now: DateTime.Utc) => {
      const day = DateTime.formatIsoDate(now)
      if (granted.day !== day) granted = { day, amount: BigInt(0) }
      return Usdc.make(granted.amount)
    }

    return handlers.handleAll({
      allowance: () => Effect.sync(() => allowanceAt(grantedToday(DateTime.nowUnsafe()), DateTime.nowUnsafe())),
      claim: ({ payload }) =>
        Effect.gen(function*() {
          if (payload.amount === BigInt(0)) return yield* new InvalidRequest({ field: "amount", problem: "outOfRange" })
          const now = DateTime.nowUnsafe()
          const before = allowanceAt(grantedToday(now), now)
          if (payload.amount > before.remaining) {
            return yield* new FaucetLimitReached({ remaining: before.remaining, resetsAt: before.resetsAt })
          }

          granted = { ...granted, amount: granted.amount + payload.amount }
          changeNow(preview, (world) => {
            const dollars = Number(payload.amount / BigInt(1_000_000))
            const deposit = transferOf(nextNumber(world.account), "deposit", dollars, "confirmed", now)
            world.account.transfers.unshift(deposit)
            return [portfolioChanged(), notify(world.account, notificationOfTransfer(deposit, stockName)!)]
          })
          return new FaucetGrant({
            amount: payload.amount,
            txHash: null,
            allowance: allowanceAt(grantedToday(now), now)
          })
        })
    })
  })
)
