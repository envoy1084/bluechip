import type { MarketStatus } from "@bluechip/domain/market/Market"
import type { MarketState } from "@bluechip/ui/bluechip/market-status"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { marketStatusAtom } from "../atoms/market.ts"

const toDate = (date: DateTime.Utc | null) => date === null ? undefined : DateTime.toDateUtc(date)

/** The props of the UI's market pill for the server's market status. */
export const marketPillProps = (status: MarketStatus) => {
  const state: MarketState = status.state === "open" ? "open" : status.reason === "weekend" ? "weekend" : "closed"
  const closesAt = toDate(status.closesAt)
  const opensAt = toDate(status.opensAt)
  return {
    state,
    ...(closesAt === undefined ? {} : { closesAt }),
    ...(opensAt === undefined ? {} : { opensAt })
  }
}

/**
 * Whether a fresh price is coming from outside regular hours: Coinbase's feeds run 24/5, so prices keep moving
 * overnight on weekdays while the market itself is closed.
 */
export const useAfterHours = (): boolean => {
  const status = useAtomValue(marketStatusAtom)
  return AsyncResult.isSuccess(status) && status.value.state === "closed"
}
