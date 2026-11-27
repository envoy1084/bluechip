/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as HttpApiSchema from "effect/http-api/HttpApiSchema"
import { Authentication } from "../Auth.ts"
import { Forbidden, NotFound, Unavailable } from "../Errors.ts"
import { AutomationId } from "../Ids.ts"

/**
 * Local development only: `POST /api/dev/fund` gives the signed-in user's account test USDC and ETH on the local
 * fork; `POST /api/dev/automations/:id/fire` runs one of the user's automations now, as its trigger would, through
 * the same durable fire (its run, conditions, plan and trades). Every other network answers `Forbidden`.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class DevApi extends HttpApiGroup.make("dev").add(
  HttpApiEndpoint.post("fund", "/dev/fund", {
    success: HttpApiSchema.NoContent,
    error: [Forbidden, Unavailable]
  }),
  HttpApiEndpoint.post("fireAutomation", "/dev/automations/:id/fire", {
    params: { id: AutomationId },
    success: HttpApiSchema.NoContent,
    error: [Forbidden, NotFound]
  })
).middleware(Authentication) {}
