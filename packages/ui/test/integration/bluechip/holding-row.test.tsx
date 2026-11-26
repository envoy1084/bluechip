import { HoldingRow } from "@bluechip/ui/bluechip/holding-row"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

const APPLE = { symbol: "AAPL", name: "Apple", shares: 2, value: 380, weight: 19 } as const

describe("HoldingRow", () => {
  it("a button by default", async () => {
    const screen = await render(<HoldingRow {...APPLE} change={1.2} />)

    await expect.element(screen.getByRole("button", { name: /^AAPL ?Apple/ })).toBeVisible()
  })

  it("a link when the router's link is its render", async () => {
    // The row fills the link with its text.
    // oxlint-disable-next-line jsx-a11y/control-has-associated-label, jsx-a11y/anchor-has-content
    const link = <a href="/stocks/AAPL" />
    const screen = await render(<HoldingRow {...APPLE} change={1.2} render={link} />)

    await expect.element(screen.getByRole("link", { name: /^AAPL ?Apple/ })).toHaveAttribute("href", "/stocks/AAPL")
  })

  it("today's change not known yet: says so, not 0.00%", async () => {
    const screen = await render(<HoldingRow {...APPLE} change={null} />)

    await expect.element(screen.getByText("No change yet")).toBeVisible()
  })
})
