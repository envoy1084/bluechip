import { ChatMessage } from "@bluechip/ui/bluechip/chat-message"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("ChatMessage", () => {
  it("shows typing dots, then streamed text with a caret, then the finished answer", async () => {
    const screen = await render(<ChatMessage from="bluechip" status="streaming" />)
    await expect.element(screen.getByRole("status", { name: "bluechip is typing" })).toBeInTheDocument()

    await screen.rerender(<ChatMessage from="bluechip" status="streaming" text="Nvidia is **$181.42**" />)
    await expect.element(screen.getByRole("status", { name: "bluechip is typing" })).not.toBeInTheDocument()
    expect(screen.container.querySelector("[data-slot=chat-caret]")).not.toBeNull()

    await screen.rerender(<ChatMessage from="bluechip" text="Nvidia is **$181.42**, up 1.86% today." />)
    await expect.element(screen.getByText("$181.42")).toBeVisible()
    expect(screen.container.querySelector("[data-slot=chat-caret]")).toBeNull()
    expect(screen.container.querySelector("[data-slot=chat-message]")?.getAttribute("aria-busy")).toBeNull()
  })

  it("renders lists, ticker chips and numbered sources", async () => {
    const screen = await render(
      <ChatMessage
        from="bluechip"
        text={"Here's where you stand:\n- [[NVDA]] Nvidia is **28.5%** of your money.[^1]\n- Your max is 30%."}
        sources={[{ kind: "Account", from: "Your portfolio", title: "Holdings and limits", when: "Right now" }]}
      />
    )
    await expect.element(screen.getByRole("listitem")).toHaveLength(2)
    await expect.element(screen.getByText("NVDA", { exact: true })).toBeVisible()
    await expect.element(screen.getByRole("button", { name: "Source 1: Your portfolio" })).toBeVisible()
  })

  it("says what went wrong and offers a retry", async () => {
    let retried = 0
    const screen = await render(
      <ChatMessage from="bluechip" status="error" error="I couldn't reach prices just now." onRetry={() => retried++} />
    )
    await screen.getByRole("button", { name: "Retry" }).click()
    expect(retried).toBe(1)
  })
})
