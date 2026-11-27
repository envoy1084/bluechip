import { expect, test } from "../fixtures/test.ts"

const pages = [
  { path: "/home", heading: "Home" },
  { path: "/chat", heading: "New chat" },
  { path: "/portfolio", heading: "Portfolio" },
  { path: "/stocks", heading: "Stocks" },
  { path: "/stocks/NVDA", heading: "NVIDIA" },
  { path: "/agents", heading: "Agents" },
  { path: "/activity", heading: "Activity" },
  { path: "/approvals", heading: "Approvals" },
  { path: "/settings", heading: "Settings" }
] as const

test.describe("sidebar navigation", () => {
  for (const { path, heading } of pages.filter((entry) => entry.path !== "/stocks/NVDA" && entry.path !== "/chat")) {
    test(`${heading} opens ${path}`, async ({ page, user: _user }) => {
      await page.goto(path === "/home" ? "/settings" : "/home")

      await page.getByRole("complementary", { name: "App navigation" }).getByRole("link", {
        name: heading,
        exact: true
      }).click()

      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible()
    })
  }
})

test.describe("sidebar", () => {
  test("Chat opens a new chat", async ({ page, user: _user }) => {
    await page.getByRole("complementary", { name: "App navigation" }).getByRole("link", { name: "Chat" }).click()

    await expect(page).toHaveURL(/\/chat$/)
    await expect(page.getByRole("heading", { name: "New chat", level: 1 })).toBeVisible()
  })

  test("its trigger folds it to icons, and the current page stays marked", async ({ page, user: _user }) => {
    await page.goto("/portfolio")
    const sidebar = page.getByRole("complementary", { name: "App navigation" })

    await page.getByRole("button", { name: "Toggle sidebar" }).click()

    await expect(sidebar).toHaveAttribute("data-collapsible", "icon")
    await expect(sidebar.getByRole("link", { name: "Portfolio" })).toHaveAttribute("aria-current", "page")
  })

  test("folded, it stays folded on the next visit", async ({ page, user: _user }) => {
    await page.goto("/portfolio")
    await page.getByRole("button", { name: "Toggle sidebar" }).click()

    await page.reload()

    await expect(page.getByRole("complementary", { name: "App navigation" })).toHaveAttribute("data-state", "collapsed")
  })
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
    await expect(page.getByRole("heading", { name: "Activity", level: 1 })).toBeVisible()
  })

  test("the navigation sheet's Close button closes it", async ({ page, user: _user }) => {
    await page.getByRole("button", { name: "Toggle sidebar" }).click()

    const navigation = page.getByRole("dialog", { name: "App navigation" })
    await navigation.getByRole("button", { name: "Close" }).click()

    await expect(navigation).toBeHidden()
  })

  test("the navigation sheet closes on the page it opens", async ({ page, user: _user }) => {
    await page.getByRole("button", { name: "Toggle sidebar" }).click()

    const navigation = page.getByRole("dialog", { name: "App navigation" })
    await navigation.getByRole("link", { name: "Activity" }).click()

    await expect(page.getByRole("heading", { name: "Activity", level: 1 })).toBeVisible()
    await expect(navigation).toBeHidden()
  })
})

test.describe("dev pages", () => {
  // The chain is read through the server's `/api/rpc`, for a signed-in browser only.
  test("/dev/chain shows the local chain's latest block", async ({ page, user: _user }) => {
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
    await expect(page.getByRole("definition").nth(2)).toHaveText("local")
    await expect(page.getByRole("definition").nth(3)).toHaveText(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    await expect(page.getByText("Live", { exact: true })).toBeVisible()
  })
})
