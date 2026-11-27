// Automations made the way a person makes one (the editor, from the list or an agent's page), or saved and fired through
// the API when a test needs a run.
import { expect, type Page } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { apiHeaders } from "../fixtures/users.ts"

/** A new automation's sentence: a weekly buy of the first stock it may trade. */
export const WEEKLY = /^Every Monday at 10:00 New York time, buy \$50 of [A-Za-z. ]+\.$/

/** The editor's sentence, as bluechip reads the draft back. */
export const sentence = (page: Page) => page.getByRole("region", { name: "What it does" }).locator("p").first()

/** Opens a new automation for your own trades, names it, saves it; resolves on its page. */
export const saveOwn = async (page: Page, name: string) => {
  await page.goto("/automations/new")
  await expect(sentence(page)).toHaveText(WEEKLY)
  await page.getByRole("textbox", { name: "Name" }).fill(name)
  await page.getByRole("button", { name: "Save automation" }).click()
  await expect(page).toHaveURL(/\/automations\/automation_[0-9a-z]+$/)
}

interface AgentBuy {
  readonly agentId: string
  readonly name: string
  readonly dollars: number
  readonly symbols: ReadonlyArray<string>
}

// Saves an automation for `agent` that buys `dollars` split evenly across its symbols, asking you first when `asks`,
// through the API the editor calls (`POST /api/automations`); resolves with its id. At any hour of the market, so a
// fire always runs.
const saveBuy = async (page: Page, agent: AgentBuy, asks: boolean): Promise<string> => {
  const weight = 10_000 / agent.symbols.length
  // USDC units, as a string: the API's JSON for amounts.
  const trade = {
    type: "buy",
    config: {
      amount: String(agent.dollars * 1_000_000),
      split: agent.symbols.map((symbol) => ({ symbol, weight }))
    }
  }
  const response = await page.request.post("/api/automations", {
    headers: apiHeaders,
    data: {
      requestId: randomUUID(),
      draft: {
        name: agent.name,
        agentId: agent.agentId,
        trigger: { type: "schedule", config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" } },
        conditions: [],
        action: asks ? { type: "ask", config: { trade } } : trade,
        settings: {
          cooldownMinutes: 60,
          maxFires: null,
          expiresAt: null,
          quietHours: null,
          marketHoursOnly: false,
          actDirectly: false
        }
      }
    }
  })
  expect(response.status(), "POST /api/automations").toBe(200)
  return (await response.json() as { readonly id: string }).id
}

/** Saves an automation for the agent `agentId` that asks you first about a buy (see `saveBuy`); resolves with its id. */
export const saveAskingBuy = (page: Page, agent: AgentBuy): Promise<string> => saveBuy(page, agent, true)

/** Saves an automation for the agent `agentId` that has it buy on its own, within its policies; resolves with its id. */
export const saveAgentBuy = (page: Page, agent: AgentBuy): Promise<string> => saveBuy(page, agent, false)

/**
 * Runs an automation now, as its trigger would (`POST /api/dev/automations/:id/fire`, local network only): its run,
 * conditions, plan and trades, through the server's real fire.
 */
export const fireAutomation = async (page: Page, id: string) => {
  const response = await page.request.post(`/api/dev/automations/${id}/fire`, { headers: apiHeaders, data: {} })
  expect(response.status(), "POST /api/dev/automations/:id/fire").toBe(204)
}
