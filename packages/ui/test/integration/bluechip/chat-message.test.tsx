import { ChatMessage } from "@bluechip/ui/bluechip/chat-message"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const PORTFOLIO = { kind: "Account", from: "Your portfolio", title: "Holdings and limits", when: "Right now" } as const

const caretOf = (container: HTMLElement) => container.querySelector("[data-slot=chat-caret]")
const busyOf = (container: HTMLElement) =>
  container.querySelector("[data-slot=chat-message]")?.getAttribute("aria-busy") ?? null

describe("ChatMessage", () => {
  describe("streaming", () => {
    it("says bluechip is typing before any text arrives", async () => {
      const screen = await render(<ChatMessage from="bluechip" status="streaming" />)
      await expect.element(screen.getByRole("status", { name: "bluechip is typing" })).toBeInTheDocument()
    })

    it("shows the text so far with a caret after it, and is busy", async () => {
      const screen = await render(<ChatMessage from="bluechip" status="streaming" text="Nvidia is" />)
      await expect.element(screen.getByText("Nvidia is")).toBeVisible()
      await expect.element(screen.getByRole("status", { name: "bluechip is typing" })).not.toBeInTheDocument()
      expect(caretOf(screen.container)?.parentElement?.textContent).toBe("Nvidia is")
      expect(busyOf(screen.container)).toBe("true")
    })

    it("puts the caret after the last list item", async () => {
      const screen = await render(<ChatMessage from="bluechip" status="streaming" text={"- Nvidia\n- Apple"} />)
      expect(caretOf(screen.container)?.parentElement?.textContent).toBe("Apple")
    })

    it("has no caret and isn't busy once done", async () => {
      const screen = await render(<ChatMessage from="bluechip" text="Nvidia is $181.42." />)
      await expect.element(screen.getByText("Nvidia is $181.42.")).toBeVisible()
      expect(caretOf(screen.container)).toBeNull()
      expect(busyOf(screen.container)).toBeNull()
    })
  })

  describe("rich text", () => {
    it("bolds **text**", async () => {
      const screen = await render(<ChatMessage from="bluechip" text="Nvidia is **$181.42** today." />)
      expect(screen.getByText("$181.42").element().tagName).toBe("B")
    })

    it("turns lines starting with - into a list", async () => {
      const screen = await render(<ChatMessage from="bluechip" text={"Here's where you stand:\n- Nvidia\n- Apple"} />)
      expect(screen.getByRole("listitem").elements().map((item) => item.textContent)).toEqual(["Nvidia", "Apple"])
    })

    it("makes each other line a paragraph, skipping blank lines", async () => {
      const screen = await render(<ChatMessage from="bluechip" text={"Nvidia is up.\n\nApple is down."} />)
      expect(screen.getByRole("paragraph").elements().map((p) => p.textContent)).toEqual([
        "Nvidia is up.",
        "Apple is down."
      ])
    })

    it("turns [[NVDA]] into a ticker chip", async () => {
      const screen = await render(<ChatMessage from="bluechip" text="[[NVDA]] is 28.5% of your money." />)
      expect(screen.container.querySelector("[data-slot=ticker-chip]")?.textContent).toBe("NVDA")
    })

    it("turns [^1] into a chip for the first source", async () => {
      const screen = await render(<ChatMessage from="bluechip" text="Your max is 30%.[^1]" sources={[PORTFOLIO]} />)
      await expect.element(screen.getByRole("button", { name: "Source 1: Your portfolio" })).toBeVisible()
    })

    it("leaves a citation with no such source as written", async () => {
      const screen = await render(<ChatMessage from="bluechip" text="Your max is 30%.[^2]" sources={[PORTFOLIO]} />)
      await expect.element(screen.getByText("Your max is 30%.[^2]")).toBeVisible()
    })
  })

  describe("errors", () => {
    it("says what went wrong", async () => {
      const screen = await render(
        <ChatMessage from="bluechip" status="error" error="I couldn't reach prices just now." />
      )
      await expect.element(screen.getByText("I couldn't reach prices just now.")).toBeVisible()
    })

    it("says something went wrong without a message", async () => {
      const screen = await render(<ChatMessage from="bluechip" status="error" />)
      await expect.element(screen.getByText("Something went wrong. Try again in a minute.")).toBeVisible()
    })

    it("retries from its Retry button", async () => {
      let retried = 0
      const screen = await render(<ChatMessage from="bluechip" status="error" onRetry={() => retried++} />)
      await userEvent.click(screen.getByRole("button", { name: "Retry" }))
      expect(retried).toBe(1)
    })

    it("has no Retry button without onRetry", async () => {
      const screen = await render(<ChatMessage from="bluechip" status="error" />)
      await expect.element(screen.getByRole("button", { name: "Retry" })).not.toBeInTheDocument()
    })
  })

  it("reads your message as yours, line breaks kept and no rich text", async () => {
    const screen = await render(<ChatMessage from="you" text={"Buy **Apple**\nevery Monday"} />)
    expect(screen.container.textContent).toBe("You:Buy **Apple**\nevery Monday")
  })
})
