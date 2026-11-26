import { parseThemeChoice, type ThemeChoice } from "@bluechip/ui/lib/theme"
import { assert, describe, it } from "@effect/vitest"

describe("parseThemeChoice", () => {
  it.each<{ name: string; stored: string | null; expected: ThemeChoice }>([
    { name: "light, as stored", stored: "light", expected: "light" },
    { name: "dark, as stored", stored: "dark", expected: "dark" },
    { name: "nothing stored: the system's", stored: null, expected: "system" },
    { name: "an unknown value: the system's", stored: "sepia", expected: "system" },
    { name: "a different case: the system's", stored: "Dark", expected: "system" }
  ])("$name", ({ expected, stored }) => {
    assert.strictEqual(parseThemeChoice(stored), expected)
  })
})
