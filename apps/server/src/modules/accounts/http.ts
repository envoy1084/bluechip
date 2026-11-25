import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { Accounts } from "./Accounts.ts"

export const AccountHandlers = HttpApiBuilder.group(
  BluechipApi,
  "account",
  Effect.fn(function*(handlers) {
    const accounts = yield* Accounts

    return handlers.handleAll({
      me: () => CurrentUser.use((user) => accounts.me(user.id)),
      setDisplayName: ({ payload }) => CurrentUser.use((user) => accounts.setDisplayName(user.id, payload.displayName)),
      setEligibility: ({ payload }) => CurrentUser.use((user) => accounts.setEligibility(user.id, payload.answer)),
      passkeys: () => CurrentUser.use((user) => accounts.passkeys(user.id, user.passkey))
    })
  })
)
