import { assert, describe, it } from "@effect/vitest"
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from "@simplewebauthn/server"
import * as Effect from "effect/Effect"
import * as Bytes from "ox/Bytes"
import * as Hex from "ox/Hex"
import * as PublicKey from "ox/PublicKey"
import * as Signature from "ox/Signature"
import * as WebAuthnP256 from "ox/WebAuthnP256"
import { fromBase64Url, toBase64Url } from "../../../src/preview/softPasskey/Authenticator.ts"
import { registrationOptions } from "../../fixtures/WebAuthn.ts"
import { ORIGIN, RP_ID, softPasskeyBrowser } from "../../utils/SoftPasskeyBrowser.ts"

describe("software passkey", () => {
  describe("create", () => {
    it.effect("a registration SimpleWebAuthn verifies, user verified, counter 0", () =>
      Effect.gen(function*() {
        const browser = softPasskeyBrowser()
        const options = yield* Effect.promise(() => registrationOptions("Ada"))

        const response = yield* Effect.promise(() => browser.register(options))
        const result = yield* Effect.promise(() =>
          verifyRegistrationResponse({
            response,
            expectedChallenge: options.challenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
            requireUserVerification: true,
            supportedAlgorithmIDs: [-7]
          })
        )

        assert.deepStrictEqual(
          [result.verified, result.registrationInfo?.credential.id, result.registrationInfo?.credential.counter],
          [true, response.id, 0]
        )
        assert.strictEqual(result.registrationInfo?.userVerified, true)
      }))

    it.effect("keeps the credential with its rpId, user handle and an owner label", () =>
      Effect.gen(function*() {
        const browser = softPasskeyBrowser()
        const options = yield* Effect.promise(() => registrationOptions("Ada"))

        const response = yield* Effect.promise(() => browser.register(options))

        const [kept] = browser.keyring.list()
        assert.deepStrictEqual(
          [kept?.id, kept?.rpId, kept?.userHandle, kept?.userName, kept?.label, kept?.counter],
          [response.id, RP_ID, options.user.id, "Ada", "Owner 1", 0]
        )
      }))

    it.effect("labels a recovery key apart from owners", () =>
      Effect.gen(function*() {
        const browser = softPasskeyBrowser()
        yield* Effect.promise(async () => browser.register(await registrationOptions("Ada")))

        yield* Effect.promise(async () => browser.register(await registrationOptions("bluechip recovery")))

        assert.deepStrictEqual(browser.keyring.list().map((credential) => credential.label), [
          "Owner 1",
          "Recovery key 1"
        ])
      }))

    it.effect("InvalidStateError: a credential it holds is excluded", () =>
      Effect.gen(function*() {
        const browser = softPasskeyBrowser()
        const first = yield* Effect.promise(async () => browser.register(await registrationOptions("Ada")))
        const options = yield* Effect.promise(() =>
          generateRegistrationOptions({
            rpName: "bluechip",
            rpID: RP_ID,
            userName: "Ada",
            excludeCredentials: [{ id: first.id }]
          })
        )

        const error = yield* Effect.flip(Effect.tryPromise(() => browser.register(options)))

        assert.strictEqual((error.cause as DOMException).name, "InvalidStateError")
        assert.strictEqual(browser.keyring.list().length, 1)
      }))
  })

  describe("get", () => {
    it.effect("an assertion SimpleWebAuthn verifies, with the user handle, counter 1", () =>
      Effect.gen(function*() {
        const browser = softPasskeyBrowser()
        const registered = yield* Effect.promise(async () => browser.register(await registrationOptions("Ada")))
        const verified = yield* Effect.promise(() =>
          verifyRegistrationResponse({
            response: registered,
            expectedChallenge: () => true,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID
          })
        )
        const credential = verified.registrationInfo!.credential
        const options = yield* Effect.promise(() =>
          generateAuthenticationOptions({
            rpID: RP_ID,
            userVerification: "required",
            allowCredentials: [{ id: credential.id }]
          })
        )

        const response = yield* Effect.promise(() => browser.authenticate(options))
        const result = yield* Effect.promise(() =>
          verifyAuthenticationResponse({
            response,
            expectedChallenge: options.challenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
            requireUserVerification: true,
            credential
          })
        )

        assert.deepStrictEqual([result.verified, result.authenticationInfo.newCounter], [true, 1])
        assert.strictEqual(response.response.userHandle, browser.keyring.list()[0]?.userHandle)
      }))

    it.effect("the counter rises with each signature, as the server's clone check needs", () =>
      Effect.gen(function*() {
        const browser = softPasskeyBrowser()
        const registered = yield* Effect.promise(async () => browser.register(await registrationOptions("Ada")))
        const verified = yield* Effect.promise(() =>
          verifyRegistrationResponse({
            response: registered,
            expectedChallenge: () => true,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID
          })
        )
        const credential = verified.registrationInfo!.credential
        yield* Effect.promise(async () =>
          browser.authenticate(await generateAuthenticationOptions({ rpID: RP_ID, userVerification: "required" }))
        )
        const options = yield* Effect.promise(() =>
          generateAuthenticationOptions({ rpID: RP_ID, userVerification: "required" })
        )

        const response = yield* Effect.promise(() => browser.authenticate(options))
        const result = yield* Effect.promise(() =>
          verifyAuthenticationResponse({
            response,
            expectedChallenge: options.challenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
            requireUserVerification: true,
            credential: { ...credential, counter: 1 }
          })
        )

        assert.deepStrictEqual([result.verified, result.authenticationInfo.newCounter], [true, 2])
        assert.strictEqual(browser.keyring.list()[0]?.counter, 2)
      }))

    it.effect("an allow list picks the credential it names, not the newest", () =>
      Effect.gen(function*() {
        const browser = softPasskeyBrowser()
        const older = yield* Effect.promise(async () => browser.register(await registrationOptions("Ada")))
        yield* Effect.promise(async () => browser.register(await registrationOptions("Ada")))
        const options = yield* Effect.promise(() =>
          generateAuthenticationOptions({ rpID: RP_ID, allowCredentials: [{ id: older.id }] })
        )

        const response = yield* Effect.promise(() => browser.authenticate(options))

        assert.strictEqual(response.id, older.id)
      }))

    it.effect("NotAllowedError: the allow list names no credential it holds", () =>
      Effect.gen(function*() {
        const browser = softPasskeyBrowser()
        yield* Effect.promise(async () => browser.register(await registrationOptions("Ada")))
        const options = yield* Effect.promise(() =>
          generateAuthenticationOptions({ rpID: RP_ID, allowCredentials: [{ id: toBase64Url(new Uint8Array(16)) }] })
        )

        const error = yield* Effect.flip(Effect.tryPromise(() => browser.authenticate(options)))

        assert.strictEqual((error.cause as DOMException).name, "NotAllowedError")
      }))

    it.effect("NotAllowedError: no credential for another rpId", () =>
      Effect.gen(function*() {
        const browser = softPasskeyBrowser()
        yield* Effect.promise(async () => browser.register(await registrationOptions("Ada")))
        const options = yield* Effect.promise(() => generateAuthenticationOptions({ rpID: "bluechip.example" }))

        const error = yield* Effect.flip(Effect.tryPromise(() => browser.authenticate(options)))

        assert.strictEqual((error.cause as DOMException).name, "NotAllowedError")
      }))

    it.effect("a discoverable sign-in with several keys asks, newest first, and signs with the one chosen", () =>
      Effect.gen(function*() {
        const asked: Array<ReadonlyArray<string>> = []
        const browser = softPasskeyBrowser({
          choose: async (candidates) => {
            asked.push(candidates.map((candidate) => candidate.label))
            return candidates[1]!
          }
        })
        yield* Effect.promise(async () => browser.register(await registrationOptions("Ada")))
        yield* Effect.promise(async () => browser.register(await registrationOptions("Ada")))
        const options = yield* Effect.promise(() => generateAuthenticationOptions({ rpID: RP_ID }))

        const response = yield* Effect.promise(() => browser.authenticate(options))

        const owner1 = browser.keyring.list().find((credential) => credential.label === "Owner 1")
        assert.deepStrictEqual(asked, [["Owner 2", "Owner 1"]])
        assert.strictEqual(response.id, owner1?.id)
      }))

    it.effect("a signature over a user operation hash verifies as the chain checks it (ox WebAuthnP256)", () =>
      Effect.gen(function*() {
        const browser = softPasskeyBrowser()
        const registered = yield* Effect.promise(async () => browser.register(await registrationOptions("Ada")))
        const userOpHash = "0x8d3f6c1a2b4e5f60718293a4b5c6d7e8f9012345678901234567890abcdef012"

        const response = yield* Effect.promise(() =>
          browser.authenticate({
            challenge: toBase64Url(Bytes.fromHex(userOpHash)),
            rpId: RP_ID,
            userVerification: "required"
          })
        )

        const signature = Signature.fromDerBytes(fromBase64Url(response.response.signature))
        const valid = WebAuthnP256.verify({
          challenge: userOpHash,
          publicKey: PublicKey.from(fromBase64Url(registered.response.publicKey!).slice(-65)),
          signature,
          metadata: {
            authenticatorData: Hex.fromBytes(fromBase64Url(response.response.authenticatorData)),
            clientDataJSON: new TextDecoder().decode(fromBase64Url(response.response.clientDataJSON)),
            userVerificationRequired: true
          },
          origin: ORIGIN,
          rpId: RP_ID
        })
        assert.strictEqual(valid, true)
      }))
  })
})
