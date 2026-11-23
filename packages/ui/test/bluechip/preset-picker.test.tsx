import { PresetPicker } from "@bluechip/ui/bluechip/preset-picker"
import type { LimitPreset } from "@bluechip/ui/lib/agent-limits"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("PresetPicker", () => {
  it("selects a preset and reports its values", async () => {
    const picked: Array<LimitPreset> = []
    const screen = await render(
      <PresetPicker defaultValue="balanced" onValueChange={(preset) => picked.push(preset)} />
    )
    await expect.element(screen.getByRole("radio", { name: /Balanced/ })).toHaveAttribute("aria-checked", "true")
    await userEvent.click(screen.getByRole("radio", { name: /Active/ }))
    await expect.element(screen.getByRole("radio", { name: /Active/ })).toHaveAttribute("aria-checked", "true")
    expect(picked.map(({ name, limits }) => ({ name, limits }))).toEqual([{
      name: "active",
      limits: { dailySpend: 1000, maxPerTrade: 400, maxInOneStock: 40, cashReserve: 5, approveAbove: 500 }
    }])
  })

  it("selects none when the limits are custom", async () => {
    const screen = await render(<PresetPicker value={null} />)
    for (const name of ["Conservative", "Balanced", "Active"]) {
      await expect.element(screen.getByRole("radio", { name: new RegExp(name) })).toHaveAttribute(
        "aria-checked",
        "false"
      )
    }
  })
})
