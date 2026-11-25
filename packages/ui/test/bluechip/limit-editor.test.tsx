import { LimitEditor } from "@bluechip/ui/bluechip/limit-editor"
import { type AgentLimits, compareLimits, limitErrors } from "@bluechip/ui/lib/agent-limits"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const LOCKED: AgentLimits = {
  stocks: ["NVDA", "AAPL", "MSFT"],
  mode: "buy-and-sell",
  dailySpend: 250,
  maxPerTrade: 100,
  maxInOneStock: 30,
  cashReserve: 10,
  approveAbove: 150
}

describe("limitErrors", () => {
  it("accepts limits inside every range", () => {
    expect(limitErrors(LOCKED)).toEqual({})
  })

  it("rejects values outside a field's range and limits that contradict each other", () => {
    expect(limitErrors({ ...LOCKED, dailySpend: 2010 }).dailySpend).toBe("Pick $0 to $2,000.")
    expect(limitErrors({ ...LOCKED, maxInOneStock: 4 }).maxInOneStock).toBe("Pick 5% to 100%.")
    expect(limitErrors({ ...LOCKED, maxPerTrade: 300 }).maxPerTrade).toBe("Can't be more than the daily spend ($250).")
    expect(limitErrors({ ...LOCKED, maxInOneStock: 95 }).cashReserve).toBe(
      "Cash reserve plus max in one stock can't pass 100%."
    )
    expect(limitErrors({ ...LOCKED, stocks: [] }).stocks).toBe("Pick at least one stock.")
  })
})

describe("compareLimits", () => {
  it("calls less room tighter and more room looser, with a bigger cash reserve counted as tighter", () => {
    expect(compareLimits(LOCKED, LOCKED)).toBe("same")
    expect(compareLimits(LOCKED, { ...LOCKED, dailySpend: 200, cashReserve: 20 })).toBe("tighter")
    expect(compareLimits(LOCKED, { ...LOCKED, cashReserve: 5 })).toBe("looser")
    expect(compareLimits(LOCKED, { ...LOCKED, stocks: ["NVDA"] })).toBe("tighter")
    expect(compareLimits(LOCKED, { ...LOCKED, dailySpend: 100, stocks: [...LOCKED.stocks, "TSLA"] })).toBe("looser")
  })
})

describe("LimitEditor", () => {
  it("blocks locking with a value out of range and says why", async () => {
    const screen = await render(<LimitEditor locked={LOCKED} lockedUntil="22 Feb" />)
    await userEvent.fill(screen.getByRole("textbox", { name: "Daily spend" }), "5000")
    await expect.element(screen.getByRole("textbox", { name: "Daily spend" })).toHaveAttribute("aria-invalid", "true")
    await expect.element(screen.getByText("Pick $0 to $2,000.").first()).toBeVisible()
    await expect.element(screen.getByRole("button", { name: "Lock with Face ID" })).toBeDisabled()
  })

  it("applies a tighter change at once", async () => {
    const applied: Array<AgentLimits> = []
    const screen = await render(<LimitEditor locked={LOCKED} onApply={(limits) => applied.push(limits)} />)
    await userEvent.fill(screen.getByRole("textbox", { name: "Daily spend" }), "200")
    await expect.element(screen.getByText("Tighter, applies now")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Apply now" }))
    expect(applied).toEqual([{ ...LOCKED, dailySpend: 200 }])
  })

  it("asks for Face ID for a looser change, including a newly allowed stock", async () => {
    const locked: Array<AgentLimits> = []
    const screen = await render(<LimitEditor locked={LOCKED} onLock={(limits) => void locked.push(limits)} />)
    await userEvent.click(screen.getByRole("button", { name: /Tesla/ }))
    await expect.element(screen.getByText("Looser, needs Face ID")).toBeVisible()
    await expect.element(screen.getByRole("button", { name: "Apply now" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Lock with Face ID" }))
    expect(locked.map((limits) => limits.stocks)).toEqual([["NVDA", "AAPL", "MSFT", "TSLA"]])
  })

  it("reads the edited values back in the preview", async () => {
    const screen = await render(<LimitEditor locked={LOCKED} />)
    await userEvent.fill(screen.getByRole("textbox", { name: "Daily spend" }), "300")
    await userEvent.fill(screen.getByRole("textbox", { name: "Max in one stock" }), "25")
    await userEvent.fill(screen.getByRole("textbox", { name: "Ask me above" }), "0")
    await expect.element(screen.getByText("Spend up to $300 a day")).toBeVisible()
    await expect.element(screen.getByText("Put over 25% of your money in one stock")).toBeVisible()
    await expect.element(screen.getByText("Ask you before every trade")).toBeVisible()
    await expect.element(screen.getByText("Not locked yet", { exact: true })).toBeVisible()
  })

  it("fills every field from a preset", async () => {
    const values: Array<AgentLimits> = []
    const screen = await render(<LimitEditor locked={LOCKED} onValueChange={(limits) => values.push(limits)} />)
    await userEvent.click(screen.getByRole("radio", { name: /Conservative/ }))
    expect(values.at(-1)).toEqual({
      ...LOCKED,
      dailySpend: 100,
      maxPerTrade: 50,
      maxInOneStock: 20,
      cashReserve: 20,
      approveAbove: 50
    })
    await expect.element(screen.getByRole("textbox", { name: "Cash reserve" })).toHaveValue("20")
  })
})
