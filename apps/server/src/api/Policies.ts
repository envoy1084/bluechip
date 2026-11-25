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

const nameOf = (symbol: string) => stocks.find((stock) => stock.symbol === symbol)?.name ?? symbol

export const PoliciesHandlers = HttpApiBuilder.group(BluechipApi, "policies", (handlers) =>
  handlers
    .handle("catalog", () => Effect.succeed(catalogInfo()))
    .handle("templates", () =>
      Effect.flatMap(Effect.all([CurrentUser, SavedTemplates]), ([user, templates]) => templates.list(user)))
    .handle("saveTemplate", ({ payload }) =>
      Effect.flatMap(Effect.all([CurrentUser, SavedTemplates]), ([user, templates]) =>
        templates.save(user, payload)))
    .handle("deleteTemplate", ({ params }) =>
      Effect.flatMap(Effect.all([CurrentUser, SavedTemplates]), ([user, templates]) =>
        templates.remove(user, params.id)))
    .handle("check", ({ payload }) => {
      const spec = complete(payload.spec)
      return Effect.succeed(
        new SpecCheck({
          problems: checkSpec(spec),
          description: describeSpec(spec, nameOf),
          changes: payload.before === null ? null : compareSpecs(complete(payload.before), spec)
        })
      )
    }))
