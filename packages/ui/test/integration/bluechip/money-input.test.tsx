import {
  checkMoneyInput,
  formatMoneyInput,
  MoneyInput,
  type MoneyInputCheck,
  parseMoneyInput
} from "@bluechip/ui/bluechip/money-input"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("formatMoneyInput", () => {
  it("groups thousands with commas", () => {
    expect(formatMoneyInput("1234567")).toBe("1,234,567")
  })

  it("keeps two decimals", () => {
    expect(formatMoneyInput("1234.5678")).toBe("1,234.56")
  })

  it("keeps the first point only", () => {
    expect(formatMoneyInput("12.3.4")).toBe("12.34")
  })

  it("drops symbols and leading zeros", () => {
    expect(formatMoneyInput("$0012")).toBe("12")
  })

  it("keeps a lone zero", () => {
    expect(formatMoneyInput("000")).toBe("0")
  })

  it("puts a zero before a leading point", () => {
    expect(formatMoneyInput(".5")).toBe("0.5")
  })

  it("keeps a trailing point to type decimals after", () => {
    expect(formatMoneyInput("12.")).toBe("12.")
  })

  it("is empty for text without digits", () => {
    expect(formatMoneyInput("abc")).toBe("")
  })
})

describe("parseMoneyInput", () => {
  it("reads a formatted amount", () => {
    expect(parseMoneyInput("1,497.64")).toBe(1497.64)
  })

  it("reads a trailing point as a whole amount", () => {
    expect(parseMoneyInput("12.")).toBe(12)
  })

  it("is null for an empty field", () => {
    expect(parseMoneyInput("")).toBeNull()
  })

  it("is null for a lone point", () => {
    expect(parseMoneyInput(".")).toBeNull()
  })
})

describe("checkMoneyInput", () => {
  const limits = { available: 1497.64, max: 1000, approvalAbove: 500 }

  it("no amount", () => {
    expect(checkMoneyInput(null, limits)).toStrictEqual({ status: "empty" })
  })

  it("an amount under the $1 minimum", () => {
    expect(checkMoneyInput(0.5, limits)).toStrictEqual({ status: "error", message: "The smallest amount is $1.00." })
  })

  it("an amount on the minimum", () => {
    expect(checkMoneyInput(1, limits)).toStrictEqual({ status: "valid" })
  })

  it("an amount under a custom minimum", () => {
    expect(checkMoneyInput(4, { ...limits, min: 5 })).toStrictEqual({
      status: "error",
      message: "The smallest amount is $5.00."
    })
  })

  it("an amount over your cash, said before the max", () => {
    expect(checkMoneyInput(2000, limits)).toStrictEqual({
      status: "error",
      message: "You have $1,497.64 in cash. Add cash or lower the amount."
    })
  })

  it("an amount over your cash where adding cash isn't the way: its own next step", () => {
    expect(checkMoneyInput(2000, { ...limits, overAvailable: "Lower the amount." })).toStrictEqual({
      status: "error",
      message: "You have $1,497.64 in cash. Lower the amount."
    })
  })

  it("an amount equal to your cash", () => {
    expect(checkMoneyInput(1497.64, { available: 1497.64 })).toStrictEqual({ status: "valid" })
  })

  it("an amount over the max", () => {
    expect(checkMoneyInput(1200, limits)).toStrictEqual({
      status: "error",
      message: "The most you can use here is $1,000.00."
    })
  })

  it("an amount on the max", () => {
    expect(checkMoneyInput(1000, { max: 1000 })).toStrictEqual({ status: "valid" })
  })

  it("an amount over the approval line", () => {
    expect(checkMoneyInput(600, limits)).toStrictEqual({
      status: "warning",
      message: "Over $500.00 needs your approval."
    })
  })

  it("an amount on the approval line", () => {
    expect(checkMoneyInput(500, limits)).toStrictEqual({ status: "valid" })
  })
})

describe("MoneyInput", () => {
  it("formats as you type and reports the amount with its check", async () => {
    const reports: Array<readonly [number | null, MoneyInputCheck]> = []
    const screen = await render(
      <MoneyInput label="Buy Nvidia with" available={5000} onValueChange={(...report) => reports.push(report)} />
    )
    const input = screen.getByLabelText("Buy Nvidia with")
    await userEvent.type(input, "1234.567")
    await expect.element(input).toHaveValue("1,234.56")
    expect(reports.at(-1)).toStrictEqual([1234.56, { status: "valid" }])
  })

  it("starts from its default value", async () => {
    const screen = await render(<MoneyInput label="Buy Nvidia with" defaultValue={1250.5} />)
    await expect.element(screen.getByLabelText("Buy Nvidia with")).toHaveValue("1,250.50")
  })

  it("asks for an amount while empty", async () => {
    const screen = await render(<MoneyInput label="Buy Nvidia with" available={1497.64} />)
    await expect.element(screen.getByText("Enter an amount. The smallest is $1.00.")).toBeVisible()
  })

  it("fills your cash with Max", async () => {
    const screen = await render(<MoneyInput label="Buy Nvidia with" available={1497.64} />)
    await userEvent.click(screen.getByRole("button", { name: "Max" }))
    await expect.element(screen.getByLabelText("Buy Nvidia with")).toHaveValue("1,497.64")
  })

  it("fills the max with Max when it's under your cash", async () => {
    const screen = await render(<MoneyInput label="Buy Nvidia with" available={1497.64} max={1000} />)
    await userEvent.click(screen.getByRole("button", { name: "Max" }))
    await expect.element(screen.getByLabelText("Buy Nvidia with")).toHaveValue("1,000")
  })

  it("has no Max without cash or a max to fill", async () => {
    const screen = await render(<MoneyInput label="Buy Nvidia with" />)
    await expect.element(screen.getByRole("button", { name: "Max" })).not.toBeInTheDocument()
  })

  it("fills a quick amount", async () => {
    const screen = await render(<MoneyInput label="Buy Nvidia with" available={1497.64} quickAmounts={[50, 250]} />)
    await userEvent.click(screen.getByRole("button", { name: "$250" }))
    await expect.element(screen.getByLabelText("Buy Nvidia with")).toHaveValue("250")
  })

  it("marks the field invalid and says what's wrong", async () => {
    const screen = await render(<MoneyInput label="Buy Nvidia with" available={1497.64} />)
    const input = screen.getByLabelText("Buy Nvidia with")
    await userEvent.type(input, "2000")
    await expect.element(input).toHaveAttribute("aria-invalid", "true")
    await expect.element(input).toHaveAccessibleDescription("You have $1,497.64 in cash. Add cash or lower the amount.")
  })

  it("warns without blocking", async () => {
    const screen = await render(<MoneyInput label="Buy Nvidia with" available={1497.64} approvalAbove={500} />)
    const input = screen.getByLabelText("Buy Nvidia with")
    await userEvent.type(input, "600")
    await expect.element(input).toHaveAttribute("aria-invalid", "false")
    await expect.element(input).toHaveAccessibleDescription("Over $500.00 needs your approval.")
  })

  it("shows a hint for the amount while it's fine", async () => {
    const screen = await render(
      <MoneyInput label="Buy Nvidia with" available={1497.64} hint={(amount) => `About ${amount / 100} shares`} />
    )
    await userEvent.type(screen.getByLabelText("Buy Nvidia with"), "250")
    await expect.element(screen.getByText("About 2.5 shares")).toBeVisible()
  })

  it("says why it's off when disabled", async () => {
    const screen = await render(
      <MoneyInput
        label="Buy Nvidia with"
        available={1497.64}
        disabled
        disabledReason="Buying opens Monday at 09:30 New York time."
      />
    )
    await expect.element(screen.getByLabelText("Buy Nvidia with")).toBeDisabled()
    await expect.element(screen.getByText("Buying opens Monday at 09:30 New York time.")).toBeVisible()
  })
})
