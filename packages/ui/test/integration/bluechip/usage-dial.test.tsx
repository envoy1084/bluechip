import { UsageDial } from "@bluechip/ui/bluechip/usage-dial"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

const usd = (value: number) => `$${value.toLocaleString("en-US")}`

describe("UsageDial", () => {
  it("says what's used of the limit, and how much of the day has gone", async () => {
    const screen = await render(<UsageDial label="Daily budget" used={180} limit={500} dayGone={0.42} format={usd} />)

    await expect.element(screen.getByText("Daily budget: $180 of $500 used.")).toBeInTheDocument()
    await expect.element(screen.getByText("36%")).toBeVisible()
    await expect.element(screen.getByText("42%")).toBeVisible()
  })

  it("rolls what's left in its middle", async () => {
    const screen = await render(<UsageDial label="Daily budget" used={180} limit={500} dayGone={0.42} format={usd} />)

    await expect.element(screen.getByText("left of $500")).toBeVisible()
    await expect.element(screen.getByText("$320", { exact: true })).toBeInTheDocument()
  })

  it("follows a new amount used", async () => {
    const screen = await render(<UsageDial label="Daily budget" used={180} limit={500} dayGone={0.42} format={usd} />)
    await screen.rerender(<UsageDial label="Daily budget" used={450} limit={500} dayGone={0.42} format={usd} />)

    await expect.element(screen.getByText("$50", { exact: true })).toBeInTheDocument()
    expect(screen.container.querySelector("[data-slot=usage-dial]")?.getAttribute("data-level")).toBe("near")
  })

  it("used up", async () => {
    const screen = await render(<UsageDial label="Trades today" used={5} limit={5} dayGone={0.6} />)

    expect(screen.container.querySelector("[data-slot=usage-dial]")?.getAttribute("data-level")).toBe("full")
    await expect.element(screen.getByText("left of 5")).toBeVisible()
  })

  it("no limit: what's used, and the day alone", async () => {
    const screen = await render(<UsageDial label="Daily budget" used={120} limit={null} dayGone={0.5} format={usd} />)

    await expect.element(screen.getByText("Daily budget: $120 used.")).toBeInTheDocument()
    await expect.element(screen.getByText("used today")).toBeVisible()
    expect(screen.container.textContent).not.toContain("Used")
  })
})
