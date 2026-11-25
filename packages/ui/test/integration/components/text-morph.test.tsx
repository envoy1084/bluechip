import { TextMorph } from "@bluechip/ui/components/text-morph"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("TextMorph", () => {
  it("a string shows as its text", async () => {
    const screen = await render(<TextMorph>Approve</TextMorph>)
    await expect.element(screen.getByText("Approve", { exact: true })).toBeInTheDocument()
  })

  it("a number shows as its text", async () => {
    const screen = await render(<TextMorph>{42}</TextMorph>)
    await expect.element(screen.getByText("42", { exact: true })).toBeInTheDocument()
  })

  it("changing the text reads as the new text alone, while the letters morph", async () => {
    const screen = await render(<TextMorph as="h3">Approving…</TextMorph>)
    await screen.rerender(<TextMorph as="h3">Approved</TextMorph>)
    await expect.element(screen.getByRole("heading")).toHaveAccessibleName("Approved")
  })

  it("renders text in the element it's given", async () => {
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

  it("renders non-text children in the element it's given", async () => {
    const screen = await render(
      <TextMorph as="h3">
        <b>Account created</b>
      </TextMorph>
    )
    await expect.element(screen.getByRole("heading", { name: "Account created" })).toBeInTheDocument()
  })
})
