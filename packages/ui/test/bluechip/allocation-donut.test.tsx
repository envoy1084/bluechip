import {
  AllocationDonut,
  type AllocationSlice,
  offTarget,
  offTargetAdvice,
  targetGap
} from "@bluechip/ui/bluechip/allocation-donut"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const SLICES: ReadonlyArray<AllocationSlice> = [
  { id: "NVDA", label: "Nvidia", current: 42, target: 35 },
  { id: "AAPL", label: "Apple", current: 30, target: 35 },
  { id: "cash", label: "Cash", current: 28, target: 30 }
]

const MIX: ReadonlyArray<AllocationSlice> = [
  { id: "NVDA", label: "Nvidia", current: 42 },
  { id: "AAPL", label: "Apple", current: 30 },
  { id: "cash", label: "Cash", current: 28 }
]

describe("offTarget", () => {
  it("is half the sum of the gaps", () => {
    expect(offTarget(SLICES)).toBe(7)
  })

  it("is 0 for a mix on its target", () => {
    expect(offTarget([{ id: "NVDA", label: "Nvidia", current: 50, target: 50 }])).toBe(0)
  })

  it("counts a slice without a target as on target", () => {
    expect(offTarget(MIX)).toBe(0)
  })
})

describe("offTargetAdvice", () => {
  it("under 1% off", () => {
    expect(offTargetAdvice(0.9)).toBe("On target")
  })

  it("1% off", () => {
    expect(offTargetAdvice(1)).toBe("Inside 5% band")
  })

  it("just under 5% off", () => {
    expect(offTargetAdvice(4.9)).toBe("Inside 5% band")
  })

  it("5% off", () => {
    expect(offTargetAdvice(5)).toBe("Time to rebalance")
  })
})

describe("targetGap", () => {
  it("a slice over its target", () => {
    expect(targetGap({ id: "NVDA", label: "Nvidia", current: 42, target: 35 })).toBe("+7.0")
  })

  it("a slice under its target", () => {
    expect(targetGap({ id: "AAPL", label: "Apple", current: 30, target: 35 })).toBe("−5.0")
  })

  it("a slice less than half a point off", () => {
    expect(targetGap({ id: "MSFT", label: "Microsoft", current: 20.4, target: 20 })).toBe("on target")
  })

  it("a slice half a point off", () => {
    expect(targetGap({ id: "MSFT", label: "Microsoft", current: 19.5, target: 20 })).toBe("−0.5")
  })
})

describe("AllocationDonut", () => {
  it("says how far off the mix is in the center", async () => {
    const screen = await render(<AllocationDonut slices={SLICES} />)
    await expect.element(screen.getByText("Off target")).toBeVisible()
    await expect.element(screen.getByText("7.0%")).toBeVisible()
    await expect.element(screen.getByText("Time to rebalance")).toBeVisible()
  })

  it("lists each slice against its target", async () => {
    const screen = await render(<AllocationDonut slices={SLICES} />)
    const legend = screen.getByRole("list", { name: "Your mix against your target" })
    await expect.element(legend.getByRole("button", { name: /Nvidia/ })).toHaveTextContent("Nvidia42.0%target 35%+7.0")
  })

  it("names the biggest slice in the center without targets", async () => {
    const screen = await render(<AllocationDonut slices={MIX} />)
    await expect.element(screen.getByText("Biggest")).toBeVisible()
    await expect.element(screen.getByText("Nvidia", { exact: true }).first()).toBeVisible()
  })

  it("lists the mix alone without targets", async () => {
    const screen = await render(<AllocationDonut slices={MIX} />)
    const legend = screen.getByRole("list", { name: "Your mix" })
    await expect.element(legend.getByRole("button", { name: /Nvidia/ })).toHaveTextContent("Nvidia42.0%")
  })

  it("keeps a slice isolated when you press its legend row", async () => {
    const screen = await render(<AllocationDonut slices={SLICES} />)
    const apple = screen.getByRole("button", { name: /Apple/ })
    await userEvent.click(apple)
    await expect.element(apple).toHaveAttribute("aria-pressed", "true")
  })

  it("lets a slice go when you press its row again", async () => {
    const screen = await render(<AllocationDonut slices={SLICES} />)
    const apple = screen.getByRole("button", { name: /Apple/ })
    await userEvent.click(apple)
    await userEvent.click(apple)
    await expect.element(apple).toHaveAttribute("aria-pressed", "false")
  })

  it("isolates one slice at a time", async () => {
    const screen = await render(<AllocationDonut slices={SLICES} />)
    await userEvent.click(screen.getByRole("button", { name: /Apple/ }))
    await userEvent.click(screen.getByRole("button", { name: /Nvidia/ }))
    await expect.element(screen.getByRole("button", { name: /Apple/ })).toHaveAttribute("aria-pressed", "false")
  })
})
