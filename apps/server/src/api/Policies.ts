import { stocks } from "@bluechip/chain/Contracts"
import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import {
  catalogInfo,
  checkSpec,
  compareSpecs,
  complete,
  describeSpec,
  SpecCheck
} from "@bluechip/domain/policies/Catalog"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { SavedTemplates } from "../agents/SavedTemplates.ts"

export const PoliciesHandlers = HttpApiBuilder.group(
  BluechipApi,
  "policies",
  Effect.fn(function*(handlers) {
    const templates = yield* SavedTemplates

    return handlers.handleAll({
      catalog: () => Effect.succeed(catalogInfo()),
      templates: () => CurrentUser.use((user) => templates.list(user)),
      saveTemplate: ({ payload }) => CurrentUser.use((user) => templates.save(user, payload)),
      deleteTemplate: ({ params }) => CurrentUser.use((user) => templates.remove(user, params.id)),
      check: ({ payload }) => {
        const spec = complete(payload.spec)
        return Effect.succeed(
          new SpecCheck({
            problems: checkSpec(spec),
            description: describeSpec(
              spec,
              (symbol) => stocks.find((stock) => stock.symbol === symbol)?.name ?? symbol
            ),
            changes: payload.before === null ? null : compareSpecs(complete(payload.before), spec)
          })
        )
      }
    })
  })
)
