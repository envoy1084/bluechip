import { PolicyRow } from "@bluechip/ui/bluechip/policy-row"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("PolicyRow", () => {
  it("folds to its summary until Edit opens its editor", async () => {
    const screen = await render(
      <PolicyRow title="Trade size" summary="Trade up to $100 at a time.">
        <label>
          Ask me above <input />
        </label>
      </PolicyRow>
    )
    await expect.element(screen.getByText("Trade up to $100 at a time.")).toBeVisible()
    await expect.element(screen.getByRole("textbox", { name: "Ask me above" })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /^Trade size/ }))

    await expect.element(screen.getByRole("textbox", { name: "Ask me above" })).toBeVisible()
  })

  it("a problem keeps it open and says what to fix", async () => {
    const screen = await render(
      <PolicyRow title="Trade size" summary="Trade up to $100 at a time." problem="Pick $10 to $1,000.">
        <label>
          Ask me above <input />
        </label>
      </PolicyRow>
    )
    await expect.element(screen.getByText("Pick $10 to $1,000.")).toBeVisible()
    await expect.element(screen.getByRole("textbox", { name: "Ask me above" })).toBeVisible()
  })

  it("a rule it doesn't carry doesn't open", async () => {
    const screen = await render(
      <PolicyRow
        off
        title="Cash reserve"
        summary="Keeps some cash."
        control={<input type="checkbox" aria-label="Cash reserve" />}
      >
        <label>
          Cash reserve percent <input />
        </label>
      </PolicyRow>
    )
    await expect.element(screen.getByRole("button", { name: /^Cash reserve/ })).toBeDisabled()
    await expect.element(screen.getByRole("checkbox", { name: "Cash reserve" })).toBeVisible()
  })
})
