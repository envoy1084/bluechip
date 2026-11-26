import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { Automations } from "./Automations.ts"

export const AutomationsHandlers = HttpApiBuilder.group(
  BluechipApi,
  "automations",
  Effect.fn(function*(handlers) {
    const automations = yield* Automations

    return handlers.handleAll({
      catalog: () => Effect.succeed(automations.catalog),
      list: ({ query }) => CurrentUser.use((user) => automations.list(user, query.agentId)),
      automation: ({ params }) => CurrentUser.use((user) => automations.detail(user, params.id)),
      check: ({ payload }) => CurrentUser.use((user) => automations.check(user, payload.draft)),
      create: ({ payload }) =>
        CurrentUser.use((user) =>
          automations.create(user, { requestId: payload.requestId, draft: payload.draft, createdBy: "owner" })
        ),
      update: ({ params, payload }) => CurrentUser.use((user) => automations.update(user, params.id, payload)),
      remove: ({ params }) => CurrentUser.use((user) => automations.remove(user, params.id))
    })
  })
)
