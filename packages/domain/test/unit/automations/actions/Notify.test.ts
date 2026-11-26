import { notify } from "@bluechip/domain/automations/actions/Notify"
import { assert, describe, it } from "@effect/vitest"

describe("notify.describe", () => {
  it.each<{ name: string; message: string; expected: string }>([
    { name: "no message", message: "  ", expected: "tell you" },
    { name: "a message", message: "Apple is under $200", expected: "tell you: Apple is under $200" },
    { name: "a message ending in a period", message: "Apple is under $200.", expected: "tell you: Apple is under $200" }
  ])("$name", ({ expected, message }) => {
    assert.strictEqual(notify.describe({ message }, { name: (symbol) => symbol }), expected)
  })
})
