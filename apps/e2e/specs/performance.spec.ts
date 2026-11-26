import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures/test.ts"
import { createAgent } from "../utils/agents.ts"
import { askToBuy } from "../utils/intents.ts"
import { buy } from "../utils/trading.ts"

const results = (page: Page, name: string) => page.getByRole("region", { name })

test.describe("performance", () => {
  test("with cash only, the portfolio says no trades yet and the profit chart waits for one", async ({ page, funded: _ }) => {
    await page.goto("/portfolio")

    const card = results(page, "Your money")
    await expect(card.getByText("No trades yet.")).toBeVisible()
    await expect(card.getByText("Nothing held yet")).toBeVisible()
    const chart = results(page, "Portfolio over time")
    await chart.getByRole("tablist", { name: "Chart" }).getByRole("tab", { name: "Profit" }).click()
    await expect(chart.getByText("Your results start with your first trade")).toBeVisible()
  })

  test("after a buy, the portfolio counts one trade and lists the stock by what it cost", async ({ page, funded: _ }) => {
    await buy(page, "NVDA", 50)

    await page.goto("/portfolio")

    const card = results(page, "Your money")
    await expect(card.getByText(/^1 trade: \$\d+\.\d{2} in pool fees, /)).toBeVisible()
    await expect(card).toContainText("on $50.00 you paid")
    const lines = results(page, "By stock and agent").getByRole("link")
    await expect(lines.first()).toHaveAccessibleName(/NVIDIA Cost \$50\.00, worth \$\d/)
  })

  test("an agent's page shows what it bought and how often its policies blocked it", async ({ page, funded: _ }) => {
    await createAgent(page, { stocks: ["NVDA NVIDIA"], askAbove: 100 })
    await askToBuy(page, 50)

    await page.getByRole("link", { name: "Results" }).click()

    await expect(results(page, "Money moved").getByText("$50.00", { exact: true })).toBeVisible()
    await expect(results(page, "Its policies").getByText("None of its trades were blocked.")).toBeVisible()
  })
})
