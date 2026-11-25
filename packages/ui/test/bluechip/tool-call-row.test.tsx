import { ToolCallRow } from "@bluechip/ui/bluechip/tool-call-row"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("ToolCallRow", () => {
  it("announces each state and shows the result only when done", async () => {
    const screen = await render(<ToolCallRow state="running" label="Checking Nvidia's price…" result="$181.42" />)
    const row = screen.getByRole("status")
    await expect.element(row).toHaveTextContent("Running: Checking Nvidia's price…")
    await expect.element(screen.getByText("$181.42")).not.toBeInTheDocument()

    await screen.rerender(<ToolCallRow state="done" label="Checked Nvidia's price" result="$181.42" />)
    await expect.element(row).toHaveTextContent("Done: Checked Nvidia's price$181.42")

    await screen.rerender(<ToolCallRow state="failed" label="Couldn't check Tesla's price, market closed" />)
    await expect.element(row).toHaveTextContent("Failed: Couldn't check Tesla's price, market closed")
  })
})
