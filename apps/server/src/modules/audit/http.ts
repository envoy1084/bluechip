import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { AuditLog } from "./AuditLog.ts"

export const AuditHandlers = HttpApiBuilder.group(
  BluechipApi,
  "audit",
  Effect.fn(function*(handlers) {
    const audit = yield* AuditLog

    return handlers.handleAll({
      list: ({ query }) =>
        CurrentUser.use((user) =>
          audit.page(user.id, { ...query, size: query.pageSize ?? 25, before: query.pageToken })
        ),
      export: ({ query }) => CurrentUser.use((user) => audit.export(user.id, query))
    })
  })
)
