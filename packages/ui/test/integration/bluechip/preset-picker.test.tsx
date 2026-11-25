import { PresetPicker } from "@bluechip/ui/bluechip/preset-picker"
import type { LimitPreset } from "@bluechip/ui/lib/agent-limits"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("PresetPicker", () => {
  it("checks its default preset", async () => {
    const screen = await render(<PresetPicker defaultValue="balanced" />)
    await expect.element(screen.getByRole("radio", { name: /Balanced/ })).toBeChecked()
  })

  it("reports the preset you pick, with its values", async () => {
    const picked: Array<LimitPreset> = []
    const screen = await render(
      <PresetPicker defaultValue="balanced" onValueChange={(preset) => picked.push(preset)} />
    )
    await userEvent.click(screen.getByRole("radio", { name: /Active/ }))
    await expect.element(screen.getByRole("radio", { name: /Active/ })).toBeChecked()
    expect(picked).toStrictEqual([{
      name: "active",
      label: "Active",
      blurb: "More room, still capped",
      limits: { dailySpend: 1000, maxPerTrade: 400, maxInOneStock: 40, cashReserve: 5, approveAbove: 500 }
    }])
  })

  it("checks none when the limits are custom", async () => {
    const screen = await render(<PresetPicker value={null} />)
    expect(screen.getByRole("radio").elements().map((radio) => radio.getAttribute("aria-checked"))).toStrictEqual([
      "false",
      "false",
      "false"
    ])
  })

  it("shows each preset's blurb and values", async () => {
    const screen = await render(<PresetPicker />)
    expect(screen.getByRole("radio", { name: /Conservative/ }).element().textContent).toBe(
      "ConservativeSmall, careful trades$100a day$50per trade20%max in one"
    )
  })

  it("shows only the daily spend when compact", async () => {
    const screen = await render(<PresetPicker compact />)
    expect(screen.getByRole("radio", { name: /Conservative/ }).element().textContent).toBe("Conservative$100a day")
  })
})
