import { BluechipApi } from "@bluechip/domain/Api"
import { sessionCookie } from "@bluechip/domain/Auth"
import { SignatureRejected } from "@bluechip/domain/Errors"
import { Ceremony } from "@bluechip/domain/WebAuthn"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as HttpEffect from "effect/http/HttpEffect"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as Option from "effect/Option"
import { findMe, findPasskey, recordPasskeyUse, registerUser } from "../accounts/Accounts.ts"
import { consumeChallenge, issueChallenge } from "../auth/Challenges.ts"
import { passkeyLabel } from "../auth/PasskeyLabel.ts"
import { createSession, revokeSession } from "../auth/Sessions.ts"
import {
  authenticationOptions,
  registrationOptions,
  verifyAuthentication,
  verifyRegistration
} from "../auth/WebAuthn.ts"
import { AppConfig } from "../Config.ts"

// SimpleWebAuthn leaves unset options as `undefined`, which is not JSON; send them as the browser will read them.
const toJson = (options: object): Record<string, unknown> => JSON.parse(JSON.stringify(options))

/** Starts a session for the user and sets its cookie on the response. */
const signIn = Effect.fn("Auth.signIn")(function*(...owner: Parameters<typeof createSession>) {
  const config = yield* AppConfig
  const session = yield* createSession(...owner)
  yield* HttpApiBuilder.securitySetCookie(sessionCookie, session.token, {
    path: "/",
    sameSite: "lax",
    secure: config.env === "production",
    expires: DateTime.toDateUtc(session.expiresAt)
  })
})

export const AuthHandlers = HttpApiBuilder.group(BluechipApi, "auth", (handlers) =>
  handlers
    .handle("registerOptions", ({ payload }) =>
      Effect.gen(function*() {
        const options = yield* registrationOptions(payload.displayName)
        const challengeId = yield* issueChallenge("register", options.challenge)
        return new Ceremony({ challengeId, options: toJson(options) })
      }))
    .handle("registerVerify", ({ payload }) =>
      Effect.gen(function*() {
        const challenge = yield* consumeChallenge("register", payload.challengeId)
        const passkey = yield* verifyRegistration(payload.credential, challenge)
        const request = yield* HttpServerRequest.HttpServerRequest
        const label = passkeyLabel({ aaguid: passkey.aaguid, userAgent: request.headers["user-agent"] })
        const { me, passkeyId } = yield* registerUser({ displayName: payload.displayName, passkey, label })
        yield* signIn(me.user.id, passkeyId)
        return me
      }))
    .handle("loginOptions", () =>
      Effect.gen(function*() {
        const options = yield* authenticationOptions()
        const challengeId = yield* issueChallenge("login", options.challenge)
        return new Ceremony({ challengeId, options: toJson(options) })
      }))
    .handle("loginVerify", ({ payload }) =>
      Effect.gen(function*() {
        const challenge = yield* consumeChallenge("login", payload.challengeId)
        const passkey = yield* findPasskey(payload.credential.id)
        if (Option.isNone(passkey)) return yield* new SignatureRejected({ reason: "unknownPasskey" })
        const counter = yield* verifyAuthentication(payload.credential, challenge, passkey.value)
        yield* recordPasskeyUse(passkey.value.id, counter)
        yield* signIn(passkey.value.userId as never, passkey.value.id as never)
        return yield* findMe(passkey.value.userId as never)
      }))
    .handle("logout", () =>
      Effect.gen(function*() {
        const request = yield* HttpServerRequest.HttpServerRequest
        const token = request.cookies[sessionCookie.key]
        if (token !== undefined) yield* revokeSession(token)
        yield* HttpEffect.appendPreResponseHandler((_request, response) =>
          Effect.succeed(HttpServerResponse.expireCookieUnsafe(response, sessionCookie.key, { path: "/" }))
        )
      })))
