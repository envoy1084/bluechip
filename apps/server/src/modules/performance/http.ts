import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { Performance } from "./Performance.ts"

export const PerformanceHandlers = HttpApiBuilder.group(
  BluechipApi,
  "performance",
  Effect.fn(function*(handlers) {
    const performance = yield* Performance

    return handlers.handleAll({
      portfolio: () => CurrentUser.use((user) => performance.portfolio(user.id)),
      stock: ({ params }) => CurrentUser.use((user) => performance.stock(user.id, params.symbol)),
      agent: ({ params }) => CurrentUser.use((user) => performance.agent(user, params.id)),
      automation: ({ params }) => CurrentUser.use((user) => performance.automation(user, params.id))
    })
  })
)
