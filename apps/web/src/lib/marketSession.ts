import type { MarketSession, MarketStatus } from "@bluechip/domain/market/Market"
import type { MarketStatusProps } from "@bluechip/ui/bluechip/market-status"
import * as DateTime from "effect/DateTime"

/** How each session outside regular hours is named. */
export const SESSION_LABEL: Readonly<Record<Exclude<MarketSession, "regular" | "paused">, string>> = {
  preMarket: "Pre-market",
  afterHours: "After hours",
  overnight: "Overnight"
}

/** The props of the UI's market pill for the server's market status. */
export const marketPillProps = (status: MarketStatus): MarketStatusProps => {
  switch (status.session) {
    case "regular":
      return {
        state: "open",
        ...(status.closesAt === null ? {} : { closesAt: DateTime.toDateUtc(status.closesAt) })
      }
    case "paused":
      return { state: "paused", resumesAt: DateTime.toDateUtc(status.changesAt) }
    default:
      return { state: "extended", session: SESSION_LABEL[status.session], opensAt: DateTime.toDateUtc(status.opensAt) }
  }
}
