// The mock's `agents` group, answered from the preview's agents as the server's `Agents` and `AgentRequests` answer:
// reads, pausing, and locks, changes, renewals and removals prepared for Face ID, sent once confirmed, and landing a
// moment later with `AgentChanged` events.
import {
  type Agent,
  type AgentAction,
  AgentRequest,
  AgentsRemoval,
  SESSION_DAYS,
  transition
} from "@bluechip/domain/agents/Agent"
import { BluechipApi } from "@bluechip/domain/Api"
import { Conflict, InvalidSpec, NotFound } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { AgentId, SigningRequestId } from "@bluechip/domain/Ids"
import { checkSpec, complete } from "@bluechip/domain/policies/Catalog"
import { TemplateId } from "@bluechip/domain/policies/Templates"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import { type AgentsSlice, findAgent, portfolioUsdc } from "../../world/agents.ts"
import {
  type AgentRecord,
  nextId,
  saveSession,
  type SigningRequest,
  toAgent,
  usageOf
} from "../../world/agents/AgentRecord.ts"
import { addSession, land, prepareSession, send } from "../../world/agents/AgentStates.ts"
import { Preview } from "../Preview.ts"
import { afterLanding, ceremonyOptions, expiresAt } from "./signing.ts"

const NO_USAGE = { trade: 0, tradesPerDay: 0, gasBudget: 0, slippageBudget: 0 }

const agentBusy = () => new Conflict({ reason: "agentBusy" })

export const AgentsHandlers = HttpApiBuilder.group(
  BluechipApi,
  "agents",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    // A change to the agents, made where the panel sees it.
    const change = <A>(apply: (slice: AgentsSlice) => A): A => {
      let result: A | undefined
      preview.update((world) => {
        result = apply(world.agents)
      })
      return result as A
    }

    const told = (record: AgentRecord, said?: "paused" | "renewed"): Agent => {
      const agent = toAgent(record)
      preview.emit(LiveEvent.cases.AgentChanged.make(said === undefined ? { agent } : { agent, change: said }))
      return agent
    }

    const owned = (id: AgentId) => {
      const record = findAgent(preview.world.agents, id)
      return record === undefined ? Effect.fail(new NotFound({ resource: "agent", id })) : Effect.succeed(record)
    }

    const toRequest = (request: Extract<SigningRequest, { kind: "agent" }>, record: AgentRecord) =>
      new AgentRequest({
        id: request.id,
        options: ceremonyOptions(request.id),
        action: request.action,
        agent: toAgent(record),
        deploysAccount: false,
        expiresAt: request.expiresAt
      })

    // The request prepared under this request id for the same agent and action, if any.
    const prepared = (requestId: string, record: AgentRecord, action: AgentAction) => {
      const found = preview.world.agents.requests.find((request) =>
        request.kind === "agent" && request.requestId === requestId && request.agentId === record.id &&
        request.action === action
      )
      return found?.kind === "agent" ? toRequest(found, record) : undefined
    }

    const prepare = (
      slice: AgentsSlice,
      record: AgentRecord,
      options: {
        readonly requestId: string
        readonly action: AgentAction
        readonly sessionId: AgentRecord["pendingSessionId"]
      },
      now: DateTime.Utc
    ) => {
      const request = {
        kind: "agent" as const,
        id: nextId(slice.ids, "signing") as SigningRequestId,
        agentId: record.id,
        expiresAt: expiresAt(now),
        ...options
      }
      slice.requests.push(request)
      return toRequest(request, record)
    }

    const requireValid = (spec: Parameters<typeof checkSpec>[0]) => {
      const problems = checkSpec(spec)
      return problems.length === 0 ? Effect.void : Effect.fail(new InvalidSpec({ problems }))
    }

    // Lands what was sent once Base would have, if nothing else moved the agent meanwhile.
    const landLater = (id: AgentId) => {
      const sent = findAgent(preview.world.agents, id)!
      const status = sent.status
      const pending = sent.pendingSessionId
      return afterLanding(() =>
        change((slice) => {
          const record = findAgent(slice, id)
          if (record === undefined || record.status !== status || record.pendingSessionId !== pending) return
          const landed = land(record, DateTime.nowUnsafe())
          told(record, landed === "renewed" ? "renewed" : undefined)
        })
      )
    }

    const removable = () =>
      preview.world.agents.agents.filter((record) => record.status === "active" || record.status === "expired")

    const toRemoval = (request: Extract<SigningRequest, { kind: "agents" }>) =>
      new AgentsRemoval({
        id: request.id,
        options: ceremonyOptions(request.id),
        agents: request.agentIds.map((id) => toAgent(findAgent(preview.world.agents, id)!)),
        expiresAt: request.expiresAt
      })

    const claim = <K extends SigningRequest["kind"]>(id: SigningRequestId, kind: K) => {
      const request = preview.world.agents.requests.find((each) => each.id === id && each.kind === kind)
      return request === undefined ?
        Effect.fail(new NotFound({ resource: "signingRequest", id })) :
        Effect.succeed(request as Extract<SigningRequest, { kind: K }>)
    }

    const setPaused = (paused: boolean) => ({ params }: { readonly params: { readonly id: AgentId } }) =>
      Effect.gen(function*() {
        const record = yield* owned(params.id)
        if (record.status === "draft" || record.status === "removed") return yield* agentBusy()
        if (record.paused === paused) return toAgent(record)
        return change(() => {
          record.paused = paused
          return told(record, paused ? "paused" : undefined)
        })
      })

    const setAllPaused = (paused: boolean) => () =>
      Effect.sync(() =>
        change((slice) => {
          for (const record of slice.agents) {
            const running = ["locking", "active", "updating", "removing"].includes(record.status)
            if (!running || record.paused === paused) continue
            record.paused = paused
            told(record, paused ? "paused" : undefined)
          }
          return slice.agents.filter((record) => record.status !== "removed").map(toAgent)
        })
      )

    return handlers.handleAll({
      list: () =>
        Effect.sync(() =>
          preview.world.agents.agents.filter((record) => record.status !== "removed")
            .toSorted((a, b) => DateTime.toEpochMillis(a.createdAt) - DateTime.toEpochMillis(b.createdAt))
            .map(toAgent)
        ),
      agent: ({ params }) => Effect.map(owned(params.id), toAgent),
      usage: ({ params }) =>
        Effect.map(owned(params.id), (record) => usageOf(record, portfolioUsdc(preview.world.cast))),
      journal: ({ params, query }) =>
        Effect.map(owned(params.id), (record) => {
          const size = query.pageSize ?? 25
          const after = query.pageToken === undefined ?
            0 :
            record.journal.findIndex((entry) => entry.id === query.pageToken) + 1
          const items = record.journal.slice(after, after + size)
          return { items, nextPageToken: after + size < record.journal.length ? items.at(-1)!.id as string : null }
        }),
      // Changes prepared but never signed stay out of the history.
      sessions: ({ params }) =>
        Effect.map(
          owned(params.id),
          (record) =>
            record.sessions.filter((session) => session.status !== "draft" || session.id === record.pendingSessionId)
        ),
      create: ({ payload }) =>
        Effect.gen(function*() {
          const spec = complete(payload.spec)
          yield* requireValid(spec)
          const existing = preview.world.agents.requests.find((request) =>
            request.kind === "agent" && request.requestId === payload.requestId && request.action === "lock"
          )
          if (existing?.kind === "agent") return toRequest(existing, findAgent(preview.world.agents, existing.agentId)!)
          const known = Schema.is(TemplateId)(payload.template) ||
            preview.world.agents.templates.some((template) => template.id === payload.template)
          if (payload.template !== null && !known) {
            return yield* new NotFound({ resource: "template", id: payload.template })
          }

          const now = yield* DateTime.now
          return change((slice) => {
            const record: AgentRecord = {
              id: nextId(slice.ids, "agent") as AgentId,
              name: payload.name,
              template: payload.template,
              status: "draft",
              paused: false,
              createdAt: now,
              sessions: [],
              currentSessionId: null,
              pendingSessionId: null,
              usage: NO_USAGE,
              journal: []
            }
            record.pendingSessionId = addSession(slice.ids, record, {
              status: "draft",
              spec,
              createdBy: "owner",
              validUntil: DateTime.add(now, { days: SESSION_DAYS }),
              createdAt: now,
              installedAt: null,
              endedAt: null
            })
            slice.agents.push(record)
            return prepare(
              slice,
              record,
              { requestId: payload.requestId, action: "lock", sessionId: record.pendingSessionId },
              now
            )
          })
        }),
      lock: ({ params, payload }) =>
        Effect.gen(function*() {
          const record = yield* owned(params.id)
          const existing = prepared(payload.requestId, record, "lock")
          if (existing !== undefined) return existing
          if (record.status !== "draft") return yield* agentBusy()

          const now = yield* DateTime.now
          return change((slice) => {
            saveSession(record, record.pendingSessionId!, { validUntil: DateTime.add(now, { days: SESSION_DAYS }) })
            return prepare(
              slice,
              record,
              { requestId: payload.requestId, action: "lock", sessionId: record.pendingSessionId },
              now
            )
          })
        }),
      change: ({ params, payload }) =>
        Effect.gen(function*() {
          const record = yield* owned(params.id)
          const existing = prepared(payload.requestId, record, "update")
          if (existing !== undefined) return existing
          if (record.status !== "active") return yield* agentBusy()
          const spec = complete(payload.spec)
          yield* requireValid(spec)

          const now = yield* DateTime.now
          return change((slice) => {
            const sessionId = prepareSession(slice.ids, record, now, { spec })
            return prepare(slice, record, { requestId: payload.requestId, action: "update", sessionId }, now)
          })
        }),
      renew: ({ params, payload }) =>
        Effect.gen(function*() {
          const record = yield* owned(params.id)
          const existing = prepared(payload.requestId, record, "renew")
          if (existing !== undefined) return existing
          if (record.status !== "active" && record.status !== "expired") return yield* agentBusy()

          const now = yield* DateTime.now
          return change((slice) => {
            const sessionId = prepareSession(slice.ids, record, now, "renew")
            return prepare(slice, record, { requestId: payload.requestId, action: "renew", sessionId }, now)
          })
        }),
      remove: ({ params, payload }) =>
        Effect.gen(function*() {
          const record = yield* owned(params.id)
          if (record.status === "draft") {
            return change(() => {
              record.status = Result.getOrThrow(transition(record.status, { _tag: "Discarded" }))
              return told(record)
            })
          }
          const existing = prepared(payload.requestId, record, "remove")
          if (existing !== undefined) return existing
          if (record.status !== "active" && record.status !== "expired") return yield* agentBusy()

          const now = yield* DateTime.now
          return change((slice) =>
            prepare(slice, record, { requestId: payload.requestId, action: "remove", sessionId: null }, now)
          )
        }),
      confirm: ({ params }) =>
        Effect.gen(function*() {
          const request = yield* claim(params.id, "agent")
          const record = yield* owned(request.agentId)
          const next = transition(record.status, { _tag: "Sent", action: request.action })
          if (Result.isFailure(next)) return yield* agentBusy()

          const agent = change((slice) => {
            slice.requests = slice.requests.filter((each) => each.id !== request.id)
            send(record, request.action, next.success, request.sessionId)
            return told(record)
          })
          yield* landLater(record.id)
          return agent
        }),
      pause: setPaused(true),
      resume: setPaused(false),
      pauseAll: setAllPaused(true),
      resumeAll: setAllPaused(false),
      removeAll: ({ payload }) =>
        Effect.gen(function*() {
          const existing = preview.world.agents.requests.find((request) =>
            request.kind === "agents" && request.requestId === payload.requestId
          )
          if (existing?.kind === "agents") return toRemoval(existing)
          const records = removable()
          if (records.length === 0) return yield* agentBusy()

          const now = yield* DateTime.now
          return change((slice) => {
            const request = {
              kind: "agents" as const,
              id: nextId(slice.ids, "signing") as SigningRequestId,
              requestId: payload.requestId,
              agentIds: records.map((record) => record.id),
              expiresAt: expiresAt(now)
            }
            slice.requests.push(request)
            return toRemoval(request)
          })
        }),
      confirmRemoveAll: ({ params }) =>
        Effect.gen(function*() {
          const request = yield* claim(params.id, "agents")
          const records = request.agentIds.map((id) => findAgent(preview.world.agents, id)!)
          // Every one must still be where it was when the operation was prepared.
          const next = records.map((record) => transition(record.status, { _tag: "Sent", action: "remove" }))
          if (next.some(Result.isFailure)) return yield* agentBusy()

          const agents = change((slice) => {
            slice.requests = slice.requests.filter((each) => each.id !== request.id)
            return records.map((record) => {
              send(record, "remove", "removing", null)
              return told(record)
            })
          })
          yield* Effect.forEach(records, (record) => landLater(record.id), { discard: true })
          return agents
        })
    })
  })
)
