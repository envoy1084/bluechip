import { expect, test } from "../fixtures/test.ts"

test.describe("help center", () => {
  test("the help page lists every article on its shelf", async ({ page }) => {
    await page.goto("/help")

    await expect(page.getByRole("heading", { name: "Help", level: 1 })).toBeVisible()
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Getting started",
      "Agents and trading",
      "The assistant",
      "Your account"
    ])
    await expect(page.getByRole("region", { name: "Getting started" }).getByRole("link")).toHaveCount(4)
  })

  test("an article opens on its own page, with its sections and the way back", async ({ page }) => {
    await page.goto("/help")

    await page.getByRole("region", { name: "Getting started" }).getByRole("link", { name: /^Gas/ }).click()

    await expect(page).toHaveURL(/\/help\/gas$/)
    await expect(page.getByRole("heading", { name: "Gas", level: 1 })).toBeVisible()
    await expect(page.getByRole("region", { name: "Who pays gas" })).toContainText("bluechip pays it for you today")
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Help" }).click()
    await expect(page).toHaveURL(/\/help$/)
  })

  test("an article leads on to the next one", async ({ page }) => {
    await page.goto("/help/getting-started")

    await page.getByRole("navigation", { name: "More help" }).getByRole("link", { name: /Paper money/ }).click()

    await expect(page).toHaveURL(/\/help\/paper-money$/)
  })

  test("an article that doesn't exist is not found, with the way back to help", async ({ page }) => {
    await page.goto("/help/no-such-article")

    await expect(page.getByRole("heading", { name: "We can't find that article", level: 1 })).toBeVisible()
    await page.getByRole("link", { name: "See all help articles" }).click()
    await expect(page).toHaveURL(/\/help$/)
  })
})

test.describe("landing", () => {
  test("Get started in the hero opens the welcome page", async ({ page }) => {
    await page.goto("/")

    await page.getByRole("main").getByRole("link", { name: "Get started" }).first().click()

    await expect(page).toHaveURL(/\/welcome$/)
  })

  test("Sign in in the top bar opens the welcome page", async ({ page }) => {
    await page.goto("/")

    await page.getByRole("banner").getByRole("link", { name: "Sign in" }).click()

    await expect(page).toHaveURL(/\/welcome$/)
    await expect(page.getByRole("button", { name: "Sign in with passkey" })).toBeVisible()
  })

  test("someone signed in gets Open bluechip, to home", async ({ page, user: _user }) => {
    await page.goto("/")

    await page.getByRole("banner").getByRole("link", { name: "Open bluechip" }).click()

    await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible()
  })

  test("the help center opens from the landing", async ({ page }) => {
    await page.goto("/")

    await page.getByRole("contentinfo").getByRole("link", { name: "Help center" }).click()

    await expect(page.getByRole("heading", { name: "Help", level: 1 })).toBeVisible()
  })
})
