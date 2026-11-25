import { BluechipApi } from "@bluechip/domain/Api"
import { sessionCookie } from "@bluechip/domain/Auth"
import { SignatureRejected } from "@bluechip/domain/Errors"
import type { PasskeyId, UserId } from "@bluechip/domain/Ids"
import { Ceremony } from "@bluechip/domain/WebAuthn"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as HttpEffect from "effect/http/HttpEffect"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as Option from "effect/Option"
import { AppConfig } from "../../config/AppConfig.ts"
import { Accounts } from "../accounts/Accounts.ts"
import { Challenges } from "./Challenges.ts"
import { passkeyLabel } from "./PasskeyLabel.ts"
import { Sessions } from "./Sessions.ts"
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

    // Starts a session for the user and sets its cookie on the response.
    const signIn = Effect.fn("Auth.signIn")(function*(userId: UserId, passkeyId: PasskeyId) {
      const session = yield* sessions.create(userId, passkeyId)
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
        yield* signIn(me.user.id, passkeyId)
        return me
      }),
      loginOptions: Effect.fn(function*() {
        const options = yield* webAuthn.authenticationOptions
        const challengeId = yield* challenges.issue("login", options.challenge)
        return new Ceremony({ challengeId, options: toJson(options) })
      }),
      loginVerify: Effect.fn(function*({ payload }) {
        const challenge = yield* challenges.consume("login", payload.challengeId)
        const passkey = yield* accounts.findPasskey(payload.credential.id)
        if (Option.isNone(passkey)) return yield* new SignatureRejected({ reason: "unknownPasskey" })
        const counter = yield* webAuthn.verifyAuthentication(payload.credential, challenge, passkey.value)
        yield* accounts.recordPasskeyUse(passkey.value.id, counter)
        yield* signIn(passkey.value.userId as UserId, passkey.value.id as PasskeyId)
        return yield* accounts.me(passkey.value.userId as UserId)
      }),
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
