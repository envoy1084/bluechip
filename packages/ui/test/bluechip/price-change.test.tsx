import { Price, PriceChange, priceDirection } from "@bluechip/ui/bluechip/price-change"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

const textOf = (container: HTMLElement, slot: string) => container.querySelector(`[data-slot=${slot}]`)?.textContent

describe("priceDirection", () => {
  it("a rise", () => {
    expect(priceDirection(1.86)).toBe("up")
  })

  it("a fall", () => {
    expect(priceDirection(-0.77)).toBe("down")
  })

  it("a rise that rounds up to 0.01", () => {
    expect(priceDirection(0.005)).toBe("up")
  })

  it("a rise that rounds to 0.00", () => {
    expect(priceDirection(0.004)).toBe("flat")
  })

  it("a fall that rounds to 0.00", () => {
    expect(priceDirection(-0.004)).toBe("flat")
  })

  it("a fall that shows as −0.01%", () => {
    expect(priceDirection(-0.005)).toBe("down")
  })

  it("a rise that shows as +0.01%", () => {
    expect(priceDirection(0.005)).toBe("up")
  })
})

describe("PriceChange", () => {
  it("signs a rise and marks it up", async () => {
    const screen = await render(<PriceChange value={1.86} />)
    expect(textOf(screen.container, "price-change")).toBe("+1.86%")
    expect(screen.container.querySelector("[data-slot=price-change]")?.getAttribute("data-direction")).toBe("up")
  })

  it("signs a fall with a true minus and marks it down", async () => {
    const screen = await render(<PriceChange value={-0.77} />)
    expect(textOf(screen.container, "price-change")).toBe("−0.77%")
    expect(screen.container.querySelector("[data-slot=price-change]")?.getAttribute("data-direction")).toBe("down")
  })

  it("leaves a change that rounds to zero unsigned and flat", async () => {
    const screen = await render(<PriceChange value={0.004} />)
    expect(textOf(screen.container, "price-change")).toBe("0.00%")
    expect(screen.container.querySelector("[data-slot=price-change]")?.getAttribute("data-direction")).toBe("flat")
  })

  it("shows a fall of −0.005 as −0.01%, marked down", async () => {
    const screen = await render(<PriceChange value={-0.005} />)
    expect(textOf(screen.container, "price-change")).toBe("−0.01%")
    expect(screen.container.querySelector("[data-slot=price-change]")?.getAttribute("data-direction")).toBe("down")
  })

  it("puts the amount before the percent", async () => {
    const screen = await render(<PriceChange value={1.83} amount={220.4} />)
    expect(textOf(screen.container, "price-change")).toBe("+$220.40 (+1.83%)")
  })
})

describe("Price", () => {
  it("shows the price alone when the change isn't known", async () => {
    const screen = await render(<Price price={181.42} />)
    expect(textOf(screen.container, "price")).toBe("$181.42")
  })

  it("shows the price with its change", async () => {
    const screen = await render(<Price price={181.42} change={1.86} changeAmount={3.31} />)
    expect(textOf(screen.container, "price")).toBe("$181.42+$3.31 (+1.86%)")
  })

  it("shows a new price", async () => {
    const screen = await render(<Price price={181.42} change={1.86} />)
    await screen.rerender(<Price price={183} change={2.75} />)
    await expect.element(screen.getByText("$183.00", { exact: true })).toBeInTheDocument()
  })
})
