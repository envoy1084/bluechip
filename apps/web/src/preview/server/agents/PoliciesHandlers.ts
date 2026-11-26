// The mock's `policies` group: the catalog, the built-in templates and a spec's check from the domain's own pure
// functions, as the server's handlers answer them, and the templates you saved from the preview world.
import { BluechipApi } from "@bluechip/domain/Api"
import { InvalidSpec, NotFound } from "@bluechip/domain/Errors"
import type { SavedTemplateId } from "@bluechip/domain/Ids"
import {
  catalogInfo,
  checkSpec,
  compareSpecs,
  complete,
  describeSpec,
  SpecCheck
} from "@bluechip/domain/policies/Catalog"
import { SavedTemplate, templateInfos } from "@bluechip/domain/policies/Templates"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { nextId } from "../../world/agents/AgentRecord.ts"
import { stockName } from "../../world/agents/stockName.ts"
import { Preview } from "../Preview.ts"

export const PoliciesHandlers = HttpApiBuilder.group(
  BluechipApi,
  "policies",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      catalog: () => Effect.succeed(catalogInfo()),
      templates: () =>
        Effect.sync(() => ({
          builtIn: templateInfos(),
          saved: preview.world.agents.templates.toSorted((a, b) =>
            DateTime.toEpochMillis(a.createdAt) - DateTime.toEpochMillis(b.createdAt)
          )
        })),
      saveTemplate: ({ payload }) =>
        Effect.gen(function*() {
          const spec = complete(payload.spec)
          const problems = checkSpec(spec)
          if (problems.length > 0) return yield* new InvalidSpec({ problems })

          const createdAt = yield* DateTime.now
          let saved: SavedTemplate | undefined
          preview.update((world) => {
            saved = new SavedTemplate({
              id: nextId(world.agents.ids, "template") as SavedTemplateId,
              name: payload.name,
              basedOn: payload.basedOn,
              spec,
              createdAt
            })
            world.agents.templates.push(saved)
          })
          return saved!
        }),
      deleteTemplate: ({ params }) =>
        Effect.gen(function*() {
          if (!preview.world.agents.templates.some((template) => template.id === params.id)) {
            return yield* new NotFound({ resource: "template", id: params.id })
          }
          preview.update((world) => {
            world.agents.templates = world.agents.templates.filter((template) => template.id !== params.id)
          })
        }),
      check: ({ payload }) => {
        const spec = complete(payload.spec)
        return Effect.succeed(
          new SpecCheck({
            problems: checkSpec(spec),
            description: describeSpec(spec, stockName),
            changes: payload.before === null ? null : compareSpecs(complete(payload.before), spec)
          })
        )
      }
    })
  })
)
