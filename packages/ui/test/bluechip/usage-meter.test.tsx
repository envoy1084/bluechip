import { usageLevel, UsageMeter } from "@bluechip/ui/bluechip/usage-meter"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("usageLevel", () => {
  it("turns near at 80% and full at 100%", () => {
    expect(usageLevel(159, 200)).toBe("normal")
    expect(usageLevel(160, 200)).toBe("near")
    expect(usageLevel(199, 200)).toBe("near")
    expect(usageLevel(200, 200)).toBe("full")
    expect(usageLevel(0, 0)).toBe("full")
  })
})

describe("UsageMeter", () => {
  it("says what's left, then when it resets", async () => {
    const screen = await render(<UsageMeter used={140} limit={200} />)
    await expect.element(screen.getByRole("meter", { name: "Spent today" })).toHaveAttribute(
      "aria-valuetext",
      "$140 of $200"
    )
    await expect.element(screen.getByText("$60 left today")).toBeVisible()

    await screen.rerender(<UsageMeter used={170} limit={200} />)
    await expect.element(screen.getByText("$30 left today")).toBeVisible()
    expect(screen.container.querySelector("[data-slot=usage-meter]")?.getAttribute("data-level")).toBe("near")

    await screen.rerender(<UsageMeter used={200} limit={200} />)
    await expect.element(screen.getByText("Limit reached. Resets at midnight New York time.")).toBeVisible()
    await expect.element(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "200")
  })
})
