/**
 * Who is calling: a session cookie set at sign-in, checked on every signed-in endpoint.
 *
 * @since 0.0.0
 */
import * as Context from "effect/Context"
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware"
import * as HttpApiSecurity from "effect/http-api/HttpApiSecurity"
import { Unauthenticated } from "./Errors.ts"
import type { Address, PasskeyId, SessionId, UserId } from "./Ids.ts"

/**
 * The session cookie: an opaque random token, httpOnly, so page scripts never see it.
 *
 * @stability unstable
 * @category security
 * @since 0.0.0
 */
export const sessionCookie = HttpApiSecurity.apiKey({ key: "bluechip_session", in: "cookie" })

/**
 * The signed-in user, provided to handlers by {@link Authentication}.
 *
 * @stability unstable
 * @category services
 * @since 0.0.0
 */
export class CurrentUser extends Context.Service<CurrentUser, {
  readonly id: UserId
  readonly account: Address
  /** The passkey that signed in this session. */
  readonly passkey: PasskeyId
  /** This browser's session, among the user's devices. */
  readonly session: SessionId
}>()("@bluechip/domain/Auth/CurrentUser") {}

/**
 * Requires a valid session; fails with `Unauthenticated` (401) otherwise.
 *
 * @stability unstable
 * @category middleware
 * @since 0.0.0
 */
export class Authentication extends HttpApiMiddleware.Service<Authentication, { provides: CurrentUser }>()(
  "@bluechip/domain/Auth/Authentication",
  { security: { session: sessionCookie }, error: Unauthenticated }
) {}

/**
 * The recovery cookie: a session signed in with the account's recovery passkey, which can only see and make a
 * recovery (15 minutes).
 *
 * @stability unstable
 * @category security
 * @since 0.0.0
 */
export const recoveryCookie = HttpApiSecurity.apiKey({ key: "bluechip_recovery", in: "cookie" })

/**
 * Someone signed in with an account's recovery passkey, provided to recovery handlers by
 * {@link RecoveryAuthentication}.
 *
 * @stability unstable
 * @category services
 * @since 0.0.0
 */
export class RecoveringUser extends Context.Service<RecoveringUser, {
  readonly id: UserId
  readonly account: Address
  /** The recovery passkey that signed in. */
  readonly passkey: PasskeyId
}>()("@bluechip/domain/Auth/RecoveringUser") {}

/**
 * Requires a live recovery session; fails with `Unauthenticated` (401) otherwise.
 *
 * @stability unstable
 * @category middleware
 * @since 0.0.0
 */
export class RecoveryAuthentication
  extends HttpApiMiddleware.Service<RecoveryAuthentication, { provides: RecoveringUser }>()(
    "@bluechip/domain/Auth/RecoveryAuthentication",
    { security: { recovery: recoveryCookie }, error: Unauthenticated }
  )
{}
