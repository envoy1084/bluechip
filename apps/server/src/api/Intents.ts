import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { auditPage } from "../audit/AuditLog.ts"
import { Database } from "../db/Database.ts"
import { Intents } from "../intents/Intents.ts"

export const IntentsHandlers = HttpApiBuilder.group(BluechipApi, "intents", (handlers) =>
  handlers
    .handle("preview", ({ payload }) =>
      Effect.flatMap(Effect.all([CurrentUser, Intents]), ([user, intents]) =>
        intents.preview(user, payload.agentId, payload.leg)))
    .handle("create", ({ payload }) =>
      Effect.flatMap(Effect.all([CurrentUser, Intents]), ([user, intents]) =>
        intents.create(user, payload)))
    .handle("list", ({ query }) =>
      Effect.flatMap(Effect.all([CurrentUser, Intents]), ([user, intents]) =>
        intents.list(user, query)))
    .handle("intent", ({ params }) =>
      Effect.flatMap(Effect.all([CurrentUser, Intents]), ([user, intents]) =>
        intents.find(user, params.id)))
    .handle("approvals", () =>
      Effect.flatMap(Effect.all([CurrentUser, Intents]), ([user, intents]) =>
        intents.approvals(user)))
    .handle("approve", ({ params, payload }) =>
      Effect.flatMap(Effect.all([CurrentUser, Intents]), ([user, intents]) =>
        intents.approve(user, params.id, payload.requestId)))
    .handle("confirm", ({ params, payload }) =>
      Effect.flatMap(Effect.all([CurrentUser, Intents]), ([user, intents]) =>
        intents.confirm(user, params.id, payload.credential)))
    .handle("decline", ({ params }) =>
      Effect.flatMap(Effect.all([CurrentUser, Intents]), ([user, intents]) =>
        intents.decline(user, params.id)))
    .handle("cancel", ({ params }) =>
      Effect.flatMap(Effect.all([CurrentUser, Intents]), ([user, intents]) =>
        intents.cancel(user, params.id)))
    .handle("audit", ({ query }) =>
      Effect.gen(function*() {
        const user = yield* CurrentUser
        return yield* auditPage(user.id, { size: query.pageSize ?? 25, before: query.pageToken }).pipe(
          Effect.provideService(Database, yield* Database)
        )
      })))
