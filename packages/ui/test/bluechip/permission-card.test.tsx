import { PermissionCard } from "@bluechip/ui/bluechip/permission-card"
import type { AgentLimits } from "@bluechip/ui/lib/agent-limits"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const REBALANCER: AgentLimits = {
  stocks: ["NVDA", "AAPL", "MSFT", "TSLA"],
  mode: "rebalance",
  dailySpend: 200,
  maxPerTrade: 100,
  maxInOneStock: 30,
  cashReserve: 10,
  approveAbove: 150
}

const items = (list: Element | null) => [...(list?.querySelectorAll("li") ?? [])].map((li) => li.textContent)

describe("PermissionCard", () => {
  it("renders the given limits exactly, as sentences", async () => {
    let edits = 0
    const screen = await render(
      <PermissionCard limits={REBALANCER} spentToday={140} lockedUntil="21 Feb" onEditLimits={() => edits++} />
    )
    expect(items(screen.container.querySelector("[data-slot=permission-card-can]"))).toEqual([
      "Trade Nvidia, Apple, Microsoft +1, only to move you back to your target mix",
      "Spend up to $200 a day",
      "Up to $100 per trade",
      "Ask you before trades over $150"
    ])
    expect(items(screen.container.querySelector("[data-slot=permission-card-never]"))).toEqual([
      "Send money out of your account",
      "Put over 30% of your money in one stock",
      "Leave less than 10% in cash",
      "Pay more than 1% off the market price",
      "Change its own limits"
    ])
    await expect.element(screen.getByRole("meter", { name: "Spent today" })).toHaveAttribute(
      "aria-valuetext",
      "$140 of $200"
    )
    await expect.element(screen.getByText("Locked with Face ID until 21 Feb")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Edit limits" }))
    expect(edits).toBe(1)
  })

  it("drops rules a sell-only draft doesn't have and says it isn't locked", async () => {
    const screen = await render(
      <PermissionCard
        limits={{ ...REBALANCER, stocks: ["TSLA"], mode: "sell", dailySpend: 0, maxInOneStock: 100, cashReserve: 0 }}
        spentToday={0}
      />
    )
    expect(items(screen.container.querySelector("[data-slot=permission-card-can]"))).toEqual([
      "Sell Tesla",
      "Up to $100 per trade",
      "Ask you before trades over $150"
    ])
    await expect.element(screen.getByRole("meter")).not.toBeInTheDocument()
    await expect.element(screen.getByText("Not locked yet")).toBeVisible()
  })
})
