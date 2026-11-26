import { expect, test } from "../fixtures/test.ts"
import { createAgent } from "../utils/agents.ts"

test.describe("notification bell", () => {
  test("a new person: no badge, and nothing new in the popover", async ({ page, user: _user }) => {
    await page.goto("/home")

    await page.getByRole("button", { name: "Notifications", exact: true }).click()

    await expect(page.getByTestId("notification-badge")).toBeHidden()
    await expect(page.getByText("Nothing new")).toBeVisible()
    await expect(page.getByText("Trades, approvals and your agents' news show up here.")).toBeVisible()
  })

  test("pausing an agent: the badge counts it, opening it reads it and goes to the agent", async ({ page, funded: _funded }) => {
    const { id } = await createAgent(page, { name: "Bell agent" })
    await page.getByRole("button", { name: "Pause", exact: true }).click()

    await expect(page.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible()
    await page.goto("/home")
    await page.getByRole("button", { name: "Notifications, 1 unread" }).click()
    const row = page.getByTestId("notification").filter({ hasText: "Bell agent is paused" })
    await expect(row).toContainText("It can't trade until you resume it. Nothing was sold.")
    await row.click()

    await expect(page).toHaveURL(new RegExp(`/agents/${id}$`))
    await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible()
  })

  test("Mark all read clears the badge", async ({ page, funded: _funded }) => {
    await createAgent(page, { name: "Read agent" })
    await page.getByRole("button", { name: "Pause", exact: true }).click()
    await page.getByRole("button", { name: "Notifications, 1 unread" }).click()

    await page.getByRole("button", { name: "Mark all read" }).click()

    await expect(page.getByTestId("notification-badge")).toBeHidden()
    await expect(page.getByLabel("Unread")).toBeHidden()
  })

  test("the popover links to notification settings", async ({ page, user: _user }) => {
    await page.goto("/portfolio")
    await page.getByRole("button", { name: "Notifications", exact: true }).click()

    await page.getByRole("link", { name: "Notification settings" }).click()

    await expect(page).toHaveURL(/\/settings\/notifications$/)
    await expect(page.getByRole("heading", { name: "Notifications", level: 1 })).toBeVisible()
  })

  test("a notification's approvals link opens the approvals sheet", async ({ page, user: _user }) => {
    await page.goto("/home?sheet=approvals")

    await expect(page.getByRole("dialog", { name: "Approvals" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page).toHaveURL(/\/home$/)
  })
})

test.describe("notification settings", () => {
  test("Settings links to them", async ({ page, user: _user }) => {
    await page.goto("/settings")

    await page.getByRole("link", { name: "Notification settings" }).click()

    await expect(page).toHaveURL(/\/settings\/notifications$/)
  })

  test("each kind's channels: Telegram off for trades done, kept after a reload", async ({ page, user: _user }) => {
    await page.goto("/settings/notifications")
    const telegram = page.getByRole("switch", { name: "Trades done: Telegram" })
    await expect(telegram).toBeChecked()

    await telegram.click()

    await expect(telegram).not.toBeChecked()
    await page.reload()
    await expect(page.getByRole("switch", { name: "Trades done: Telegram" })).not.toBeChecked()
    await expect(page.getByRole("switch", { name: "Trades done: In app" })).toBeDisabled()
  })

  test("security kinds are locked on every channel", async ({ page, user: _user }) => {
    await page.goto("/settings/notifications")
    const security = page.getByRole("region", { name: "Security" })

    for (const channel of ["In app", "Push", "Telegram"]) {
      const toggle = security.getByRole("switch", { name: `A chat was linked: ${channel}` })
      await expect(toggle).toBeChecked()
      await expect(toggle).toBeDisabled()
    }
  })

  test("a news kind can wait for the daily digest", async ({ page, user: _user }) => {
    await page.goto("/settings/notifications")
    const digest = page.getByRole("switch", { name: "An automation ran: hold for the daily digest" })

    await digest.click()

    await expect(digest).toBeChecked()
    await page.reload()
    await expect(page.getByRole("switch", { name: "An automation ran: hold for the daily digest" })).toBeChecked()
  })

  test("quiet hours: on from 22:00 to 07:00 in your zone, then off", async ({ page, user: _user }) => {
    await page.goto("/settings/notifications")

    await page.getByRole("switch", { name: "Quiet hours" }).click()

    await expect(page.getByLabel("Quiet from")).toHaveValue("22:00")
    await expect(page.getByLabel("Quiet until")).toHaveValue("07:00")
    await page.getByRole("switch", { name: "Quiet hours" }).click()
    await expect(page.getByText("Off: everything goes out when it happens.")).toBeVisible()
  })

  test("push on this device: the switch, or why it can't be used", async ({ page, user: _user }) => {
    await page.goto("/settings/notifications")

    await expect(page.getByRole("switch", { name: "Push on this device" })).toBeVisible()
    await expect(page.getByRole("region", { name: "Push notifications" })).toContainText(
      /Off on this device|Notifications are blocked|Push isn't set up|This browser can't show push/
    )
  })
})

test.describe("linking Telegram", () => {
  test("Link Telegram shows a one-time code and how to send it", async ({ page, user: _user }) => {
    await page.goto("/settings/notifications")

    await page.getByRole("button", { name: "Link Telegram" }).click()

    const panel = page.getByTestId("link-code")
    await expect(panel).toContainText(
      /^Send this code to (@\w+ in a private chat\. It works once, for 10 minutes\.|bluechip's bot in a private chat\.)/
    )
    await expect(panel.getByText(/^[A-HJ-NP-Z2-9]{8}$/)).toBeVisible()
    await panel.getByRole("button", { name: "Done" }).click()
    await expect(panel).toBeHidden()
  })

  test("a new code replaces the last one", async ({ page, user: _user }) => {
    await page.goto("/settings/notifications")
    await page.getByRole("button", { name: "Link Telegram" }).click()
    const first = await page.getByTestId("link-code").getByText(/^[A-HJ-NP-Z2-9]{8}$/).textContent()
    await page.getByRole("button", { name: "Done" }).click()

    await page.getByRole("button", { name: "Link Telegram" }).click()

    await expect(page.getByTestId("link-code").getByText(/^[A-HJ-NP-Z2-9]{8}$/)).not.toHaveText(first!)
  })

  test("no chat linked yet: nothing to unlink", async ({ page, user: _user }) => {
    await page.goto("/settings/notifications")

    await expect(page.getByRole("region", { name: "Telegram" }).getByRole("button", { name: "Unlink" })).toBeHidden()
  })
})
