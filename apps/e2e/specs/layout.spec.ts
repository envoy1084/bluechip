import { expect, test } from "../fixtures/test.ts"

const pages = [
  { path: "/home", heading: "Home" },
  { path: "/portfolio", heading: "Portfolio" },
  { path: "/stocks", heading: "Stocks" },
  { path: "/stocks/NVDA", heading: "NVIDIA" },
  { path: "/agents", heading: "Agents" },
  { path: "/activity", heading: "Activity" },
  { path: "/approvals", heading: "Approvals" },
  { path: "/settings", heading: "Settings" }
] as const

test.describe("sidebar navigation", () => {
  for (const { path, heading } of pages.filter((entry) => entry.path !== "/stocks/NVDA")) {
    test(`${heading} opens ${path}`, async ({ page, user: _user }) => {
      await page.goto(path === "/home" ? "/settings" : "/home")

      await page.getByRole("complementary", { name: "App navigation" }).getByRole("link", { name: heading }).click()

      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible()
    })
  }
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  for (const { path, heading } of pages) {
    test(`${path} fits the screen`, async ({ page, user: _user }) => {
      await page.goto(path)

      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await expect(page.getByRole("button", { name: "Toggle sidebar" })).toBeVisible()
      await expect(page.getByRole("complementary", { name: "App navigation" })).toBeHidden()
    })
  }

  test("the navigation opens as a sheet and leads to each page", async ({ page, user: _user }) => {
    await page.getByRole("button", { name: "Toggle sidebar" }).click()

    const navigation = page.getByRole("dialog", { name: "App navigation" })
    await navigation.getByRole("link", { name: "Activity" }).click()

    await expect(page).toHaveURL(/\/activity$/)
    await expect(page.getByRole("heading", { name: "Activity", level: 1 })).toBeAttached()
    await navigation.getByRole("button", { name: "Close" }).click()
    await expect(navigation).toBeHidden()
    await expect(page.getByRole("heading", { name: "Activity", level: 1 })).toBeVisible()
  })

  test.fixme("the navigation sheet closes on the page it opens (bug: it stays open over the new page)", async ({ page, user: _user }) => {
    await page.getByRole("button", { name: "Toggle sidebar" }).click()

    const navigation = page.getByRole("dialog", { name: "App navigation" })
    await navigation.getByRole("link", { name: "Activity" }).click()

    await expect(page.getByRole("heading", { name: "Activity", level: 1 })).toBeVisible()
    await expect(navigation).toBeHidden()
  })
})

test.describe("dark mode", () => {
  // bluechip has one, light, theme (`color-scheme: light` in `@bluechip/ui`'s base styles): a dark system setting
  // must not leave it half dark, with dark form controls on light pages.
  test("the app keeps its light theme when the system is dark", async ({ page, user: _user }) => {
    await page.emulateMedia({ colorScheme: "dark" })

    await page.goto("/settings")

    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible()
    expect(await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).toBe(true)
    expect(
      await page.evaluate(() => ({
        background: getComputedStyle(document.body).backgroundColor,
        scheme: getComputedStyle(document.documentElement).colorScheme,
        input: getComputedStyle(document.querySelector("input")!).colorScheme
      }))
    ).toEqual({ background: "rgb(251, 251, 252)", scheme: "light", input: "light" })
  })
})

test.describe("dev pages", () => {
  test("/dev/chain shows the local chain's latest block", async ({ page }) => {
    await page.goto("/dev/chain")

    await expect(page.getByRole("heading", { name: "Chain", level: 1 })).toBeVisible()
    await expect(page.getByText("Chain 8453")).toBeVisible()
    await expect(page.getByText("Connecting…")).toBeHidden()
    await expect(page.getByRole("heading", { name: "Wallet" })).toBeVisible()
  })

  test("/dev/connection shows the server's version and the live events", async ({ page, user: _user }) => {
    await page.goto("/dev/connection")

    await expect(page.getByRole("heading", { name: "Connection", level: 1 })).toBeVisible()
    await expect(page.getByRole("definition").nth(1)).toHaveText("v1")
    await expect(page.getByRole("definition").nth(2)).toHaveText(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    await expect(page.getByText("Live", { exact: true })).toBeVisible()
  })
})
