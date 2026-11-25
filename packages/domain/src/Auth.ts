/**
 * Who is calling: a session cookie set at sign-in, checked on every signed-in endpoint.
 *
 * @since 0.0.0
 */
import * as Context from "effect/Context"
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware"
import * as HttpApiSecurity from "effect/http-api/HttpApiSecurity"
import { Unauthenticated } from "./Errors.ts"
import type { Address, UserId } from "./Ids.ts"

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
