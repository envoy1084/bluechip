import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import { startAuthentication } from "@simplewebauthn/browser"
import * as Effect from "effect/Effect"

// The browser's WebAuthn JSON and the domain schemas describe the same objects (SimpleWebAuthn types its extension
// outputs as an interface, the schema as a record); the server decodes and checks every field.
export const ceremonyOptions = <A>(options: Record<string, unknown>) => options as A
export const asCredential = <A>(credential: object) => credential as unknown as A

/** Asks the account's passkey (Face ID / Touch ID) to sign what the server prepared, from its WebAuthn options. */
export const signWithPasskey = (options: Record<string, unknown>) =>
  Effect.map(
    Effect.tryPromise(() => startAuthentication({ optionsJSON: ceremonyOptions(options) })),
    (credential) => asCredential<typeof AuthenticationCredential.Type>(credential)
  )
