import { Checkbox } from "@bluechip/ui/components/checkbox"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("Checkbox", () => {
  it("reports a mixed state when indeterminate", async () => {
    const screen = await render(<Checkbox aria-label="Stocks this agent can trade" indeterminate />)
    await expect.element(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "mixed")
  })

  it("turns fully on when an indeterminate checkbox is pressed", async () => {
    let checked: boolean | undefined
    const screen = await render(
      <Checkbox
        aria-label="Stocks this agent can trade"
        indeterminate
        onCheckedChange={(next) => (checked = next)}
      />
    )
    screen.getByRole("checkbox").element().focus()
    await userEvent.keyboard(" ")
    expect(checked).toBe(true)
  })

  it("toggles with the Space key", async () => {
    const screen = await render(<Checkbox aria-label="Email me a receipt" />)
    const checkbox = screen.getByRole("checkbox")
    checkbox.element().focus()
    await userEvent.keyboard(" ")
    await expect.element(checkbox).toBeChecked()
    await userEvent.keyboard(" ")
    await expect.element(checkbox).not.toBeChecked()
  })
})
