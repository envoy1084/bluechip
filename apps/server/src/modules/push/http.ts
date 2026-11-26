import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { PushConfig } from "./PushConfig.ts"
import { PushSubscriptions } from "./PushSubscriptions.ts"

export const PushHandlers = HttpApiBuilder.group(
  BluechipApi,
  "push",
  Effect.fn(function*(handlers) {
    const { vapid } = yield* PushConfig
    const subscriptions = yield* PushSubscriptions

    return handlers.handleAll({
      key: () => Effect.succeed({ publicKey: vapid?.publicKey ?? null }),
      devices: () => CurrentUser.use((user) => subscriptions.devices(user.id)),
      subscribe: ({ payload }) => CurrentUser.use((user) => subscriptions.subscribe(user.id, payload)),
      unsubscribe: ({ params }) => CurrentUser.use((user) => subscriptions.unsubscribe(user.id, params.id))
    })
  })
)
