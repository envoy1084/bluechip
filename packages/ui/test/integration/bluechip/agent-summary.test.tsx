import { AgentSummary } from "@bluechip/ui/bluechip/agent-summary"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

const NIMBUS = {
  agentId: "nimbus",
  name: "Nimbus",
  state: "active",
  does: "Buys and sells Nvidia and Apple",
  spentToday: 50,
  dailyBudget: 250,
  tradesToday: 1,
  tradesPerDay: 12,
  lockedUntil: "21 Feb"
} as const

describe("AgentSummary", () => {
  it("counts today's trades against the most it may make", async () => {
    const screen = await render(<AgentSummary {...NIMBUS} />)
    await expect.element(screen.getByText("1 of 12")).toBeVisible()
  })

  it("says its last trade", async () => {
    const screen = await render(<AgentSummary {...NIMBUS} lastTrade="Bought $50.00 of Apple at 09:41" />)
    await expect.element(screen.getByText("Last: bought $50.00 of Apple at 09:41")).toBeVisible()
  })

  it("says when it hasn't traded yet", async () => {
    const screen = await render(<AgentSummary {...NIMBUS} />)
    await expect.element(screen.getByText("No trades yet.")).toBeVisible()
  })

  it("a budget used up says when it starts again", async () => {
    const screen = await render(<AgentSummary {...NIMBUS} spentToday={250} resetsAt="midnight UTC" />)
    await expect.element(screen.getByText("Limit reached. Resets at midnight UTC.")).toBeVisible()
  })

  it("a sell-only agent has no budget to spend", async () => {
    const screen = await render(<AgentSummary {...NIMBUS} dailyBudget={0} spentToday={0} />)
    await expect.element(screen.getByText("It only sells")).toBeVisible()
  })
})
