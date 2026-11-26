/**
 * What a notification lets you do where it reaches you, beside opening it: review a trade waiting for your approval,
 * pause every agent when a policy stopped one of their trades (the kill switch, where it reads as an answer rather than
 * an alarm), and cancel a recovery you didn't ask for. Pausing and cancelling need no Face ID, since both only take
 * power away; reviewing opens the approval, where Face ID decides.
 *
 * @since 0.0.0
 */
import type { NotificationKind } from "./Notification.ts"

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type NotificationAction = "review" | "pauseAll" | "cancelRecovery"

/**
 * Each action's button, and what it says once done.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const ACTION_LABELS: Readonly<Record<NotificationAction, { readonly idle: string; readonly done: string }>> = {
  review: { idle: "Review", done: "Reviewed" },
  pauseAll: { idle: "Pause all agents", done: "Every agent is paused" },
  cancelRecovery: { idle: "Cancel recovery", done: "Recovery cancelled" }
}

const ACTIONS: Partial<Record<NotificationKind, ReadonlyArray<NotificationAction>>> = {
  approvalNeeded: ["review"],
  approvalExpiring: ["review"],
  intentBlocked: ["pauseAll"],
  recoveryRequested: ["cancelRecovery"]
}

/**
 * The actions a notification of `kind` offers: most offer none, opening it is enough.
 *
 * **Example** (A recovery asked for)
 *
 * ```ts import.meta.vitest
 * import { actionsOf } from "@bluechip/domain/notifications/Actions"
 *
 * actionsOf("recoveryRequested") // => ["cancelRecovery"]
 * actionsOf("approvalNeeded") // => ["review"]
 * actionsOf("intentFilled") // => []
 * ```
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const actionsOf = (kind: NotificationKind): ReadonlyArray<NotificationAction> => ACTIONS[kind] ?? []
