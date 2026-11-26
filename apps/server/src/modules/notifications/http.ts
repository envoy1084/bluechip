import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { Notifications } from "./Notifications.ts"

export const NotificationsHandlers = HttpApiBuilder.group(
  BluechipApi,
  "notifications",
  Effect.fn(function*(handlers) {
    const notifications = yield* Notifications

    return handlers.handleAll({
      list: ({ query }) =>
        CurrentUser.use((user) =>
          notifications.list(user.id, {
            pageSize: query.pageSize,
            pageToken: query.pageToken,
            unread: query.unread === "true"
          })
        ),
      unreadCount: () =>
        CurrentUser.use((user) => Effect.map(notifications.unreadCount(user.id), (count) => ({ count }))),
      read: ({ params }) => CurrentUser.use((user) => notifications.read(user.id, params.id)),
      readAll: () => CurrentUser.use((user) => notifications.readAll(user.id)),
      settings: () => CurrentUser.use((user) => notifications.settings(user.id)),
      setRule: ({ params, payload }) => CurrentUser.use((user) => notifications.setRule(user.id, params.kind, payload)),
      setQuietHours: ({ payload }) =>
        CurrentUser.use((user) => notifications.setQuietHours(user.id, payload.quietHours))
    })
  })
)
