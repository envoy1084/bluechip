import { AgentControlCard } from "@bluechip/ui/bluechip/agent-control-card"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const noop = () => {}

describe("AgentControlCard", () => {
  it("asks to pause, naming the agent and that nothing is sold", async () => {
    const screen = await render(
      <AgentControlCard
        action="pause"
        agentName="Nimbus"
        status="pending"
        busy={null}
        onConfirm={noop}
        onDismiss={noop}
      />
    )
    await expect.element(screen.getByText("It stops trading right away. Nothing is sold.")).toBeVisible()
    await expect.element(screen.getByRole("button", { name: "Pause Nimbus" })).toBeEnabled()
  })

  it("confirms with its own action", async () => {
    let confirmed = 0
    const screen = await render(
      <AgentControlCard
        action="resume"
        agentName="Nimbus"
        status="pending"
        busy={null}
        onConfirm={() => confirmed++}
        onDismiss={noop}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Resume Nimbus" }))
    expect(confirmed).toBe(1)
  })

  it("holds both answers while one is on its way", async () => {
    const screen = await render(
      <AgentControlCard
        action="pause"
        agentName="Nimbus"
        status="pending"
        busy="confirm"
        onConfirm={noop}
        onDismiss={noop}
      />
    )
    await expect.element(screen.getByRole("button", { name: "Not now" })).toBeDisabled()
  })

  it("once applied, says what it did and asks nothing", async () => {
    const screen = await render(
      <AgentControlCard
        action="pauseAll"
        agentName={null}
        status="applied"
        busy={null}
        onConfirm={noop}
        onDismiss={noop}
      />
    )
    await expect.element(screen.getByRole("heading", { name: "Every agent is paused" })).toBeVisible()
    await expect.element(screen.getByRole("button")).not.toBeInTheDocument()
  })

  it("once dismissed, says it left the agent as it was", async () => {
    const screen = await render(
      <AgentControlCard
        action="pause"
        agentName="Nimbus"
        status="dismissed"
        busy={null}
        onConfirm={noop}
        onDismiss={noop}
      />
    )
    await expect.element(screen.getByText("You left it as it was.")).toBeVisible()
  })

  it("says why an answer didn't go", async () => {
    const screen = await render(
      <AgentControlCard
        action="pause"
        agentName="Nimbus"
        status="pending"
        busy={null}
        problem="We couldn't reach bluechip just now. Nothing changed, so try again."
        onConfirm={noop}
        onDismiss={noop}
      />
    )
    await expect.element(screen.getByText("We couldn't reach bluechip just now. Nothing changed, so try again."))
      .toBeVisible()
  })
})
