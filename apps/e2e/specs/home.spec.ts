import { expect, test } from "../fixtures/test.ts"
import { buy, giveShares, withdraw } from "../utils/trading.ts"

test.describe("home", () => {
  test("a new person is greeted and asked to add cash", async ({ page, user: _user }) => {
    await expect(page.getByRole("heading", { level: 2, name: /^Good (morning|afternoon|evening)$/ })).toBeVisible()
    await expect(
      page.getByText(new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }))
    )
      .toBeVisible()
    await expect(page.getByRole("region", { name: "Your money" })).toBeHidden()

    await page.getByRole("main").getByRole("button", { name: "Add cash" }).click()

    await expect(page.getByRole("dialog", { name: "Add cash" })).toBeVisible()
  })

  test("your money shows the total, all of it in cash, with Add cash", async ({ page, funded: _funded }) => {
    await page.reload()

    const money = page.getByRole("region", { name: "Your money" })
    await expect(money).toContainText("$1,000.00")
    await expect(money.getByRole("img")).toHaveAccessibleName("Cash 100%")
    await expect(money).toContainText("$1,000.00 in cash to invest")
    await expect(money.getByRole("button", { name: "Add cash" })).toBeVisible()
  })

  // fixme: pins $100 prices; the stack now runs at the devnet's captured prices (backlog W8)
  test.fixme("the total counts shares, and today's move is theirs", async ({ page, user }) => {
    await giveShares(user, { MSFT: 4 })
    await user.fund(page)

    await page.reload()

    await expect(page.getByRole("region", { name: "Your money" })).toContainText("$1,400.00")
    await expect(page.getByRole("main")).toContainText("+$8.00")
    await expect(page.getByRole("main")).toContainText("+0.57%")
  })

  test("the latest activity lists a withdrawal and leads to the rest", async ({ page, funded: _funded }) => {
    await withdraw(page, 12, "0x000000000000000000000000000000000000dEaD")

    await page.getByRole("link", { name: "Home" }).click()

    const latest = page.getByRole("region", { name: "Latest activity" })
    await expect(latest.getByText("Withdrew $12.00")).toBeVisible()
    await expect(latest.getByText("To 0x0000…dEaD on Base")).toBeVisible()
    await latest.getByRole("link", { name: "See all" }).click()
    await expect(page.getByRole("heading", { name: "Activity", level: 1 })).toBeVisible()
  })

  test.fixme(
    "the latest activity lists a buy (bug: on a holiday the chain runs days ahead of the server's clock, so every swap's deadline has passed)",
    async ({ page, funded: _funded }) => {
      await buy(page, "SPCX", 10)

      await page.getByRole("link", { name: "Home" }).click()

      const latest = page.getByRole("region", { name: "Latest activity" })
      await expect(latest.getByText(/^Bought \$\d+\.\d{2} of SpaceX$/)).toBeVisible()
      await expect(latest.getByText(/^\d+\.\d+ shares at \$\d+\.\d{2}$/)).toBeVisible()
    }
  )

  test("home has no chat of its own", async ({ page, user: _user }) => {
    await expect(page.getByRole("heading", { name: "Ask bluechip" })).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Message bluechip" })).toBeHidden()
  })

  test("a suggestion opens a new chat with it in the box, not sent", async ({ page, user: _user }) => {
    await page.getByRole("link", { name: "How did I do this week?" }).click()

    await expect(page).toHaveURL(/\/chat\?ask=/)
    await expect(page.getByRole("textbox", { name: "Message bluechip" })).toHaveValue("How did I do this week?")
    await expect(page.locator("[data-slot=\"chat-message\"]")).toHaveCount(0)
  })

  test("New chat opens the chat page", async ({ page, user: _user }) => {
    await page.getByRole("region", { name: "Ask bluechip" }).getByRole("link", { name: "New chat" }).click()

    await expect(page).toHaveURL(/\/chat$/)
    await expect(page.getByRole("heading", { name: "New chat", level: 1 })).toBeVisible()
  })
})
