import { TextMorph } from "@bluechip/ui/components/text-morph"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("TextMorph", () => {
  it("ends on the new text, and reads it as plain text", async () => {
    const screen = await render(<TextMorph>Approve</TextMorph>)
    await expect.element(screen.getByText("Approve", { exact: true })).toBeInTheDocument()
    await screen.rerender(<TextMorph>Approving…</TextMorph>)
    await expect.element(screen.getByText("Approving…", { exact: true })).toBeInTheDocument()
    await screen.rerender(<TextMorph>Approved</TextMorph>)
    await expect.element(screen.getByText("Approved", { exact: true })).toBeInTheDocument()
    expect(screen.container.textContent).not.toContain("Approving")
  })

  it("renders the element it's given", async () => {
    const screen = await render(<TextMorph as="h3">Filled</TextMorph>)
    await expect.element(screen.getByRole("heading", { name: "Filled" })).toBeInTheDocument()
  })

  it("shows anything that isn't text as it is", async () => {
    const screen = await render(
      <TextMorph>
        <b>Account created</b>
      </TextMorph>
    )
    await expect.element(screen.getByText("Account created")).toBeVisible()
  })
})
