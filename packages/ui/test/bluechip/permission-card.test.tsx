import { PermissionCard } from "@bluechip/ui/bluechip/permission-card"
import { type AgentLimits, limitRules } from "@bluechip/ui/lib/agent-limits"
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

const SELL_ONLY: AgentLimits = {
  ...REBALANCER,
  stocks: ["TSLA"],
  mode: "sell",
  dailySpend: 0,
  maxInOneStock: 100,
  cashReserve: 0
}

const canOf = (limits: AgentLimits) => limitRules(limits).can

describe("limitRules", () => {
  it("a rebalancer", () => {
    expect(limitRules(REBALANCER)).toStrictEqual({
      can: [
        "Trade Nvidia, Apple, Microsoft +1, only to move you back to your target mix",
        "Spend up to $200 a day",
        "Up to $100 per trade",
        "Ask you before trades over $150"
      ],
      never: [
        "Send money out of your account",
        "Put over 30% of your money in one stock",
        "Leave less than 10% in cash",
        "Pay more than 1% off the market price",
        "Change its own limits"
      ]
    })
  })

  it("a sell-only agent with no spend, max or reserve", () => {
    expect(limitRules(SELL_ONLY)).toStrictEqual({
      can: ["Sell Tesla", "Up to $100 per trade", "Ask you before trades over $150"],
      never: ["Send money out of your account", "Pay more than 1% off the market price", "Change its own limits"]
    })
  })

  it("a buyer", () => {
    expect(canOf({ ...SELL_ONLY, mode: "buy" })[0]).toBe("Buy Tesla")
  })

  it("an agent that buys and sells", () => {
    expect(canOf({ ...SELL_ONLY, mode: "buy-and-sell" })[0]).toBe("Buy and sell Tesla")
  })

  it("two stocks", () => {
    expect(canOf({ ...SELL_ONLY, stocks: ["NVDA", "AAPL"] })[0]).toBe("Sell Nvidia and Apple")
  })

  it("three stocks", () => {
    expect(canOf({ ...SELL_ONLY, stocks: ["NVDA", "AAPL", "MSFT"] })[0]).toBe("Sell Nvidia, Apple and Microsoft")
  })

  it("no stocks", () => {
    expect(canOf({ ...SELL_ONLY, stocks: [] })[0]).toBe("Sell no stocks yet")
  })

  it("a stock bluechip doesn't know, by its symbol", () => {
    expect(canOf({ ...SELL_ONLY, stocks: ["ZZZZ"] })[0]).toBe("Sell ZZZZ")
  })

  it("an agent that asks before every trade", () => {
    expect(canOf({ ...SELL_ONLY, approveAbove: 0 }).at(-1)).toBe("Ask you before every trade")
  })
})

describe("PermissionCard", () => {
  const rulesIn = (container: HTMLElement, kind: "can" | "never") =>
    [...container.querySelectorAll(`[data-slot=permission-card-${kind}] li`)].map((li) => li.textContent)

  it("lists the rules in a can column and a can-never column", async () => {
    const screen = await render(<PermissionCard limits={SELL_ONLY} />)
    expect(rulesIn(screen.container, "can")).toStrictEqual([
      "Sell Tesla",
      "Up to $100 per trade",
      "Ask you before trades over $150"
    ])
    expect(rulesIn(screen.container, "never")).toStrictEqual([
      "Send money out of your account",
      "Pay more than 1% off the market price",
      "Change its own limits"
    ])
  })

  it("meters what it spent today against the daily spend", async () => {
    const screen = await render(<PermissionCard limits={REBALANCER} spentToday={140} />)
    await expect.element(screen.getByRole("meter", { name: "Spent today" })).toHaveAttribute(
      "aria-valuetext",
      "$140 of $200"
    )
  })

  it("has no meter without what it spent today", async () => {
    const screen = await render(<PermissionCard limits={REBALANCER} />)
    await expect.element(screen.getByRole("meter")).not.toBeInTheDocument()
  })

  it("has no meter for an agent that never buys", async () => {
    const screen = await render(<PermissionCard limits={SELL_ONLY} spentToday={0} />)
    await expect.element(screen.getByRole("meter")).not.toBeInTheDocument()
  })

  it("says until when the limits are locked", async () => {
    const screen = await render(<PermissionCard limits={REBALANCER} lockedUntil="21 Feb" />)
    await expect.element(screen.getByText("Locked with Face ID until 21 Feb")).toBeVisible()
  })

  it("says a draft isn't locked yet", async () => {
    const screen = await render(<PermissionCard limits={REBALANCER} />)
    await expect.element(screen.getByText("Not locked yet")).toBeVisible()
  })

  it("edits limits from its Edit limits button", async () => {
    let edits = 0
    const screen = await render(<PermissionCard limits={REBALANCER} onEditLimits={() => edits++} />)
    await userEvent.click(screen.getByRole("button", { name: "Edit limits" }))
    expect(edits).toBe(1)
  })

  it("has no Edit limits button without onEditLimits", async () => {
    const screen = await render(<PermissionCard limits={REBALANCER} />)
    await expect.element(screen.getByRole("button", { name: "Edit limits" })).not.toBeInTheDocument()
  })
})
