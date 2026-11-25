import { MarketStatus } from "@bluechip/ui/bluechip/market-status"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

// Fri 20 Nov 2026, 16:00 in New York (21:00 UTC).
const FRIDAY_CLOSE = Date.UTC(2026, 10, 20, 21, 0)

describe("MarketStatus", () => {
  it("is one chip, and explains when an open market closes in New York time", async () => {
    const screen = await render(<MarketStatus state="open" closesAt={FRIDAY_CLOSE} />)
    const chip = screen.getByRole("button", { name: "US market open" })
    await expect.element(chip).toBeVisible()

    await userEvent.click(chip)
    await expect.element(screen.getByText("Regular trading closes")).toBeVisible()
    await expect.element(screen.getByText("Fri 20 Nov, 16:00")).toBeVisible()
  })

  it("names the extended session and when regular trading opens", async () => {
    const screen = await render(
      <MarketStatus state="extended" session="After hours" opensAt={Date.UTC(2026, 10, 23, 14, 30)} />
    )
    await userEvent.click(screen.getByRole("button", { name: "After hours" }))
    await expect.element(screen.getByText("Regular trading opens")).toBeVisible()
    await expect.element(screen.getByText("Mon 23 Nov, 09:30")).toBeVisible()
  })

  it("says paused prices come back, and when", async () => {
    const screen = await render(<MarketStatus state="paused" resumesAt={Date.UTC(2026, 10, 23, 1, 0)} />)
    await userEvent.click(screen.getByRole("button", { name: "Prices paused" }))
    await expect.element(screen.getByText("Prices move again")).toBeVisible()
    await expect.element(screen.getByText("Sun 22 Nov, 20:00")).toBeVisible()
  })

  it("names the halted stock", async () => {
    const screen = await render(<MarketStatus state="halted" symbol="SPCX" />)
    await userEvent.click(screen.getByRole("button", { name: "SPCX halted" }))
    await expect.element(screen.getByText("Its exchange paused trading in this stock.")).toBeVisible()
  })
})
