import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures/test.ts"
import { buy, withdraw } from "../utils/trading.ts"

const burn = "0x000000000000000000000000000000000000dEaD"

const choosePeriod = async (page: Page, period: string) => {
  await page.getByRole("combobox", { name: "Period" }).click()
  await page.getByRole("option", { name: period }).click()
}

test.describe("activity", () => {
  test("a new person's activity is empty, and says where trades will show", async ({ page, user: _user }) => {
    await page.goto("/activity")

    await expect(page.getByText("No activity yet")).toBeVisible()
    await expect(page.getByText("Your trades, deposits and withdrawals show up here.")).toBeVisible()
    await choosePeriod(page, "All time")
    await expect(page.getByText("No activity yet")).toBeVisible()
    await expect(page.getByText("Try another type or a longer period.")).toBeHidden()
  })

  test("a withdrawal is listed under today", async ({ page, funded: _funded }) => {
    await withdraw(page, 15, burn)

    await page.goto("/activity")

    await expect(page.getByRole("heading", { name: "Today", level: 2 })).toBeVisible()
    await expect(page.getByText("Withdrew $15.00")).toBeVisible()
    await expect(page.getByText("To 0x0000…dEaD on Base")).toBeVisible()
    const summary = page.getByRole("region", { name: "Summary" })
    await expect(summary.getByText("$15.00")).toBeVisible()
    await expect(summary.getByText("1 withdrawal")).toBeVisible()
  })

  test("a withdrawal's details show its amount, address, status and transaction", async ({ page, funded: _ }) => {
    await withdraw(page, 15, burn)
    await page.goto("/activity")

    await page.getByText("Withdrew $15.00").click()

    const details = page.getByRole("dialog", { name: "Withdrew $15.00" })
    await expect(details.getByRole("definition")).toHaveText([
      "Withdrawal",
      "$15.00 USDC",
      burn,
      "Sent",
      /^0x[0-9a-f]{4}…[0-9a-f]{4}$/
    ])
    await expect(details.getByRole("link", { name: /^0x/ })).toHaveAttribute(
      "href",
      /^https:\/\/basescan\.org\/tx\/0x[0-9a-f]{64}$/
    )
  })

  test("the Trades filter leaves out withdrawals, and Cash keeps them", async ({ page, funded: _funded }) => {
    await withdraw(page, 15, burn)
    await page.goto("/activity")
    await expect(page.getByText("Withdrew $15.00")).toBeVisible()
    const filter = page.getByRole("tablist", { name: "Filter by type" })

    await filter.getByRole("tab", { name: "Trades" }).click()

    await expect(page.getByText("Withdrew $15.00")).toBeHidden()
    await expect(page.getByText("Nothing here yet")).toBeVisible()
    await expect(page.getByText("Try another type or a longer period.")).toBeVisible()
    await filter.getByRole("tab", { name: "Cash" }).click()
    await expect(page.getByText("Withdrew $15.00")).toBeVisible()
  })

  test("an empty filter offers every type and period again", async ({ page, funded: _funded }) => {
    await withdraw(page, 15, burn)
    await page.goto("/activity")
    const filter = page.getByRole("tablist", { name: "Filter by type" })
    await filter.getByRole("tab", { name: "Trades" }).click()

    await page.getByRole("button", { name: "Show all activity" }).click()

    await expect(filter.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true")
    await expect(page.getByRole("combobox", { name: "Period" })).toHaveText("All time")
    await expect(page.getByText("Withdrew $15.00")).toBeVisible()
  })

  test.fixme(
    "a filled buy's details are its receipt, then the price checked against Chainlink (bug: on a holiday the chain runs days ahead of the server's clock, so every swap's deadline has passed)",
    async ({ page, funded: _funded }) => {
      await buy(page, "SPCX", 10)
      await page.goto("/activity")

      await page.getByText(/^Bought \$\d+\.\d{2} of SpaceX$/).click()

      const details = page.getByRole("dialog", { name: /^Bought \$\d+\.\d{2} of SpaceX$/ })
      const receipt = details.getByRole("region", { name: "Bought SpaceX" })
      await expect(details).toContainText(/You, today at \d{2}:\d{2}/)
      await expect(details.getByRole("definition")).toHaveText([
        /^[\d.]+ shares?$/,
        /^\$\d+\.\d{2} a share$/,
        /^\$\d+\.\d{2}$/,
        /^\$\d+\.\d{2}$/,
        /^\d+\.\d{2}% (worse|better) than Chainlink$/
      ])
      await expect(receipt.getByRole("link", { name: "View on BaseScan" })).toBeVisible()
    }
  )
})
