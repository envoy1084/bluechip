import { Price, PriceChange, priceDirection } from "@bluechip/ui/bluechip/price-change"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("PriceChange", () => {
  it("signs and tones each direction", async () => {
    const screen = await render(
      <div>
        <PriceChange value={1.86} data-testid="up" />
        <PriceChange value={-0.77} data-testid="down" />
        <PriceChange value={0.004} data-testid="flat" />
      </div>
    )
    await expect.element(screen.getByTestId("up")).toHaveTextContent("+1.86%")
    await expect.element(screen.getByTestId("up")).toHaveAttribute("data-direction", "up")
    await expect.element(screen.getByTestId("down")).toHaveTextContent("−0.77%")
    await expect.element(screen.getByTestId("down")).toHaveAttribute("data-direction", "down")
    await expect.element(screen.getByTestId("flat")).toHaveTextContent("0.00%")
    await expect.element(screen.getByTestId("flat")).toHaveAttribute("data-direction", "flat")
  })

  it("puts the amount before the percent", async () => {
    const screen = await render(<PriceChange value={1.83} amount={220.4} />)
    await expect.element(screen.getByText("+$220.40 (+1.83%)")).toBeVisible()
  })

  it("draws an arrow for up and down, a dash for flat", async () => {
    const screen = await render(<PriceChange value={-2} data-testid="change" />)
    expect(screen.getByTestId("change").element().querySelector("svg")).not.toBeNull()
    expect(priceDirection(0.005)).toBe("up")
    expect(priceDirection(-0.004)).toBe("flat")
  })

  it("shows a new price", async () => {
    const screen = await render(<Price price={181.42} change={1.86} />)
    await expect.element(screen.getByText("$181.42")).toBeVisible()
    await screen.rerender(<Price price={183} change={2.75} />)
    await expect.element(screen.getByText("$183.00")).toBeVisible()
  })
})
