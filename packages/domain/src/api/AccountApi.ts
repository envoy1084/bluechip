/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as Schema from "effect/Schema"
import { Me, Passkey, User } from "../Account.ts"
import { Authentication } from "../Auth.ts"

/**
 * The signed-in user's account.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class AccountApi extends HttpApiGroup.make("account").add(
  HttpApiEndpoint.get("me", "/account", { success: Me }),
  HttpApiEndpoint.post("setDisplayName", "/account/display-name", {
    payload: Schema.Struct({ displayName: Schema.NullOr(Schema.String.check(Schema.isMaxLength(64))) }),
    success: User
  }),
  HttpApiEndpoint.post("setEligibility", "/account/eligibility", {
    payload: Schema.Struct({ answer: Schema.Literals(["outsideUs", "us"]) }),
    success: User
  }),
  HttpApiEndpoint.get("passkeys", "/account/passkeys", { success: Schema.Array(Passkey) })
).middleware(Authentication) {}
