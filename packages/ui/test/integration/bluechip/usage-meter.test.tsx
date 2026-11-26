import { UsageBar, usageLevel, UsageMeter } from "@bluechip/ui/bluechip/usage-meter"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("usageLevel", () => {
  it("just under 80% used", () => {
    expect(usageLevel(159, 200)).toBe("normal")
  })

  it("80% used", () => {
    expect(usageLevel(160, 200)).toBe("near")
  })

  it("just under all used", () => {
    expect(usageLevel(199, 200)).toBe("near")
  })

  it("all used", () => {
    expect(usageLevel(200, 200)).toBe("full")
  })

  it("more than all used", () => {
    expect(usageLevel(210, 200)).toBe("full")
  })

  it("a limit of $0", () => {
    expect(usageLevel(0, 0)).toBe("full")
  })
})

describe("UsageMeter", () => {
  const noteOf = (container: HTMLElement) => container.querySelector("[data-slot=usage-meter-note]")?.textContent

  it("is a meter of what's spent against the limit", async () => {
    const screen = await render(<UsageMeter used={140} limit={200} />)
    await expect.element(screen.getByRole("meter", { name: "Spent today" })).toHaveAttribute(
      "aria-valuetext",
      "$140 of $200"
    )
  })

  it("says what's left today", async () => {
    const screen = await render(<UsageMeter used={140} limit={200} />)
    expect(noteOf(screen.container)).toBe("$60 left today")
  })

  it("follows a new amount spent", async () => {
    const screen = await render(<UsageMeter used={140} limit={200} />)
    await screen.rerender(<UsageMeter used={170} limit={200} />)
    await expect.element(screen.getByText("$30", { exact: true })).toBeInTheDocument()
  })

  it("says when it resets once the limit is reached", async () => {
    const screen = await render(<UsageMeter used={200} limit={200} />)
    expect(noteOf(screen.container)).toBe("Limit reached. Resets at midnight UTC.")
  })

  it("says the reset time it's given", async () => {
    const screen = await render(<UsageMeter used={200} limit={200} resetsAt="09:30 tomorrow" />)
    expect(noteOf(screen.container)).toBe("Limit reached. Resets at 09:30 tomorrow.")
  })

  it("stops the meter at the limit when spending passed it", async () => {
    const screen = await render(<UsageMeter used={210} limit={200} />)
    await expect.element(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "200")
  })

  it("is named for what it measures", async () => {
    const screen = await render(<UsageMeter used={3} limit={10} label="Trades today" />)
    await expect.element(screen.getByRole("meter", { name: "Trades today" })).toBeInTheDocument()
  })
})

describe("UsageBar", () => {
  it("is a meter when it has a name", async () => {
    const screen = await render(<UsageBar used={3} limit={10} label="Trades today" valueText="3 of 10" />)
    await expect.element(screen.getByRole("meter", { name: "Trades today" })).toHaveAttribute(
      "aria-valuetext",
      "3 of 10"
    )
  })

  it("is hidden without a name", async () => {
    const screen = await render(<UsageBar used={3} limit={10} />)
    expect(screen.container.querySelector("[role=meter]")).toBeNull()
  })

  it("marks how much of the day has gone", async () => {
    const screen = await render(<UsageBar used={3} limit={10} dayGone={0.25} />)
    const tick = screen.container.querySelector<HTMLElement>("[data-slot=usage-bar-day]")
    expect(tick?.style.left).toBe("25%")
  })
})
