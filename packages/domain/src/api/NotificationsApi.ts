/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as Schema from "effect/Schema"
import { Authentication } from "../Auth.ts"
import { NotFound } from "../Errors.ts"
import { NotificationId } from "../Ids.ts"
import {
  Channel,
  Notification,
  NotificationKind,
  NotificationSettings,
  QuietHours
} from "../notifications/Notification.ts"
import { Page, PageQuery } from "../Page.ts"

/**
 * The notification center: your notifications, newest first (`unread` for only those you haven't read), how many you
 * haven't read, reading them, and where each kind goes. New ones arrive as `NotificationAdded` live events.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class NotificationsApi extends HttpApiGroup.make("notifications").add(
  HttpApiEndpoint.get("list", "/notifications", {
    query: { ...PageQuery, unread: Schema.optionalKey(Schema.Literal("true")) },
    success: Page(Notification)
  }),
  HttpApiEndpoint.get("unreadCount", "/notifications/unread-count", {
    success: Schema.Struct({ count: Schema.Int })
  }),
  HttpApiEndpoint.post("read", "/notifications/:id/read", {
    params: { id: NotificationId },
    success: Notification,
    error: NotFound
  }),
  HttpApiEndpoint.post("readAll", "/notifications/read", {
    success: Schema.Void
  }),
  HttpApiEndpoint.get("settings", "/notifications/settings", {
    success: NotificationSettings
  }),
  HttpApiEndpoint.put("setRule", "/notifications/settings/rules/:kind", {
    params: { kind: NotificationKind },
    /** The center (`inApp`) is always on, and a security kind always goes everywhere, whatever is sent. */
    payload: Schema.Struct({ channels: Schema.Array(Channel), digest: Schema.Boolean }),
    success: NotificationSettings
  }),
  HttpApiEndpoint.put("setQuietHours", "/notifications/settings/quiet-hours", {
    /** `null` turns them off. */
    payload: Schema.Struct({ quietHours: Schema.NullOr(QuietHours) }),
    success: NotificationSettings
  })
).middleware(Authentication) {}
