import { AllocationDonut, type AllocationSlice, offTarget } from "@bluechip/ui/bluechip/allocation-donut"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const SLICES: ReadonlyArray<AllocationSlice> = [
  { id: "NVDA", label: "Nvidia", current: 42, target: 35 },
  { id: "AAPL", label: "Apple", current: 30, target: 35 },
  { id: "cash", label: "Cash", current: 28, target: 30 }
]

describe("AllocationDonut", () => {
  it("measures how far the mix is from its target", () => {
    expect(offTarget(SLICES)).toBe(7)
    expect(offTarget([{ id: "a", label: "A", current: 50, target: 50 }])).toBe(0)
  })

  it("lists every slice against its target in the legend", async () => {
    const screen = await render(<AllocationDonut slices={SLICES} />)
    await expect.element(screen.getByText("7.0%")).toBeVisible()
    await expect.element(screen.getByText("Time to rebalance")).toBeVisible()
    const legend = screen.getByRole("list", { name: "Your mix against your target" })
    await expect.element(legend.getByRole("button", { name: /Nvidia/ })).toHaveTextContent("Nvidia42.0%target 35%+7.0")
    await expect.element(legend.getByRole("button", { name: /Apple/ })).toHaveTextContent("Apple30.0%target 35%−5.0")
  })

  it("shows the mix alone when there are no targets", async () => {
    const mix = SLICES.map(({ current, id, label }) => ({ id, label, current }))
    const screen = await render(<AllocationDonut slices={mix} />)
    await expect.element(screen.getByText("Biggest")).toBeVisible()
    const legend = screen.getByRole("list", { name: "Your mix" })
    await expect.element(legend.getByRole("button", { name: /Nvidia/ })).toHaveTextContent("Nvidia42.0%")
  })

  it("keeps a slice isolated when its legend row is pressed", async () => {
    const screen = await render(<AllocationDonut slices={SLICES} />)
    const apple = screen.getByRole("button", { name: /Apple/ })
    await userEvent.click(apple)
    await expect.element(apple).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(apple)
    await expect.element(apple).toHaveAttribute("aria-pressed", "false")
  })
})
