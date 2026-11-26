import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import { Sessions } from "../auth/Sessions.ts"
import { Accounts } from "./Accounts.ts"
import { Passkeys } from "./Passkeys.ts"

export const AccountHandlers = HttpApiBuilder.group(
  BluechipApi,
  "account",
  Effect.fn(function*(handlers) {
    const accounts = yield* Accounts
    const passkeys = yield* Passkeys
    const sessions = yield* Sessions

    return handlers.handleAll({
      me: () => CurrentUser.use((user) => accounts.me(user.id)),
      setDisplayName: ({ payload }) => CurrentUser.use((user) => accounts.setDisplayName(user.id, payload.displayName)),
      setEligibility: ({ payload }) => CurrentUser.use((user) => accounts.setEligibility(user.id, payload.answer)),
      passkeys: () => CurrentUser.use((user) => accounts.passkeys(user.id, user.passkey)),
      passkeyOptions: () => CurrentUser.use((user) => passkeys.options(user)),
      addPasskey: Effect.fn(function*({ payload }) {
        const user = yield* CurrentUser
        const request = yield* HttpServerRequest.HttpServerRequest
        return yield* passkeys.add(user, { ...payload, userAgent: request.headers["user-agent"] })
      }),
      removePasskey: ({ params, payload }) =>
        CurrentUser.use((user) => passkeys.remove(user, params.id, payload.requestId)),
      confirmPasskeyChange: ({ params, payload }) =>
        CurrentUser.use((user) => passkeys.confirm(user, params.id, payload.credential)),
      devices: () => CurrentUser.use((user) => sessions.devices(user.id, user.session)),
      signOutDevice: ({ params }) => CurrentUser.use((user) => sessions.signOut(user.id, params.id)),
      signOutOthers: () => CurrentUser.use((user) => sessions.signOutAll(user.id, user.session))
    })
  })
)
