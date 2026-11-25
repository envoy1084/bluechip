import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { AuditLog } from "../audit/AuditLog.ts"
import { Intents } from "./Intents.ts"

export const IntentsHandlers = HttpApiBuilder.group(
  BluechipApi,
  "intents",
  Effect.fn(function*(handlers) {
    const intents = yield* Intents
    const audit = yield* AuditLog

    return handlers.handleAll({
      preview: ({ payload }) => CurrentUser.use((user) => intents.preview(user, payload.agentId, payload.leg)),
      create: ({ payload }) => CurrentUser.use((user) => intents.create(user, payload)),
      list: ({ query }) => CurrentUser.use((user) => intents.list(user, query)),
      intent: ({ params }) => CurrentUser.use((user) => intents.find(user, params.id)),
      approvals: () => CurrentUser.use((user) => intents.approvals(user)),
      approve: ({ params, payload }) => CurrentUser.use((user) => intents.approve(user, params.id, payload.requestId)),
      confirm: ({ params, payload }) => CurrentUser.use((user) => intents.confirm(user, params.id, payload.credential)),
      decline: ({ params }) => CurrentUser.use((user) => intents.decline(user, params.id)),
      cancel: ({ params }) => CurrentUser.use((user) => intents.cancel(user, params.id)),
      audit: ({ query }) =>
        CurrentUser.use((user) => audit.page(user.id, { size: query.pageSize ?? 25, before: query.pageToken }))
    })
  })
)
