import { formatMoney } from "@bluechip/ui/lib/format"
import { type FlowParts, NumberRoll, toFlow } from "@bluechip/ui/motion/number-roll"
import { assert, describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("toFlow", () => {
  it.each<{ name: string; text: string; expected: FlowParts | undefined }>([
    {
      name: "dollars: the symbol before, two grouped decimals",
      text: "$12,480.32",
      expected: {
        prefix: "$",
        magnitude: 12_480.32,
        suffix: "",
        format: { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }
      }
    },
    {
      name: "a negative: the sign stays in the prefix",
      text: "−$3.00",
      expected: {
        prefix: "−$",
        magnitude: 3,
        suffix: "",
        format: { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }
      }
    },
    {
      name: "a token amount: the symbol after",
      text: "0.275604 NVDAc",
      expected: {
        prefix: "",
        magnitude: 0.275604,
        suffix: " NVDAc",
        format: { minimumFractionDigits: 6, maximumFractionDigits: 6, useGrouping: false }
      }
    },
    {
      name: "compact: the unit after",
      text: "$1.2M",
      expected: {
        prefix: "$",
        magnitude: 1.2,
        suffix: "M",
        format: { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false }
      }
    },
    {
      name: "a grouped whole number",
      text: "1,234",
      expected: {
        prefix: "",
        magnitude: 1234,
        suffix: "",
        format: { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: true }
      }
    },
    {
      name: "an arrowed percent",
      text: "▲ 1.82%",
      expected: {
        prefix: "▲ ",
        magnitude: 1.82,
        suffix: "%",
        format: { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }
      }
    },
    { name: "text without digits", text: "No price yet", expected: undefined },
    { name: "empty text", text: "", expected: undefined }
  ])("$name", ({ expected, text }) => {
    assert.deepStrictEqual(toFlow(text), expected)
  })
})

describe("NumberRoll", () => {
  it("reads as the value formatted with Intl options", async () => {
    const screen = await render(<NumberRoll value={12480.32} format={{ style: "currency", currency: "USD" }} />)

    await expect.element(screen.getByText("$12,480.32", { exact: true })).toBeInTheDocument()
  })

  it("reads as the value formatted with a formatter", async () => {
    const screen = await render(<NumberRoll value={-3} format={formatMoney} />)

    await expect.element(screen.getByText("−$3.00", { exact: true })).toBeInTheDocument()
  })

  it("reads as the new value after it changes", async () => {
    const screen = await render(<NumberRoll value={-3} format={formatMoney} />)

    await screen.rerender(<NumberRoll value={1240.5} format={formatMoney} />)

    await expect.element(screen.getByText("$1,240.50", { exact: true })).toBeInTheDocument()
  })

  it("hides the rolling digits from screen readers", async () => {
    const screen = await render(<NumberRoll value={-1240.5} format={formatMoney} />)

    assert.strictEqual(screen.container.querySelector("number-flow-react")?.getAttribute("aria-hidden"), "true")
  })

  it("shows text without digits as it is, with no roll", async () => {
    const screen = await render(<NumberRoll value={Number.NaN} format={() => "No price yet"} />)

    await expect.element(screen.getByText("No price yet", { exact: true }).first()).toBeInTheDocument()
    assert.isNull(screen.container.querySelector("number-flow-react"))
  })
})
