// Agents as a user makes them through the API: created as drafts, locked onchain with the user's passkey.
import type { Agent, AgentRequest, AgentStatus } from "@bluechip/domain/agents/Agent"
import { RequestId } from "@bluechip/domain/Ids"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import { randomUUID } from "node:crypto"
import { PICKER } from "../fixtures/Specs.ts"
import { type Api, type Browser, type TestUser, TestUsers } from "./TestUsers.ts"

/** What creating an agent can fail with, as the typed client reports it. */
export type CreateError = Effect.Error<ReturnType<Api["agents"]["create"]>>

export class TestAgents extends Context.Service<TestAgents, {
  /**
   * `POST /api/agents`: a "Tech picker" from the Stock picker template with {@link PICKER}'s policies, unless
   * `options` says otherwise; a new request id unless one is given.
   */
  readonly create: (
    user: Browser,
    options?: {
      readonly spec?: AgentSpec
      readonly template?: string | null
      readonly requestId?: RequestId
    }
  ) => Effect.Effect<AgentRequest, CreateError>
  /**
   * Signs a prepared request with the user's passkey and confirms it, then waits for the agent to settle at `status`
   * with nothing pending. Returns the agent as the confirmation answered and as it settled.
   */
  readonly sign: (
    user: TestUser,
    request: AgentRequest,
    status: AgentStatus
  ) => Effect.Effect<{ readonly sent: Agent; readonly agent: Agent }>
  /** A funded user with a Stock picker locked onchain. */
  readonly locked: Effect.Effect<{ readonly user: TestUser; readonly agent: Agent }, never, Scope.Scope>
}>()("@bluechip/server/test/TestAgents") {
  static readonly layerNoDeps = Layer.effect(
    TestAgents,
    Effect.gen(function*() {
      const users = yield* TestUsers

      const create = (
        user: Browser,
        options: { readonly spec?: AgentSpec; readonly template?: string | null; readonly requestId?: RequestId } = {}
      ) =>
        user.api.agents.create({
          payload: {
            requestId: options.requestId ?? RequestId.make(randomUUID()),
            name: "Tech picker",
            template: options.template === undefined ? "stockPicker" : options.template,
            spec: options.spec ?? PICKER
          }
        })

      const sign = Effect.fnUntraced(function*(user: TestUser, request: AgentRequest, status: AgentStatus) {
        const sent = yield* user.api.agents.confirm({
          params: { id: request.id },
          payload: { credential: user.authenticator.authenticate(request.options) }
        }).pipe(Effect.orDie)
        const settled = yield* user.events.next(
          "AgentChanged",
          ({ agent }) => agent.id === request.agent.id && agent.status === status && agent.pendingSpec === null
        )
        return { sent, agent: settled.agent }
      })

      const locked = Effect.gen(function*() {
        const user = yield* users.funded
        const created = yield* Effect.orDie(create(user))
        const { agent } = yield* sign(user, created, "active")
        return { user, agent }
      })

      return { create, sign, locked }
    })
  )

  /** The agents of the test server's users, served by this layer too. */
  static readonly layer = this.layerNoDeps.pipe(Layer.provideMerge(TestUsers.layer))

  /** The agents of a test server on a devnet of the file's own (`TestUsers.layerIsolated`). */
  static readonly layerIsolated = this.layerNoDeps.pipe(Layer.provideMerge(TestUsers.layerIsolated))
}
