import { allocationSegments, MoneyCard, PortfolioSummary } from "@bluechip/ui/bluechip/portfolio-summary"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

const NVDA = { symbol: "NVDA", name: "Nvidia", value: 500 }
const AAPL = { symbol: "AAPL", name: "Apple", value: 300 }

describe("allocationSegments", () => {
  it("holdings largest first, then cash, as shares of the whole", () => {
    expect(allocationSegments([AAPL, NVDA], 200).map(({ id, percent }) => [id, percent])).toStrictEqual([
      ["NVDA", 50],
      ["AAPL", 30],
      ["cash", 20]
    ])
  })

  it("folds holdings past the shown ones into Others", () => {
    const positions = [NVDA, AAPL, { symbol: "MSFT", name: "Microsoft", value: 100 }, {
      symbol: "TSLA",
      name: "Tesla",
      value: 100
    }]
    expect(allocationSegments(positions, 0, 2).map(({ id, value }) => [id, value])).toStrictEqual([
      ["NVDA", 500],
      ["AAPL", 300],
      ["others", 200]
    ])
  })

  it("leaves out holdings worth nothing and no cash", () => {
    expect(allocationSegments([NVDA, { ...AAPL, value: 0 }], 0).map(({ id }) => id)).toStrictEqual(["NVDA"])
  })

  it("empty money has no segments", () => {
    expect(allocationSegments([], 0)).toStrictEqual([])
  })
})

describe("PortfolioSummary", () => {
  it("names each part of the strip with its share", async () => {
    const screen = await render(
      <PortfolioSummary value={1000} dayChange={12} dayChangePercent={1.2} cash={200} positions={[NVDA, AAPL]} />
    )
    await expect.element(screen.getByRole("img", { name: "Nvidia 50%, Apple 30%, Cash 20%" })).toBeInTheDocument()
  })

  it("with nothing in it, says how to start", async () => {
    const screen = await render(
      <PortfolioSummary
        value={0}
        dayChange={0}
        dayChangePercent={0}
        cash={0}
        positions={[]}
        addCash={<button type="button">Add cash</button>}
      />
    )
    await expect.element(screen.getByText(/^Nothing here yet/)).toBeVisible()
    await expect.element(screen.getByRole("button", { name: "Add cash" })).toBeVisible()
  })
})

describe("MoneyCard", () => {
  it("is a region named Your money, with the page's aside and detail", async () => {
    const screen = await render(
      <MoneyCard value={1000} dayChange={12} dayChangePercent={1.2} aside={<span>Profit in all</span>}>
        <p>Cash line</p>
      </MoneyCard>
    )
    const card = screen.getByRole("region", { name: "Your money" })
    await expect.element(card.getByText("Profit in all")).toBeVisible()
    await expect.element(card.getByText("Cash line")).toBeVisible()
  })
})
