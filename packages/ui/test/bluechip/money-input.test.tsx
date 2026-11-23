import { checkMoneyInput, formatMoneyInput, MoneyInput, parseMoneyInput } from "@bluechip/ui/bluechip/money-input"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("formatMoneyInput", () => {
  it("adds commas, keeps one point and two decimals", () => {
    expect(formatMoneyInput("1234567")).toBe("1,234,567")
    expect(formatMoneyInput("1234.5678")).toBe("1,234.56")
    expect(formatMoneyInput("12.3.4")).toBe("12.34")
    expect(formatMoneyInput("$0012")).toBe("12")
    expect(formatMoneyInput(".5")).toBe("0.5")
    expect(formatMoneyInput("12.")).toBe("12.")
    expect(formatMoneyInput("abc")).toBe("")
  })

  it("parses back to a number, or null when empty", () => {
    expect(parseMoneyInput("1,497.64")).toBe(1497.64)
    expect(parseMoneyInput("250")).toBe(250)
    expect(parseMoneyInput("")).toBeNull()
    expect(parseMoneyInput(".")).toBeNull()
  })
})

describe("checkMoneyInput", () => {
  const limits = { available: 1497.64, max: 1000, approvalAbove: 500 }

  it("puts the smallest amount first, then cash, then the max, then approval", () => {
    expect(checkMoneyInput(null, limits)).toEqual({ status: "empty" })
    expect(checkMoneyInput(0.5, limits).status).toBe("error")
    expect(checkMoneyInput(2000, limits)).toEqual({
      status: "error",
      message: "You have $1,497.64 in cash. Add cash or lower the amount."
    })
    expect(checkMoneyInput(1200, limits)).toEqual({
      status: "error",
      message: "The most you can use here is $1,000.00."
    })
    expect(checkMoneyInput(600, limits)).toEqual({
      status: "warning",
      message: "Over $500.00 needs your OK with Face ID."
    })
    expect(checkMoneyInput(250, limits)).toEqual({ status: "valid" })
  })
})

describe("MoneyInput", () => {
  it("formats as you type and reports the amount", async () => {
    const amounts: Array<number | null> = []
    const screen = await render(
      <MoneyInput label="Buy Nvidia with" available={5000} onValueChange={(amount) => amounts.push(amount)} />
    )
    const input = screen.getByLabelText("Buy Nvidia with")
    await userEvent.type(input, "1234.567")
    await expect.element(input).toHaveValue("1,234.56")
    expect(amounts.at(-1)).toBe(1234.56)
  })

  it("fills your cash with Max", async () => {
    const screen = await render(<MoneyInput label="Buy Nvidia with" available={1497.64} />)
    await userEvent.click(screen.getByRole("button", { name: "Max" }))
    await expect.element(screen.getByLabelText("Buy Nvidia with")).toHaveValue("1,497.64")
  })

  it("says what's wrong when the amount is over your cash", async () => {
    const screen = await render(<MoneyInput label="Buy Nvidia with" available={1497.64} />)
    const input = screen.getByLabelText("Buy Nvidia with")
    await userEvent.type(input, "2000")
    await expect.element(input).toHaveAttribute("aria-invalid", "true")
    await expect.element(screen.getByText("You have $1,497.64 in cash. Add cash or lower the amount.")).toBeVisible()
    await userEvent.clear(input)
    await userEvent.type(input, "0.5")
    await expect.element(screen.getByText("The smallest amount is $1.00.")).toBeVisible()
  })

  it("fills a quick amount", async () => {
    const screen = await render(<MoneyInput label="Buy Nvidia with" available={1497.64} quickAmounts={[50, 250]} />)
    await userEvent.click(screen.getByRole("button", { name: "$250" }))
    await expect.element(screen.getByLabelText("Buy Nvidia with")).toHaveValue("250")
  })
})
