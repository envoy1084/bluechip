import { type AgentTemplate, TemplatePicker } from "@bluechip/ui/bluechip/template-picker"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("TemplatePicker", () => {
  it("moves and selects with the arrow keys", async () => {
    const picked: Array<AgentTemplate["name"]> = []
    const screen = await render(
      <TemplatePicker defaultValue="rebalancer" onValueChange={(template) => picked.push(template.name)} />
    )
    await userEvent.click(screen.getByRole("radio", { name: "Rebalancer" }))
    await userEvent.keyboard("{ArrowDown}")
    await expect.element(screen.getByRole("radio", { name: "Stock picker" })).toHaveFocus()
    await expect.element(screen.getByRole("radio", { name: "Stock picker" })).toHaveAttribute("aria-checked", "true")
    await userEvent.keyboard("{ArrowDown}{ArrowDown}")
    await expect.element(screen.getByRole("radio", { name: "Stop-loss guard" })).toHaveAttribute("aria-checked", "true")
    expect(picked).toEqual(["stock-picker", "weekly-buyer", "stop-loss-guard"])
  })

  it("describes each template with its promise", async () => {
    const screen = await render(<TemplatePicker />)
    await expect.element(screen.getByRole("radio", { name: "Weekly buyer" })).toHaveAccessibleDescription(
      "Buys a set amount on a schedule, like $50 every Monday."
    )
  })
})
