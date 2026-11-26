// The mock API's notifications and where they reach you: the center (newest first, read one or all), the rules per
// kind and quiet hours, the devices that get push, and the Telegram chats linked with a one-time code.
import { BluechipApi } from "@bluechip/domain/Api"
import { LINK_CODE_ALPHABET, LINK_CODE_MINUTES, LinkCode } from "@bluechip/domain/channels/Channel"
import { NotFound } from "@bluechip/domain/Errors"
import type { PushSubscriptionId } from "@bluechip/domain/Ids"
import { notificationOfChatLink } from "@bluechip/domain/notifications/Drafts"
import { KINDS, ruleFor } from "@bluechip/domain/notifications/Kinds"
import { Notification, NotificationSettings } from "@bluechip/domain/notifications/Notification"
import { PushDevice } from "@bluechip/domain/push/Push"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Layer from "effect/Layer"
import type { AccountSlice } from "../../world/account.ts"
import { nextNumber, notify, record } from "../../world/account/changes.ts"
import { previewId } from "../../world/ids.ts"
import { Preview } from "../Preview.ts"
import { changeNow } from "./ceremonies.ts"
import { pageOf } from "./pages.ts"

/** Every kind's rule in force, and quiet hours. */
export const settingsOf = (account: AccountSlice): NotificationSettings =>
  new NotificationSettings({
    rules: KINDS.map((info) => ruleFor(info.kind, account.rules.get(info.kind))),
    quietHours: account.quietHours
  })

const NotificationsHandlers = HttpApiBuilder.group(
  BluechipApi,
  "notifications",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      list: ({ query }) =>
        Effect.sync(() => {
          const all = preview.world.account.notifications
          return pageOf(query.unread === "true" ? all.filter((notification) => notification.readAt === null) : all, {
            pageSize: query.pageSize ?? 20,
            pageToken: query.pageToken
          })
        }),
      unreadCount: () =>
        Effect.sync(() => ({
          count: preview.world.account.notifications.filter((notification) => notification.readAt === null).length
        })),
      read: Effect.fn(function*({ params }) {
        const notification = preview.world.account.notifications.find((candidate) => candidate.id === params.id)
        if (notification === undefined) return yield* new NotFound({ resource: "notification", id: params.id })
        if (notification.readAt !== null) return notification

        const read = new Notification({ ...notification, readAt: DateTime.nowUnsafe() })
        preview.update((world) => {
          world.account.notifications = world.account.notifications.map((candidate) =>
            candidate.id === read.id ? read : candidate
          )
        })
        return read
      }),
      readAll: () =>
        Effect.sync(() => {
          const now = DateTime.nowUnsafe()
          preview.update((world) => {
            world.account.notifications = world.account.notifications.map((notification) =>
              notification.readAt === null ? new Notification({ ...notification, readAt: now }) : notification
            )
          })
        }),
      settings: () => Effect.sync(() => settingsOf(preview.world.account)),
      setRule: ({ params, payload }) =>
        Effect.sync(() => {
          preview.update((world) => {
            world.account.rules.set(params.kind, { channels: payload.channels, digest: payload.digest })
          })
          return settingsOf(preview.world.account)
        }),
      setQuietHours: ({ payload }) =>
        Effect.sync(() => {
          preview.update((world) => {
            world.account.quietHours = payload.quietHours
          })
          return settingsOf(preview.world.account)
        })
    })
  })
)

const PushHandlers = HttpApiBuilder.group(
  BluechipApi,
  "push",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      key: () => Effect.sync(() => ({ publicKey: preview.world.account.pushKey })),
      devices: () => Effect.sync(() => preview.world.account.pushDevices),
      // The same endpoint again replaces its subscription.
      subscribe: ({ payload }) =>
        Effect.sync(() => {
          const device = new PushDevice({
            id: previewId("pushsub", nextNumber(preview.world.account)) as PushSubscriptionId,
            device: payload.device,
            endpoint: payload.endpoint,
            createdAt: DateTime.nowUnsafe()
          })
          preview.update((world) => {
            world.account.pushDevices = [
              ...world.account.pushDevices.filter((other) => other.endpoint !== payload.endpoint),
              device
            ]
          })
          return device
        }),
      unsubscribe: Effect.fn(function*({ params }) {
        if (!preview.world.account.pushDevices.some((device) => device.id === params.id)) {
          return yield* new NotFound({ resource: "pushSubscription", id: params.id })
        }
        preview.update((world) => {
          world.account.pushDevices = world.account.pushDevices.filter((device) => device.id !== params.id)
        })
      })
    })
  })
)

const BOT = "bluechip_market_bot"

const ChannelsHandlers = HttpApiBuilder.group(
  BluechipApi,
  "channels",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      links: () => Effect.sync(() => preview.world.account.links),
      // The code links nothing by itself: the panel's "Telegram linked" stands in for sending it to the bot.
      linkCode: ({ params }) =>
        Effect.sync(() => {
          const n = nextNumber(preview.world.account)
          const code = Array.from({ length: 8 }, (_, index) =>
            LINK_CODE_ALPHABET[(n * 7 + index * 11) % LINK_CODE_ALPHABET.length]).join("")
          return new LinkCode({
            platform: params.platform,
            code,
            bot: `@${BOT}`,
            deepLink: `https://t.me/${BOT}?start=${code}`,
            expiresAt: DateTime.add(DateTime.nowUnsafe(), { minutes: LINK_CODE_MINUTES })
          })
        }),
      unlink: Effect.fn(function*({ params }) {
        const link = preview.world.account.links.find((candidate) => candidate.id === params.id)
        if (link === undefined) return yield* new NotFound({ resource: "channelLink", id: params.id })

        changeNow(preview, (world) => {
          world.account.links = world.account.links.filter((candidate) => candidate.id !== link.id)
          record(world.account, {
            actor: "owner",
            action: "channel.unlinked",
            subjectType: "channelLink",
            subjectId: link.id,
            data: { platform: link.platform }
          })
          return [notify(world.account, notificationOfChatLink(link, "unlinked"))]
        })
      })
    })
  })
)

export const NotificationGroupsLive = Layer.mergeAll(NotificationsHandlers, PushHandlers, ChannelsHandlers)
