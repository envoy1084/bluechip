import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures/test.ts"
import { createAgent } from "../utils/agents.ts"
import { askToBuy, tradeCard } from "../utils/intents.ts"
import { giveShares } from "../utils/trading.ts"

const gettingStarted = (page: Page) => page.getByRole("region", { name: /^(Welcome to bluechip|Getting started)$/ })

test.describe("home", () => {
  test("a new person is greeted, welcomed with the first steps and asked to add cash", async ({ page, user: _user }) => {
    await expect(page.getByRole("heading", { level: 2, name: /^Good (morning|afternoon|evening)$/ })).toBeVisible()
    await expect(
      page.getByText(new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }))
    )
      .toBeVisible()
    await expect(page.getByRole("region", { name: "Your money" })).toBeHidden()
    const welcome = page.getByRole("region", { name: "Welcome to bluechip" })
    await expect(welcome.getByRole("progressbar", { name: "Steps done" })).toHaveAttribute(
      "aria-valuetext",
      "0 of 5 done"
    )
    await expect(welcome.getByText("Send USDC on Base. It's yours to invest or take out at any time.")).toBeVisible()

    await welcome.getByRole("button", { name: "Add cash" }).click()

    await expect(page.getByRole("dialog", { name: "Add cash" })).toBeVisible()
  })

  test("a new person can ask the assistant from the welcome", async ({ page, user: _user }) => {
    await page.getByRole("region", { name: "Welcome to bluechip" }).getByRole("link", { name: "Ask the assistant" })
      .click()

    await expect(page).toHaveURL(/\/chat$/)
    await expect(page.getByRole("heading", { name: "New chat", level: 1 })).toBeVisible()
  })

  test("home has no chat or activity of its own", async ({ page, user: _user }) => {
    await expect(page.getByRole("textbox", { name: "Message bluechip" })).toBeHidden()
    await expect(page.getByRole("region", { name: "Latest activity" })).toBeHidden()
  })

  test("your money shows the total, all of it in cash, with Add cash", async ({ page, funded: _funded }) => {
    await page.reload()

    const money = page.getByRole("region", { name: "Your money" })
    await expect(money).toContainText("$1,000.00")
    await expect(money.getByRole("img", { name: "Cash 100%" })).toBeVisible()
    await expect(money).toContainText("$1,000.00 in cash to invest")
    await expect(money.getByRole("button", { name: "Add cash" })).toBeVisible()
  })

  test("with cash in, getting started ticks it and offers a first agent", async ({ page, funded: _funded }) => {
    await page.reload()

    const steps = gettingStarted(page)
    await expect(steps.getByRole("heading", { name: "Getting started" })).toBeVisible()
    await expect(steps.getByRole("progressbar", { name: "Steps done" })).toHaveAttribute(
      "aria-valuetext",
      "1 of 5 done"
    )
    await steps.getByRole("link", { name: "New agent" }).click()

    await expect(page).toHaveURL(/\/agents\/new$/)
  })

  test("your agents show on home and lead to theirs", async ({ page, funded: _funded }) => {
    const { id } = await createAgent(page, { name: "Home agent" })
    await page.getByRole("link", { name: "Home", exact: true }).click()

    await page.getByRole("region", { name: "Your agents" }).getByRole("link", { name: /^Home agent/ }).click()

    await expect(page).toHaveURL(new RegExp(`/agents/${id}$`))
  })

  test("a trade waiting for you needs you, and Review opens the approvals", async ({ page, funded: _funded }) => {
    await createAgent(page, { stocks: ["NVDA NVIDIA"], askAbove: 100 })
    await askToBuy(page, 150)
    await expect(tradeCard(page).getByText("Needs your approval", { exact: true })).toBeVisible()
    await page.goto("/home")

    const needs = page.getByRole("region", { name: "Needs you" })
    await expect(needs.getByText("1 trade waits for your approval")).toBeVisible()
    await needs.getByRole("button", { name: "Review" }).click()

    await expect(page.getByRole("dialog", { name: "Approvals" })).toBeVisible()
  })

  test("nothing needs a new person", async ({ page, user: _user }) => {
    await expect(page.getByRole("region", { name: "Your agents" })).toBeHidden()
    await expect(page.getByRole("region", { name: "Needs you" })).toBeHidden()
  })

  test("the total counts shares, and today's move is theirs", async ({ page, user }) => {
    await giveShares(user, { MSFT: 4 })
    await user.fund(page)

    await page.reload()

    // $1,000 of cash and four shares of Microsoft at the devnet's price, more than a dollar each.
    await expect(page.getByRole("region", { name: "Your money" })).toContainText(
      /\$1,[1-9]\d{2}\.\d{2}|\$[2-9],\d{3}\.\d{2}/
    )
    await expect(page.getByRole("main")).toContainText(/[+−-]\$\d+\.\d{2}/)
    await expect(page.getByRole("main")).toContainText(/[+−-]\d+\.\d{2}%/)
  })
})
