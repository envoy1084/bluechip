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

/**
 * Saves an automation for the agent `agentId` that asks you first about a buy of `dollars` split evenly across
 * `symbols`, through the API the editor calls (`POST /api/automations`); resolves with its id. At any hour of the
 * market, so a fire always runs.
 */
export const saveAskingBuy = async (
  page: Page,
  agent: {
    readonly agentId: string
    readonly name: string
    readonly dollars: number
    readonly symbols: ReadonlyArray<string>
  }
): Promise<string> => {
  const weight = 10_000 / agent.symbols.length
  const response = await page.request.post("/api/automations", {
    headers: apiHeaders,
    data: {
      requestId: randomUUID(),
      draft: {
        name: agent.name,
        agentId: agent.agentId,
        trigger: { type: "schedule", config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" } },
        conditions: [],
        action: {
          type: "ask",
          config: {
            trade: {
              type: "buy",
              // USDC units, as a string: the API's JSON for amounts.
              config: {
                amount: String(agent.dollars * 1_000_000),
                split: agent.symbols.map((symbol) => ({ symbol, weight }))
              }
            }
          }
        },
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

/**
 * Runs an automation now, as its trigger would (`POST /api/dev/automations/:id/fire`, local network only): its run,
 * conditions, plan and trades, through the server's real fire.
 */
export const fireAutomation = async (page: Page, id: string) => {
  const response = await page.request.post(`/api/dev/automations/${id}/fire`, { headers: apiHeaders, data: {} })
  expect(response.status(), "POST /api/dev/automations/:id/fire").toBe(204)
}
