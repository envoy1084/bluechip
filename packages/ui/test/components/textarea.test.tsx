import { Textarea } from "@bluechip/ui/components/textarea"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("Textarea", () => {
  it("counts characters as you type", async () => {
    const screen = await render(
      <Textarea aria-label="Tell your agent what to do" limit={20} defaultValue="Rebalance" />
    )
    await expect.element(screen.getByText("9 / 20")).toBeVisible()
    await userEvent.type(screen.getByRole("textbox"), " weekly")
    await expect.element(screen.getByText("16 / 20")).toBeVisible()
  })

  it("marks the field invalid past the limit", async () => {
    const screen = await render(<Textarea aria-label="Tell your agent what to do" limit={10} />)
    const textarea = screen.getByRole("textbox")
    await userEvent.type(textarea, "Buy every stock")
    await expect.element(screen.getByText("15 / 10")).toHaveAttribute("data-over")
    await expect.element(textarea).toHaveAttribute("aria-invalid", "true")
  })
})
