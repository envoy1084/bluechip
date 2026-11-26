import type { UserId } from "@bluechip/domain/Ids"
import type { Notification } from "@bluechip/domain/notifications/Notification"
import { pushMessageOf } from "@bluechip/domain/push/Push"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import { NotifierError } from "../notifications/NotifierError.ts"
import { PushConfig } from "./PushConfig.ts"
import { PushSubscriptions } from "./PushSubscriptions.ts"
import { encryptPayload, vapidAuthorization } from "./WebPush.ts"

/**
 * The push notifier: a notification encrypted for each device that opted in, sent to its push service with the
 * server's VAPID identity. A push service that no longer knows a device (404, 410) forgets it; the delivery is sent
 * when one device took it, skipped when none opted in (or push isn't set up), and retried while a service is busy.
 */
export class PushNotifier extends Context.Service<PushNotifier, {
  readonly send: (userId: UserId, notification: Notification) => Effect.Effect<"sent" | "skipped", NotifierError>
}>()("@bluechip/server/PushNotifier") {
  static readonly layer = Layer.effect(
    PushNotifier,
    Effect.gen(function*() {
      const { vapid } = yield* PushConfig
      const subscriptions = yield* PushSubscriptions
      const http = yield* HttpClient.HttpClient

      const send = Effect.fn("PushNotifier.send")(function*(userId: UserId, notification: Notification) {
        const devices = yield* subscriptions.rows(userId)
        if (vapid === undefined || devices.length === 0) return "skipped" as const

        const message = pushMessageOf(notification)
        const now = Math.floor(DateTime.toEpochMillis(yield* DateTime.now) / 1000)
        const results = yield* Effect.forEach(devices, (device) =>
          http.execute(
            HttpClientRequest.post(device.endpoint).pipe(
              HttpClientRequest.setHeaders({
                authorization: vapidAuthorization({
                  endpoint: device.endpoint,
                  publicKey: vapid.publicKey,
                  privateKey: Redacted.value(vapid.privateKey),
                  subject: vapid.subject,
                  now
                }),
                "content-encoding": "aes128gcm",
                ttl: String(24 * 60 * 60),
                urgency: notification.severity === "info" ? "normal" : "high"
              }),
              HttpClientRequest.bodyUint8Array(
                encryptPayload({ payload: JSON.stringify(message), p256dh: device.p256dh, auth: device.auth }),
                "application/octet-stream"
              )
            )
          ).pipe(
            Effect.flatMap((response) => {
              if (response.status >= 200 && response.status < 300) return Effect.succeed("sent" as const)
              if (response.status === 404 || response.status === 410) {
                return Effect.as(subscriptions.forget(device.id), "gone" as const)
              }
              return Effect.succeed(
                response.status === 429 || response.status >= 500 ? "busy" as const : "refused" as const
              )
            }),
            Effect.catch(() => Effect.succeed("busy" as const))
          ), { concurrency: 4 })

        if (results.includes("sent")) return "sent" as const
        if (results.includes("busy")) {
          return yield* new NotifierError({
            channel: "push",
            reason: "A push service didn't take it.",
            retryable: true
          })
        }
        if (results.includes("refused")) {
          return yield* new NotifierError({ channel: "push", reason: "A push service refused it.", retryable: false })
        }
        return "skipped" as const
      })

      return PushNotifier.of({ send })
    })
  )
}
