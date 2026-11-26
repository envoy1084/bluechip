import { expect, test } from "../fixtures/test.ts"

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

  test("the account shows its address and eligibility", async ({ page, user }) => {
    await page.goto("/settings")

    await expect(page.getByText("Send USDC on Base here to add cash.")).toBeVisible()
    await expect(page.getByRole("main")).toContainText(`${user.address.slice(0, 6)}…${user.address.slice(-4)}`)
    await expect(page.getByText("You confirmed you live outside the United States.")).toBeVisible()
    await expect(page.getByText("Confirmed", { exact: true })).toBeVisible()
  })

  test("the passkey you signed up with is listed as this device", async ({ page, user: _user }) => {
    await page.goto("/settings")

    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    await expect(page.getByText("This device", { exact: true })).toBeVisible()
    await expect(page.getByText(`On this device only, added ${today}, last used ${today}`)).toBeVisible()
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
})
