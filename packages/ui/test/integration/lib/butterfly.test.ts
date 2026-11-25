import { butterflyPixels, hash, paintButterfly } from "@bluechip/ui/lib/butterfly"
import { assert, describe, it } from "@effect/vitest"
import * as Schema from "effect/Schema"

const COLORS: Readonly<Record<string, string>> = {
  B: "#2a5bff",
  C: "#3c8aff",
  P: "#fea8cd",
  V: "#cd99fd",
  G: "#66c800",
  L: "#b6f569",
  K: "#0a0b0d"
}

// Produced by running the brand kit's core.js (KIT.butterflyPixels) in Node: "<x><y><color>" per pixel, in order.
const KIT: ReadonlyArray<readonly [id: string, hash: number, pixels: string]> = [
  [
    "Weekly buyer",
    1270564157,
    "10V 70V 01V 81V 11B 71B 21V 61V 31V 51V 02V 82V 12V 72V 22V 62V 32V 52V 23V 63V 33V 53V 14V 74V 24V 64V 34V 54V 15B 75B 25V 65V 26V 66V 41K 42K 43K 44K 45K 30K 50K"
  ],
  [
    "rebalancer",
    57820370,
    "10G 70G 01L 81L 21G 61G 31L 51L 12G 72G 22G 62G 32G 52G 13G 73G 33G 53G 14G 74G 24G 64G 34G 54G 15G 75G 25L 65L 41K 42K 43K 44K 45K 30K 50K"
  ],
  [
    "a",
    3826002220,
    "10C 70C 20P 60P 01P 81P 11C 71C 21C 61C 31C 51C 12P 72P 22P 62P 32C 52C 13C 73C 23C 63C 33C 53C 34C 54C 25C 65C 26C 66C 41K 42K 43K 44K 45K 30K 50K"
  ],
  [
    "",
    2166136261,
    "10P 70P 11P 71P 21P 61P 31P 51P 02P 82P 32V 52V 23P 63P 33V 53V 14V 74V 24P 64P 34P 54P 15P 75P 25P 65P 41K 42K 43K 44K 45K 30K 50K"
  ]
]

const decode = (tokens: string) =>
  tokens.split(" ").map((token) => ({ x: Number(token[0]), y: Number(token[1]), color: COLORS[token[2] ?? ""] }))

describe("hash", () => {
  it.each(KIT.map(([id, expected]) => ({ id: JSON.stringify(id), source: id, expected })))(
    "matches the kit for $id",
    ({ expected, source }) => {
      assert.strictEqual(hash(source), expected)
    }
  )
})

describe("butterflyPixels", () => {
  it.each(KIT.map(([id, , pixels]) => ({ id: JSON.stringify(id), source: id, pixels })))(
    "matches the kit for $id",
    ({ pixels, source }) => {
      assert.deepStrictEqual(butterflyPixels(source), decode(pixels))
    }
  )

  it.prop("is mirrored around the body, on the 9 × 7 grid", { id: Schema.String }, ({ id }) => {
    const pixels = butterflyPixels(id)
    return pixels.every(({ color, x, y }) =>
      x >= 0 && x < 9 && y >= 0 && y < 7 && pixels.some((p) => p.x === 8 - x && p.y === y && p.color === color)
    )
  })
})

describe("paintButterfly", () => {
  it("paints one canvas pixel per grid cell", () => {
    const canvas = document.createElement("canvas")

    paintButterfly(canvas, "rebalancer")

    // The kit's "rebalancer": nothing at 0,0, a light green wing at 0,1, the body's ink at 4,1.
    const at = (x: number, y: number) => [...canvas.getContext("2d")!.getImageData(x, y, 1, 1).data]
    assert.deepStrictEqual(
      { width: canvas.width, height: canvas.height, empty: at(0, 0), wing: at(0, 1), body: at(4, 1) },
      { width: 9, height: 7, empty: [0, 0, 0, 0], wing: [182, 245, 105, 255], body: [10, 11, 13, 255] }
    )
  })
})
