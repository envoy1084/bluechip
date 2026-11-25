import { isoBase64URL, isoCBOR, isoUint8Array } from "@simplewebauthn/server/helpers"
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto"

const sha256 = (data: Uint8Array) => new Uint8Array(createHash("sha256").update(data).digest())
const b64url = (bytes: Uint8Array) => isoBase64URL.fromBuffer(bytes as Uint8Array<ArrayBuffer>)
const u32 = (value: number) => new Uint8Array([value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255])

// Flags: user present, user verified, attested credential data included.
const UP = 0x01
const UV = 0x04
const AT = 0x40

/**
 * A software passkey, as a platform authenticator would answer WebAuthn ceremonies: a P-256 key, a "none"
 * attestation at registration and ES256 signatures at sign-in. Real verification code checks every byte.
 */
export const softwareAuthenticator = (options: { readonly rpId: string; readonly origin: string }) => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
  const jwk = publicKey.export({ format: "jwk" })
  const credentialId = new Uint8Array(randomBytes(16))
  const rpIdHash = sha256(new TextEncoder().encode(options.rpId))
  let counter = 0

  const clientData = (type: "webauthn.create" | "webauthn.get", challenge: string) =>
    new TextEncoder().encode(JSON.stringify({ type, challenge, origin: options.origin, crossOrigin: false }))

  const coseKey = isoCBOR.encode(
    new Map<number, number | Uint8Array>([
      [1, 2], // kty: EC2
      [3, -7], // alg: ES256
      [-1, 1], // crv: P-256
      [-2, isoBase64URL.toBuffer(jwk.x!)],
      [-3, isoBase64URL.toBuffer(jwk.y!)]
    ])
  )

  return {
    credentialId: b64url(credentialId),
    register: (challenge: string) => {
      const authData = isoUint8Array.concat([
        rpIdHash,
        new Uint8Array([UP | UV | AT]),
        u32(counter),
        new Uint8Array(16), // AAGUID
        new Uint8Array([0, credentialId.length]),
        credentialId,
        coseKey
      ])
      const attestationObject = isoCBOR.encode(
        new Map<string, unknown>([["fmt", "none"], ["attStmt", new Map()], ["authData", authData]]) as never
      )
      return {
        id: b64url(credentialId),
        rawId: b64url(credentialId),
        type: "public-key" as const,
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64url(clientData("webauthn.create", challenge)),
          attestationObject: b64url(attestationObject),
          transports: ["internal"]
        }
      }
    },
    authenticate: (challenge: string) => {
      counter += 1
      const authData = isoUint8Array.concat([rpIdHash, new Uint8Array([UP | UV]), u32(counter)])
      const data = clientData("webauthn.get", challenge)
      const signature = sign("sha256", isoUint8Array.concat([authData, sha256(data)]), privateKey)
      return {
        id: b64url(credentialId),
        rawId: b64url(credentialId),
        type: "public-key" as const,
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64url(data),
          authenticatorData: b64url(authData),
          signature: b64url(new Uint8Array(signature))
        }
      }
    },
    /** Signs with a lower counter next time, as a cloned authenticator would. */
    rewindCounter: () => {
      counter = 0
    }
  }
}
