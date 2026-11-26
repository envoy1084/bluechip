/**
 * Web push: each browser that opts in stores a subscription (its push service's endpoint and the keys messages are
 * encrypted for), and gets bluechip's notifications on the channels' rules.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { PushSubscriptionId } from "../Ids.ts"

/**
 * A subscription as the browser's `PushSubscription.toJSON()` gives it, with a name for the device.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const NewPushSubscription = Schema.Struct({
  endpoint: Schema.String.check(Schema.isPattern(/^https:\/\//), Schema.isMaxLength(2048)),
  keys: Schema.Struct({
    /** The browser's P-256 public key, base64url. */
    p256dh: Schema.String.check(Schema.isMinLength(80), Schema.isMaxLength(100)),
    /** The 16-byte authentication secret, base64url. */
    auth: Schema.String.check(Schema.isMinLength(16), Schema.isMaxLength(32))
  }),
  /** "Chrome on Mac": how settings names this device. */
  device: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80))
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type NewPushSubscription = typeof NewPushSubscription.Type

/**
 * A device that gets push notifications.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class PushDevice extends Schema.Class<PushDevice>("@bluechip/domain/push/Push/PushDevice")({
  id: PushSubscriptionId,
  device: Schema.String,
  /** The push service's endpoint: a browser finds its own device by it. */
  endpoint: Schema.String,
  createdAt: Schema.DateTimeUtc
}) {}

/**
 * What the service worker receives in a push: the notification's words and the page to open.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const PushMessage = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  body: Schema.String,
  /** A path in the app. */
  link: Schema.String
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type PushMessage = typeof PushMessage.Type
