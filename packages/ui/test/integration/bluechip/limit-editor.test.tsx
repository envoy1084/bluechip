import { LimitEditor } from "@bluechip/ui/bluechip/limit-editor"
import { type AgentLimits, compareLimits, limitErrors, matchPreset } from "@bluechip/ui/lib/agent-limits"
import { describe, expect, it } from "@effect/vitest"
import { useState } from "react"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

// The Balanced preset, on three stocks.
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
  it("limits inside every range", () => {
    expect(limitErrors(LOCKED)).toStrictEqual({})
  })

  it("a daily spend on its max", () => {
    expect(limitErrors({ ...LOCKED, dailySpend: 2000 })).toStrictEqual({})
  })

  it("a daily spend past its max", () => {
    expect(limitErrors({ ...LOCKED, dailySpend: 2010 })).toStrictEqual({ dailySpend: "Pick $0 to $2,000." })
  })

  it("an empty field", () => {
    expect(limitErrors({ ...LOCKED, dailySpend: Number.NaN })).toStrictEqual({ dailySpend: "Pick $0 to $2,000." })
  })

  it("a max per trade under its min", () => {
    expect(limitErrors({ ...LOCKED, maxPerTrade: 9 })).toStrictEqual({ maxPerTrade: "Pick $10 to $1,000." })
  })

  it("a max in one stock under its min", () => {
    expect(limitErrors({ ...LOCKED, maxInOneStock: 4 })).toStrictEqual({ maxInOneStock: "Pick 5% to 100%." })
  })

  it("a cash reserve past its max", () => {
    expect(limitErrors({ ...LOCKED, cashReserve: 51 })).toStrictEqual({ cashReserve: "Pick 0% to 50%." })
  })

  it("an ask-me amount past its max", () => {
    expect(limitErrors({ ...LOCKED, approveAbove: 1010 })).toStrictEqual({ approveAbove: "Pick $0 to $1,000." })
  })

  it("a max per trade equal to the daily spend", () => {
    expect(limitErrors({ ...LOCKED, maxPerTrade: 250 })).toStrictEqual({})
  })

  it("a max per trade over the daily spend", () => {
    expect(limitErrors({ ...LOCKED, maxPerTrade: 260 })).toStrictEqual({
      maxPerTrade: "Can't be more than the daily spend ($250)."
    })
  })

  it("a max per trade over a sell-only agent's zero daily spend", () => {
    expect(limitErrors({ ...LOCKED, dailySpend: 0 })).toStrictEqual({})
  })

  it("a cash reserve and max in one stock adding up to 100%", () => {
    expect(limitErrors({ ...LOCKED, maxInOneStock: 90 })).toStrictEqual({})
  })

  it("a cash reserve and max in one stock past 100%", () => {
    expect(limitErrors({ ...LOCKED, maxInOneStock: 91 })).toStrictEqual({
      cashReserve: "Cash reserve plus max in one stock can't pass 100%."
    })
  })

  it("no stocks", () => {
    expect(limitErrors({ ...LOCKED, stocks: [] })).toStrictEqual({ stocks: "Pick at least one stock." })
  })
})

describe("compareLimits", () => {
  it("the same limits", () => {
    expect(compareLimits(LOCKED, { ...LOCKED })).toBe("same")
  })

  it("a lower daily spend", () => {
    expect(compareLimits(LOCKED, { ...LOCKED, dailySpend: 200 })).toBe("tighter")
  })

  it("a higher daily spend", () => {
    expect(compareLimits(LOCKED, { ...LOCKED, dailySpend: 300 })).toBe("looser")
  })

  it("a bigger cash reserve", () => {
    expect(compareLimits(LOCKED, { ...LOCKED, cashReserve: 20 })).toBe("tighter")
  })

  it("a smaller cash reserve", () => {
    expect(compareLimits(LOCKED, { ...LOCKED, cashReserve: 5 })).toBe("looser")
  })

  it("a stock taken away", () => {
    expect(compareLimits(LOCKED, { ...LOCKED, stocks: ["NVDA", "AAPL"] })).toBe("tighter")
  })

  it("a stock added", () => {
    expect(compareLimits(LOCKED, { ...LOCKED, stocks: ["NVDA", "AAPL", "MSFT", "TSLA"] })).toBe("looser")
  })

  it("a stock swapped for another", () => {
    expect(compareLimits(LOCKED, { ...LOCKED, stocks: ["NVDA", "AAPL", "TSLA"] })).toBe("looser")
  })

  it("one limit tighter and another looser", () => {
    expect(compareLimits(LOCKED, { ...LOCKED, dailySpend: 200, approveAbove: 200 })).toBe("looser")
  })

  it("a sell-only agent allowed to buy too", () => {
    expect(compareLimits({ ...LOCKED, mode: "sell" }, { ...LOCKED, mode: "buy-and-sell" })).toBe("looser")
  })

  it("a buy-only agent switched to selling", () => {
    expect(compareLimits({ ...LOCKED, mode: "buy" }, { ...LOCKED, mode: "sell" })).toBe("looser")
  })

  it("an agent that buys and sells narrowed to rebalancing", () => {
    expect(compareLimits({ ...LOCKED, mode: "buy-and-sell" }, { ...LOCKED, mode: "rebalance" })).toBe("tighter")
  })

  it("a Rebalancer allowed to trade freely", () => {
    expect(compareLimits({ ...LOCKED, mode: "rebalance" }, { ...LOCKED, mode: "buy-and-sell" })).toBe("looser")
  })
})

describe("matchPreset", () => {
  it("limits with a preset's values", () => {
    expect(matchPreset(LOCKED)).toBe("balanced")
  })

  it("limits one value off every preset", () => {
    expect(matchPreset({ ...LOCKED, dailySpend: 260 })).toBeUndefined()
  })
})

const dailySpend = (screen: Awaited<ReturnType<typeof render>>) => screen.getByRole("textbox", { name: "Daily spend" })

describe("LimitEditor", () => {
  describe("unchanged", () => {
    it("says until when the limits are locked", async () => {
      const screen = await render(<LimitEditor locked={LOCKED} lockedUntil="22 Feb" />)
      await expect.element(screen.getByText("Locked with Face ID until 22 Feb.")).toBeVisible()
      await expect.element(screen.getByRole("button", { name: "Lock with Face ID" })).not.toBeInTheDocument()
      await expect.element(screen.getByRole("button", { name: "Apply now" })).not.toBeInTheDocument()
    })

    it("says they aren't locked without a lock date", async () => {
      const screen = await render(<LimitEditor locked={LOCKED} />)
      await expect.element(screen.getByText("Not locked yet.", { exact: true })).toBeVisible()
    })
  })

  it("blocks locking a value out of range and says why", async () => {
    const screen = await render(<LimitEditor locked={LOCKED} />)
    await userEvent.fill(dailySpend(screen), "5000")
    await expect.element(dailySpend(screen)).toHaveAttribute("aria-invalid", "true")
    await expect.element(screen.getByText("Pick $0 to $2,000.").first()).toBeVisible()
    await expect.element(screen.getByRole("button", { name: "Lock with Face ID" })).toBeDisabled()
  })

  it("applies a tighter change at once", async () => {
    const applied: Array<AgentLimits> = []
    const screen = await render(<LimitEditor locked={LOCKED} onApply={(limits) => applied.push(limits)} />)
    await userEvent.fill(dailySpend(screen), "200")
    await expect.element(screen.getByText("Tighter, applies now")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Apply now" }))
    expect(applied).toStrictEqual([{ ...LOCKED, dailySpend: 200 }])
  })

  it("asks for Face ID for a looser change, like a newly allowed stock", async () => {
    const locked: Array<AgentLimits> = []
    const screen = await render(<LimitEditor locked={LOCKED} onLock={(limits) => void locked.push(limits)} />)
    await userEvent.click(screen.getByRole("button", { name: /Tesla/ }))
    await expect.element(screen.getByText("Looser, needs Face ID")).toBeVisible()
    await expect.element(screen.getByRole("button", { name: "Apply now" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Lock with Face ID" }))
    expect(locked).toStrictEqual([{ ...LOCKED, stocks: ["NVDA", "AAPL", "MSFT", "TSLA"] }])
  })

  it("waits while Face ID locks", async () => {
    const screen = await render(<LimitEditor locked={LOCKED} onLock={() => new Promise(() => {})} />)
    await userEvent.fill(dailySpend(screen), "300")
    await userEvent.click(screen.getByRole("button", { name: "Lock with Face ID" }))
    await expect.element(screen.getByRole("button", { name: "Waiting for Face ID…" })).toBeDisabled()
  })

  it("says nothing changed when the lock fails, and lets you try again", async () => {
    const screen = await render(<LimitEditor locked={LOCKED} onLock={() => Promise.reject(new Error("cancelled"))} />)
    await userEvent.fill(dailySpend(screen), "300")
    await userEvent.click(screen.getByRole("button", { name: "Lock with Face ID" }))
    await expect.element(screen.getByText("The limits weren't locked, so nothing changed. Try Face ID again."))
      .toBeVisible()
    await expect.element(screen.getByRole("button", { name: "Lock with Face ID" })).toBeEnabled()
  })

  it("says the new limits are live once locked", async () => {
    function Editor() {
      const [locked, setLocked] = useState(LOCKED)
      return <LimitEditor locked={locked} onLock={setLocked} />
    }
    const screen = await render(<Editor />)
    await userEvent.fill(dailySpend(screen), "300")
    await userEvent.click(screen.getByRole("button", { name: "Lock with Face ID" }))
    await expect.element(screen.getByText("Locked with Face ID. New limits are live.")).toBeVisible()
  })

  it("undoes your changes back to the locked limits", async () => {
    const values: Array<AgentLimits> = []
    const screen = await render(<LimitEditor locked={LOCKED} onValueChange={(limits) => values.push(limits)} />)
    await userEvent.fill(dailySpend(screen), "300")
    await userEvent.click(screen.getByRole("button", { name: "Undo" }))
    expect(values.at(-1)).toStrictEqual(LOCKED)
    await expect.element(dailySpend(screen)).toHaveValue("250")
  })

  it("reads the edited values back in the preview, not locked yet", async () => {
    const screen = await render(<LimitEditor locked={LOCKED} lockedUntil="22 Feb" />)
    await userEvent.fill(dailySpend(screen), "300")
    await expect.element(screen.getByText("Spend up to $300 a day")).toBeVisible()
    await expect.element(screen.getByText("Not locked yet", { exact: true })).toBeVisible()
  })

  it("says every trade waits for you when the ask-me amount is 0", async () => {
    const screen = await render(<LimitEditor locked={LOCKED} />)
    await userEvent.fill(screen.getByRole("textbox", { name: "Ask me above" }), "0")
    await expect.element(screen.getByText("Every trade waits for your OK.")).toBeVisible()
  })

  it("fills every field from a preset", async () => {
    const values: Array<AgentLimits> = []
    const screen = await render(<LimitEditor locked={LOCKED} onValueChange={(limits) => values.push(limits)} />)
    await userEvent.click(screen.getByRole("radio", { name: /Conservative/ }))
    expect(values.at(-1)).toStrictEqual({
      ...LOCKED,
      dailySpend: 100,
      maxPerTrade: 50,
      maxInOneStock: 20,
      cashReserve: 20,
      approveAbove: 50
    })
    await expect.element(screen.getByRole("textbox", { name: "Cash reserve" })).toHaveValue("20")
  })

  it("selects the preset the limits match", async () => {
    const screen = await render(<LimitEditor locked={LOCKED} />)
    await expect.element(screen.getByRole("radio", { name: /Balanced/ })).toBeChecked()
    await expect.element(screen.getByText("Custom limits")).not.toBeInTheDocument()
  })

  it("calls limits off every preset custom", async () => {
    const screen = await render(<LimitEditor locked={LOCKED} />)
    await userEvent.fill(dailySpend(screen), "260")
    await expect.element(screen.getByText("Custom limits")).toBeVisible()
    await expect.element(screen.getByRole("radio", { name: /Balanced/ })).not.toBeChecked()
  })
})
