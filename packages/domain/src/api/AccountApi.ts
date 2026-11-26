/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as HttpApiSchema from "effect/http-api/HttpApiSchema"
import * as Schema from "effect/Schema"
import { Device, Me, Passkey, PasskeyChange, User } from "../Account.ts"
import { Authentication } from "../Auth.ts"
import { TimeZoneName } from "../automations/Time.ts"
import { Conflict, InvalidRequest, NotFound, SignatureRejected, Unavailable } from "../Errors.ts"
import { PasskeyId, RequestId, SessionId, SigningRequestId } from "../Ids.ts"
import { AuthenticationCredential, Ceremony, RegistrationCredential } from "../WebAuthn.ts"

/**
 * The signed-in user's account: their name and eligibility, the passkeys that own it (add one, remove one, each one
 * owner operation signed with Face ID), and the devices signed in.
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
  HttpApiEndpoint.post("setTimeZone", "/account/time-zone", {
    /** An IANA zone (`Europe/London`). */
    payload: Schema.Struct({ timeZone: TimeZoneName }),
    success: User,
    error: InvalidRequest
  }),
  HttpApiEndpoint.post("setEligibility", "/account/eligibility", {
    payload: Schema.Struct({ answer: Schema.Literals(["outsideUs", "us"]) }),
    success: User
  }),
  HttpApiEndpoint.get("passkeys", "/account/passkeys", { success: Schema.Array(Passkey) }),
  HttpApiEndpoint.post("passkeyOptions", "/account/passkeys/options", { success: Ceremony }),
  HttpApiEndpoint.post("addPasskey", "/account/passkeys", {
    payload: Schema.Struct({ requestId: RequestId, challengeId: Schema.String, credential: RegistrationCredential }),
    success: PasskeyChange,
    error: [SignatureRejected, Conflict, Unavailable]
  }),
  HttpApiEndpoint.post("removePasskey", "/account/passkeys/:id/remove", {
    params: { id: PasskeyId },
    payload: Schema.Struct({ requestId: RequestId }),
    success: PasskeyChange,
    error: [NotFound, Conflict, Unavailable]
  }),
  HttpApiEndpoint.post("confirmPasskeyChange", "/account/passkey-changes/:id/confirm", {
    params: { id: SigningRequestId },
    payload: Schema.Struct({ credential: AuthenticationCredential }),
    success: Passkey,
    error: [NotFound, Conflict, SignatureRejected, Unavailable]
  }),
  HttpApiEndpoint.get("devices", "/account/devices", { success: Schema.Array(Device) }),
  HttpApiEndpoint.post("signOutDevice", "/account/devices/:id/sign-out", {
    params: { id: SessionId },
    success: HttpApiSchema.NoContent,
    error: NotFound
  }),
  HttpApiEndpoint.post("signOutOthers", "/account/devices/sign-out-others", { success: HttpApiSchema.NoContent })
).middleware(Authentication) {}
