/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as HttpApiSchema from "effect/http-api/HttpApiSchema"
import { Authentication } from "../Auth.ts"
import { Forbidden, Unavailable } from "../Errors.ts"

/**
 * Local development only: `POST /api/dev/fund` gives the signed-in user's account test USDC and ETH on the local
 * fork. Every other network answers `Forbidden`.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class DevApi extends HttpApiGroup.make("dev").add(
  HttpApiEndpoint.post("fund", "/dev/fund", {
    success: HttpApiSchema.NoContent,
    error: [Forbidden, Unavailable]
  })
).middleware(Authentication) {}
