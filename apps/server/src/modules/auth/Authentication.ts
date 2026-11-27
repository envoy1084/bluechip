import { Authentication, CurrentUser, RecoveringUser, RecoveryAuthentication } from "@bluechip/domain/Auth"
import { Unauthenticated } from "@bluechip/domain/Errors"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import { Sessions } from "./Sessions.ts"

/** Session cookie → live session → `CurrentUser`; anything else is `Unauthenticated`. */
export const AuthenticationLive = Layer.effect(
  Authentication,
  Effect.gen(function*() {
    const sessions = yield* Sessions
    const signedIn = Effect.fn("Authentication.session")(function*(token: string) {
      if (token === "") return yield* new Unauthenticated()
      const user = yield* sessions.user(token)
      if (Option.isNone(user)) return yield* new Unauthenticated()
      return user.value
    })
    return Authentication.of({
      // The user goes on the request's span, so every trace says whose request it was.
      session: Effect.fnUntraced(function*(httpEffect, { credential }) {
        const user = yield* signedIn(Redacted.value(credential))
        yield* Effect.annotateCurrentSpan("user.id", user.id)
        return yield* Effect.provideService(httpEffect, CurrentUser, user)
      })
    })
  })
)

/** Recovery cookie → live recovery session → `RecoveringUser`; anything else is `Unauthenticated`. */
export const RecoveryAuthenticationLive = Layer.effect(
  RecoveryAuthentication,
  Effect.gen(function*() {
    const sessions = yield* Sessions
    return RecoveryAuthentication.of({
      recovery: Effect.fn("RecoveryAuthentication.recovery")(function*(httpEffect, { credential }) {
        const token = Redacted.value(credential)
        if (token === "") return yield* new Unauthenticated()
        const user = yield* sessions.recovering(token)
        if (Option.isNone(user)) return yield* new Unauthenticated()
        return yield* Effect.provideService(httpEffect, RecoveringUser, user.value)
      })
    })
  })
)
