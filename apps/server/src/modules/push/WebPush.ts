// Web push's two standards on node:crypto: a message encrypted for one browser (RFC 8291, `aes128gcm`), and the
// server's VAPID identity on each request (RFC 8292), so a push service knows who sends and the browser who may.
import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from "node:crypto"

const RECORD_SIZE = 4096

const hmac = (key: Uint8Array, data: Uint8Array) => createHmac("sha256", key).update(data).digest()

const utf8 = (text: string) => Buffer.from(text, "utf8")

const fromBase64Url = (value: string) => Buffer.from(value, "base64url")

/**
 * `payload` encrypted for the browser that holds `p256dh` and `auth` (base64url, from its subscription): one
 * `aes128gcm` record with its header. `salt` and `serverPrivateKey` are random for every message; tests pass the
 * RFC's.
 */
export const encryptPayload = (options: {
  readonly payload: string
  readonly p256dh: string
  readonly auth: string
  readonly salt?: Uint8Array | undefined
  readonly serverPrivateKey?: Uint8Array | undefined
}): Buffer => {
  const browserKey = fromBase64Url(options.p256dh)
  const authSecret = fromBase64Url(options.auth)
  const salt = options.salt === undefined ? randomBytes(16) : Buffer.from(options.salt)

  const ecdh = createECDH("prime256v1")
  if (options.serverPrivateKey === undefined) ecdh.generateKeys()
  else ecdh.setPrivateKey(Buffer.from(options.serverPrivateKey))
  const serverKey = ecdh.getPublicKey()
  const shared = ecdh.computeSecret(browserKey)

  // RFC 8291 §3.4: the shared secret, bound to both keys and the browser's auth secret, then RFC 8188's keys.
  const prkKey = hmac(authSecret, shared)
  const keyInfo = Buffer.concat([utf8("WebPush: info\0"), browserKey, serverKey, Buffer.from([1])])
  const ikm = hmac(prkKey, keyInfo)
  const prk = hmac(salt, ikm)
  const contentKey = hmac(prk, Buffer.concat([utf8("Content-Encoding: aes128gcm\0"), Buffer.from([1])])).subarray(0, 16)
  const nonce = hmac(prk, Buffer.concat([utf8("Content-Encoding: nonce\0"), Buffer.from([1])])).subarray(0, 12)

  const cipher = createCipheriv("aes-128-gcm", contentKey, nonce)
  // One record, so it is the last: the plaintext ends with the delimiter 0x02 and no padding.
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.concat([utf8(options.payload), Buffer.from([2])])),
    cipher.final()
  ])

  const header = Buffer.alloc(21)
  salt.copy(header, 0)
  header.writeUInt32BE(RECORD_SIZE, 16)
  header.writeUInt8(serverKey.length, 20)
  return Buffer.concat([header, serverKey, ciphertext, cipher.getAuthTag()])
}

/**
 * The `Authorization` header of a push to `endpoint`: a VAPID JWT (ES256) for the push service's origin, valid 12
 * hours from `now` (epoch seconds), signed with the server's key pair (base64url, raw P-256: 65-byte public, 32-byte
 * private).
 */
export const vapidAuthorization = (options: {
  readonly endpoint: string
  readonly publicKey: string
  readonly privateKey: string
  readonly subject: string
  readonly now: number
}): string => {
  const publicKey = fromBase64Url(options.publicKey)
  const key = createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      d: options.privateKey,
      x: publicKey.subarray(1, 33).toString("base64url"),
      y: publicKey.subarray(33, 65).toString("base64url")
    }
  })
  const encode = (value: object) => utf8(JSON.stringify(value)).toString("base64url")
  const unsigned = `${encode({ typ: "JWT", alg: "ES256" })}.${
    encode({ aud: new URL(options.endpoint).origin, exp: options.now + 12 * 60 * 60, sub: options.subject })
  }`
  const signature = sign("sha256", utf8(unsigned), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")
  return `vapid t=${unsigned}.${signature}, k=${options.publicKey}`
}
