import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures/test.ts"
import { giveShares } from "../utils/trading.ts"

const holdingRows = (page: Page) => page.getByRole("region", { name: "Holdings" }).getByRole("button")

test.describe("portfolio", () => {
  test("with no money, it says how to start", async ({ page, user: _user }) => {
    await page.goto("/portfolio")

    await expect(page.getByText("No stocks yet")).toBeVisible()
    await expect(page.getByText("Add cash, then buy a stock you like. Your chart starts with your first deposit."))
      .toBeVisible()
    await page.getByRole("link", { name: "See stocks" }).click()
    await expect(page.getByRole("heading", { name: "Stocks", level: 1 })).toBeVisible()
  })

  test("with cash only, the chart explains it starts today and cash is the whole mix", async ({ page, funded: _ }) => {
    await page.goto("/portfolio")

    await expect(
      page.getByText(
        "Your chart starts building today. We record your portfolio's value every 4 hours and keep the last 30 days."
      )
    ).toBeVisible()
    await expect(holdingRows(page)).toHaveCount(1)
    await expect(holdingRows(page).nth(0)).toHaveAccessibleName("USDC Cash Ready to invest $1,000.00 100.0%")
    await expect(page.getByRole("list", { name: "Your mix" }).getByRole("button")).toHaveCount(1)
    await expect(page.getByRole("list", { name: "Your mix" }).getByRole("button")).toHaveAccessibleName("Cash 100.0%")
  })

  test("your money sums it up first, with Add cash left to the page", async ({ page, funded: _ }) => {
    await page.goto("/portfolio")

    const money = page.getByRole("region", { name: "Your money" })
    await expect(money).toContainText("$1,000.00")
    await expect(money.getByRole("img")).toHaveAccessibleName("Cash 100%")
    await expect(money.getByRole("button", { name: "Add cash" })).toHaveCount(0)
  })

  // fixme: pins $100 prices and shares (backlog W8)
  test.fixme("holdings are listed biggest first, with cash last", async ({ page, user }) => {
    await giveShares(user, { TSLA: 3, AMZN: 2 })
    await user.fund(page)

    await page.goto("/portfolio")

    await expect(holdingRows(page).nth(0)).toHaveAccessibleName(/^TSLA Tesla 3 shares, 20\.0% of your money \$300\.00/)
    await expect(holdingRows(page).nth(1)).toHaveAccessibleName(/^AMZN Amazon 2 shares, 13\.3% of your money \$200\.00/)
    await expect(holdingRows(page).nth(2)).toHaveAccessibleName(/^USDC Cash Ready to invest \$1,000\.00 66\.7%$/)
  })

  test("the Name tab sorts holdings by name", async ({ page, user }) => {
    await giveShares(user, { TSLA: 3, AMZN: 2 })
    await user.fund(page)
    await page.goto("/portfolio")
    await expect(holdingRows(page).nth(0)).toHaveAccessibleName(/^TSLA Tesla/)

    await page.getByRole("tablist", { name: "Sort holdings" }).getByRole("tab", { name: "Name" }).click()

    await expect(holdingRows(page).nth(0)).toHaveAccessibleName(/^AMZN Amazon/)
    await expect(holdingRows(page).nth(1)).toHaveAccessibleName(/^TSLA Tesla/)
    await expect(holdingRows(page).nth(2)).toHaveAccessibleName(/^USDC Cash/)
  })

  // fixme: pins +2.04% (backlog W8)
  test.fixme("the Today tab sorts by today's move, ties kept biggest first", async ({ page, user }) => {
    await giveShares(user, { TSLA: 3, AMZN: 2 })
    await user.fund(page)
    await page.goto("/portfolio")
    const sort = page.getByRole("tablist", { name: "Sort holdings" })
    await sort.getByRole("tab", { name: "Name" }).click()
    await expect(holdingRows(page).nth(0)).toHaveAccessibleName(/^AMZN Amazon/)

    await sort.getByRole("tab", { name: "Today" }).click()

    await expect(sort.getByRole("tab", { name: "Today" })).toHaveAttribute("aria-selected", "true")
    await expect(holdingRows(page).nth(0)).toHaveAccessibleName(/^TSLA Tesla.*\+2\.04%$/)
    await expect(holdingRows(page).nth(1)).toHaveAccessibleName(/^AMZN Amazon.*\+2\.04%$/)
  })

  test("a holding opens its stock's page", async ({ page, user }) => {
    await giveShares(user, { TSLA: 3 })
    await user.fund(page)
    await page.goto("/portfolio")

    await holdingRows(page).filter({ hasText: "Tesla" }).click()

    await expect(page).toHaveURL(/\/stocks\/TSLA$/)
  })

  // fixme: pins $100 prices (backlog W8)
  test.fixme("the mix splits the money between stocks and cash", async ({ page, user }) => {
    await giveShares(user, { TSLA: 3, AMZN: 2 })
    await user.fund(page)

    await page.goto("/portfolio")

    const slices = page.getByRole("list", { name: "Your mix" }).getByRole("button")
    await expect(slices).toHaveCount(3)
    await expect(slices.nth(0)).toHaveAccessibleName("Tesla 20.0%")
    await expect(slices.nth(1)).toHaveAccessibleName("Amazon 13.3%")
    await expect(slices.nth(2)).toHaveAccessibleName("Cash 66.7%")
  })

  test("a single share reads \"1 share\"", async ({ page, user }) => {
    await giveShares(user, { AMZN: 1 })
    await user.fund(page)

    await page.goto("/portfolio")

    await expect(holdingRows(page).nth(0)).toHaveAccessibleName(/^AMZN Amazon 1 share, /)
  })

  test("the cash card's buttons open Add cash and Withdraw", async ({ page, funded: _funded }) => {
    await page.goto("/portfolio")
    const cash = page.getByText("USDC on Base, ready to invest or withdraw.").locator("..")

    await cash.getByRole("button", { name: "Add cash" }).click()
    await expect(page.getByRole("dialog", { name: "Add cash" })).toBeVisible()
    await page.getByRole("dialog", { name: "Add cash" }).getByRole("button", { name: "Close" }).click()
    await cash.getByRole("button", { name: "Withdraw" }).click()

    await expect(page.getByRole("dialog", { name: "Withdraw cash" })).toBeVisible()
    await expect(page.getByText("You have $1,000.00 in cash.")).toBeVisible()
  })

  test("the cash row opens Add cash", async ({ page, funded: _funded }) => {
    await page.goto("/portfolio")

    await holdingRows(page).filter({ hasText: "Ready to invest" }).click()

    await expect(page.getByRole("dialog", { name: "Add cash" })).toBeVisible()
  })
})
