import { type AgentTemplate, TemplatePicker } from "@bluechip/ui/bluechip/template-picker"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("TemplatePicker", () => {
  it("checks its default template", async () => {
    const screen = await render(<TemplatePicker defaultValue="rebalancer" />)
    await expect.element(screen.getByRole("radio", { name: "Rebalancer" })).toBeChecked()
  })

  it("reports the template you pick", async () => {
    const picked: Array<AgentTemplate> = []
    const screen = await render(<TemplatePicker onValueChange={(template) => picked.push(template)} />)
    await userEvent.click(screen.getByRole("radio", { name: "Weekly buyer" }))
    expect(picked).toStrictEqual([{
      name: "weekly-buyer",
      label: "Weekly buyer",
      promise: "Buys a set amount on a schedule, like $50 every Monday.",
      rule: "Buy only",
      illustration: "calendar"
    }])
  })

  it("describes each template with its promise", async () => {
    const screen = await render(<TemplatePicker />)
    await expect.element(screen.getByRole("radio", { name: "Stop-loss guard" })).toHaveAccessibleDescription(
      "Sells a stock for you if it falls too far."
    )
  })

  it("shows each template's defining rule", async () => {
    const screen = await render(<TemplatePicker />)
    await expect.element(screen.getByRole("radio", { name: "Rebalancer" })).toHaveTextContent(
      "RebalancerKeeps your mix on target. It can only trade to move you back.Rebalance only"
    )
  })
})
