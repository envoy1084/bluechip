import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures/test.ts"
import { canRules, createAgent, dayFromNow, startAgent } from "../utils/agents.ts"

/** Reviews a Stock picker of Apple spending $400 a day, and saves its rules as `name`. */
const saveTemplate = async (page: Page, name: string) => {
  await startAgent(page, "Stock picker")
  await page.getByRole("button", { name: "AAPL Apple" }).click()
  await page.getByRole("textbox", { name: "Daily budget" }).fill("400")
  await page.getByRole("button", { name: "Review" }).click()

  await page.getByRole("button", { name: "Save as template" }).click()
  await page.getByRole("textbox", { name: "Template name" }).fill(name)
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByText(`Saved as ${name}. It's with your templates for the next agent.`)).toBeVisible()
}

test.describe("saved templates", () => {
  test("saving from the review says where it went", async ({ page, user: _user }) => {
    await startAgent(page, "Stock picker")
    await page.getByRole("button", { name: "AAPL Apple" }).click()
    await page.getByRole("button", { name: "Review" }).click()

    await page.getByRole("button", { name: "Save as template" }).click()

    await expect(page.getByRole("textbox", { name: "Template name" })).toHaveValue("Stock picker")
    await page.getByRole("textbox", { name: "Template name" }).fill("Apple only")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page.getByRole("status")).toHaveText(
      "Saved as Apple only. It's with your templates for the next agent."
    )
  })

  test("a template needs a name", async ({ page, user: _user }) => {
    await startAgent(page, "Stock picker")
    await page.getByRole("button", { name: "AAPL Apple" }).click()
    await page.getByRole("button", { name: "Review" }).click()
    await page.getByRole("button", { name: "Save as template" }).click()

    await page.getByRole("textbox", { name: "Template name" }).fill(" ")

    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled()
  })

  test("Cancel closes the form without saving", async ({ page, user: _user }) => {
    await startAgent(page, "Stock picker")
    await page.getByRole("button", { name: "AAPL Apple" }).click()
    await page.getByRole("button", { name: "Review" }).click()
    await page.getByRole("button", { name: "Save as template" }).click()

    await page.getByRole("button", { name: "Cancel" }).click()

    await expect(page.getByRole("textbox", { name: "Template name" })).toBeHidden()
    await page.goto("/agents/new")
    await expect(page.getByRole("radiogroup", { name: "Agent templates" }).getByRole("radio")).toHaveCount(5)
  })

  test("a saved template is offered in the template step", async ({ page, user: _user }) => {
    await saveTemplate(page, "Apple at 400")

    await page.goto("/agents/new")

    const template = page.getByRole("radio", { name: "Apple at 400" })
    await expect(template).toHaveAccessibleDescription("Your saved template: its rules start as you saved them.")
    await expect(template).toContainText("Buy and sell")
    await expect(page.getByRole("radiogroup", { name: "Agent templates" }).getByRole("radio")).toHaveCount(6)
  })

  test("starting from it opens its rules, without presets", async ({ page, user: _user }) => {
    await saveTemplate(page, "Apple starter")
    await page.goto("/agents/new")

    await page.getByRole("radio", { name: "Apple starter" }).click()
    await page.getByRole("button", { name: "Continue" }).click()

    await expect(page.getByRole("button", { name: "AAPL Apple" })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("textbox", { name: "Daily budget" })).toHaveValue("400")
    await expect(canRules(page).first()).toHaveText("Buy and sell Apple")
    await expect(page.getByText("Start from a preset")).toBeHidden()
  })

  test("an agent made from it is named after it", async ({ page, funded: _funded }) => {
    await saveTemplate(page, "Apple daily")
    await page.goto("/agents/new")
    await page.getByRole("radio", { name: "Apple daily" }).click()
    await page.getByRole("button", { name: "Continue" }).click()
    await page.getByRole("button", { name: "Review" }).click()

    await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue("Apple daily")
    await page.getByRole("button", { name: "Lock these rules with Face ID" }).click()
    await page.getByRole("link", { name: "Go to Apple daily" }).click()

    await expect(page.getByText(/^Apple daily template, created /)).toHaveText(
      `Apple daily template, created ${dayFromNow(0)}, locked until ${dayFromNow(90)}`
    )
    await page.goto("/agents")
    await expect(page.getByRole("link", { name: /^Apple daily / })).toContainText("Apple dailyApple dailyActive")
  })

  test("deleting it takes it off the template step", async ({ page, user: _user }) => {
    await saveTemplate(page, "Short lived")
    await page.goto("/agents/new")
    await page.getByRole("radio", { name: "Short lived" }).click()

    await page.getByRole("button", { name: "Delete template" }).click()

    await expect(page.getByRole("radio", { name: "Short lived" })).toBeHidden()
    await expect(page.getByRole("radio", { name: "Rebalancer" })).toBeChecked()
    await expect(page.getByRole("button", { name: "Delete template" })).toBeHidden()
    await page.reload()
    await expect(page.getByRole("radiogroup", { name: "Agent templates" }).getByRole("radio")).toHaveCount(5)
  })

  test("a built-in template can't be deleted", async ({ page, user: _user }) => {
    await page.goto("/agents/new")

    await page.getByRole("radio", { name: "Stock picker" }).click()

    await expect(page.getByRole("button", { name: "Delete template" })).toBeHidden()
  })

  test("an agent's page saves its rules as a template", async ({ page, funded: _funded }) => {
    await createAgent(page, { name: "Source agent" })

    await page.getByRole("button", { name: "Save as template" }).click()

    await expect(page.getByRole("textbox", { name: "Template name" })).toHaveValue("Source agent's rules")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page.getByText("Saved as Source agent's rules. It's with your templates for the next agent."))
      .toBeVisible()
    await page.goto("/agents/new")
    await expect(page.getByRole("radio", { name: "Source agent's rules" })).toBeVisible()
  })
})
