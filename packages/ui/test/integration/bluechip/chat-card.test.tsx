import { ChatCard, ChatCardState } from "@bluechip/ui/bluechip/chat-card"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("ChatCardState", () => {
  it("inside a card: the state shows in the card's header, opposite its tag", async () => {
    const screen = await render(
      <ChatCard tag="Agent trade" icon="agent">
        <b>Buy $400.00 of NVIDIA</b>
        <ChatCardState>
          <span>Needs your approval</span>
        </ChatCardState>
      </ChatCard>
    )

    const header = screen.getByRole("region", { name: "Agent trade" }).element().querySelector("header")!
    expect(header.textContent).toContain("Needs your approval")
  })

  it("outside a card: the state stays where it is", async () => {
    const screen = await render(
      <div>
        <ChatCardState>
          <span>Needs your approval</span>
        </ChatCardState>
      </div>
    )

    await expect.element(screen.getByText("Needs your approval")).toBeVisible()
  })
})
