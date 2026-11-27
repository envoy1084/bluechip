import type { AuthenticationCredential, RegistrationCredential } from "@bluechip/domain/WebAuthn"
import { startAuthentication, startRegistration } from "@simplewebauthn/browser"
import * as Effect from "effect/Effect"
import { track } from "./analytics.ts"
import { passkeyFailureReason } from "./passkeyProblem.ts"

// The browser's WebAuthn JSON and the domain schemas describe the same objects (SimpleWebAuthn types its extension
// outputs as an interface, the schema as a record); the server decodes and checks every field.
export const ceremonyOptions = <A>(options: Record<string, unknown>) => options as A
export const asCredential = <A>(credential: object) => credential as unknown as A

// Every prompt that fails says why to analytics; the error goes on to the screen that shows it.
const reportFailure = (step: "create" | "get") => (error: unknown) =>
  Effect.sync(() => {
    const reason = passkeyFailureReason(error)
    if (reason !== null) track({ _tag: "passkey_prompt_failed", step, reason })
  })

/** Asks the account's passkey (Face ID / Touch ID) to sign what the server prepared, from its WebAuthn options. */
export const signWithPasskey = (options: Record<string, unknown>) =>
  Effect.tryPromise(() => startAuthentication({ optionsJSON: ceremonyOptions(options) })).pipe(
    Effect.tapError(reportFailure("get")),
    Effect.map((credential) => asCredential<typeof AuthenticationCredential.Type>(credential))
  )

/** Makes a new passkey (on this device, another one by its QR code, or a hardware key) from the server's options. */
export const createPasskey = (options: Record<string, unknown>) =>
  Effect.tryPromise(() => startRegistration({ optionsJSON: ceremonyOptions(options) })).pipe(
    Effect.tapError(reportFailure("create")),
    Effect.map((credential) => asCredential<typeof RegistrationCredential.Type>(credential))
  )
