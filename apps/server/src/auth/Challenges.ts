import { SignatureRejected } from "@bluechip/domain/Errors"
import { and, eq, gt, isNull } from "drizzle-orm"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { typeid } from "typeid-js"
import { Database } from "../db/Database.ts"
import { authChallenges } from "../db/schema/auth.ts"

type Purpose = "register" | "login"

/** Stores a ceremony's challenge for five minutes; returns the id the client sends back with its response. */
export const issueChallenge = Effect.fn("Challenges.issue")(function*(purpose: Purpose, challenge: string) {
  const db = yield* Database
  const id = typeid("challenge").toString() as `challenge_${string}`
  const expiresAt = DateTime.add(yield* DateTime.now, { minutes: 5 })
  yield* db.insert(authChallenges).values({ id, purpose, challenge, expiresAt }).pipe(Effect.orDie)
  return id
})

/** Marks the challenge used and returns it, in one statement, so it can never verify twice. */
export const consumeChallenge = Effect.fn("Challenges.consume")(function*(purpose: Purpose, challengeId: string) {
  const db = yield* Database
  const now = yield* DateTime.now
  if (!challengeId.startsWith("challenge_")) return yield* new SignatureRejected({ reason: "challenge" })
  const id = challengeId as `challenge_${string}`
  const [used] = yield* db.update(authChallenges)
    .set({ usedAt: now })
    .where(and(
      eq(authChallenges.id, id),
      eq(authChallenges.purpose, purpose),
      isNull(authChallenges.usedAt),
      gt(authChallenges.expiresAt, now)
    ))
    .returning({ challenge: authChallenges.challenge })
    .pipe(Effect.orDie)
  if (used === undefined) return yield* new SignatureRejected({ reason: "challenge" })
  return used.challenge
})
