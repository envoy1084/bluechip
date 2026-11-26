/**
 * What a notification lets you do where it reaches you, beside opening the app: pause every agent from any news of
 * their trades (the kill switch), and cancel a recovery you didn't ask for. Neither needs Face ID, since both only take
 * power away.
 *
 * @since 0.0.0
 */
import type { NotificationKind } from "./Notification.ts"

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type NotificationAction = "pauseAll" | "cancelRecovery"

const TRADES: ReadonlyArray<NotificationKind> = [
  "intentFilled",
  "intentBlocked",
  "intentWaiting",
  "approvalNeeded",
  "approvalExpiring"
]

/**
 * The actions a notification of `kind` offers.
 *
 * **Example** (A recovery asked for)
 *
 * ```ts import.meta.vitest
 * import { actionsOf } from "@bluechip/domain/notifications/Actions"
 *
 * actionsOf("recoveryRequested") // => ["cancelRecovery"]
 * actionsOf("intentBlocked") // => ["pauseAll"]
 * actionsOf("dailyDigest") // => []
 * ```
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const actionsOf = (kind: NotificationKind): ReadonlyArray<NotificationAction> =>
  kind === "recoveryRequested" ? ["cancelRecovery"] : TRADES.includes(kind) ? ["pauseAll"] : []
