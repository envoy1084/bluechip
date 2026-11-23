import { AllocationBar, capState } from "@bluechip/ui/bluechip/allocation-bar"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("capState", () => {
  it("is at the max within one point below it, over once past it", () => {
    expect(capState(22, 30)).toBe("under")
    expect(capState(29.6, 30)).toBe("at")
    expect(capState(30, 30)).toBe("at")
    expect(capState(36, 30)).toBe("over")
  })
})

describe("AllocationBar", () => {
  it("states both numbers when a stock is over the max", async () => {
    const screen = await render(<AllocationBar weight={36} cap={30} label="Nvidia" />)
    const meter = screen.getByRole("meter", { name: "Nvidia" })
    await expect.element(meter).toHaveAttribute("data-state", "over")
    await expect.element(meter).toHaveAttribute("aria-valuenow", "36")
    await expect.element(meter).toHaveAttribute("aria-valuetext", "36.0% of your money, 6.0% over your 30% max")
  })

  it("reads the would-be weight of a blocked trade", async () => {
    const screen = await render(<AllocationBar weight={17.5} projected={41} cap={30} label="Tesla" />)
    await expect.element(screen.getByRole("meter", { name: "Tesla" })).toHaveAttribute(
      "aria-valuetext",
      "17.5% of your money now, would be 41.0%, your max is 30%"
    )
  })
})
