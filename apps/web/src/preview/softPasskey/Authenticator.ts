// A software platform authenticator answering `navigator.credentials.create` and `get` as a real one would (after
// the server tests' `Authenticator.ts`): a P-256 key per credential, a "none" attestation with an ES256 COSE key,
// authenticator data flagged user present and verified, a signature counter, and ES256 signatures over
// authenticatorData || sha256(clientDataJSON). The site's own verification (SimpleWebAuthn, and Namera's
// `WebAuthnValidator` onchain for owners) checks every byte.
import { type CborValue, concatBytes, encodeCbor } from "./Cbor.ts"
import type { Keyring, SoftCredential } from "./Keyring.ts"
import { rawToDer } from "./Signature.ts"

const UP = 0x01
const UV = 0x04
const AT = 0x40
const ES256 = -7
const RECOVERY_USER_NAME = "bluechip recovery"

const P256 = { name: "ECDSA", namedCurve: "P-256" } as const

export const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")

export const fromBase64Url = (text: string): Uint8Array =>
  Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0))

const bytesOf = (source: BufferSource): Uint8Array =>
  ArrayBuffer.isView(source) ?
    new Uint8Array(source.buffer, source.byteOffset, source.byteLength).slice() :
    new Uint8Array(source).slice()

const buffer = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer as ArrayBuffer

const u32 = (value: number) => [value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]

const sha256 = async (bytes: Uint8Array) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>))

const notAllowed = (message: string) => new DOMException(message, "NotAllowedError")

const throwIfAborted = (signal: AbortSignal | null | undefined) => {
  if (signal?.aborted === true) throw new DOMException("The operation was aborted.", "AbortError")
}

/** The `PublicKeyCredential` a registration answers with, as browsers shape it. */
export interface SoftRegistration {
  readonly id: string
  readonly rawId: ArrayBuffer
  readonly type: "public-key"
  readonly authenticatorAttachment: "platform"
  readonly getClientExtensionResults: () => AuthenticationExtensionsClientOutputs
  readonly response: {
    readonly clientDataJSON: ArrayBuffer
    readonly attestationObject: ArrayBuffer
    readonly getTransports: () => Array<string>
    readonly getPublicKey: () => ArrayBuffer
    readonly getPublicKeyAlgorithm: () => number
    readonly getAuthenticatorData: () => ArrayBuffer
  }
}

/** The `PublicKeyCredential` an assertion answers with, as browsers shape it. */
export interface SoftAssertion {
  readonly id: string
  readonly rawId: ArrayBuffer
  readonly type: "public-key"
  readonly authenticatorAttachment: "platform"
  readonly getClientExtensionResults: () => AuthenticationExtensionsClientOutputs
  readonly response: {
    readonly clientDataJSON: ArrayBuffer
    readonly authenticatorData: ArrayBuffer
    readonly signature: ArrayBuffer
    readonly userHandle: ArrayBuffer
  }
}

export interface SoftAuthenticatorConfig {
  /** The page's origin, written into `clientDataJSON`; its host is the default rpId. */
  readonly origin: string
  readonly keyring: Keyring
  /** Picks one of several credentials a discoverable sign-in could use, newest first. */
  readonly choose: (candidates: ReadonlyArray<SoftCredential>, signal?: AbortSignal) => Promise<SoftCredential>
}

export const makeAuthenticator = (config: SoftAuthenticatorConfig) => {
  const defaultRpId = new URL(config.origin).hostname

  const clientData = (type: "webauthn.create" | "webauthn.get", challenge: BufferSource) =>
    new TextEncoder().encode(
      JSON.stringify({ type, challenge: toBase64Url(bytesOf(challenge)), origin: config.origin, crossOrigin: false })
    )

  const replace = (updated: SoftCredential) =>
    config.keyring.save(config.keyring.list().map((kept) => kept.id === updated.id ? updated : kept))

  const create = async (options: CredentialCreationOptions): Promise<SoftRegistration> => {
    const request = options.publicKey
    if (request === undefined) throw new DOMException("Only public-key credentials are supported.", "NotSupportedError")
    throwIfAborted(options.signal)

    const rpId = request.rp.id ?? defaultRpId
    if (!request.pubKeyCredParams.some((param) => param.alg === ES256)) {
      throw new DOMException("This authenticator signs with ES256 only.", "NotSupportedError")
    }
    const kept = config.keyring.list().filter((credential) => credential.rpId === rpId)
    const excluded = new Set(
      (request.excludeCredentials ?? []).map((descriptor) => toBase64Url(bytesOf(descriptor.id)))
    )
    if (kept.some((credential) => excluded.has(credential.id))) {
      throw new DOMException("The authenticator already holds one of the excluded credentials.", "InvalidStateError")
    }

    const keys = await crypto.subtle.generateKey(P256, true, ["sign", "verify"])
    const privateKey = await crypto.subtle.exportKey("jwk", keys.privateKey)
    const spki = new Uint8Array(await crypto.subtle.exportKey("spki", keys.publicKey))
    const credentialId = crypto.getRandomValues(new Uint8Array(16))

    const coseKey = encodeCbor(
      new Map<number, number | Uint8Array>([
        [1, 2], // kty: EC2
        [3, ES256], // alg
        [-1, 1], // crv: P-256
        [-2, fromBase64Url(privateKey.x!)],
        [-3, fromBase64Url(privateKey.y!)]
      ])
    )
    const authData = concatBytes([
      await sha256(new TextEncoder().encode(rpId)),
      [UP | UV | AT],
      u32(0),
      new Uint8Array(16), // AAGUID: none
      [0, credentialId.length],
      credentialId,
      coseKey
    ])
    const attestationObject = encodeCbor(
      new Map<string, CborValue>([["fmt", "none"], ["attStmt", new Map()], ["authData", authData]])
    )
    const clientDataJSON = clientData("webauthn.create", request.challenge)

    const recovery = request.user.name === RECOVERY_USER_NAME
    const sameKind = kept.filter((credential) => credential.label.startsWith("Recovery") === recovery).length
    const credential: SoftCredential = {
      id: toBase64Url(credentialId),
      privateKey,
      rpId,
      userHandle: toBase64Url(bytesOf(request.user.id)),
      userName: request.user.name,
      label: `${recovery ? "Recovery key" : "Owner"} ${sameKind + 1}`,
      counter: 0,
      createdAt: Date.now()
    }
    config.keyring.save([...config.keyring.list(), credential])

    const extensions: AuthenticationExtensionsClientOutputs = request.extensions?.credProps === true ?
      { credProps: { rk: true } } :
      {}
    return {
      id: credential.id,
      rawId: buffer(credentialId),
      type: "public-key",
      authenticatorAttachment: "platform",
      getClientExtensionResults: () => extensions,
      response: {
        clientDataJSON: buffer(clientDataJSON),
        attestationObject: buffer(attestationObject),
        getTransports: () => ["internal"],
        getPublicKey: () => buffer(spki),
        getPublicKeyAlgorithm: () => ES256,
        getAuthenticatorData: () => buffer(authData)
      }
    }
  }

  const get = async (options: CredentialRequestOptions): Promise<SoftAssertion> => {
    const request = options.publicKey
    if (request === undefined) throw new DOMException("Only public-key credentials are supported.", "NotSupportedError")
    throwIfAborted(options.signal)

    const rpId = request.rpId ?? defaultRpId
    const allowed = new Set((request.allowCredentials ?? []).map((descriptor) => toBase64Url(bytesOf(descriptor.id))))
    const candidates = config.keyring.list()
      .filter((credential) => credential.rpId === rpId && (allowed.size === 0 || allowed.has(credential.id)))
      .toSorted((a, b) => b.createdAt - a.createdAt)
    if (candidates.length === 0) throw notAllowed(`No software passkey for ${rpId} matches this request.`)

    // An allow list names the credentials the site expects: the newest of them answers. A discoverable sign-in asks.
    const chosen = allowed.size === 0 && candidates.length > 1 ?
      await config.choose(candidates, options.signal ?? undefined) :
      candidates[0]!
    throwIfAborted(options.signal)

    const counter = chosen.counter + 1
    const authData = concatBytes([await sha256(new TextEncoder().encode(rpId)), [UP | UV], u32(counter)])
    const clientDataJSON = clientData("webauthn.get", request.challenge)
    const key = await crypto.subtle.importKey("jwk", chosen.privateKey, P256, false, ["sign"])
    const raw = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      concatBytes([authData, await sha256(clientDataJSON)]) as Uint8Array<ArrayBuffer>
    )
    replace({ ...chosen, counter })

    return {
      id: chosen.id,
      rawId: buffer(fromBase64Url(chosen.id)),
      type: "public-key",
      authenticatorAttachment: "platform",
      getClientExtensionResults: () => ({}),
      response: {
        clientDataJSON: buffer(clientDataJSON),
        authenticatorData: buffer(authData),
        signature: buffer(rawToDer(new Uint8Array(raw))),
        userHandle: buffer(fromBase64Url(chosen.userHandle))
      }
    }
  }

  return { create, get }
}
