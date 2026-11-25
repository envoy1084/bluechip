import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { listActivity } from "../activity/Activity.ts"

export const ActivityHandlers = HttpApiBuilder.group(
  BluechipApi,
  "activity",
  (handlers) =>
    handlers.handle("list", ({ query }) => Effect.flatMap(CurrentUser, (user) => listActivity(user.id, query)))
)
