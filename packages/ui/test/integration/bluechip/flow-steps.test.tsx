import { FlowSteps } from "@bluechip/ui/bluechip/flow-steps"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("FlowSteps", () => {
  it("marks the step you're on as the current one", async () => {
    const screen = await render(<FlowSteps steps={["Start", "Rules", "Review"]} current={1} />)
    await expect.element(screen.getByRole("listitem").nth(1)).toHaveAttribute("aria-current", "step")
  })

  it("says which steps are done to screen readers", async () => {
    const screen = await render(<FlowSteps steps={["Start", "Rules", "Review"]} current={1} />)
    expect(screen.getByRole("listitem").elements().map((step) => step.textContent)).toStrictEqual([
      "Start, done",
      "Rules, current step",
      "Review"
    ])
  })

  it("names the step and how far along it is", async () => {
    const screen = await render(<FlowSteps steps={["Start", "Rules", "Review"]} current={2} />)
    await expect.element(screen.getByText(/^Step 3 of 3, Review$/)).toBeVisible()
  })
})
