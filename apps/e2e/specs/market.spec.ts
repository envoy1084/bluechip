import { localDeployment } from "@bluechip/chain/deployments/Base"
import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures/test.ts"

const list = (page: Page) => page.getByRole("region", { name: "Stocks on bluechip" })

test.describe("stocks list", () => {
  test("every stock bluechip trades is listed with its price and day", async ({ page, user: _user }) => {
    await page.goto("/stocks")

    await expect(list(page).getByRole("link")).toHaveCount(localDeployment.stocks.length)
    for (const stock of localDeployment.stocks) {
      await expect(list(page).getByRole("link", { name: new RegExp(`^${stock.symbol} ${stock.name}`) })).toBeVisible()
    }
    await expect(list(page).getByRole("link", { name: /^TSLA Tesla/ })).toContainText(/\$[\d,]+\.\d{2}/)
    await expect(list(page).getByRole("link", { name: /^TSLA Tesla/ })).toContainText(/[+−-]?\d+\.\d{2}%/)
    await expect(page.getByText("These are Coinbase's tokenized US stocks on Base. Each one tracks its stock's price."))
      .toBeVisible()
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

  test("the header shows the price, the day's move and Chainlink's price", async ({ page, user: _user }) => {
    await page.goto("/stocks/MSFT")

    await expect(page.getByRole("heading", { name: "Microsoft", level: 1 })).toBeVisible()
    await expect(page.getByText("Microsoft on Base")).toBeVisible()
    await expect(page.getByRole("main")).toContainText(/\$[\d,]+\.\d{2}/)
    await expect(page.getByRole("main")).toContainText(/[+−-]?\d+\.\d{2}%/)
    await expect(page.getByText(/^Chainlink \$[\d,]+\.\d{2}, \d+\.\d% apart, updated /)).toBeVisible()
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
