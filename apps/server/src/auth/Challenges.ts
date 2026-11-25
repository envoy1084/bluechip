import { SignatureRejected } from "@bluechip/domain/Errors"
import { and, eq, gt, isNull } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { typeid } from "typeid-js"
import { Database } from "../db/Database.ts"
import { authChallenges } from "../db/schema/auth.ts"

type Purpose = "register" | "login"

/** The challenges of passkey ceremonies, each valid for five minutes and verified at most once. */
export class Challenges extends Context.Service<Challenges, {
  /** Stores a ceremony's challenge; returns the id the client sends back with its response. */
  readonly issue: (purpose: Purpose, challenge: string) => Effect.Effect<string>
  /** Marks the challenge used and returns it, in one statement, so it can never verify twice. */
  readonly consume: (purpose: Purpose, challengeId: string) => Effect.Effect<string, SignatureRejected>
}>()("@bluechip/server/Challenges") {
  static readonly layer = Layer.effect(
    Challenges,
    Effect.gen(function*() {
      const db = yield* Database

      const issue = Effect.fn("Challenges.issue")(function*(purpose: Purpose, challenge: string) {
        const id = typeid("challenge").toString() as `challenge_${string}`
        const expiresAt = DateTime.add(yield* DateTime.now, { minutes: 5 })
        yield* db.insert(authChallenges).values({ id, purpose, challenge, expiresAt }).pipe(Effect.orDie)
        return id
      })

      const consume = Effect.fn("Challenges.consume")(function*(purpose: Purpose, challengeId: string) {
        const now = yield* DateTime.now
        if (!challengeId.startsWith("challenge_")) return yield* new SignatureRejected({ reason: "challenge" })

        const [used] = yield* db.update(authChallenges)
          .set({ usedAt: now })
          .where(and(
            eq(authChallenges.id, challengeId as `challenge_${string}`),
            eq(authChallenges.purpose, purpose),
            isNull(authChallenges.usedAt),
            gt(authChallenges.expiresAt, now)
          ))
          .returning({ challenge: authChallenges.challenge })
          .pipe(Effect.orDie)
        if (used === undefined) return yield* new SignatureRejected({ reason: "challenge" })
        return used.challenge
      })

      return Challenges.of({ issue, consume })
    })
  )
}
