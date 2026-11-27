import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures/test.ts"
import { buy, giveShares } from "../utils/trading.ts"

const tradeBox = (page: Page, name: string) => page.getByRole("region", { name: `Trade ${name}` })

test.describe("buying on a stock's page", () => {
  test("a quote shows what the buy does and checks its price against Chainlink", async ({ page, funded: _ }) => {
    await page.goto("/stocks/MSTR")
    const box = tradeBox(page, "Strategy")

    await box.getByRole("textbox", { name: "Buy Strategy" }).fill("10")

    await expect(box.getByText(/^About \d+\.\d+ shares for \$10\.00\.$/)).toBeVisible()
    const rows = box.getByRole("definition")
    await expect(rows.nth(0)).toHaveText("MSTRStrategy")
    await expect(rows.nth(1)).toHaveText("$10.00")
    await expect(rows.nth(2)).toHaveText(/^\$\d+\.\d{2} a share$/)
    await expect(rows.nth(3)).toHaveText(/^\d+\.\d+ shares$/)
    await expect(rows.nth(4)).toHaveText("Within 1%")
    await expect(rows.nth(5)).toHaveText(/^\d+\.\d+ shares$/)
    await expect(box.getByRole("term").nth(5)).toHaveText("At least, after 0.5% slippage")
    await expect(box.getByRole("button", { name: "Buy with Face ID" })).toBeEnabled()
  })

  test("before an amount, the box says the smallest trade is $1", async ({ page, funded: _funded }) => {
    await page.goto("/stocks/MSTR")
    const box = tradeBox(page, "Strategy")

    await expect(box.getByText("$1,000.00 cash available")).toBeVisible()
    await expect(box.getByText("Enter an amount. The smallest trade is $1.")).toBeVisible()
    await expect(box.getByRole("button", { name: "Buy with Face ID" })).toBeDisabled()
  })

  test("a buy under $1 can't be sent", async ({ page, funded: _funded }) => {
    await page.goto("/stocks/MSTR")
    const box = tradeBox(page, "Strategy")

    await box.getByRole("textbox", { name: "Buy Strategy" }).fill("0.5")

    await expect(box.getByText("The smallest trade is $1.")).toBeVisible()
    await expect(box.getByRole("button", { name: "Buy with Face ID" })).toBeDisabled()
  })

  test("each quick amount fills the field", async ({ page, funded: _funded }) => {
    await page.goto("/stocks/MSTR")
    const box = tradeBox(page, "Strategy")
    const field = box.getByRole("textbox", { name: "Buy Strategy" })

    for (const amount of ["50", "100", "150"]) {
      await box.getByRole("group", { name: "Quick amounts" }).getByRole("button", { name: `$${amount}` }).click()

      await expect(field).toHaveValue(amount)
    }
    await expect(box.getByText(/^About \d+\.\d+ shares for \$150\.00\.$/)).toBeVisible()
  })

  test("Max fills in all the cash", async ({ page, funded: _funded }) => {
    await page.goto("/stocks/MSTR")
    const box = tradeBox(page, "Strategy")

    await box.getByRole("button", { name: "Max" }).click()

    await expect(box.getByRole("textbox", { name: "Buy Strategy" })).toHaveValue("1000.00")
  })

  test("more than your cash is refused before any quote", async ({ page, funded: _funded }) => {
    await page.goto("/stocks/MSTR")
    const box = tradeBox(page, "Strategy")
    const quotes: Array<string> = []
    page.on("request", (request) => {
      if (request.url().endsWith("/api/market/quotes")) quotes.push(request.url())
    })

    await box.getByRole("textbox", { name: "Buy Strategy" }).fill("1000.01")

    await expect(box.getByText("That's more than your cash.")).toBeVisible()
    await expect(box.getByRole("textbox", { name: "Buy Strategy" })).toHaveAttribute("aria-invalid", "true")
    await expect(box.getByRole("button", { name: "Buy with Face ID" })).toBeDisabled()
    expect(quotes).toEqual([])
  })

  test("without cash, the box has no Max", async ({ page, user: _user }) => {
    await page.goto("/stocks/MSTR")
    const box = tradeBox(page, "Strategy")

    await expect(box.getByText("$0.00 cash available")).toBeVisible()
    await expect(box.getByRole("button", { name: "Max" })).toBeHidden()
  })

  test("the amount switches to shares and back, keeping its value", async ({ page, funded: _funded }) => {
    await page.goto("/stocks/TSLA")
    const box = tradeBox(page, "Tesla")
    await box.getByRole("textbox", { name: "Buy Tesla" }).fill("50")

    await box.getByRole("button", { name: "Amount in USDC. Switch to shares" }).click()

    await expect(box.getByRole("textbox", { name: "Buy Tesla" })).toHaveValue(/^0\.\d+$/)
    await expect(box.getByRole("group", { name: "Quick amounts" })).toBeHidden()
    await box.getByRole("button", { name: "Amount in TSLA shares. Switch to USDC" }).click()
    await expect(box.getByRole("textbox", { name: "Buy Tesla" })).toHaveValue("50.00")
  })

  test(`a buy with Face ID fills, then shows in holdings and activity`, async ({ page, funded: _funded }) => {
    await buy(page, "SPCX", 10)

    const status = page.getByRole("region", { name: "Trade status" })
    await expect(status.getByRole("heading", { name: /^Bought \$\d+\.\d{2} of SpaceX$/ })).toBeVisible()
    await expect(status.getByText("Shares bought")).toBeVisible()
    await expect(status.getByRole("link", { name: "View on BaseScan" })).toBeVisible()
    await page.goto("/portfolio")
    await expect(page.getByRole("region", { name: "Holdings" }).getByRole("link", { name: /^SPCX SpaceX/ }))
      .toBeVisible()
    await page.goto("/activity")
    await expect(page.getByRole("button", { name: /^Bought \$\d+\.\d{2} of SpaceX/ })).toBeVisible()
  })

  test(`"Buy more SpaceX" starts a new buy`, async ({ page, funded: _funded }) => {
    await buy(page, "SPCX", 5)

    await page.getByRole("button", { name: "Buy more SpaceX" }).click()

    await expect(tradeBox(page, "SpaceX").getByRole("textbox", { name: "Buy SpaceX" })).toHaveValue("")
  })

  test(`a cancelled Face ID sends nothing, and the page says so`, async ({ page, authenticator, funded: _funded }) => {
    await page.goto("/stocks/SPCX")
    const box = tradeBox(page, "SpaceX")
    await box.getByRole("textbox", { name: "Buy SpaceX" }).fill("10")
    await expect(box.getByText("Within 1%")).toBeVisible()
    await authenticator.setVerified(false)
    const confirms: Array<string> = []
    page.on("request", (request) => {
      if (/\/api\/trades\/[^/]+\/confirm$/.test(request.url())) confirms.push(request.url())
    })

    await box.getByRole("button", { name: "Buy with Face ID" }).click()

    await expect(box.getByText("You cancelled Face ID. Nothing was bought."))
      .toBeVisible()
    expect(confirms).toEqual([])
    await expect(box.getByText("$1,000.00 cash available")).toBeVisible()
  })
})

test.describe("selling on a stock's page", () => {
  test("with no shares, there is nothing to sell", async ({ page, funded: _funded }) => {
    await page.goto("/stocks/MSTR")
    const box = tradeBox(page, "Strategy")

    await box.getByRole("tab", { name: "Sell" }).click()

    await expect(box.getByText("You don't own any MSTR yet.")).toBeVisible()
    await expect(box.getByText("0 shares, worth $0.00")).toBeVisible()
    await expect(box.getByRole("button", { name: "Max" })).toBeHidden()
    await expect(box.getByRole("button", { name: "Sell with Face ID" })).toBeDisabled()
  })

  test("the Sell tab shows the shares you own and their worth", async ({ page, user }) => {
    await giveShares(user, { TSLA: 3 })
    await user.fund(page)
    await page.goto("/stocks/TSLA")
    const box = tradeBox(page, "Tesla")

    await box.getByRole("tab", { name: "Sell" }).click()

    await expect(box.getByText(/^3 shares, worth \$[\d,]+\.\d{2}$/)).toBeVisible()
    await expect(box.getByText("Enter how much to sell.")).toBeVisible()
    await expect(box.getByRole("group", { name: "Quick amounts" })).toBeHidden()
  })

  test("part of your shares, typed in shares, is quoted in USDC", async ({ page, user }) => {
    await giveShares(user, { TSLA: 3 })
    await user.fund(page)
    await page.goto("/stocks/TSLA")
    const box = tradeBox(page, "Tesla")
    await box.getByRole("tab", { name: "Sell" }).click()
    await box.getByRole("button", { name: "Amount in USDC. Switch to shares" }).click()

    await box.getByRole("textbox", { name: "Sell Tesla" }).fill("1.5")

    await expect(box.getByText(/^About \$[\d,]+\.\d{2} for 1\.5 shares\.$/)).toBeVisible()
    await expect(box.getByRole("definition").nth(0)).toHaveText("TSLATesla")
    await expect(box.getByRole("definition").nth(1)).toHaveText("1.5 shares")
    await expect(box.getByRole("button", { name: "Sell with Face ID" })).toBeEnabled()
  })

  test("Max sells every share, in the unit shown", async ({ page, user }) => {
    await giveShares(user, { TSLA: 3 })
    await user.fund(page)
    await page.goto("/stocks/TSLA")
    const box = tradeBox(page, "Tesla")
    await box.getByRole("tab", { name: "Sell" }).click()

    await box.getByRole("button", { name: "Max" }).click()

    await expect(box.getByRole("textbox", { name: "Sell Tesla" })).toHaveValue(/^[\d,]+(\.\d{1,2})?$/)
    await box.getByRole("button", { name: "Amount in USDC. Switch to shares" }).click()
    await expect(box.getByRole("textbox", { name: "Sell Tesla" })).toHaveValue("3")
  })

  test("more shares than you have is refused", async ({ page, user }) => {
    await giveShares(user, { TSLA: 3 })
    await user.fund(page)
    await page.goto("/stocks/TSLA")
    const box = tradeBox(page, "Tesla")
    await box.getByRole("tab", { name: "Sell" }).click()
    await box.getByRole("button", { name: "Amount in USDC. Switch to shares" }).click()

    await box.getByRole("textbox", { name: "Sell Tesla" }).fill("3.1")

    await expect(box.getByText("That's more than you have.")).toBeVisible()
    await expect(box.getByRole("button", { name: "Sell with Face ID" })).toBeDisabled()
  })

  test(`selling part of a holding with Face ID fills`, async ({ page, funded: _funded }) => {
    await buy(page, "SPCX", 20)
    await page.getByRole("button", { name: "Buy more SpaceX" }).click()
    const box = tradeBox(page, "SpaceX")
    await box.getByRole("tab", { name: "Sell" }).click()
    await box.getByRole("textbox", { name: "Sell SpaceX" }).fill("5")
    await expect(box.getByText(/^About \$5\.00 for \d+\.\d+ shares\.$/)).toBeVisible()

    await box.getByRole("button", { name: "Sell with Face ID" }).click()

    await expect(page.getByRole("button", { name: "Trade again" })).toBeVisible()
    await expect(page.getByRole("heading", { name: /^Sold \d+(\.\d+)? shares? of SpaceX$/ })).toBeVisible()
    await page.goto("/activity")
    await expect(page.getByRole("button", { name: /^Sold \$\d+\.\d{2} of SpaceX/ })).toBeVisible()
  })
})
