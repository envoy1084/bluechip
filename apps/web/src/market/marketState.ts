import type { MarketStatus } from "@bluechip/domain/market/Market"
import type { MarketState } from "@bluechip/ui/bluechip/market-status"
import * as DateTime from "effect/DateTime"

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
