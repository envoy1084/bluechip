import {
  BluechipApiClient,
  channelsReactivityKey,
  liveReactivityKey,
  notificationsReactivityKey
} from "../../../lib/api/client.ts"

export const notificationKeys = [notificationsReactivityKey, liveReactivityKey]

/** How many notifications the bell's list shows. */
export const bellPageSize = 20

/** The latest notifications, newest first. */
export const notificationsAtom = BluechipApiClient.query("notifications", "list", {
  query: { pageSize: bellPageSize },
  reactivityKeys: notificationKeys
})

/** How many notifications you haven't read, for the bell's badge. */
export const unreadCountAtom = BluechipApiClient.query("notifications", "unreadCount", {
  reactivityKeys: notificationKeys
})

export const readNotificationAtom = BluechipApiClient.mutation("notifications", "read")

export const readAllNotificationsAtom = BluechipApiClient.mutation("notifications", "readAll")

/** Where each kind goes, and quiet hours. */
export const notificationSettingsAtom = BluechipApiClient.query("notifications", "settings", {
  reactivityKeys: [notificationsReactivityKey]
})

export const setRuleAtom = BluechipApiClient.mutation("notifications", "setRule")

export const setQuietHoursAtom = BluechipApiClient.mutation("notifications", "setQuietHours")

export const channelKeys = [channelsReactivityKey, liveReactivityKey]

/** Chats linked to the account. */
export const channelLinksAtom = BluechipApiClient.query("channels", "links", { reactivityKeys: channelKeys })

/** A one-time code to link a chat. */
export const linkCodeAtom = BluechipApiClient.mutation("channels", "linkCode")

export const unlinkAtom = BluechipApiClient.mutation("channels", "unlink")

export const pushKeys = ["push"]

/** The server's VAPID public key (`null` when push isn't set up), and the devices that opted in. */
export const pushKeyAtom = BluechipApiClient.query("push", "key", {})

export const pushDevicesAtom = BluechipApiClient.query("push", "devices", { reactivityKeys: pushKeys })

export const subscribePushAtom = BluechipApiClient.mutation("push", "subscribe")

export const unsubscribePushAtom = BluechipApiClient.mutation("push", "unsubscribe")
