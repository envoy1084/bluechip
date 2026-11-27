import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures/test.ts"
import { createAgent } from "../utils/agents.ts"
import { fireAutomation, saveAskingBuy } from "../utils/automations.ts"
import { agentActivity } from "../utils/intents.ts"

const approval = (page: Page) => page.getByRole("region", { name: /^Stock picker wants to buy / })

/**
 * A Stock picker on NVIDIA and Apple that asks above $50, with an automation that asks you first about $200 split
 * between them, fired: one plan of two $100 buys, each over its largest trade, waiting for one approval. Resolves with
 * the agent's id.
 */
const fireBatch = async (page: Page) => {
  const agent = await createAgent(page, { stocks: ["NVDA NVIDIA", "AAPL Apple"], askAbove: 50 })
  const automation = await saveAskingBuy(page, {
    agentId: agent.id,
    name: "Split buy",
    dollars: 200,
    symbols: ["NVDA", "AAPL"]
  })
  await fireAutomation(page, automation)
  return agent
}

test.describe("an automation's plan of several trades", () => {
  test("waits as one approval listing every trade, and one Face ID fills them all", async ({ page, funded: _funded }) => {
    await fireBatch(page)
    await page.goto("/approvals")

    await expect(page.getByText("2 trades wait for your approval")).toBeVisible()
    await expect(approval(page)).toHaveCount(1)
    await expect(approval(page).getByText("Buy $100.00 of NVIDIA", { exact: true })).toBeVisible()
    await expect(approval(page).getByText("Buy $100.00 of Apple", { exact: true })).toBeVisible()

    await approval(page).getByRole("button", { name: "Approve 2 trades with Face ID" }).click()

    const approved = page.getByRole("region", { name: /^You approved: buy / })
    await expect(approved.getByText("They're in your portfolio.")).toBeVisible()
    await expect(page.getByLabel("2 waiting")).toBeHidden()
  })

  test("the agent's activity says what each trade was planned with", async ({ page, funded: _funded }) => {
    const agent = await fireBatch(page)

    await page.goto(`/agents/${agent.id}/history`)

    const activity = agentActivity(page)
    await expect(
      activity.getByRole("listitem").filter({ hasText: "Buy $100.00 of NVIDIA" }).getByText(
        "Planned with buy $100.00 of Apple"
      )
    ).toBeVisible()
    await expect(
      activity.getByRole("listitem").filter({ hasText: "Buy $100.00 of Apple" }).getByText(
        "Planned with buy $100.00 of NVIDIA"
      )
    ).toBeVisible()
  })
})
