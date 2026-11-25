/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as Schema from "effect/Schema"
import { ActivityItem, ActivityKind, ActivityPeriod } from "../activity/Activity.ts"
import { Authentication } from "../Auth.ts"
import { Page, PageQuery } from "../Page.ts"

/**
 * `GET /api/activity`: the user's trades and withdrawals, newest first, by kind and period.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class ActivityApi extends HttpApiGroup.make("activity").add(
  HttpApiEndpoint.get("list", "/activity", {
    query: { ...PageQuery, kind: Schema.optionalKey(ActivityKind), period: Schema.optionalKey(ActivityPeriod) },
    success: Page(ActivityItem)
  })
).middleware(Authentication) {}
