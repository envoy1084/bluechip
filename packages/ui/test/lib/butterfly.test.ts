import { butterflyPixels, hash } from "@bluechip/ui/lib/butterfly"
import { describe, expect, it } from "@effect/vitest"

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

describe("butterflyPixels", () => {
  for (const [id, expectedHash, pixels] of KIT) {
    it(`matches the kit for ${JSON.stringify(id)}`, () => {
      expect(hash(id)).toBe(expectedHash)
      expect(butterflyPixels(id)).toEqual(decode(pixels))
    })
  }

  it("is deterministic", () => {
    expect(butterflyPixels("Dividend hunter")).toEqual(butterflyPixels("Dividend hunter"))
  })

  it("is mirrored around the body and stays on the 9 × 7 grid", () => {
    const pixels = butterflyPixels("Stop-loss guard")
    for (const { x, y, color } of pixels) {
      expect(x >= 0 && x < 9 && y >= 0 && y < 7).toBe(true)
      expect(pixels.some((p) => p.x === 8 - x && p.y === y && p.color === color)).toBe(true)
    }
  })

  it("gives different agents different butterflies", () => {
    expect(butterflyPixels("Weekly buyer")).not.toEqual(butterflyPixels("Weekly buyer 2"))
  })
})
