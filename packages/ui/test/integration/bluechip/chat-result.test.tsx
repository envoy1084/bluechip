import {
  ChatResult,
  ChatResultRow,
  ChatResultRows,
  ChatResultStat,
  ChatResultStats
} from "@bluechip/ui/bluechip/chat-result"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("ChatResult", () => {
  it("is a region named by its title, with its rows and the way to its page", async () => {
    const screen = await render(
      <ChatResult title="Your portfolio" icon="portfolio" action={<a href="/portfolio">Open</a>}>
        <ChatResultRows>
          <ChatResultRow title="Apple" detail="2 shares" value="$380.00" />
        </ChatResultRows>
      </ChatResult>
    )

    const card = screen.getByRole("region", { name: "Your portfolio" })
    await expect.element(card.getByText("Apple")).toBeVisible()
    await expect.element(card.getByText("$380.00")).toBeVisible()
    await expect.element(card.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/portfolio")
  })

  it("shimmers while it's read: busy, without its body or its link", async () => {
    const screen = await render(
      <ChatResult title="Prices" icon="chart-up" state="loading" action={<a href="/stocks">Open</a>}>
        <p>Apple $190.00</p>
      </ChatResult>
    )

    await expect.element(screen.getByRole("region", { name: "Prices" })).toHaveAttribute("aria-busy", "true")
    await expect.element(screen.getByText("Apple $190.00")).not.toBeInTheDocument()
    await expect.element(screen.getByRole("link", { name: "Open" })).not.toBeInTheDocument()
  })

  it("says it found nothing in a line, keeping the way to its page", async () => {
    const screen = await render(
      <ChatResult
        title="Your agents"
        icon="agents"
        state="empty"
        message="No agents yet."
        action={<a href="/agents">See all</a>}
      >
        <p>Rows</p>
      </ChatResult>
    )

    await expect.element(screen.getByText("No agents yet.")).toBeVisible()
    await expect.element(screen.getByText("Rows")).not.toBeInTheDocument()
    await expect.element(screen.getByRole("link", { name: "See all" })).toBeVisible()
  })

  it("says what went wrong when it failed, with no way to a page it couldn't read", async () => {
    const screen = await render(
      <ChatResult
        title="Quote"
        icon="receipt"
        state="error"
        message="Couldn't get a quote. Prices are paused."
        action={<a href="/stocks/TSLA">Trade</a>}
        footer={<a href="/stocks">All stocks</a>}
      />
    )

    await expect.element(screen.getByText("Couldn't get a quote. Prices are paused.")).toBeVisible()
    await expect.element(screen.getByRole("link")).not.toBeInTheDocument()
  })
})

describe("ChatResultStats", () => {
  it("pairs each label with its value", async () => {
    const screen = await render(
      <ChatResultStats>
        <ChatResultStat label="Realised" value="+$12.00" />
        <ChatResultStat label="Unrealised" value="−$4.00" tone="loss" />
      </ChatResultStats>
    )

    await expect.element(screen.getByRole("term").nth(1)).toHaveTextContent("Unrealised")
    await expect.element(screen.getByRole("definition").nth(1)).toHaveTextContent("−$4.00")
  })
})
