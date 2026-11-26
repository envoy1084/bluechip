// WebCrypto signs ECDSA as raw r || s; WebAuthn carries it as DER. S is made low (s <= n / 2), as smart-account
// verifiers that refuse malleable signatures require; ECDSA accepts either half, so SimpleWebAuthn does too.
import { concatBytes } from "./Cbor.ts"

const P256_N = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551")
const HALF_N = P256_N / BigInt(2)

const toBigInt = (bytes: Uint8Array) =>
  BigInt(`0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`)

const toBytes32 = (value: bigint) => {
  const hex = value.toString(16).padStart(64, "0")
  return Uint8Array.from({ length: 32 }, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16))
}

const derInteger = (bytes: Uint8Array) => {
  let start = 0
  while (start < bytes.length - 1 && bytes[start] === 0) start += 1
  const trimmed = bytes.slice(start)
  const value = (trimmed[0]! & 0x80) === 0 ? trimmed : concatBytes([[0], trimmed])
  return concatBytes([[0x02, value.length], value])
}

/** A raw P-256 signature (r || s, 64 bytes) as DER, with its S made low. */
export const rawToDer = (raw: Uint8Array): Uint8Array => {
  if (raw.length !== 64) throw new RangeError(`a raw P-256 signature has 64 bytes, not ${raw.length}`)
  const r = raw.slice(0, 32)
  const s = toBigInt(raw.slice(32))
  const lowS = s > HALF_N ? P256_N - s : s
  const body = concatBytes([derInteger(r), derInteger(toBytes32(lowS))])
  return concatBytes([[0x30, body.length], body])
}
