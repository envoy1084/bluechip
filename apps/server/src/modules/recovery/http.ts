import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser, RecoveringUser, recoveryCookie } from "@bluechip/domain/Auth"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as Layer from "effect/Layer"
import { AppConfig } from "../../config/AppConfig.ts"
import { Recoveries } from "./Recoveries.ts"
import { RecoveryKeys } from "./RecoveryKeys.ts"

const userAgent = Effect.gen(function*() {
  const request = yield* HttpServerRequest.HttpServerRequest
  return request.headers["user-agent"]
})

const AccountRecoveryHandlers = HttpApiBuilder.group(
  BluechipApi,
  "accountRecovery",
  Effect.fn(function*(handlers) {
    const keys = yield* RecoveryKeys
    const recoveries = yield* Recoveries

    return handlers.handleAll({
      get: () => CurrentUser.use((user) => keys.get(user)),
      keyOptions: () => CurrentUser.use((user) => keys.options(user)),
      setUp: Effect.fn(function*({ payload }) {
        const user = yield* CurrentUser
        return yield* keys.setUp(user, { ...payload, userAgent: yield* userAgent })
      }),
      removeKey: ({ payload }) => CurrentUser.use((user) => keys.remove(user, payload.requestId)),
      confirmKey: ({ params, payload }) => CurrentUser.use((user) => keys.confirm(user, params.id, payload.credential)),
      cancel: Effect.fn(function*() {
        const user = yield* CurrentUser
        yield* recoveries.cancel(user.id, "app")
        return yield* keys.get(user)
      })
    })
  })
)

const RecoveryHandlers = HttpApiBuilder.group(
  BluechipApi,
  "recovery",
  Effect.fn(function*(handlers) {
    const recoveries = yield* Recoveries
    const config = yield* AppConfig

    return handlers.handleAll({
      options: () => recoveries.signInOptions,
      signIn: Effect.fn(function*({ payload }) {
        const signedIn = yield* recoveries.signIn({ ...payload, userAgent: yield* userAgent })
        yield* HttpApiBuilder.securitySetCookie(recoveryCookie, signedIn.token, {
          path: "/",
          sameSite: "lax",
          secure: config.env === "production",
          expires: DateTime.toDateUtc(signedIn.expiresAt)
        })
        return signedIn.recovering
      })
    })
  })
)

const RecoveringHandlers = HttpApiBuilder.group(
  BluechipApi,
  "recovering",
  Effect.fn(function*(handlers) {
    const recoveries = yield* Recoveries

    return handlers.handleAll({
      get: () => RecoveringUser.use((user) => recoveries.get(user)),
      passkeyOptions: () => RecoveringUser.use((user) => recoveries.passkeyOptions(user)),
      request: Effect.fn(function*({ payload }) {
        const user = yield* RecoveringUser
        return yield* recoveries.request(user, { ...payload, userAgent: yield* userAgent })
      }),
      execute: () => RecoveringUser.use((user) => recoveries.execute(user)),
      confirm: ({ params, payload }) =>
        RecoveringUser.use((user) => recoveries.confirm(user, params.id, payload.credential))
    })
  })
)

export const RecoveryApiHandlers = Layer.mergeAll(AccountRecoveryHandlers, RecoveryHandlers, RecoveringHandlers)
