import { AgentStatus } from "@bluechip/ui/bluechip/agent-status"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("StatusPill", () => {
  it("says its state, with its tone", async () => {
    const screen = await render(<StatusPill tone="positive">Filled</StatusPill>)
    const pill = screen.container.querySelector("[data-slot=status-pill]")

    expect(pill?.textContent).toBe("Filled")
    expect(pill?.getAttribute("data-tone")).toBe("positive")
  })

  it("an icon, which takes the dot's place", async () => {
    const screen = await render(<StatusPill tone="pending" icon="clock" dot>Sending</StatusPill>)

    expect(screen.container.querySelectorAll("svg").length).toBe(1)
    expect(screen.container.querySelectorAll("i").length).toBe(0)
  })

  it("a live dot", async () => {
    const screen = await render(<StatusPill tone="positive" dot="live">Active</StatusPill>)

    expect(screen.container.querySelectorAll("i").length).toBe(2)
  })
})

describe("AgentStatus", () => {
  it("a draft not locked yet", async () => {
    const screen = await render(<AgentStatus state="unlocked" />)

    await expect.element(screen.getByText("Not locked yet")).toBeInTheDocument()
  })

  it("a change on its way to Base", async () => {
    const screen = await render(<AgentStatus state="sending" />)

    await expect.element(screen.getByText("On its way")).toBeInTheDocument()
  })

  it("one whose limits ran out", async () => {
    const screen = await render(<AgentStatus state="expired" />)

    await expect.element(screen.getByText("Ran out")).toBeInTheDocument()
  })
})
