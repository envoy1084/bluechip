import { ChatMessage } from "@bluechip/ui/bluechip/chat-message"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

const PORTFOLIO = { kind: "Account", from: "Your portfolio", title: "Holdings and limits", when: "Right now" } as const

// Streamdown draws its caret in CSS, after the last block, from this custom property.
const caretOf = (container: HTMLElement) => container.querySelector("[style*='--streamdown-caret']")
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
      expect(caretOf(screen.container)?.textContent).toBe("Nvidia is")
      expect(busyOf(screen.container)).toBe("true")
    })

    it("renders an unfinished bold as it will end", async () => {
      const screen = await render(<ChatMessage from="bluechip" status="streaming" text="Nvidia is **$181" />)
      await expect.element(screen.getByText("$181")).toBeVisible()
      expect(screen.getByText("$181").element().tagName).toBe("STRONG")
    })

    it("has no caret and isn't busy once done", async () => {
      const screen = await render(<ChatMessage from="bluechip" text="Nvidia is $181.42." />)
      await expect.element(screen.getByText("Nvidia is $181.42.")).toBeVisible()
      expect(caretOf(screen.container)).toBeNull()
      expect(busyOf(screen.container)).toBeNull()
    })
  })

  describe("markdown", () => {
    it("bolds **text**", async () => {
      const screen = await render(<ChatMessage from="bluechip" text="Nvidia is **$181.42** today." />)
      await expect.element(screen.getByText("$181.42")).toBeVisible()
      expect(screen.getByText("$181.42").element().tagName).toBe("STRONG")
    })

    it("turns lines starting with - into a list", async () => {
      const screen = await render(<ChatMessage from="bluechip" text={"Here's where you stand:\n\n- Nvidia\n- Apple"} />)
      await expect.element(screen.getByText("Apple")).toBeVisible()
      expect(screen.getByRole("listitem").elements().map((item) => item.textContent)).toEqual(["Nvidia", "Apple"])
    })

    it("makes each block a paragraph", async () => {
      const screen = await render(<ChatMessage from="bluechip" text={"Nvidia is up.\n\nApple is down."} />)
      await expect.element(screen.getByText("Apple is down.")).toBeVisible()
      expect(screen.getByRole("paragraph").elements().map((p) => p.textContent)).toEqual([
        "Nvidia is up.",
        "Apple is down."
      ])
    })

    it("turns [[NVDA]] into a ticker chip", async () => {
      const screen = await render(<ChatMessage from="bluechip" text="[[NVDA]] is 28.5% of your money." />)
      await expect.element(screen.getByText("is 28.5% of your money.", { exact: false })).toBeVisible()
      expect(screen.container.querySelector("[data-slot=ticker-chip]")?.textContent).toBe("NVDA")
    })

    it("turns [^1] into a chip for the first source", async () => {
      const screen = await render(<ChatMessage from="bluechip" text="Your max is 30%.[^1]" sources={[PORTFOLIO]} />)
      await expect.element(screen.getByRole("button", { name: "Source 1: Your portfolio" })).toBeVisible()
    })

    it("shows no chip for a citation with no such source", async () => {
      const screen = await render(<ChatMessage from="bluechip" text="Your max is 30%.[^2]" sources={[PORTFOLIO]} />)
      await expect.element(screen.getByText("Your max is 30%.")).toBeVisible()
      await expect.element(screen.getByRole("button", { name: /^Source/ })).not.toBeInTheDocument()
    })

    it("highlights a fenced code block", async () => {
      const screen = await render(<ChatMessage from="bluechip" text={"```ts\nconst max = 30\n```"} />)
      await expect.element(screen.getByText("max", { exact: false })).toBeVisible()
      expect(screen.container.querySelector("[data-streamdown=code-block]")).not.toBeNull()
    })

    it("offers to copy a code block", async () => {
      const screen = await render(<ChatMessage from="bluechip" text={"```ts\nconst max = 30\n```"} />)
      await expect.element(screen.getByRole("button", { name: "Copy Code" })).toBeInTheDocument()
    })
  })

  describe("links", () => {
    it("draws a link to one of the app's pages with internalLink", async () => {
      const screen = await render(
        <ChatMessage
          from="bluechip"
          text="See [How agents work](/help/agents#policies)."
          internalLink={({ children, className, href }) => (
            <a href={href} className={className} data-internal="">{children}</a>
          )}
        />
      )
      await expect.element(screen.getByRole("link", { name: "How agents work" })).toHaveAttribute(
        "data-internal",
        ""
      )
    })

    it("opens a link to one of the app's pages without asking", async () => {
      const opened: Array<string> = []
      const screen = await render(
        <ChatMessage
          from="bluechip"
          text="See [Approvals](/help/approvals)."
          internalLink={({ children, className, href }) => (
            <a
              href={href}
              className={className}
              onClick={(event) => {
                event.preventDefault()
                opened.push(href)
              }}
            >
              {children}
            </a>
          )}
        />
      )
      await userEvent.click(screen.getByRole("link", { name: "Approvals" }))
      expect(opened).toEqual(["/help/approvals"])
      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
    })

    it("asks before opening another site", async () => {
      const screen = await render(
        <ChatMessage from="bluechip" text="See [Chainlink's feeds](https://data.chain.link/feeds)." />
      )
      await userEvent.click(screen.getByRole("link", { name: "Chainlink's feeds" }))
      await expect.element(page.getByRole("dialog", { name: "Open data.chain.link?" })).toBeVisible()
    })

    it("stays put when you keep to bluechip", async () => {
      const screen = await render(
        <ChatMessage from="bluechip" text="See [Chainlink's feeds](https://data.chain.link/feeds)." />
      )
      await userEvent.click(screen.getByRole("link", { name: "Chainlink's feeds" }))
      // Base UI's scroll lock keeps Playwright's stability check from settling in the test iframe; the click is real.
      await userEvent.click(page.getByRole("button", { name: "Stay here" }), { force: true })
      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("puts what the tools found above the text, so it stays put as the text streams", async () => {
    const screen = await render(
      <ChatMessage from="bluechip" status="streaming" text="Nvidia is up." attachments={<p>Your portfolio</p>} />
    )
    await expect.element(screen.getByText("Nvidia is up.")).toBeVisible()
    const found = screen.getByText("Your portfolio").element()
    const text = screen.getByText("Nvidia is up.").element()
    expect(found.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
