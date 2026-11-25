// Agents as the API takes and returns them: specs encoded as JSON, and an agent locked onchain with the user's passkey.
import { AgentSpec, type PolicyEntry, type PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { randomUUID } from "node:crypto"
import { call, fundedUser } from "./api.ts"

export const encode = (spec: AgentSpec) =>
  Schema.encodeSync(Schema.toCodecJson(AgentSpec))(spec) as { readonly policies: ReadonlyArray<unknown> }

/** A balanced Stock picker for NVDA and AAPL: $100 a trade, $250 a day, 30% in one stock, 10% cash. */
export const PICKER = draftSpec({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

/** `spec` with each entry's configuration changed. */
export const changed = (spec: AgentSpec, ...changes: ReadonlyArray<{ id: PolicyId; config: object }>) =>
  new AgentSpec({
    policies: spec.policies.map((entry) => {
      const change = changes.find((candidate) => candidate.id === entry.id)
      return (change === undefined
        ? entry
        : { id: entry.id, config: { ...entry.config, ...change.config } }) as PolicyEntry
    })
  })

export type User = Effect.Success<ReturnType<typeof fundedUser>>

export const createAgent = (
  cookie: string,
  options: { spec?: AgentSpec; template?: string | null; requestId?: string } = {}
) =>
  call("POST", "/api/agents", {
    cookie,
    body: {
      requestId: options.requestId ?? randomUUID(),
      name: "Tech picker",
      template: options.template === undefined ? "stockPicker" : options.template,
      spec: encode(options.spec ?? PICKER)
    }
  })

/** Signs a prepared request with the user's passkey and sends it; waits for the agent to reach `status`. */
export const signed = Effect.fnUntraced(function*(user: User, request: any, status: string) {
  const credential = user.authenticator.authenticate(request.options.challenge)
  const sent = yield* call("POST", `/api/agents/requests/${request.id}/confirm`, {
    cookie: user.cookie,
    body: { credential }
  })
  const settled = yield* user.events.next((event) =>
    event._tag === "AgentChanged" && event.agent.id === request.agent.id && event.agent.status === status &&
    event.agent.pendingSpec === null
  )
  return { sent, agent: settled.agent }
})

/** A funded user with a Stock picker locked onchain. */
export const lockedAgent = Effect.fnUntraced(function*() {
  const user = yield* fundedUser()
  const created = yield* createAgent(user.cookie)
  const { agent } = yield* signed(user, created.json, "active")
  return { user, agent }
})

/** A new user with gas for owner operations (the devnet's accounts pay their own), without their event stream. */
export const newCookie = Effect.gen(function*() {
  const user = yield* fundedUser()
  yield* user.events.close
  return user.cookie
})
