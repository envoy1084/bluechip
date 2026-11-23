import { MarketStatus } from "@bluechip/ui/bluechip/market-status"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

// Fri 20 Nov 2026, 16:00 in New York (21:00 UTC).
const FRIDAY_CLOSE = Date.UTC(2026, 10, 20, 21, 0)

describe("MarketStatus", () => {
  it("says when an open market closes, in New York time", async () => {
    const screen = await render(<MarketStatus state="open" closesAt={FRIDAY_CLOSE} />)
    await expect.element(screen.getByText("US market open")).toBeVisible()
    await expect.element(screen.getByText("· closes 16:00 New York")).toBeVisible()
  })

  it("says when a closed market opens", async () => {
    const screen = await render(<MarketStatus state="closed" opensAt={Date.UTC(2026, 10, 24, 14, 30)} />)
    await expect.element(screen.getByText("Market closed")).toBeVisible()
    await expect.element(screen.getByText("· opens 09:30 New York")).toBeVisible()
  })

  it("gives the last close over the weekend, New York first", async () => {
    const screen = await render(<MarketStatus state="weekend" lastClose={FRIDAY_CLOSE} />)
    await expect.element(screen.getByText("Closed for the weekend")).toBeVisible()
    await expect.element(screen.getByText("· last close Fri 16:00 New York (21:00 UTC)")).toBeVisible()
  })

  it("names the halted stock", async () => {
    const screen = await render(<MarketStatus state="halted" symbol="SPCX" />)
    await expect.element(screen.getByText("SPCX halted")).toBeVisible()
    await expect.element(screen.getByText("· by exchange")).toBeVisible()
  })
})
