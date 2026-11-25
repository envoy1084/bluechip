import { Authentication, CurrentUser } from "@bluechip/domain/Auth"
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
    return Authentication.of({
      session: Effect.fn("Authentication.session")(function*(httpEffect, { credential }) {
        const token = Redacted.value(credential)
        if (token === "") return yield* new Unauthenticated()
        const user = yield* sessions.user(token)
        if (Option.isNone(user)) return yield* new Unauthenticated()
        return yield* Effect.provideService(httpEffect, CurrentUser, user.value)
      })
    })
  })
)
