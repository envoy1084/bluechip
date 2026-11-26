/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as Schema from "effect/Schema"
import { AuditEvent, AuditType } from "../audit/Audit.ts"
import { Authentication } from "../Auth.ts"
import { AgentId } from "../Ids.ts"
import { Page, PageQuery } from "../Page.ts"

/**
 * What the audit log filters by: the kind of thing, the agent, and the dates (`from` inclusive, `to` exclusive).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const AuditFilter = {
  type: Schema.optionalKey(AuditType),
  agentId: Schema.optionalKey(AgentId),
  from: Schema.optionalKey(Schema.DateTimeUtcFromString),
  to: Schema.optionalKey(Schema.DateTimeUtcFromString)
}

/**
 * The audit trail: a page of it, newest first, or all of it matching the filter as JSON (up to 10,000 events).
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class AuditApi extends HttpApiGroup.make("audit").add(
  HttpApiEndpoint.get("list", "/audit", {
    query: { ...PageQuery, ...AuditFilter },
    success: Page(AuditEvent)
  }),
  HttpApiEndpoint.get("export", "/audit/export", {
    query: AuditFilter,
    success: Schema.Array(AuditEvent)
  })
).middleware(Authentication) {}
