import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures/test.ts"
import { createAgent } from "../utils/agents.ts"
import { askToBuy } from "../utils/intents.ts"
import { buy } from "../utils/trading.ts"

const results = (page: Page, name: string) => page.getByRole("region", { name })

test.describe("performance", () => {
  test("with cash only, the portfolio says no trades yet and the profit chart waits for one", async ({ page, funded: _ }) => {
    await page.goto("/portfolio")

    const card = results(page, "How you're doing")
    await expect(card.getByText("No trades yet.")).toBeVisible()
    await expect(card.getByText("Nothing held yet")).toBeVisible()
    await expect(page.getByText("Your results start with your first trade")).toBeVisible()
  })

  test("after a buy, the portfolio counts one trade and lists the stock by what it cost", async ({ page, funded: _ }) => {
    await buy(page, "NVDA", 50)

    await page.goto("/portfolio")

    const card = results(page, "How you're doing")
    await expect(card.getByText(/^1 trade: \$\d+\.\d{2} in pool fees, /)).toBeVisible()
    await expect(card.getByText("On $50.00 you paid")).toBeVisible()
    const lines = results(page, "By stock and agent").getByRole("link")
    await expect(lines.first()).toHaveAccessibleName(/NVIDIA Cost \$50\.00, worth \$\d/)
  })

  test("a stock you bought shows your cost and results on its page", async ({ page, funded: _ }) => {
    await buy(page, "NVDA", 50)

    await page.goto("/stocks/NVDA")

    const card = results(page, "Your results")
    await expect(card.getByText("$50.00", { exact: true })).toBeVisible()
    await expect(card.getByText(/^\$\d+\.\d{2} a share$/)).toBeVisible()
    await expect(card.getByText(/^Costs: \$\d+\.\d{2} in pool fees, /)).toBeVisible()
  })

  test("a stock never traded has no results section", async ({ page, funded: _ }) => {
    await page.goto("/stocks/AAPL")

    await expect(page.getByRole("heading", { name: "Apple" })).toBeVisible()
    await expect(results(page, "Your results")).toHaveCount(0)
  })

  test("an agent's page shows what it bought and how often its policies blocked it", async ({ page, funded: _ }) => {
    await createAgent(page, { stocks: ["NVDA NVIDIA"], askAbove: 100 })
    await askToBuy(page, 50)

    const card = results(page, "Results")
    await expect(card.getByText("$50.00", { exact: true })).toBeVisible()
    await expect(card.getByText("Its policies haven't blocked any of the 1 trade it tried.")).toBeVisible()
  })
})
