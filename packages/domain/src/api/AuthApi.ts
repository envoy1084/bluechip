/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as HttpApiSchema from "effect/http-api/HttpApiSchema"
import * as Schema from "effect/Schema"
import { Me } from "../Account.ts"
import { SignatureRejected } from "../Errors.ts"
import { AuthenticationCredential, Ceremony, RegistrationCredential } from "../WebAuthn.ts"

const DisplayName = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(64))

/**
 * Passkey sign-up and sign-in. Each ceremony is two calls: `options` returns a single-use challenge (5 minutes),
 * `verify` checks the passkey's response and sets the session cookie.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class AuthApi extends HttpApiGroup.make("auth").add(
  HttpApiEndpoint.post("registerOptions", "/auth/register/options", {
    payload: Schema.Struct({ displayName: Schema.optionalKey(DisplayName) }),
    success: Ceremony
  }),
  HttpApiEndpoint.post("registerVerify", "/auth/register/verify", {
    payload: Schema.Struct({
      challengeId: Schema.String,
      credential: RegistrationCredential,
      displayName: Schema.optionalKey(DisplayName)
    }),
    success: Me,
    error: SignatureRejected
  }),
  HttpApiEndpoint.post("loginOptions", "/auth/login/options", { success: Ceremony }),
  HttpApiEndpoint.post("loginVerify", "/auth/login/verify", {
    payload: Schema.Struct({ challengeId: Schema.String, credential: AuthenticationCredential }),
    success: Me,
    error: SignatureRejected
  }),
  HttpApiEndpoint.post("logout", "/auth/logout", { success: HttpApiSchema.NoContent })
) {}
