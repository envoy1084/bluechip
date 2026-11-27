/**
 * Notifications: what bluechip tells you, kept in your notification center and delivered on the channels you chose
 * for each kind (push to your devices, Telegram), from what happened to your trades, agents, automations and money.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { TimeOfDay } from "../automations/Time.ts"
import { NotificationId } from "../Ids.ts"

/**
 * Where a notification goes: the notification center in the app (always), push to the devices that opted in, and
 * the Telegram chats linked to the account.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Channel = Schema.Literals(["inApp", "push", "telegram"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Channel = typeof Channel.Type

/**
 * How much a notification matters: news (`info`), something to act on or a limit at work (`important`), or your
 * account's safety (`security`: on every channel, through quiet hours).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Severity = Schema.Literals(["info", "important", "security"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Severity = typeof Severity.Type

/**
 * Every kind of notification.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const NotificationKind = Schema.Literals([
  "intentFilled",
  "intentBlocked",
  "intentWaiting",
  "approvalNeeded",
  "approvalExpiring",
  "automationFired",
  "automationMessage",
  "automationSkipped",
  "sessionEnding",
  "sessionRenewed",
  "agentPaused",
  "passkeyAdded",
  "passkeyRemoved",
  "newDevice",
  "recoveryKeyChanged",
  "recoveryRequested",
  "recoveryCancelled",
  "recoveryCompleted",
  "chatLinked",
  "chatUnlinked",
  "deposit",
  "withdrawal",
  "balanceUnexplained",
  "dailyDigest"
])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type NotificationKind = typeof NotificationKind.Type

/**
 * A notification in your center: what happened, in a title and a sentence, the page it is about (`link`, a path in
 * the app) and the record it is about.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Notification extends Schema.Class<Notification>("@bluechip/domain/notifications/Notification")({
  id: NotificationId,
  kind: NotificationKind,
  severity: Severity,
  title: Schema.String,
  body: Schema.String,
  /** A path in the app (`/agents/agent_…`), `null` when there is nothing to open. */
  link: Schema.NullOr(Schema.String),
  subjectType: Schema.NullOr(Schema.String),
  subjectId: Schema.NullOr(Schema.String),
  createdAt: Schema.DateTimeUtc,
  readAt: Schema.NullOr(Schema.DateTimeUtc)
}) {}

/**
 * A notification before it is stored: its kind and words, and the key that makes it one notification however often
 * what caused it is seen (`intentFilled:intent_…`). A schema, so a draft can wait in the notifications' outbox.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const NotificationDraft = Schema.Struct({
  kind: NotificationKind,
  title: Schema.String,
  body: Schema.String,
  link: Schema.NullOr(Schema.String),
  subjectType: Schema.NullOr(Schema.String),
  subjectId: Schema.NullOr(Schema.String),
  dedupeKey: Schema.String
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type NotificationDraft = typeof NotificationDraft.Type

/**
 * Where one kind of notification goes, and whether it waits for the daily digest instead of going out at once.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const NotificationRule = Schema.Struct({
  kind: NotificationKind,
  channels: Schema.Array(Channel),
  digest: Schema.Boolean
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type NotificationRule = typeof NotificationRule.Type

/**
 * Hours in which push and Telegram stay quiet, in your time zone: what comes in then goes out when they end (security
 * notifications don't wait). A window past midnight (`22:00` to `07:00`) wraps.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const QuietHours = Schema.Struct({ from: TimeOfDay, to: TimeOfDay })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type QuietHours = typeof QuietHours.Type

/**
 * Your notification settings: a rule for every kind (the defaults for those you never changed), and quiet hours.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class NotificationSettings
  extends Schema.Class<NotificationSettings>("@bluechip/domain/notifications/NotificationSettings")({
    rules: Schema.Array(NotificationRule),
    quietHours: Schema.NullOr(QuietHours)
  })
{}
