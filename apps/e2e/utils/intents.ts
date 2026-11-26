// Asking an agent for a trade the way a person does: the agent page's "Trade with this agent" card.
import { expect, type Page } from "@playwright/test"
import { openRule, startAgent } from "./agents.ts"

/** The agent page's "Trade with this agent" card. */
export const tradeCard = (page: Page) => page.getByRole("region", { name: "Trade with this agent" })

/** The agent page's activity list. */
export const agentActivity = (page: Page) => page.getByRole("region", { name: "Activity" })

/** Types an amount to spend on the agent page's trade card; its policies' answer follows below it. */
export const typeBuy = async (page: Page, dollars: number) => {
  await tradeCard(page).getByRole("textbox", { name: "How much to spend" }).fill(String(dollars))
}

/** Asks the agent (on its page) to buy `dollars` of its first stock. */
export const askToBuy = async (page: Page, dollars: number) => {
  await typeBuy(page, dollars)
  await tradeCard(page).getByRole("button", { name: /^Ask .+ to buy$/ }).click()
}

/**
 * Makes a Stock picker for NVIDIA with a daily budget other than the template's $250 (`createAgent` keeps it), so its
 * "Ask me above" may go higher; locks it with Face ID and resolves on its page.
 */
export const createAgentWithBudget = async (
  page: Page,
  rules: { readonly dailyBudget: number; readonly askAbove: number }
) => {
  await startAgent(page)
  await page.getByRole("button", { name: "NVDA NVIDIA" }).click()
  await page.getByRole("textbox", { name: "Daily budget" }).fill(String(rules.dailyBudget))
  await openRule(page, "Trade size")
  await page.getByRole("textbox", { name: "Ask me above" }).fill(String(rules.askAbove))

  await page.getByRole("button", { name: "Review" }).click()
  await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()
  await expect(page.getByRole("heading", { name: / is live$/ })).toBeVisible()

  await page.getByRole("link", { name: /^Go to / }).click()
  await expect(page).toHaveURL(/\/agents\/agent_[0-9a-z]+$/)
}
