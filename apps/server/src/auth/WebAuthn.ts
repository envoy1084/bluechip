import { SignatureRejected } from "@bluechip/domain/Errors"
import type { AuthenticationCredential, RegistrationCredential } from "@bluechip/domain/WebAuthn"
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from "@simplewebauthn/server"
import { cose, decodeCredentialPublicKey, isoBase64URL, isoUint8Array } from "@simplewebauthn/server/helpers"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
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
  /** The authenticator model's id; names the provider (all zeros when it doesn't say). */
  readonly aaguid: string
  /** Backed up by its provider (iCloud Keychain, Google Password Manager, …) rather than bound to one device. */
  readonly synced: boolean
}

/** Passkey ceremonies for this site, as the relying party: their options, and checks of the browser's answers. */
export class WebAuthn extends Context.Service<WebAuthn, {
  /** Options for creating a discoverable, user-verified ES256 passkey. */
  readonly registrationOptions: (
    displayName: string | undefined
  ) => Effect.Effect<PublicKeyCredentialCreationOptionsJSON>
  readonly verifyRegistration: (
    credential: typeof RegistrationCredential.Type,
    expectedChallenge: string
  ) => Effect.Effect<NewPasskey, SignatureRejected>
  /** Options for signing in with any discoverable passkey for this site. */
  readonly authenticationOptions: Effect.Effect<PublicKeyCredentialRequestOptionsJSON>
  /**
   * Verifies a sign-in against the stored passkey and returns its new signature counter. A counter that goes
   * backwards means a cloned authenticator; synced passkeys always report 0, which passes.
   */
  readonly verifyAuthentication: (
    credential: typeof AuthenticationCredential.Type,
    expectedChallenge: string,
    stored: { readonly credentialId: string; readonly coseKey: string; readonly counter: number }
  ) => Effect.Effect<number, SignatureRejected>
}>()("@bluechip/server/WebAuthn") {
  static readonly layer = Layer.effect(
    WebAuthn,
    Effect.gen(function*() {
      const config = yield* AppConfig

      const registrationOptions = Effect.fn("WebAuthn.registrationOptions")((displayName: string | undefined) =>
        Effect.promise(() =>
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
      )

      const verifyRegistration = Effect.fn("WebAuthn.verifyRegistration")(
        function*(credential: typeof RegistrationCredential.Type, expectedChallenge: string) {
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
            catch: () => new SignatureRejected({ reason: "invalid" })
          })
          if (!result.verified) return yield* new SignatureRejected({ reason: "invalid" })

          const { aaguid, credential: verified, credentialBackedUp } = result.registrationInfo
          const publicKey = yield* Effect.try({
            try: (): Hex => {
              const key = decodeCredentialPublicKey(verified.publicKey)
              if (!cose.isCOSEPublicKeyEC2(key) || key.get(cose.COSEKEYS.crv) !== cose.COSECRV.P256) {
                throw new Error("not P-256")
              }
              const x = key.get(cose.COSEKEYS.x)
              const y = key.get(cose.COSEKEYS.y)
              if (x === undefined || y === undefined) throw new Error("incomplete P-256 key")
              return toHex(isoUint8Array.concat([new Uint8Array([4]), x, y]))
            },
            catch: () => new SignatureRejected({ reason: "invalid" })
          })
          return {
            credentialId: verified.id,
            coseKey: isoBase64URL.fromBuffer(verified.publicKey),
            publicKey,
            counter: verified.counter,
            transports: credential.response.transports ?? [],
            aaguid,
            synced: credentialBackedUp
          } satisfies NewPasskey
        }
      )

      const authenticationOptions = Effect.promise(() =>
        generateAuthenticationOptions({ rpID: config.rpId, userVerification: "required" })
      ).pipe(Effect.withSpan("WebAuthn.authenticationOptions"))

      const verifyAuthentication = Effect.fn("WebAuthn.verifyAuthentication")(function*(
        credential: typeof AuthenticationCredential.Type,
        expectedChallenge: string,
        stored: { readonly credentialId: string; readonly coseKey: string; readonly counter: number }
      ) {
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

      return WebAuthn.of({ registrationOptions, verifyRegistration, authenticationOptions, verifyAuthentication })
    })
  )
}
