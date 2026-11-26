// Money moved the way a person moves it: a buy on the stock's page and a withdrawal from Portfolio, each signed with the
// page's passkey. Holdings a screen needs without a trade come from the devnet's controls, for the test's own account.
import { stocks } from "@bluechip/chain/Contracts"
import { mintShares, rpc } from "@bluechip/devnet/Controls"
import { expect, type Page } from "@playwright/test"
import type { User } from "../fixtures/users.ts"
import { urls } from "../stack/Stack.ts"

const stock = (symbol: string) => {
  const found = stocks.find((candidate) => candidate.symbol === symbol)
  if (found === undefined) throw new Error(`e2e: bluechip doesn't trade ${symbol}`)
  return found
}

/** A stock's name as bluechip shows it: "NVIDIA" for NVDA. */
export const stockName = (symbol: string) => stock(symbol).name

/** Buys `dollars` of `symbol` on its page with Face ID; resolves once the trade is filled. */
export const buy = async (page: Page, symbol: string, dollars: number) => {
  const name = stockName(symbol)
  await page.goto(`/stocks/${symbol}`)
  await page.getByRole("textbox", { name: `Buy ${name}` }).fill(String(dollars))
  await expect(page.getByText("Within 1% of Chainlink's price")).toBeVisible()

  await page.getByRole("button", { name: "Buy with Face ID" }).click()
  await expect(page.getByRole("button", { name: "Bought. Buy more" })).toBeVisible()
}

/**
 * Gives `user` whole shares of stocks (`{ TSLA: 3 }`), minted on the devnet. Call it before `user.fund(page)`: the
 * server keeps an account's balances for 15 seconds, and funding is what makes it read them again.
 */
export const giveShares = async (user: User, shares: Readonly<Record<string, number>>) => {
  const node = rpc(urls.anvil)
  for (const [symbol, count] of Object.entries(shares)) {
    await mintShares(node, stock(symbol).token, user.address, BigInt(count) * BigInt(100_000_000))
  }
}

/** Withdraws `dollars` of cash to `to` from Portfolio's Withdraw dialog with Face ID; resolves once Base confirms it. */
export const withdraw = async (page: Page, dollars: number, to: string) => {
  await page.goto("/portfolio")
  await page.getByRole("region", { name: "Holdings" }).waitFor()
  await page.getByRole("button", { name: "Withdraw" }).first().click()

  const dialog = page.getByRole("dialog", { name: "Withdraw cash" })
  await dialog.getByRole("textbox", { name: "Amount" }).fill(String(dollars))
  await dialog.getByRole("textbox", { name: /^To this address on Base/ }).fill(to)
  await dialog.getByRole("button", { name: "Review withdrawal" }).click()
  await dialog.getByRole("button", { name: "Withdraw with Face ID" }).click()
  // "Done" replaces "Close" once Base confirms it.
  await dialog.getByRole("button", { name: "Done", exact: true }).click()
}
