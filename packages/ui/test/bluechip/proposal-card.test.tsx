import { cashWeight, ProposalCard } from "@bluechip/ui/bluechip/proposal-card"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

const HOLDINGS = [{ symbol: "NVDA", weight: 30, cappedFrom: 45 }, { symbol: "SNDK", weight: 30 }, {
  symbol: "MSFT",
  weight: 25
}]

describe("ProposalCard", () => {
  it("fills the rest with cash so the weights add up to 100%", async () => {
    expect(cashWeight(HOLDINGS)).toBe(15)
    const screen = await render(<ProposalCard title="AI chips and memory" holdings={HOLDINGS} />)
    const weights = screen.container.querySelectorAll("[data-slot=proposal-weight] b")
    const total = [...weights].reduce((sum, weight) => sum + Number.parseFloat(weight.textContent ?? ""), 0)
    expect(total).toBe(100)
    await expect.element(screen.getByText("USDC", { exact: true })).toBeVisible()
  })

  it("lists what bluechip doesn't offer and what your max capped", async () => {
    const screen = await render(
      <ProposalCard title="AI chips and memory" holdings={HOLDINGS} unavailable={["AMD", "TSM"]} />
    )
    const unavailable = screen.container.querySelector("[data-slot=proposal-unavailable]")
    expect([...(unavailable?.querySelectorAll("[data-slot=ticker-chip]") ?? [])].map((chip) => chip.textContent))
      .toEqual(["AMD", "TSM"])
    await expect.element(screen.getByText("Capped NVDA at 30% (your max)")).toBeVisible()
    await expect.element(screen.getByText("capped from 45%")).toBeVisible()
  })
})
