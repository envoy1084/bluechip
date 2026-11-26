// Signing requests in the preview: WebAuthn options any made-up credential answers (the mock checks no signature),
// and the short wait Base takes before an operation lands.
import type { SigningRequestId } from "@bluechip/domain/Ids"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"

/** The request's WebAuthn options: its id as the challenge, any of your passkeys. */
export const ceremonyOptions = (id: SigningRequestId): Record<string, unknown> => ({
  challenge: btoa(id).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""),
  timeout: 60_000,
  userVerification: "required",
  allowCredentials: []
})

/** When a request prepared at `now` stops being signable. */
export const expiresAt = (now: DateTime.Utc): DateTime.Utc => DateTime.add(now, { minutes: 5 })

/** How long an owner operation takes to land on Base, so the app's progress shows. */
const LANDING = "2500 millis"

/** Runs `landed` once the operation would have landed, after the request that sent it has answered. */
export const afterLanding = (landed: () => void): Effect.Effect<void> =>
  Effect.asVoid(Effect.forkDetach(Effect.andThen(Effect.sleep(LANDING), Effect.sync(landed))))
