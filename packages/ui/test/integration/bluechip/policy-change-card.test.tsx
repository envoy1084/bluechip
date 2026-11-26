import { PolicyChangeCard } from "@bluechip/ui/bluechip/policy-change-card"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("PolicyChangeCard", () => {
  it("says each changed setting before and after", async () => {
    const screen = await render(
      <PolicyChangeCard
        action="update"
        agentId="agent_01jd8v4t5m6n7a8q9r0s1t2v3w"
        name="Nimbus"
        note="Its new rules are locked onchain once you approve."
        changes={[{
          title: "Stocks and direction",
          change: "tighter",
          fields: [{ label: "Daily budget", before: "$250", after: "$100" }]
        }]}
        state="Waiting for Face ID"
        footer={null}
      />
    )
    await expect.element(screen.getByText("Daily budget: $250 → $100")).toBeVisible()
    await expect.element(screen.getByText("Tighter")).toBeVisible()
  })

  it("says a new rule's setting with no before", async () => {
    const screen = await render(
      <PolicyChangeCard
        action="update"
        agentId="agent_01jd8v4t5m6n7a8q9r0s1t2v3w"
        name="Nimbus"
        note="Its new rules are locked onchain once you approve."
        changes={[{ title: "Trades a day", change: "added", fields: [{ label: "Trades", before: null, after: "5" }] }]}
        state="Waiting for Face ID"
        footer={null}
      />
    )
    await expect.element(screen.getByText("Trades: 5")).toBeVisible()
  })

  it("warns only when the change gives the agent more room", async () => {
    const screen = await render(
      <PolicyChangeCard
        action="update"
        agentId="agent_01jd8v4t5m6n7a8q9r0s1t2v3w"
        name="Nimbus"
        note="Its new rules are locked onchain once you approve."
        changes={[{ title: "Trade size", change: "tighter" }]}
        state="Waiting for Face ID"
        footer={null}
      />
    )
    await expect.element(screen.getByText("Tighter")).toBeVisible()
    await expect.element(screen.getByText("This gives the agent more room than it has now.")).not.toBeInTheDocument()
  })
})
