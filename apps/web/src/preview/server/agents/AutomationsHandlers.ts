// The mock's `automations` group, answered as the server's `Automations` answers: the catalog, a draft's check and
// an agent's defaults from the domain's own pure functions, and the preview's automations saved, paused, edited and
// deleted.
import { BluechipApi } from "@bluechip/domain/Api"
import {
  type AutomationDraft,
  AutomationProblem,
  checkAutomation,
  describeAutomation
} from "@bluechip/domain/automations/Automation"
import { AutomationCheck, catalogInfo } from "@bluechip/domain/automations/Catalog"
import { AutomationDetail } from "@bluechip/domain/automations/Run"
import { defaultAutomations } from "@bluechip/domain/automations/Templates"
import { Conflict, InvalidAutomation, NotFound } from "@bluechip/domain/Errors"
import type { AgentId, AutomationId } from "@bluechip/domain/Ids"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { complete } from "@bluechip/domain/policies/Catalog"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { findAgent, findAutomation } from "../../world/agents.ts"
import { nextId, toAgent } from "../../world/agents/AgentRecord.ts"
import { saveAutomation, savedAutomation } from "../../world/agents/automations.ts"
import { stockName } from "../../world/agents/stockName.ts"
import { Preview } from "../Preview.ts"

const LATEST_RUNS = 20

export const AutomationsHandlers = HttpApiBuilder.group(
  BluechipApi,
  "automations",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview
    const catalog = catalogInfo()

    const agentOf = (id: AgentId) => {
      const record = findAgent(preview.world.agents, id)
      return record === undefined
        ? Effect.fail(new NotFound({ resource: "agent", id }))
        : Effect.succeed(toAgent(record))
    }

    // The policies an automation is checked against: its agent's in force, or the change on its way.
    const specOf = (agentId: AgentId | null): Effect.Effect<AgentSpec | null, NotFound> =>
      agentId === null ?
        Effect.succeed(null) :
        Effect.map(agentOf(agentId), (agent) => complete(agent.pendingSpec ?? agent.spec))

    const check = (draft: AutomationDraft) =>
      Effect.map(specOf(draft.agentId), (spec) =>
        new AutomationCheck({
          problems: checkAutomation(draft, spec),
          description: describeAutomation(draft, stockName)
        }))

    const valid = (draft: AutomationDraft) =>
      Effect.flatMap(
        check(draft),
        ({ problems }) => problems.length === 0 ? Effect.void : Effect.fail(new InvalidAutomation({ problems }))
      )

    const owned = (id: AutomationId) => {
      const record = findAutomation(preview.world.agents, id)
      return record === undefined ? Effect.fail(new NotFound({ resource: "automation", id })) : Effect.succeed(record)
    }

    return handlers.handleAll({
      catalog: () => Effect.succeed(catalog),
      list: ({ query }) =>
        Effect.sync(() =>
          preview.world.agents.automations.filter(({ automation }) =>
            automation.status !== "deleted" && (query.agentId === undefined || automation.agentId === query.agentId)
          ).map(({ automation }) => automation)
        ),
      automation: ({ params }) =>
        Effect.map(owned(params.id), (record) =>
          new AutomationDetail({
            automation: record.automation,
            runs: record.runs.slice(0, LATEST_RUNS),
            judgments: record.judgments
          })),
      check: ({ payload }) => check(payload.draft),
      defaults: ({ params }) =>
        Effect.map(
          agentOf(params.agentId),
          (agent) => defaultAutomations(agent.template, complete(agent.pendingSpec ?? agent.spec), agent.id)
        ),
      create: ({ payload }) =>
        Effect.gen(function*() {
          const requestKey = `request:${payload.requestId}`
          const existing = preview.world.agents.automations.find((record) => record.requestKey === requestKey)
          if (existing !== undefined) return existing.automation
          yield* valid(payload.draft)

          const now = yield* DateTime.now
          let saved: ReturnType<typeof savedAutomation> | undefined
          preview.update((world) => {
            saved = savedAutomation({
              id: nextId(world.agents.ids, "automation") as AutomationId,
              draft: payload.draft,
              status: "active",
              createdBy: payload.createdBy ?? "owner",
              createdAt: now,
              now,
              requestKey
            })
            world.agents.automations.unshift(saved)
          })
          return saved!.automation
        }),
      update: ({ params, payload }) =>
        Effect.gen(function*() {
          const record = yield* owned(params.id)
          const { status } = record.automation
          if (status === "done" || status === "expired") return yield* new Conflict({ reason: "automationEnded" })
          const draft = payload.draft
          if (draft !== undefined) {
            if (draft.agentId !== record.automation.agentId) {
              return yield* new InvalidAutomation({
                problems: [
                  new AutomationProblem({
                    part: "name",
                    index: null,
                    field: "agentId",
                    message: "Its agent can't change."
                  })
                ]
              })
            }
            yield* valid(draft)
          }

          const now = yield* DateTime.now
          preview.update(() =>
            saveAutomation(record, {
              ...(draft === undefined ? {} : {
                name: draft.name.trim(),
                trigger: draft.trigger,
                conditions: draft.conditions,
                action: draft.action,
                settings: draft.settings
              }),
              ...(payload.status === undefined ? {} : { status: payload.status })
            }, now)
          )
          return record.automation
        }),
      remove: ({ params }) =>
        Effect.gen(function*() {
          const record = yield* owned(params.id)
          const now = yield* DateTime.now
          preview.update(() => saveAutomation(record, { status: "deleted" }, now))
        })
    })
  })
)
