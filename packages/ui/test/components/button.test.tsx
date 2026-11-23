import { Button } from "@bluechip/ui/components/button"
import { HAPTIC_EVENT } from "@bluechip/ui/lib/haptics"
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

  it("plays its haptic and still calls onClick", async () => {
    let presses = 0
    const played: Array<unknown> = []
    const listen = (event: Event) => played.push((event as CustomEvent).detail)
    window.addEventListener(HAPTIC_EVENT, listen)
    try {
      const screen = await render(<Button haptic="success" onClick={() => presses++}>Approve</Button>)
      await userEvent.click(screen.getByRole("button", { name: "Approve" }))
      expect(presses).toBe(1)
      expect(played).toEqual(["success"])
    } finally {
      window.removeEventListener(HAPTIC_EVENT, listen)
    }
  })
})
