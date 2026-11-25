import { AllocationBar, allocationText, capState } from "@bluechip/ui/bluechip/allocation-bar"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("capState", () => {
  it("is under more than one point below the max", () => {
    expect(capState(28.9, 30)).toBe("under")
  })

  it("is at the max from one point below it", () => {
    expect(capState(29, 30)).toBe("at")
  })

  it("is at the max on it", () => {
    expect(capState(30, 30)).toBe("at")
  })

  it("is still at the max a rounding error past it", () => {
    expect(capState(30.04, 30)).toBe("at")
  })

  it("is over a tenth of a point past the max", () => {
    expect(capState(30.1, 30)).toBe("over")
  })
})

describe("allocationText", () => {
  it("a stock under its max", () => {
    expect(allocationText({ weight: 22, cap: 30, projected: undefined, cash: false })).toBe(
      "22.0% of your money, max 30%"
    )
  })

  it("a stock at its max", () => {
    expect(allocationText({ weight: 29.6, cap: 30, projected: undefined, cash: false })).toBe(
      "29.6% of your money, at your 30% max"
    )
  })

  it("a stock over its max", () => {
    expect(allocationText({ weight: 36, cap: 30, projected: undefined, cash: false })).toBe(
      "36.0% of your money, 6.0% over your 30% max"
    )
  })

  it("a blocked trade's would-be weight", () => {
    expect(allocationText({ weight: 17.5, cap: 30, projected: 41, cash: false })).toBe(
      "17.5% of your money now, would be 41.0%, your max is 30%"
    )
  })

  it("cash against the reserve", () => {
    expect(allocationText({ weight: 8, cap: 10, projected: undefined, cash: true })).toBe(
      "8.0% in cash, keep at least 10%"
    )
  })
})

describe("AllocationBar", () => {
  it("is a meter named for the stock, reading its weight to one decimal", async () => {
    const screen = await render(<AllocationBar weight={36.04} cap={30} label="Nvidia" />)
    const meter = screen.getByRole("meter", { name: "Nvidia" })
    await expect.element(meter).toHaveAttribute("aria-valuenow", "36")
    await expect.element(meter).toHaveAttribute("aria-valuetext", "36.0% of your money, 6.0% over your 30% max")
    await expect.element(meter).toHaveAttribute("data-state", "over")
  })

  it("is named Share of your money without a label", async () => {
    const screen = await render(<AllocationBar weight={22} cap={30} />)
    await expect.element(screen.getByRole("meter", { name: "Share of your money" })).toBeInTheDocument()
  })

  it("is over when a blocked trade would take it past the max", async () => {
    const screen = await render(<AllocationBar weight={17.5} projected={41} cap={30} label="Tesla" />)
    await expect.element(screen.getByRole("meter", { name: "Tesla" })).toHaveAttribute("data-state", "over")
  })

  it("is in the cash state for cash, whatever its weight", async () => {
    const screen = await render(<AllocationBar weight={8} cap={10} cash label="Cash" />)
    await expect.element(screen.getByRole("meter", { name: "Cash" })).toHaveAttribute("data-state", "cash")
  })
})
