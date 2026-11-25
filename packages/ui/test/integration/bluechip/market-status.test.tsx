import { marketExplainer, MarketStatus, type MarketTimes } from "@bluechip/ui/bluechip/market-status"
import { afterEach, describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { cdp, userEvent } from "vitest/browser"

// Fri 20 Nov 2026, 16:00 in New York (21:00 UTC).
const FRIDAY_CLOSE = Date.UTC(2026, 10, 20, 21, 0)
// Mon 23 Nov 2026, 09:30 in New York.
const MONDAY_OPEN = Date.UTC(2026, 10, 23, 14, 30)

const NO_TIMES: MarketTimes = { closesAt: undefined, opensAt: undefined, lastClose: undefined, resumesAt: undefined }

// The viewer's time zone, emulated for the test page; "" restores the machine's own.
const viewIn = (timezoneId: string) => cdp().send("Emulation.setTimezoneOverride", { timezoneId })

describe("marketExplainer", () => {
  it("open", () => {
    expect(marketExplainer("open", { ...NO_TIMES, closesAt: FRIDAY_CLOSE }, undefined, undefined)).toStrictEqual({
      label: "US market open",
      moment: "Regular trading closes",
      at: FRIDAY_CLOSE
    })
  })

  it("extended, in a named session", () => {
    expect(marketExplainer("extended", { ...NO_TIMES, opensAt: MONDAY_OPEN }, undefined, "After hours"))
      .toStrictEqual({
        label: "After hours",
        moment: "Regular trading opens",
        at: MONDAY_OPEN,
        note: "Prices still move outside regular hours, with less trading behind them."
      })
  })

  it("extended, with no session named", () => {
    expect(marketExplainer("extended", NO_TIMES, undefined, undefined).label).toBe("Extended hours")
  })

  it("paused", () => {
    expect(marketExplainer("paused", { ...NO_TIMES, resumesAt: MONDAY_OPEN }, undefined, undefined)).toStrictEqual({
      label: "Prices paused",
      moment: "Prices move again",
      at: MONDAY_OPEN,
      note: "Stock tokens still trade, with no live price to compare against."
    })
  })

  it("closed", () => {
    expect(marketExplainer("closed", { ...NO_TIMES, opensAt: MONDAY_OPEN }, undefined, undefined)).toStrictEqual({
      label: "Market closed",
      moment: "Regular trading opens",
      at: MONDAY_OPEN
    })
  })

  it("weekend", () => {
    expect(marketExplainer("weekend", { ...NO_TIMES, lastClose: FRIDAY_CLOSE }, undefined, undefined))
      .toStrictEqual({ label: "Closed for the weekend", moment: "Last close", at: FRIDAY_CLOSE })
  })

  it("halted, naming the stock", () => {
    expect(marketExplainer("halted", NO_TIMES, "SPCX", undefined)).toStrictEqual({
      label: "SPCX halted",
      note: "Its exchange paused trading in this stock."
    })
  })

  it("halted, with no stock named", () => {
    expect(marketExplainer("halted", NO_TIMES, undefined, undefined).label).toBe("Trading halted")
  })
})

describe("MarketStatus", () => {
  afterEach(() => viewIn(""))

  it("is one chip, named for the state", async () => {
    const screen = await render(<MarketStatus state="closed" opensAt={MONDAY_OPEN} />)
    await expect.element(screen.getByRole("button", { name: "Market closed" })).toBeVisible()
  })

  it("explains when the state changes, in New York time", async () => {
    await viewIn("America/New_York")
    const screen = await render(<MarketStatus state="open" closesAt={FRIDAY_CLOSE} />)
    await userEvent.click(screen.getByRole("button", { name: "US market open" }))
    await expect.element(screen.getByText("Regular trading closes")).toBeVisible()
    await expect.element(screen.getByRole("definition")).toHaveTextContent("Fri 20 Nov, 16:00")
  })

  it("adds the viewer's own time outside New York", async () => {
    await viewIn("Europe/London")
    const screen = await render(<MarketStatus state="open" closesAt={FRIDAY_CLOSE} />)
    await userEvent.click(screen.getByRole("button", { name: "US market open" }))
    await expect.element(screen.getByRole("term").nth(1)).toHaveTextContent("Your time")
    await expect.element(screen.getByRole("definition").nth(1)).toHaveTextContent("Fri 20 Nov, 21:00")
  })

  it("leaves the time out when it isn't known", async () => {
    const screen = await render(<MarketStatus state="open" />)
    await userEvent.click(screen.getByRole("button", { name: "US market open" }))
    await expect.element(screen.getByRole("dialog")).toBeVisible()
    await expect.element(screen.getByText("Regular trading closes")).not.toBeInTheDocument()
  })

  it("explains why, when the state has a note", async () => {
    const screen = await render(<MarketStatus state="halted" symbol="SPCX" />)
    await userEvent.click(screen.getByRole("button", { name: "SPCX halted" }))
    await expect.element(screen.getByText("Its exchange paused trading in this stock.")).toBeVisible()
  })
})
