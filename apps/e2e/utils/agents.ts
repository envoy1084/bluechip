// Agents made the way a person makes one: the new agent flow, locked with the page's passkey.
import { expect, type Locator, type Page } from "@playwright/test"
import type { Authenticator } from "../fixtures/authenticator.ts"

export interface NewAgent {
  /** The template's name as the picker shows it ("Stock picker", "Weekly buyer", "Start from scratch"…). */
  readonly template?: string
  /** The stocks it trades, by symbol and name as the stock buttons read ("NVDA NVIDIA"). */
  readonly stocks?: ReadonlyArray<string>
  readonly name?: string
  /** "Ask you above": the largest trade it makes without your approval, in dollars. */
  readonly askAbove?: number
}

/** Opens the rules step of a new agent from `template`. */
export const startAgent = async (page: Page, template = "Stock picker") => {
  await page.goto("/agents/new")
  await page.getByRole("radio", { name: new RegExp(`^${template}`) }).click()
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByRole("heading", { name: "Its limits" })).toBeVisible()
}

/** Opens a rule's row on the rules step (folded to a line until opened) so its fields can be set. */
export const openRule = async (page: Page, title: string) => {
  const trigger = page.locator("[data-slot='policy-row']").getByRole("button", { name: new RegExp(`^${title}`) })
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click()
}

/** Opens the rules step's Fine-tuning: fair price, weekly slippage and trades a day. */
export const openFineTuning = async (page: Page) => {
  const trigger = page.getByRole("button", { name: /^Fine-tuning/ })
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click()
}

/**
 * Gives each of a Stop-loss guard's stocks ("AAPL Apple") the floor `price`: the guard starts with its floor on, and
 * can't be reviewed until every stock has one.
 */
export const setFloors = async (page: Page, stocks: ReadonlyArray<string>, price = 100) => {
  await openRule(page, "Stop-loss floor")
  for (const stock of stocks) {
    await page.getByRole("textbox", { name: `${stock.slice(stock.indexOf(" ") + 1)} floor`, exact: true })
      .fill(String(price))
  }
}

/** Sets an agent's rules and opens its review, named `agent.name` when given. */
const reviewAgent = async (page: Page, agent: NewAgent) => {
  await startAgent(page, agent.template)
  const stocks = agent.stocks ?? ["NVDA NVIDIA"]
  for (const stock of stocks) await page.getByRole("button", { name: stock }).click()
  if (agent.template === "Stop-loss guard") await setFloors(page, stocks)
  if (agent.askAbove !== undefined) {
    await openRule(page, "Trade size")
    await page.getByRole("textbox", { name: "Ask you above" }).fill(String(agent.askAbove))
  }

  await page.getByRole("button", { name: "Review" }).click()
  if (agent.name !== undefined) await page.getByRole("textbox", { name: "Name" }).fill(agent.name)
}

/** Makes an agent and locks it with Face ID; resolves on its page, with its id. */
export const createAgent = async (page: Page, agent: NewAgent = {}): Promise<{ readonly id: string }> => {
  await reviewAgent(page, agent)
  await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()
  await expect(page.getByRole("heading", { name: / is live$/ })).toBeVisible()

  await page.getByRole("link", { name: /^Go to / }).click()
  await expect(page).toHaveURL(/\/agents\/agent_[0-9a-z]+$/)
  return { id: agentIdOf(page) }
}

/**
 * Makes a draft: the review's Face ID is cancelled, which saves the agent unlocked. Face ID works again afterwards;
 * resolves on the draft's page, with its id.
 */
export const createDraft = async (
  page: Page,
  authenticator: Authenticator,
  agent: NewAgent & { readonly name: string }
): Promise<{ readonly id: string }> => {
  await reviewAgent(page, agent)
  await authenticator.setVerified(false)
  await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()
  await expect(page.getByText("You cancelled Face ID. Nothing changed.")).toBeVisible()
  await authenticator.setVerified(true)

  await page.goto("/agents")
  await page.getByRole("link", { name: new RegExp(`^${agent.name} `) }).click()
  await expect(page.getByText(`${agent.name} isn't locked yet`)).toBeVisible()
  return { id: agentIdOf(page) }
}

const agentIdOf = (page: Page): string => new URL(page.url()).pathname.split("/").at(-1)!

/** A rule's row header on the rules step: its title, what it does now in a sentence, and Edit when it carries it. */
export const ruleRow = (page: Page, title: string): Locator =>
  page.locator("[data-slot='policy-row']").getByRole("button", { name: new RegExp(`^${title}`) })

/** The three numbers of the rules at a glance: a day, per trade, trades a day. */
export const glanceNumbers = (page: Page): Locator =>
  page.getByRole("region", { name: "Its rules at a glance" }).getByRole("definition")

/** The sentences of the "It can" half of the rules at a glance on the page (one card per screen). */
export const canRules = (page: Page): Locator =>
  page.getByRole("list", { name: "It can", exact: true }).first().getByRole("listitem")

/** The sentences of the "It can never" half of the rules at a glance on the page. */
export const neverRules = (page: Page): Locator =>
  page.getByRole("list", { name: "It can never", exact: true }).first().getByRole("listitem")

/** The agent state pill in the page's main area ("Active", "Paused", "Not locked yet"…). */
export const statePill = (page: Page): Locator => page.getByRole("main").locator("[data-slot='agent-status']")

const DAY = 24 * 60 * 60 * 1000

/** A day as the agent screens say it ("24 Feb"), `days` from now. */
export const dayFromNow = (days: number): string =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(Date.now() + days * DAY))

/** A moment `days` from now. */
export const daysFromNow = (days: number): Date => new Date(Date.now() + days * DAY)
