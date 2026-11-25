import { addAuthenticator } from "../fixtures/authenticator.ts"
import { expect, test } from "../fixtures/test.ts"

test.describe("landing and legal", () => {
  test("the landing page leads to sign-up and sign-in", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("heading", { name: "bluechip", level: 1 })).toBeVisible()
    await page.getByRole("link", { name: "Create account" }).click()
    await expect(page.getByRole("button", { name: "Create account with Face ID" })).toBeVisible()
    await page.goto("/")
    await page.getByRole("link", { name: "Sign in" }).click()
    await expect(page.getByRole("heading", { name: "Sign in to bluechip" })).toBeVisible()
  })

  test("the terms and the risk disclosure open from the welcome screen", async ({ page }) => {
    await page.goto("/welcome")

    await page.getByRole("link", { name: "Terms" }).click()
    await expect(page).toHaveURL(/\/legal\/terms$/)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await page.goto("/welcome")
    await page.getByRole("link", { name: "Risk disclosure" }).click()
    await expect(page).toHaveURL(/\/legal\/risk$/)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })
})

test.describe("sign up", () => {
  test("a passkey makes an account on Base, then eligibility and cash lead home", async ({ page, authenticator }) => {
    await page.goto("/welcome")
    await page.getByRole("button", { name: "Create account with Face ID" }).click()

    await expect(page.getByRole("heading", { name: "Your account is ready" })).toBeVisible()
    await expect(page.getByText("Passkey saved with Face ID")).toBeVisible()
    await expect(page.getByText(/^0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}$/)).toBeVisible()
    expect(await authenticator.credentials()).toHaveLength(1)

    await page.getByRole("button", { name: "Continue" }).click()
    await expect(page.getByRole("radio", { name: /Outside the United States/ })).toBeChecked()
    await expect(page.getByText("You can use bluechip.")).toBeVisible()
    await page.getByRole("button", { name: "Continue" }).click()
    await expect(page.getByRole("heading", { name: "Add cash", level: 1 })).toBeVisible()
    await page.getByRole("button", { name: "Go to home" }).click()
    await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible()
  })

  test("a person in the US can't continue", async ({ page }) => {
    await page.goto("/welcome")
    await page.getByRole("button", { name: "Create account with Face ID" }).click()
    await page.getByRole("button", { name: "Continue" }).click()

    await page.getByRole("radio", { name: /In the United States/ }).click()

    await expect(page.getByText("bluechip isn't available in the US")).toBeVisible()
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled()
  })

  test("a US answer is kept: signing in again returns to eligibility", async ({ page, context }) => {
    await page.goto("/welcome")
    await page.getByRole("button", { name: "Create account with Face ID" }).click()
    await page.getByRole("button", { name: "Continue" }).click()
    await page.getByRole("radio", { name: /In the United States/ }).click()
    await expect(page.getByText("bluechip isn't available in the US")).toBeVisible()

    await context.clearCookies()
    await page.goto("/signin")
    await page.getByRole("button", { name: "Sign in with Face ID" }).click()

    await expect(page).toHaveURL(/\/welcome\/eligibility$/)
    await expect(page.getByRole("radio", { name: /In the United States/ })).toBeChecked()
  })

  test("a cancelled Face ID saves nothing and says so", async ({ page, authenticator }) => {
    await authenticator.setVerified(false)
    await page.goto("/welcome")

    await page.getByRole("button", { name: "Create account with Face ID" }).click()

    await expect(page.getByText("Your passkey wasn't created")).toBeVisible()
    expect(await authenticator.credentials()).toHaveLength(0)
  })
})

test.describe("sign in and out", () => {
  test("signing out from settings, then in again with the same passkey", async ({ page, user: _user }) => {
    await page.getByRole("link", { name: "Settings" }).click()
    await page.getByRole("button", { name: "Sign out" }).click()

    await expect(page.getByRole("heading", { name: "Sign in to bluechip" })).toBeVisible()
    await page.goto("/home")
    await expect(page).toHaveURL(/\/signin$/)

    await page.getByRole("button", { name: "Sign in with Face ID" }).click()
    await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible()
  })

  test("the welcome screen's sign-in button signs in an existing account", async ({ page, context, user: _user }) => {
    await context.clearCookies()
    await page.goto("/welcome")

    await page.getByRole("button", { name: "Sign in with Face ID" }).click()

    await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible()
  })

  test("a synced passkey signs in on another device", async ({ page, browser, authenticator, user: _user }) => {
    const other = await browser.newContext()
    const otherPage = await other.newPage()
    await authenticator.copyTo(await addAuthenticator(otherPage))

    await otherPage.goto("/signin")
    await otherPage.getByRole("button", { name: "Sign in with Face ID" }).click()

    await expect(otherPage.getByRole("heading", { name: "Home", level: 1 })).toBeVisible()
    await other.close()
    await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible()
  })

  test("a device without a bluechip passkey can't sign in", async ({ page }) => {
    await page.goto("/signin")

    await page.getByRole("button", { name: "Sign in with Face ID" }).click()

    await expect(page.getByText("That didn't work")).toBeVisible()
    await page.getByRole("button", { name: "Create an account" }).click()
    await expect(page.getByRole("button", { name: "Create account with Face ID" })).toBeVisible()
  })

  test("a signed-out visitor is sent to sign in", async ({ page }) => {
    await page.goto("/portfolio")

    await expect(page).toHaveURL(/\/signin$/)
  })
})
