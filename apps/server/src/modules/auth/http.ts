import { BluechipApi } from "@bluechip/domain/Api"
import { sessionCookie } from "@bluechip/domain/Auth"
import { SignatureRejected } from "@bluechip/domain/Errors"
import type { PasskeyId, UserId } from "@bluechip/domain/Ids"
import { notificationOfDevice } from "@bluechip/domain/notifications/SecurityDrafts"
import { Ceremony } from "@bluechip/domain/WebAuthn"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as HttpEffect from "effect/http/HttpEffect"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as Option from "effect/Option"
import { AppConfig } from "../../config/AppConfig.ts"
import { count, UsersSignedIn } from "../../platform/telemetry/Metrics.ts"
import { Accounts } from "../accounts/Accounts.ts"
import { AuditLog } from "../audit/AuditLog.ts"
import { Notifications } from "../notifications/Notifications.ts"
import { Challenges } from "./Challenges.ts"
import { passkeyLabel } from "./PasskeyLabel.ts"
import { Sessions } from "./Sessions.ts"
import { deviceOf } from "./UserAgents.ts"
import { WebAuthn } from "./WebAuthn.ts"

// SimpleWebAuthn leaves unset options as `undefined`, which is not JSON; send them as the browser will read them.
const toJson = (options: object): Record<string, unknown> => JSON.parse(JSON.stringify(options))

export const AuthHandlers = HttpApiBuilder.group(
  BluechipApi,
  "auth",
  Effect.fn(function*(handlers) {
    const config = yield* AppConfig
    const accounts = yield* Accounts
    const challenges = yield* Challenges
    const sessions = yield* Sessions
    const webAuthn = yield* WebAuthn
    const notifications = yield* Notifications
    const audit = yield* AuditLog

    // Starts a session for the user on this browser and sets its cookie on the response. A sign-in on a device the
    // user never signed in on is a security notification (not the sign-up's first one).
    const signIn = Effect.fn("Auth.signIn")(function*(userId: UserId, passkeyId: PasskeyId, firstSession: boolean) {
      const request = yield* HttpServerRequest.HttpServerRequest
      const device = deviceOf(request.headers["user-agent"])
      const session = yield* sessions.create({ userId, passkeyId, device })
      yield* audit.record({
        userId,
        actor: "owner",
        action: "device.signedIn",
        subjectType: "session",
        subjectId: session.id,
        data: { device }
      })
      if (session.newDevice && !firstSession) {
        yield* notifications.add(userId, notificationOfDevice({ id: session.id, device }))
      }
      yield* HttpApiBuilder.securitySetCookie(sessionCookie, session.token, {
        path: "/",
        sameSite: "lax",
        secure: config.env === "production",
        expires: DateTime.toDateUtc(session.expiresAt)
      })
    })

    return handlers.handleAll({
      registerOptions: Effect.fn(function*({ payload }) {
        const options = yield* webAuthn.registrationOptions(payload.displayName)
        const challengeId = yield* challenges.issue("register", options.challenge)
        return new Ceremony({ challengeId, options: toJson(options) })
      }),
      registerVerify: Effect.fn(function*({ payload }) {
        const challenge = yield* challenges.consume("register", payload.challengeId)
        const passkey = yield* webAuthn.verifyRegistration(payload.credential, challenge)
        const request = yield* HttpServerRequest.HttpServerRequest
        const label = passkeyLabel({ aaguid: passkey.aaguid, userAgent: request.headers["user-agent"] })
        const { me, passkeyId } = yield* accounts.register({ displayName: payload.displayName, passkey, label })
        yield* signIn(me.user.id, passkeyId, true)
        return me
      }),
      loginOptions: Effect.fn(function*() {
        const options = yield* webAuthn.authenticationOptions
        const challengeId = yield* challenges.issue("login", options.challenge)
        return new Ceremony({ challengeId, options: toJson(options) })
      }),
      loginVerify: Effect.fn(
        function*({ payload }) {
          const challenge = yield* challenges.consume("login", payload.challengeId)
          const passkey = yield* accounts.findPasskey(payload.credential.id)
          // Only the account's owners sign in here: a recovery passkey signs in to recover, and a passkey being added
          // or removed doesn't own the account.
          if (Option.isNone(passkey) || passkey.value.role !== "owner" || passkey.value.status !== "active") {
            return yield* new SignatureRejected({ reason: "unknownPasskey" })
          }
          const counter = yield* webAuthn.verifyAuthentication(payload.credential, challenge, passkey.value)
          yield* accounts.recordPasskeyUse(passkey.value.id, counter)
          yield* signIn(passkey.value.userId as UserId, passkey.value.id as PasskeyId, false)
          yield* count(UsersSignedIn, { method: "passkey", outcome: "ok" })
          return yield* accounts.me(passkey.value.userId as UserId)
        },
        Effect.tapErrorTag("SignatureRejected", () => count(UsersSignedIn, { method: "passkey", outcome: "rejected" }))
      ),
      logout: Effect.fn(function*() {
        const request = yield* HttpServerRequest.HttpServerRequest
        const token = request.cookies[sessionCookie.key]
        if (token !== undefined) yield* sessions.revoke(token)
        yield* HttpEffect.appendPreResponseHandler((_request, response) =>
          Effect.succeed(HttpServerResponse.expireCookieUnsafe(response, sessionCookie.key, { path: "/" }))
        )
      })
    })
  })
)
