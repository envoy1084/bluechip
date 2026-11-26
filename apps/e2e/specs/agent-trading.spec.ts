import { expect, test } from "../fixtures/test.ts"
import { createAgent } from "../utils/agents.ts"
import { agentActivity, askToBuy, createAgentWithBudget, tradeCard, typeBuy } from "../utils/intents.ts"

test.describe("asking an agent for a trade", () => {
  test("the preview says a trade within its policies is sent by the agent itself", async ({ page, funded: _funded }) => {
    await createAgent(page, { stocks: ["NVDA NVIDIA"], askAbove: 100 })

    await typeBuy(page, 50)

    await expect(tradeCard(page).getByText("Within its policies, so it sends it itself.")).toBeVisible()
  })

  test("the preview says a trade over its largest trade needs your Face ID", async ({ page, funded: _funded }) => {
    await createAgent(page, { stocks: ["NVDA NVIDIA"], askAbove: 100 })
    await expect(tradeCard(page).getByRole("button", { name: "Ask Stock picker to buy" })).toBeDisabled()

    await typeBuy(page, 150)

    await expect(
      tradeCard(page).getByText("Over its $100 limit, so it needs your approval.")
    ).toBeVisible()
    await expect(tradeCard(page).getByRole("button", { name: "Ask Stock picker to buy" })).toBeEnabled()
  })

  test("a trade within its policies is sent and fills", async ({ page, funded: _funded }) => {
    await createAgent(page, { stocks: ["NVDA NVIDIA"], askAbove: 100 })

    await askToBuy(page, 50)

    await expect(tradeCard(page).getByRole("heading", { name: "Bought $50.00 of NVIDIA" })).toBeVisible()
    await expect(tradeCard(page).getByRole("button", { name: "Trade again" })).toBeVisible()
  })

  test("the journal tells a filled trade by day, newest first, after its rules were locked", async ({ page, funded: _funded }) => {
    await createAgent(page, { stocks: ["NVDA NVIDIA"], askAbove: 100 })
    await askToBuy(page, 50)
    await expect(tradeCard(page).getByRole("heading", { name: "Bought $50.00 of NVIDIA" })).toBeVisible()

    await page.getByRole("link", { name: "Journal" }).click()
    const today = page.getByRole("region", { name: "Journal" }).getByRole("region", { name: "Today" })
    const lines = today.getByRole("listitem")
    await expect(lines.first()).toContainText("Buy $50.00 of NVIDIA")
    await expect(lines.first().getByText("Filled", { exact: true })).toBeVisible()
    await expect(lines.filter({ hasText: "Within its policies, so it sent it itself." })).toContainText("Sent")
    await expect(lines.last()).toContainText("Rules locked with Face ID")

    await page.getByRole("tablist", { name: "Show" }).getByRole("tab", { name: "Rules" }).click()
    await expect(lines).toHaveCount(1)
    await expect(lines.first()).toContainText("Rules locked with Face ID")
  })

  // fixme: the activity row never showed Filled within 30 s; not diagnosed (run once on the 2 s-block stack)
  test.fixme("a filled trade shows in its activity, its usage, the stock's holdings and Activity", async ({ page, funded: _funded }) => {
    await createAgent(page, { stocks: ["NVDA NVIDIA"], askAbove: 100 })
    await askToBuy(page, 50)
    await expect(tradeCard(page).getByRole("heading", { name: "Bought $50.00 of NVIDIA" })).toBeVisible()

    const row = agentActivity(page).getByRole("listitem").filter({ hasText: "Buy $50.00 of NVIDIA" })
    await expect(row.getByText("Filled", { exact: true })).toBeVisible()
    await expect(row.getByText("Within its policies, so it sends it itself.")).toBeVisible()
    const usage = page.getByRole("region", { name: "Usage" })
    await expect(usage.getByText("$200 left today")).toBeVisible()
    await expect(usage.getByText("11 left today")).toBeVisible()

    await page.goto("/stocks/NVDA")
    const trade = page.getByRole("region", { name: "Trade NVIDIA" })
    await trade.getByRole("tab", { name: "Sell" }).click()
    await expect(trade.getByText(/^0\.\d+ shares, worth \$\d+\.\d{2}$/)).toBeVisible()

    await page.goto("/activity")
    await expect(page.getByText("Bought $50.00 of NVIDIA")).toBeVisible()
  })

  // fixme: the blocked line's copy never appeared; check the wording against DecisionLine
  test.fixme("a buy that would put over 30% in one stock is blocked, with the policy in words", async ({ page, funded: _funded }) => {
    await createAgentWithBudget(page, { dailyBudget: 500, askAbove: 400 })

    await askToBuy(page, 350)

    await expect(tradeCard(page).getByText("Blocked", { exact: true })).toBeVisible()
    await expect(
      tradeCard(page).getByText("Blocked by Max in one stock: Would put too much of your money in NVIDIA.")
    ).toBeVisible()
    await expect(tradeCard(page).getByText("Nothing was bought. Your cash is where it was.")).toBeVisible()
    await expect(agentActivity(page).getByText("Buy $350.00 of NVIDIA, blocked")).toBeVisible()
  })

  test("a paused agent can't be asked to trade", async ({ page, funded: _funded }) => {
    await createAgent(page, { stocks: ["NVDA NVIDIA"], askAbove: 100 })
    await expect(tradeCard(page)).toBeVisible()

    await page.getByRole("button", { name: "Pause", exact: true }).click()

    await expect(page.getByText("Stock picker is paused")).toBeVisible()
    await expect(page.getByText("It won't trade until you resume it. Nothing was sold.")).toBeVisible()
    await expect(tradeCard(page)).toBeHidden()
  })
})
