import { Button } from "@bluechip/ui/components/button"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("Button", () => {
  it("calls onClick when pressed", async () => {
    let presses = 0
    const screen = await render(<Button onClick={() => presses++}>Create agent</Button>)
    await userEvent.click(screen.getByRole("button", { name: "Create agent" }))
    expect(presses).toBe(1)
  })

  it("blocks presses and reports busy while loading", async () => {
    let presses = 0
    const screen = await render(<Button loading onClick={() => presses++}>Approve</Button>)
    const button = screen.getByRole("button")
    await expect.element(button).toHaveAttribute("aria-busy", "true")
    await expect.element(button).toBeDisabled()
    expect(presses).toBe(0)
  })
})
