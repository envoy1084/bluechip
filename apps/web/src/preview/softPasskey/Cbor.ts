// The little CBOR a "none" attestation needs (RFC 8949): integers, text, bytes and maps, in the order given, which
// for the COSE key and the attestation object is already the canonical one.
export type CborValue = number | string | Uint8Array | ReadonlyMap<CborValue, CborValue>

const head = (major: number, length: number): Array<number> => {
  const type = major << 5
  if (length < 24) return [type | length]
  if (length < 0x100) return [type | 24, length]
  if (length < 0x10000) return [type | 25, length >>> 8, length & 0xff]
  return [type | 26, length >>> 24, (length >>> 16) & 0xff, (length >>> 8) & 0xff, length & 0xff]
}

const parts = (value: CborValue): Array<Uint8Array> => {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new RangeError(`CBOR: ${value} is not an integer`)
    return [new Uint8Array(value >= 0 ? head(0, value) : head(1, -1 - value))]
  }
  if (typeof value === "string") {
    const text = new TextEncoder().encode(value)
    return [new Uint8Array(head(3, text.length)), text]
  }
  if (value instanceof Uint8Array) return [new Uint8Array(head(2, value.length)), value]
  return [
    new Uint8Array(head(5, value.size)),
    ...Array.from(value).flatMap(([key, entry]) => [...parts(key), ...parts(entry)])
  ]
}

export const concatBytes = (chunks: ReadonlyArray<Uint8Array | ReadonlyArray<number>>): Uint8Array => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

export const encodeCbor = (value: CborValue): Uint8Array => concatBytes(parts(value))
