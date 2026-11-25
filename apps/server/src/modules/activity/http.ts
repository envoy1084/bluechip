import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { Activity } from "./Activity.ts"

export const ActivityHandlers = HttpApiBuilder.group(
  BluechipApi,
  "activity",
  Effect.fn(function*(handlers) {
    const activity = yield* Activity

    return handlers.handleAll({
      list: ({ query }) => CurrentUser.use((user) => activity.list(user.id, query))
    })
  })
)
