import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { AgentRequests } from "./AgentRequests.ts"
import { Agents } from "./Agents.ts"

export const AgentsHandlers = HttpApiBuilder.group(
  BluechipApi,
  "agents",
  Effect.fn(function*(handlers) {
    const agents = yield* Agents
    const requests = yield* AgentRequests

    return handlers.handleAll({
      list: () => CurrentUser.use((user) => agents.list(user)),
      agent: ({ params }) => CurrentUser.use((user) => agents.find(user, params.id)),
      usage: ({ params }) => CurrentUser.use((user) => agents.usage(user, params.id)),
      sessions: ({ params }) => CurrentUser.use((user) => agents.sessions(user, params.id)),
      pause: ({ params }) => CurrentUser.use((user) => agents.pause(user, params.id)),
      resume: ({ params }) => CurrentUser.use((user) => agents.resume(user, params.id)),
      pauseAll: () => CurrentUser.use((user) => agents.pauseAll(user)),
      resumeAll: () => CurrentUser.use((user) => agents.resumeAll(user)),
      create: ({ payload }) => CurrentUser.use((user) => requests.create(user, payload)),
      lock: ({ params, payload }) => CurrentUser.use((user) => requests.lock(user, params.id, payload.requestId)),
      change: ({ params, payload }) => CurrentUser.use((user) => requests.change(user, params.id, payload)),
      renew: ({ params, payload }) => CurrentUser.use((user) => requests.renew(user, params.id, payload.requestId)),
      remove: ({ params, payload }) => CurrentUser.use((user) => requests.remove(user, params.id, payload.requestId)),
      confirm: ({ params, payload }) => CurrentUser.use((user) => requests.confirm(user, params.id, payload.credential))
    })
  })
)
