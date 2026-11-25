// Agents made the way a person makes one: the new agent flow, locked with the page's passkey.
import { expect, type Page } from "@playwright/test"

export interface NewAgent {
  /** The template's name as the picker shows it ("Stock picker", "Weekly buyer", "Start from scratch"…). */
  readonly template?: string
  /** The stocks it trades, by symbol and name as the stock buttons read ("NVDA NVIDIA"). */
  readonly stocks?: ReadonlyArray<string>
  readonly name?: string
  /** "Ask me above": the largest trade it makes without your OK, in dollars. */
  readonly askAbove?: number
}

/** Opens the rules step of a new agent from `template`. */
export const startAgent = async (page: Page, template = "Stock picker") => {
  await page.goto("/agents/new")
  await page.getByRole("radio", { name: new RegExp(`^${template}`) }).click()
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByText("Rules it follows")).toBeVisible()
}

/** Makes an agent and locks it with Face ID; resolves on its page, with its id. */
export const createAgent = async (page: Page, agent: NewAgent = {}): Promise<{ readonly id: string }> => {
  await startAgent(page, agent.template)
  for (const stock of agent.stocks ?? ["NVDA NVIDIA"]) await page.getByRole("button", { name: stock }).click()
  if (agent.askAbove !== undefined) {
    await page.getByRole("textbox", { name: "Ask me above" }).fill(String(agent.askAbove))
  }

  await page.getByRole("button", { name: "Review" }).click()
  if (agent.name !== undefined) await page.getByRole("textbox", { name: "Name" }).fill(agent.name)
  await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()
  await expect(page.getByRole("heading", { name: / is live$/ })).toBeVisible()

  await page.getByRole("button", { name: /^Go to / }).click()
  await expect(page).toHaveURL(/\/agents\/agent_[0-9a-z]+$/)
  return { id: new URL(page.url()).pathname.split("/").at(-1)! }
}
