import { assert, describe, it } from "@effect/vitest"
import * as Bytes from "ox/Bytes"
import * as Hex from "ox/Hex"
import { encodeCbor } from "../../../src/preview/softPasskey/Cbor.ts"
import { rawToDer } from "../../../src/preview/softPasskey/Signature.ts"

describe("encodeCbor", () => {
  it.each(
    [
      ["0", 0, "0x00"],
      ["23, the last one-byte integer", 23, "0x17"],
      ["24, the first with a length byte", 24, "0x1818"],
      ["256, two length bytes", 256, "0x190100"],
      ["-1", -1, "0x20"],
      ["-7 (ES256)", -7, "0x26"],
      ["a text string", "none", "0x646e6f6e65"],
      ["a byte string", new Uint8Array([1, 2]), "0x420102"],
      ["an empty map", new Map(), "0xa0"],
      ["a map in the order given", new Map<number, number>([[1, 2], [3, -7]]), "0xa201020326"]
    ] as const
  )("%s", (_, value, expected) => {
    assert.strictEqual(Hex.fromBytes(encodeCbor(value)), expected)
  })
})

describe("rawToDer", () => {
  it("small r and s, trimmed to one byte each", () => {
    const raw = Bytes.fromHex(`0x${"00".repeat(31)}01${"00".repeat(31)}01`)

    assert.strictEqual(Hex.fromBytes(rawToDer(raw)), "0x3006020101020101")
  })

  it("an r with its high bit set gets a leading zero", () => {
    const raw = Bytes.fromHex(`0x80${"00".repeat(31)}${"00".repeat(31)}01`)

    assert.strictEqual(Hex.fromBytes(rawToDer(raw)), `0x3026022100${"80"}${"00".repeat(31)}020101`)
  })

  it("a high s (n - 1) becomes low (1)", () => {
    const raw = Bytes.fromHex(
      `0x${"00".repeat(31)}01ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632550`
    )

    assert.strictEqual(Hex.fromBytes(rawToDer(raw)), "0x3006020101020101")
  })

  it("throws on a signature that isn't 64 bytes", () => {
    assert.throws(() => rawToDer(new Uint8Array(63)), /64 bytes/)
  })
})
