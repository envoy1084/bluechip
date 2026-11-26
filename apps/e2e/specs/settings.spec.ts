import { expect, test } from "../fixtures/test.ts"
import { createAgent } from "../utils/agents.ts"

test.describe("settings", () => {
  test("a saved name greets you on home and in the sidebar", async ({ page, user: _user }) => {
    await page.goto("/settings")
    const name = page.getByRole("textbox", { name: "Your name" })
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled()

    await name.fill("  Ada ")
    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled()
    await page.getByRole("link", { name: "Home" }).click()
    await expect(page.getByRole("heading", { level: 2, name: /^Good (morning|afternoon|evening), Ada$/ })).toBeVisible()
    await expect(page.getByRole("complementary", { name: "App navigation" })).toContainText("Ada")
  })

  test("a cleared name goes back to a plain greeting", async ({ page, user: _user }) => {
    await page.goto("/settings")
    const name = page.getByRole("textbox", { name: "Your name" })
    await name.fill("Grace")
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled()

    await name.fill("")
    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled()
    await page.reload()
    await expect(page.getByRole("textbox", { name: "Your name" })).toHaveValue("")
    await page.getByRole("link", { name: "Home" }).click()
    await expect(page.getByRole("heading", { level: 2, name: /^Good (morning|afternoon|evening)$/ })).toBeVisible()
  })

  test("the time zone: this browser's on the first visit, then changed in settings", async ({ page, user: _user }) => {
    await page.goto("/settings")
    const zone = page.getByRole("combobox", { name: "Time zone" })
    const browserZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
    await expect(zone).toHaveValue(browserZone)

    await zone.fill("Tokyo")
    await page.getByRole("option", { name: "Asia/Tokyo" }).click()

    await expect(zone).toHaveValue("Asia/Tokyo")
    await page.reload()
    await expect(page.getByRole("combobox", { name: "Time zone" })).toHaveValue("Asia/Tokyo")
    await page.goto("/settings/notifications")
    await page.getByRole("switch", { name: "Quiet hours" }).click()
    await expect(page.getByText("In Asia/Tokyo time, your time zone in Settings.")).toBeVisible()
  })

  test("the account shows its address and eligibility", async ({ page, user }) => {
    await page.goto("/settings")

    await expect(page.getByText("Send USDC on Base here to add cash.")).toBeVisible()
    await expect(page.getByRole("main")).toContainText(`${user.address.slice(0, 6)}…${user.address.slice(-4)}`)
    await expect(page.getByText("You confirmed you live outside the United States.")).toBeVisible()
    await expect(page.getByText("Confirmed", { exact: true })).toBeVisible()
  })

  test("Security settings opens your passkeys, recovery and devices", async ({ page, user: _user }) => {
    await page.goto("/settings")

    await page.getByRole("link", { name: "Security settings" }).click()

    await expect(page).toHaveURL(/\/settings\/security$/)
    await expect(page.getByRole("heading", { name: "Security", level: 1 })).toBeVisible()
    await expect(page.getByText("This device", { exact: true }).first()).toBeVisible()
  })

  test("Open the audit log opens it", async ({ page, user: _user }) => {
    await page.goto("/settings")

    await page.getByRole("link", { name: "Open the audit log" }).click()

    await expect(page).toHaveURL(/\/settings\/audit$/)
  })

  test("See memories opens an empty memory page for a new person", async ({ page, user: _user }) => {
    await page.goto("/settings")

    await page.getByRole("link", { name: "See memories" }).click()

    await expect(page).toHaveURL(/\/memory$/)
    await expect(page.getByRole("heading", { name: "Memory", level: 1 })).toBeVisible()
    await expect(
      page.getByText(
        "Nothing yet. Tell the assistant what matters to you, like \"I never want to own Tesla\", and it remembers."
      )
    ).toBeVisible()
  })

  test("the danger zone stays hidden without agents", async ({ page, user: _user }) => {
    await page.goto("/settings")

    await expect(page.getByRole("heading", { name: "Assistant" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Danger zone" })).toBeHidden()
    await expect(page.getByRole("button", { name: "Pause all" })).toBeHidden()
  })

  test("Remove all agents revokes every agent with one Face ID", async ({ page, funded: _funded }) => {
    await createAgent(page, { name: "First picker" })
    await createAgent(page, { name: "Second picker" })
    await page.goto("/settings")

    await page.getByRole("button", { name: "Remove all" }).click()
    await expect(page.getByRole("dialog")).toContainText("Remove all 2 agents?")
    await page.getByRole("button", { name: "Remove with Face ID" }).click()

    await expect(page.getByRole("heading", { name: "Every agent is removed" })).toBeVisible()
    await page.getByRole("button", { name: "Done" }).click()
    await expect(page.getByRole("heading", { name: "Danger zone" })).toBeHidden()
  })
})
