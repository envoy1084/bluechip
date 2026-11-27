import { assert, describe, it } from "@effect/vitest"
import { icoFromPngs } from "../../../commands/og.ts"

describe("icoFromPngs", () => {
  it("a header, an entry per image, then the images in order", () => {
    const ico = icoFromPngs([
      { size: 16, png: new Uint8Array([1, 2]) },
      { size: 256, png: new Uint8Array([3]) }
    ])
    assert.deepStrictEqual(
      [...ico],
      [
        // Reserved, type 1 (icon), 2 images.
        0,
        0,
        1,
        0,
        2,
        0,
        // 16×16, no palette, 1 plane, 32 bits, 2 bytes at 38.
        16,
        16,
        0,
        0,
        1,
        0,
        32,
        0,
        2,
        0,
        0,
        0,
        38,
        0,
        0,
        0,
        // 256×256 is written as 0, 1 byte at 40.
        0,
        0,
        0,
        0,
        1,
        0,
        32,
        0,
        1,
        0,
        0,
        0,
        40,
        0,
        0,
        0,
        1,
        2,
        3
      ]
    )
  })
})
