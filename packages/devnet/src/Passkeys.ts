/**
 * Passkeys without a browser for tests on the devnet: account owners and recovery keys that sign real WebAuthn
 * assertions with a P-256 key.
 *
 * @since 0.0.0
 */
import * as Base64 from "ox/Base64"
import * as Bytes from "ox/Bytes"
import * as Hex from "ox/Hex"
import * as P256 from "ox/P256"
import * as PublicKey from "ox/PublicKey"
import * as Signature from "ox/Signature"
import * as WebAuthnP256 from "ox/WebAuthnP256"
import { toWebAuthnAccount, type WebAuthnAccount } from "viem/account-abstraction"

/**
 * A passkey without a browser (Namera's own test pattern): viem's WebAuthn account whose `getFn` answers like an
 * authenticator, signing the real WebAuthn payload with a P-256 key.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const softwarePasskey = (privateKey: Hex.Hex = P256.randomPrivateKey()): WebAuthnAccount => {
  const publicKey = PublicKey.toHex(P256.getPublicKey({ privateKey }))
  const id = Base64.fromBytes(Bytes.fromHex(publicKey).slice(1, 17), { url: true, pad: false })
  return toWebAuthnAccount({
    credential: { id, publicKey },
    rpId: "localhost",
    getFn: async (request) => {
      const challenge = Hex.fromBytes(new Uint8Array(request!.publicKey!.challenge as ArrayBuffer))
      const { metadata, payload } = WebAuthnP256.getSignPayload({
        challenge,
        origin: "http://localhost",
        rpId: "localhost"
      })
      const signature = P256.sign({ payload, privateKey, hash: true })
      const buffer = (bytes: Uint8Array) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      return {
        id,
        type: "public-key",
        response: {
          authenticatorData: buffer(Bytes.fromHex(metadata.authenticatorData)),
          clientDataJSON: buffer(Bytes.fromString(metadata.clientDataJSON)),
          signature: buffer(Signature.toDerBytes(signature))
        }
      } as never
    }
  })
}
