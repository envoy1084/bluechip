import { expect, test } from "../fixtures/test.ts"
import { createAgent } from "../utils/agents.ts"

test.describe("audit log", () => {
  test("a new account's first entry is this browser signing in", async ({ page, user: _user }) => {
    await page.goto("/settings/audit")

    await expect(page.getByRole("heading", { name: "Audit log", level: 1 })).toBeVisible()
    await expect(page.getByTestId("audit-event").first()).toContainText("signed in")
    await expect(page.getByTestId("audit-event").first()).toContainText("You")
  })

  test("filtered to agents, it lists the lock of a new agent", async ({ page, funded: _funded }) => {
    await createAgent(page, { name: "Audited picker" })
    await page.goto("/settings/audit")

    await page.getByRole("tablist", { name: "Kind" }).getByRole("tab", { name: "Agents" }).click()

    await expect(page.getByTestId("audit-event").first()).toContainText(
      "Audited picker's policies are in force onchain"
    )
    await expect(page.getByText("You locked Audited picker's policies with Face ID")).toBeVisible()
    await expect(page.getByText("signed in")).toBeHidden()
  })

  test("a filter nothing matches shows an empty state", async ({ page, user: _user }) => {
    await page.goto("/settings/audit")

    await page.getByRole("tablist", { name: "Kind" }).getByRole("tab", { name: "Recovery" }).click()

    await expect(page.getByText("Nothing your account did matches these filters.")).toBeVisible()
  })

  test("dates: a range before today is empty", async ({ page, user: _user }) => {
    await page.goto("/settings/audit")

    await page.getByRole("combobox", { name: "Days" }).click()
    await page.getByRole("option", { name: "Custom range" }).click()
    await page.getByLabel("To").fill("2020-01-01")

    await expect(page.getByText("Nothing your account did matches these filters.")).toBeVisible()
  })

  test("a search narrows the loaded entries, and says when none matches", async ({ page, user: _user }) => {
    await page.goto("/settings/audit")
    await expect(page.getByTestId("audit-event").first()).toBeVisible()

    await page.getByRole("searchbox", { name: "Search the log" }).fill("no such entry anywhere")

    await expect(page.getByText("No entry matches “no such entry anywhere”")).toBeVisible()
  })

  test("an entry opens its record", async ({ page, user: _user }) => {
    await page.goto("/settings/audit")

    await page.getByTestId("audit-event").first().getByRole("button", { name: /^Details: / }).click()

    await expect(page.getByText("device.signedIn")).toBeVisible()
  })

  test("Export JSON downloads the log", async ({ page, user: _user }) => {
    await page.goto("/settings/audit")

    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: "Export JSON" }).click()
    const file = await download

    expect(file.suggestedFilename()).toMatch(/^bluechip-audit-\d{4}-\d{2}-\d{2}\.json$/)
  })
})
