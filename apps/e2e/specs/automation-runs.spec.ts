import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures/test.ts"
import { createAgent } from "../utils/agents.ts"
import { fireAutomation, saveAgentBuy } from "../utils/automations.ts"
import { createAgentWithBudget } from "../utils/intents.ts"

const runs = (page: Page) =>
  page.getByRole("region", { name: "Runs" }).getByRole("region", { name: "Today" }).getByRole("listitem")

test.describe("an automation's runs", () => {
  test("a run whose trade fills says it traded", async ({ page, funded: _funded }) => {
    const agent = await createAgent(page, { stocks: ["NVDA NVIDIA"], askAbove: 100 })
    const automation = await saveAgentBuy(page, {
      agentId: agent.id,
      name: "Small buy",
      dollars: 20,
      symbols: ["NVDA"]
    })

    await fireAutomation(page, automation)
    await page.goto(`/automations/${automation}`)

    await expect(runs(page).first().locator("[data-slot=status-pill]").first()).toHaveText("Traded")
  })

  test("a run whose trades were all blocked says so, and by which policy", async ({ page, funded: _funded }) => {
    // $350 of $1,000 would put over 30% in NVIDIA, past its max in one stock.
    await createAgentWithBudget(page, { dailyBudget: 500, askAbove: 400 })
    const agentId = new URL(page.url()).pathname.split("/").at(-1)!
    const automation = await saveAgentBuy(page, { agentId, name: "Too much", dollars: 350, symbols: ["NVDA"] })

    await fireAutomation(page, automation)
    await page.goto(`/automations/${automation}`)

    const run = runs(page).first()
    await expect(run.locator("[data-slot=status-pill]").first()).toHaveText("Blocked")
    await expect(run.getByText("Its trades were blocked by Max in one stock, so nothing was traded.")).toBeVisible()
  })
})

test.describe("an agent's automations", () => {
  test("removing the agent deletes its automations", async ({ page, funded: _funded }) => {
    const agent = await createAgent(page, { name: "Going away" })
    await saveAgentBuy(page, { agentId: agent.id, name: "Its weekly buy", dollars: 20, symbols: ["NVDA"] })
    await page.goto("/automations")
    await expect(page.getByRole("link", { name: /^Its weekly buy / })).toBeVisible()

    await page.goto(`/agents/${agent.id}`)
    await page.getByRole("button", { name: "Remove", exact: true }).click()
    const confirm = page.getByRole("region", { name: "Remove Going away?" })
    await expect(confirm).toContainText("its automations are deleted with it")
    await confirm.getByRole("button", { name: "Remove agent" }).click()
    await expect(page).toHaveURL(/\/agents$/)

    await page.goto("/automations")
    await expect(page.getByRole("heading", { name: "No automations yet" })).toBeVisible()
  })
})
