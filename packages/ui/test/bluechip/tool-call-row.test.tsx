import { ToolCallRow } from "@bluechip/ui/bluechip/tool-call-row"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

const announced = (screen: Awaited<ReturnType<typeof render>>) => screen.getByRole("status").element().textContent

describe("ToolCallRow", () => {
  it("announces a running check, without its result yet", async () => {
    const screen = await render(<ToolCallRow state="running" label="Checking Nvidia's price…" result="$181.42" />)
    expect(announced(screen)).toBe("Running: Checking Nvidia's price…")
  })

  it("announces a finished check with its result", async () => {
    const screen = await render(<ToolCallRow state="done" label="Checked Nvidia's price" result="$181.42" />)
    expect(announced(screen)).toBe("Done: Checked Nvidia's price$181.42")
  })

  it("announces a finished check that has no result", async () => {
    const screen = await render(<ToolCallRow state="done" label="Checked your limits" />)
    expect(announced(screen)).toBe("Done: Checked your limits")
  })

  it("announces a failed check, without a result", async () => {
    const screen = await render(
      <ToolCallRow state="failed" label="Couldn't check Tesla's price, market closed" result="$412.10" />
    )
    expect(announced(screen)).toBe("Failed: Couldn't check Tesla's price, market closed")
  })
})
