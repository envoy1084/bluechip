import { stocks } from "@bluechip/chain/Contracts"
import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures/test.ts"
import { giveShares } from "../utils/trading.ts"

const list = (page: Page) => page.getByRole("region", { name: "Stocks on bluechip" })

test.describe("stocks list", () => {
  // fixme: pins +2.04% and $100 prices (backlog W8)
  test.fixme("every stock bluechip trades is listed with its price and day", async ({ page, user: _user }) => {
    await page.goto("/stocks")

    await expect(page.getByRole("searchbox", { name: "Search stocks" })).toHaveAttribute(
      "placeholder",
      `Search ${stocks.length} stocks`
    )
    await expect(list(page).getByRole("link")).toHaveCount(stocks.length)
    for (const stock of stocks) {
      await expect(list(page).getByRole("link", { name: new RegExp(`^${stock.symbol} ${stock.name}`) })).toBeVisible()
    }
    await expect(list(page).getByRole("link", { name: /^TSLA Tesla/ })).toContainText("+2.04%")
    await expect(page.getByText("These are Coinbase's tokenized US stocks on Base. Each one tracks its stock's price."))
      .toBeVisible()
  })

  test("a search by symbol keeps the stocks it matches", async ({ page, user: _user }) => {
    await page.goto("/stocks")

    await page.getByRole("searchbox", { name: "Search stocks" }).fill("tsla")

    await expect(list(page).getByRole("link")).toHaveCount(1)
    await expect(list(page).getByRole("link", { name: /^TSLA Tesla/ })).toBeVisible()
  })

  test("a search by name keeps the stocks it matches", async ({ page, user: _user }) => {
    await page.goto("/stocks")

    await page.getByRole("searchbox", { name: "Search stocks" }).fill("Micro")

    await expect(list(page).getByRole("link")).toHaveCount(1)
    await expect(list(page).getByRole("link", { name: /^MSFT Microsoft/ })).toBeVisible()
  })

  test("a search that matches nothing says so", async ({ page, user: _user }) => {
    await page.goto("/stocks")

    await page.getByRole("searchbox", { name: "Search stocks" }).fill("  Zebra ")

    await expect(list(page).getByRole("link")).toHaveCount(0)
    await expect(list(page).getByText("No stock matches “Zebra”.")).toBeVisible()
  })

  test("a row opens the stock's page", async ({ page, user: _user }) => {
    await page.goto("/stocks")

    await list(page).getByRole("link", { name: /^NVDA NVIDIA/ }).click()

    await expect(page).toHaveURL(/\/stocks\/NVDA$/)
    await expect(page.getByRole("heading", { name: "NVIDIA", level: 1 })).toBeVisible()
    await page.getByRole("main").getByRole("link", { name: "Stocks" }).click()
    await expect(page.getByRole("heading", { name: "Stocks", level: 1 })).toBeVisible()
  })
})

test.describe("stock page", () => {
  test("a symbol bluechip doesn't trade shows the not-found screen", async ({ page, user: _user }) => {
    await page.goto("/stocks/NOPE")

    await expect(page.getByRole("heading", { name: "Stock not found", level: 1 })).toBeVisible()
    await expect(page.getByText("We don't have that stock")).toBeVisible()
    await expect(page.getByText("Check the symbol, or pick one from the list.")).toBeVisible()
    await page.getByRole("link", { name: "See all stocks" }).click()
    await expect(page.getByRole("heading", { name: "Stocks", level: 1 })).toBeVisible()
  })

  test("a malformed symbol shows the not-found screen", async ({ page, user: _user }) => {
    await page.goto("/stocks/not-a-symbol")

    await expect(page.getByRole("heading", { name: "Stock not found", level: 1 })).toBeVisible()
  })

  // fixme: pins $100 prices (backlog W8)
  test.fixme("the header shows the price, the day's move and Chainlink's price", async ({ page, user: _user }) => {
    await page.goto("/stocks/MSFT")

    await expect(page.getByRole("heading", { name: "Microsoft", level: 1 })).toBeVisible()
    await expect(page.getByText("Microsoft on Base")).toBeVisible()
    await expect(page.getByRole("main")).toContainText("$100.00")
    await expect(page.getByRole("main")).toContainText("+2.04%")
    await expect(page.getByText(/^Chainlink \$100\.00, 0\.0% apart, updated /)).toBeVisible()
  })

  test("the chart loads every range at once and each tab shows its own", async ({ page, user: _user }) => {
    const ranges = ["1D", "1W", "1M", "ALL"].map((range) =>
      page.waitForResponse((response) =>
        response.url().includes(`/api/market/stocks/AMZN/history?range=${range}`) && response.status() === 200
      )
    )
    await page.goto("/stocks/AMZN")
    await Promise.all(ranges)

    const tabs = page.getByRole("tablist", { name: "Chart range" })
    await expect(tabs.getByRole("tab", { name: "1D" })).toHaveAttribute("aria-selected", "true")
    await expect(page.getByRole("tabpanel", { name: "1D" })).toBeVisible()
    await expect(page.getByText("Past day")).toBeVisible()

    for (const [tab, description] of [["1W", "Past week"], ["1M", "Past month"], ["All", "All time"]] as const) {
      await tabs.getByRole("tab", { name: tab }).click()

      await expect(tabs.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true")
      await expect(page.getByRole("tabpanel", { name: tab })).toBeVisible()
      await expect(page.getByText(description, { exact: true })).toBeVisible()
    }
  })
})

test.describe("stock page: your holding", () => {
  test("a stock you hold shows your shares and their share of your money", async ({ page, user }) => {
    await giveShares(user, { MSFT: 2 })
    await user.fund(page)

    await page.goto("/stocks/MSFT")

    const holding = page.getByRole("region", { name: "Your Microsoft" })
    await expect(holding).toContainText("2 shares at")
    await expect(holding).toContainText("Share of your money")
  })

  test("a stock you don't hold shows no holding", async ({ page, funded: _funded }) => {
    await page.goto("/stocks/MSFT")

    await expect(page.getByRole("heading", { level: 1, name: "Microsoft" })).toBeVisible()
    await expect(page.getByRole("region", { name: "Your Microsoft" })).toBeHidden()
  })
})
