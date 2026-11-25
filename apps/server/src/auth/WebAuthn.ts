import { SignatureRejected } from "@bluechip/domain/Errors"
import type { AuthenticationCredential, RegistrationCredential } from "@bluechip/domain/WebAuthn"
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from "@simplewebauthn/server"
import { cose, decodeCredentialPublicKey, isoBase64URL, isoUint8Array } from "@simplewebauthn/server/helpers"
import * as Effect from "effect/Effect"
import { type Hex, toHex } from "viem"
import { AppConfig } from "../Config.ts"

// Kernel's WebAuthn validator verifies P-256 only, so passkeys must use ES256.
const es256 = [cose.COSEALG.ES256]

/** A verified new passkey: its WebAuthn id and keys. */
export interface NewPasskey {
  readonly credentialId: string
  /** The COSE public key, base64url, for verifying later sign-ins. */
  readonly coseKey: string
  /** The same key uncompressed (`0x04‖x‖y`), as Kernel's validator and viem's WebAuthn account take it. */
  readonly publicKey: Hex
  readonly counter: number
  readonly transports: ReadonlyArray<string>
}

const rejected = (reason: SignatureRejected["reason"]) => () => new SignatureRejected({ reason })

const toP256Hex = (coseKey: Uint8Array<ArrayBuffer>): Hex => {
  const key = decodeCredentialPublicKey(coseKey)
  if (!cose.isCOSEPublicKeyEC2(key) || key.get(cose.COSEKEYS.crv) !== cose.COSECRV.P256) throw new Error("not P-256")
  const x = key.get(cose.COSEKEYS.x)
  const y = key.get(cose.COSEKEYS.y)
  if (x === undefined || y === undefined) throw new Error("incomplete P-256 key")
  return toHex(isoUint8Array.concat([new Uint8Array([4]), x, y]))
}

/** Options for creating a discoverable, user-verified ES256 passkey. */
export const registrationOptions = Effect.fn("WebAuthn.registrationOptions")(
  function*(displayName: string | undefined) {
    const config = yield* AppConfig
    return yield* Effect.promise(() =>
      generateRegistrationOptions({
        rpName: "bluechip",
        rpID: config.rpId,
        userName: displayName ?? "bluechip",
        userDisplayName: displayName ?? "bluechip",
        attestationType: "none",
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        supportedAlgorithmIDs: es256
      })
    )
  }
)

export const verifyRegistration = Effect.fn("WebAuthn.verifyRegistration")(
  function*(credential: typeof RegistrationCredential.Type, expectedChallenge: string) {
    const config = yield* AppConfig
    const result = yield* Effect.tryPromise({
      try: () =>
        verifyRegistrationResponse({
          response: { ...credential, response: { ...credential.response, transports: undefined } } as never,
          expectedChallenge,
          expectedOrigin: config.publicOrigin,
          expectedRPID: config.rpId,
          requireUserVerification: true,
          supportedAlgorithmIDs: es256
        }),
      catch: rejected("invalid")
    })
    if (!result.verified) return yield* new SignatureRejected({ reason: "invalid" })
    const { credential: verified } = result.registrationInfo
    const publicKey = yield* Effect.try({ try: () => toP256Hex(verified.publicKey), catch: rejected("invalid") })
    return {
      credentialId: verified.id,
      coseKey: isoBase64URL.fromBuffer(verified.publicKey),
      publicKey,
      counter: verified.counter,
      transports: credential.response.transports ?? []
    } satisfies NewPasskey
  }
)

/** Options for signing in with any discoverable passkey for this site. */
export const authenticationOptions = Effect.fn("WebAuthn.authenticationOptions")(function*() {
  const config = yield* AppConfig
  return yield* Effect.promise(() => generateAuthenticationOptions({ rpID: config.rpId, userVerification: "required" }))
})

/**
 * Verifies a sign-in against the stored passkey and returns its new signature counter. A counter that goes backwards
 * means a cloned authenticator; synced passkeys always report 0, which passes.
 */
export const verifyAuthentication = Effect.fn("WebAuthn.verifyAuthentication")(function*(
  credential: typeof AuthenticationCredential.Type,
  expectedChallenge: string,
  stored: { readonly credentialId: string; readonly coseKey: string; readonly counter: number }
) {
  const config = yield* AppConfig
  const result = yield* Effect.tryPromise({
    try: () =>
      verifyAuthenticationResponse({
        response: credential as never,
        expectedChallenge,
        expectedOrigin: config.publicOrigin,
        expectedRPID: config.rpId,
        requireUserVerification: true,
        credential: {
          id: stored.credentialId,
          publicKey: isoBase64URL.toBuffer(stored.coseKey),
          counter: stored.counter
        }
      }),
    catch: (cause) => new SignatureRejected({ reason: String(cause).includes("counter") ? "counter" : "invalid" })
  })
  if (!result.verified) return yield* new SignatureRejected({ reason: "invalid" })
  return result.authenticationInfo.newCounter
})
