// Automations as a user sets them up through the API, on agents locked onchain.
import { Devnet } from "@bluechip/devnet/Devnet"
import type { Agent } from "@bluechip/domain/agents/Agent"
import type { Automation, AutomationDraft } from "@bluechip/domain/automations/Automation"
import { type AgentId, RequestId } from "@bluechip/domain/Ids"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import { randomUUID } from "node:crypto"
import { GUARDED, STOP_LOSS_GUARD } from "../fixtures/Automations.ts"
import { TestAgents } from "./TestAgents.ts"
import { type TestUser, TestUsers } from "./TestUsers.ts"

export class TestAutomations extends Context.Service<TestAutomations, {
  /**
   * A funded user with a Stop-loss guard on `GUARDED` (locked), 2.5 of its shares, and the automation `draft` makes for
   * that agent, saved (and paused with `paused`).
   */
  readonly guarded: (
    draft: (agentId: AgentId) => AutomationDraft,
    options?: { readonly paused?: boolean }
  ) => Effect.Effect<
    { readonly user: TestUser; readonly agent: Agent; readonly automation: Automation },
    never,
    Scope.Scope
  >
}>()("@bluechip/server/test/TestAutomations") {
  static readonly layerNoDeps = Layer.effect(
    TestAutomations,
    Effect.gen(function*() {
      const users = yield* TestUsers
      const agents = yield* TestAgents
      const devnet = yield* Devnet

      const guarded = Effect.fnUntraced(function*(
        draft: (agentId: AgentId) => AutomationDraft,
        options: { readonly paused?: boolean } = {}
      ) {
        const user = yield* users.funded
        const request = yield* Effect.orDie(agents.create(user, { template: "stopLossGuard", spec: STOP_LOSS_GUARD }))
        const { agent } = yield* agents.sign(user, request, "active")
        yield* devnet.mintShares(user.account, GUARDED, 250_000_000n)
        const automation = yield* user.api.automations.create({
          payload: { requestId: RequestId.make(randomUUID()), draft: draft(agent.id) }
        }).pipe(Effect.orDie)
        if (options.paused !== true) return { user, agent, automation }

        const paused = yield* user.api.automations.update({
          params: { id: automation.id },
          payload: { status: "paused" }
        })
          .pipe(Effect.orDie)
        return { user, agent, automation: paused }
      })

      return { guarded }
    })
  )

  /** The automations of the test server's users, served by this layer too. */
  static readonly layer = this.layerNoDeps.pipe(Layer.provideMerge(TestAgents.layer))
}
