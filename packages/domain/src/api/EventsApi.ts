/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as HttpApiSchema from "effect/http-api/HttpApiSchema"
import { Authentication } from "../Auth.ts"
import { LiveEvent } from "../Events.ts"

/**
 * `GET /api/events`: the signed-in user's live event stream (Server-Sent Events, one JSON `LiveEvent` per message).
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class EventsApi extends HttpApiGroup.make("events").add(
  HttpApiEndpoint.get("watch", "/events", {
    success: HttpApiSchema.StreamSse({ data: LiveEvent, keepAlive: "15 seconds" })
  })
).middleware(Authentication) {}
