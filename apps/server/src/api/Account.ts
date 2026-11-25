import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { findMe, listPasskeys, setEligibility } from "../accounts/Accounts.ts"

export const AccountHandlers = HttpApiBuilder.group(BluechipApi, "account", (handlers) =>
  handlers
    .handle("me", () => Effect.flatMap(CurrentUser, (user) => findMe(user.id)))
    .handle("setEligibility", ({ payload }) =>
      Effect.flatMap(CurrentUser, (user) => setEligibility(user.id, payload.answer)))
    .handle("passkeys", () =>
      Effect.flatMap(CurrentUser, (user) => listPasskeys(user.id))))
