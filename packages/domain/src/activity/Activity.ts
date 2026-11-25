/**
 * Everything that happened to the user's money, newest first: trades and withdrawals now, agents' actions later.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { Transfer } from "../portfolio/Transfer.ts"
import { Trade } from "../trading/Trade.ts"

/**
 * One line of activity.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const ActivityItem = Schema.TaggedUnion({
  Trade: { trade: Trade },
  Withdrawal: { transfer: Transfer }
}).annotate({ identifier: "@bluechip/domain/activity/Activity/ActivityItem" })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type ActivityItem = typeof ActivityItem.Type

/**
 * Which activity to list: everything, trades, or cash moving in and out.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const ActivityKind = Schema.Literals(["all", "trades", "cash"])

/**
 * How far back to list.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const ActivityPeriod = Schema.Literals(["7d", "30d", "all"])
