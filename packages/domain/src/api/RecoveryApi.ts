/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as Schema from "effect/Schema"
import { Me } from "../Account.ts"
import { Authentication, RecoveryAuthentication } from "../Auth.ts"
import { Conflict, NotFound, SignatureRejected, Unavailable } from "../Errors.ts"
import { RecoveryRequestId, RequestId, SigningRequestId } from "../Ids.ts"
import { AccountRecovery, Recovering, RecoveryKeyChange, RecoverySigning } from "../recovery/Recovery.ts"
import { AuthenticationCredential, Ceremony, RegistrationCredential } from "../WebAuthn.ts"

/**
 * The account's recovery, for its owner: set up or remove the recovery passkey (an owner operation, Face ID), see a
 * recovery under way and cancel it (no Face ID: cancelling only takes power away).
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class AccountRecoveryApi extends HttpApiGroup.make("accountRecovery").add(
  HttpApiEndpoint.get("get", "/account/recovery", { success: AccountRecovery }),
  HttpApiEndpoint.post("keyOptions", "/account/recovery/key/options", { success: Ceremony }),
  HttpApiEndpoint.post("setUp", "/account/recovery/key", {
    payload: Schema.Struct({ requestId: RequestId, challengeId: Schema.String, credential: RegistrationCredential }),
    success: RecoveryKeyChange,
    error: [SignatureRejected, Conflict, Unavailable]
  }),
  HttpApiEndpoint.post("removeKey", "/account/recovery/key/remove", {
    payload: Schema.Struct({ requestId: RequestId }),
    success: RecoveryKeyChange,
    error: [Conflict, Unavailable]
  }),
  HttpApiEndpoint.post("confirmKey", "/account/recovery/key-changes/:id/confirm", {
    params: { id: SigningRequestId },
    payload: Schema.Struct({ credential: AuthenticationCredential }),
    success: AccountRecovery,
    error: [NotFound, Conflict, SignatureRejected, Unavailable]
  }),
  HttpApiEndpoint.post("cancel", "/account/recovery/cancel", {
    success: AccountRecovery,
    error: [Conflict, Unavailable]
  })
).middleware(Authentication) {}

/**
 * Signing in with a recovery passkey, from a device that has none of the account's passkeys. The session it starts
 * (15 minutes, its own cookie) can only see and make a recovery.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class RecoveryApi extends HttpApiGroup.make("recovery").add(
  HttpApiEndpoint.post("options", "/recovery/options", { success: Ceremony }),
  HttpApiEndpoint.post("signIn", "/recovery/sign-in", {
    payload: Schema.Struct({ challengeId: Schema.String, credential: AuthenticationCredential }),
    success: Recovering,
    error: SignatureRejected
  })
) {}

/**
 * Recovering, signed in with the recovery passkey: make this device's new passkey and ask for the recovery (the
 * recovery passkey signs), then, 48 hours later, make it; once it lands, this device is signed in with its new passkey.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class RecoveringApi extends HttpApiGroup.make("recovering").add(
  HttpApiEndpoint.get("get", "/recovery", { success: Recovering }),
  HttpApiEndpoint.post("passkeyOptions", "/recovery/passkey/options", { success: Ceremony }),
  HttpApiEndpoint.post("request", "/recovery/request", {
    payload: Schema.Struct({ challengeId: Schema.String, credential: RegistrationCredential }),
    success: RecoverySigning,
    error: [SignatureRejected, Conflict, Unavailable]
  }),
  HttpApiEndpoint.post("execute", "/recovery/execute", {
    success: RecoverySigning,
    error: [Conflict, Unavailable]
  }),
  HttpApiEndpoint.post("confirm", "/recovery/:id/confirm", {
    params: { id: RecoveryRequestId },
    payload: Schema.Struct({ credential: AuthenticationCredential }),
    success: Recovering,
    error: [NotFound, Conflict, SignatureRejected, Unavailable]
  }),
  HttpApiEndpoint.post("signInRecovered", "/recovery/sign-in-recovered", {
    /**
     * Once the recovery this device made has landed: signs it in with its new passkey (the session cookie), ending
     * the recovery sign-in. `Conflict` until then, and on any other device.
     */
    success: Me,
    error: Conflict
  })
).middleware(RecoveryAuthentication) {}
