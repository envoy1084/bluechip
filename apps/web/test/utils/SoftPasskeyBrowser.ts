// The software passkey as the web app reaches it: the server's WebAuthn options (JSON) turned into the browser's
// native options, and its credentials back into JSON, as `@simplewebauthn/browser`'s `startRegistration` and
// `startAuthentication` do between the app and `navigator.credentials`.
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON
} from "@simplewebauthn/server"
import { fromBase64Url, makeAuthenticator, toBase64Url } from "../../src/preview/softPasskey/Authenticator.ts"
import { type Keyring, memoryKeyring, type SoftCredential } from "../../src/preview/softPasskey/Keyring.ts"

export const ORIGIN = "http://localhost:3000"
export const RP_ID = "localhost"

const encoded = (buffer: ArrayBuffer) => toBase64Url(new Uint8Array(buffer))
const descriptor = (credential: { readonly id: string }) => ({
  id: fromBase64Url(credential.id) as Uint8Array<ArrayBuffer>,
  type: "public-key" as const
})

export const softPasskeyBrowser = (options: {
  readonly keyring?: Keyring
  readonly choose?: (candidates: ReadonlyArray<SoftCredential>) => Promise<SoftCredential>
} = {}) => {
  const keyring = options.keyring ?? memoryKeyring()
  const authenticator = makeAuthenticator({
    origin: ORIGIN,
    keyring,
    choose: options.choose ?? (async (candidates) => candidates[0]!)
  })

  const register = async (json: PublicKeyCredentialCreationOptionsJSON): Promise<RegistrationResponseJSON> => {
    const credential = await authenticator.create({
      publicKey: {
        ...json,
        challenge: fromBase64Url(json.challenge) as Uint8Array<ArrayBuffer>,
        user: { ...json.user, id: fromBase64Url(json.user.id) as Uint8Array<ArrayBuffer> },
        excludeCredentials: (json.excludeCredentials ?? []).map(descriptor)
      } as PublicKeyCredentialCreationOptions
    })
    return {
      id: credential.id,
      rawId: encoded(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: {
        clientDataJSON: encoded(credential.response.clientDataJSON),
        attestationObject: encoded(credential.response.attestationObject),
        transports: credential.response.getTransports() as Array<"internal">,
        publicKey: encoded(credential.response.getPublicKey()),
        publicKeyAlgorithm: credential.response.getPublicKeyAlgorithm(),
        authenticatorData: encoded(credential.response.getAuthenticatorData())
      }
    }
  }

  const authenticate = async (json: PublicKeyCredentialRequestOptionsJSON): Promise<AuthenticationResponseJSON> => {
    const credential = await authenticator.get({
      publicKey: {
        ...json,
        challenge: fromBase64Url(json.challenge) as Uint8Array<ArrayBuffer>,
        allowCredentials: (json.allowCredentials ?? []).map(descriptor)
      } as PublicKeyCredentialRequestOptions
    })
    return {
      id: credential.id,
      rawId: encoded(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: {
        clientDataJSON: encoded(credential.response.clientDataJSON),
        authenticatorData: encoded(credential.response.authenticatorData),
        signature: encoded(credential.response.signature),
        userHandle: encoded(credential.response.userHandle)
      }
    }
  }

  return { keyring, register, authenticate }
}
