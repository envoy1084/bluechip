import { cashWeight, ProposalCard, type ProposalHolding } from "@bluechip/ui/bluechip/proposal-card"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

// 85% in stocks, so 15% cash; Nvidia was capped from 45% at your 30% max.
const HOLDINGS: ReadonlyArray<ProposalHolding> = [
  { symbol: "NVDA", weight: 30, cappedFrom: 45 },
  { symbol: "SNDK", weight: 30 },
  { symbol: "MSFT", weight: 25 }
]

const FULL: ReadonlyArray<ProposalHolding> = [{ symbol: "NVDA", weight: 60 }, { symbol: "MSFT", weight: 40 }]

const source = (from: string) => ({ kind: "News", from, title: "Memory prices rise", when: "Today" })

describe("cashWeight", () => {
  it("is what the stocks leave of 100%", () => {
    expect(cashWeight(HOLDINGS)).toBe(15)
  })

  it("is 0 when the stocks fill 100%", () => {
    expect(cashWeight(FULL)).toBe(0)
  })

  it("is 0, never negative, when the stocks pass 100%", () => {
    expect(cashWeight([{ symbol: "NVDA", weight: 60 }, { symbol: "MSFT", weight: 45 }])).toBe(0)
  })
})

describe("ProposalCard", () => {
  const basketOf = (screen: Awaited<ReturnType<typeof render>>) =>
    screen.getByRole("list", { name: "Basket" }).getByRole("listitem").elements().map((item) => item.textContent)

  it("fills the basket with cash up to 100%", async () => {
    const screen = await render(<ProposalCard title="AI chips and memory" holdings={HOLDINGS} />)
    expect(basketOf(screen)).toStrictEqual(["NVDA30%capped from 45%", "SNDK30%", "MSFT25%", "USDC15%"])
  })

  it("has no cash when the stocks fill the basket", async () => {
    const screen = await render(<ProposalCard title="Two giants" holdings={FULL} />)
    expect(basketOf(screen)).toStrictEqual(["NVDA60%", "MSFT40%"])
  })

  it("counts the stocks and the cash", async () => {
    const screen = await render(<ProposalCard title="AI chips and memory" holdings={HOLDINGS} />)
    await expect.element(screen.getByText("3 stocks + cash")).toBeVisible()
  })

  it("counts one stock as a stock", async () => {
    const screen = await render(<ProposalCard title="Just Nvidia" holdings={[{ symbol: "NVDA", weight: 100 }]} />)
    await expect.element(screen.getByText("1 stock", { exact: true })).toBeVisible()
  })

  it("says what your max capped", async () => {
    const screen = await render(<ProposalCard title="AI chips and memory" holdings={HOLDINGS} />)
    await expect.element(screen.getByText("Capped NVDA at 30% (your max)")).toBeVisible()
  })

  it("lists what bluechip doesn't offer", async () => {
    const screen = await render(
      <ProposalCard title="AI chips and memory" holdings={HOLDINGS} unavailable={["AMD", "TSM"]} />
    )
    const unavailable = screen.container.querySelector("[data-slot=proposal-unavailable]")
    expect(unavailable?.textContent).toBe("Not available on bluechip:AMDTSM")
  })

  it("numbers sources in the order the facts cite them", async () => {
    const screen = await render(
      <ProposalCard
        title="AI chips and memory"
        holdings={HOLDINGS}
        facts={[
          { text: "Memory prices rose 20% this quarter.", source: source("Reuters") },
          { text: "Nvidia makes most AI chips." },
          { text: "SanDisk sells flash memory.", source: source("SanDisk 10-K") }
        ]}
      />
    )
    await expect.element(screen.getByRole("button", { name: "Source 1: Reuters" })).toBeVisible()
    await expect.element(screen.getByRole("button", { name: "Source 2: SanDisk 10-K" })).toBeVisible()
  })

  it("lists its assumptions", async () => {
    const screen = await render(
      <ProposalCard title="AI chips and memory" holdings={HOLDINGS} assumptions={["You'll hold for a year or more."]} />
    )
    await expect.element(screen.getByRole("heading", { name: "Assumptions" })).toBeVisible()
    await expect.element(screen.getByText("You'll hold for a year or more.")).toBeVisible()
  })

  it("labels its opinions as opinions", async () => {
    const screen = await render(
      <ProposalCard title="AI chips and memory" holdings={HOLDINGS} opinions={["Memory looks cheap."]} />
    )
    await expect.element(screen.getByRole("heading", { name: /^Opinion/ })).toHaveTextContent(
      "Opinionbluechip's view, not a fact"
    )
    await expect.element(screen.getByText("Memory looks cheap.")).toBeVisible()
  })

  it("leaves out sections it has nothing for", async () => {
    const screen = await render(<ProposalCard title="AI chips and memory" holdings={HOLDINGS} />)
    await expect.element(screen.getByRole("heading", { level: 4 })).not.toBeInTheDocument()
  })

  it("approves the basket", async () => {
    let approved = 0
    const screen = await render(
      <ProposalCard title="AI chips and memory" holdings={HOLDINGS} onApprove={() => approved++} />
    )
    await userEvent.click(screen.getByRole("button", { name: "Approve basket" }))
    expect(approved).toBe(1)
  })

  it("asks to adjust the basket", async () => {
    let adjusted = 0
    const screen = await render(
      <ProposalCard title="AI chips and memory" holdings={HOLDINGS} onAdjust={() => adjusted++} />
    )
    await userEvent.click(screen.getByRole("button", { name: "Adjust" }))
    expect(adjusted).toBe(1)
  })
})
