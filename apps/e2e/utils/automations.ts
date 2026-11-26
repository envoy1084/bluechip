// Automations made the way a person makes one: the editor, from the list or an agent's page.
import { expect, type Page } from "@playwright/test"

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
