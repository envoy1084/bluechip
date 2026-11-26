import { expect, test } from "../fixtures/test.ts"
import { createAgent } from "../utils/agents.ts"
import { ask, composer, lastTurn, unique } from "../utils/assistant.ts"

test.describe("the chat page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/chat")
  })

  test("Enter sends a message and bluechip's answer streams in", async ({ page, user: _user, replies }) => {
    const to = unique("Hello there")
    await replies.record({ to, rounds: [[{ text: "Hello! Ask me about your money or your agents." }]] })

    await composer(page).fill(to)
    await composer(page).press("Enter")

    await expect(page.getByText(to, { exact: true })).toBeVisible()
    await expect(lastTurn(page).getByText("Hello! Ask me about your money or your agents.")).toBeVisible()
    await expect(page).toHaveURL(/\/chat\/conversation_[0-9a-z]+$/)
    await expect(composer(page)).toHaveValue("")
  })

  test("Shift+Enter adds a line, and the Send button sends both", async ({ page, user: _user, replies }) => {
    const first = unique("First line")
    const to = `${first}\nSecond line`
    await replies.record({ to, rounds: [[{ text: "Two lines, read." }]] })

    await composer(page).fill(first)
    await composer(page).press("Shift+Enter")
    await composer(page).pressSequentially("Second line")
    await expect(composer(page)).toHaveValue(to)
    await page.getByRole("button", { name: "Send" }).click()

    await expect(page.getByText(to, { exact: true })).toBeVisible()
    await expect(lastTurn(page).getByText("Two lines, read.")).toBeVisible()
  })

  test("the Send button waits for a message", async ({ page, user: _user }) => {
    await expect(page.getByRole("button", { name: "Send" })).toBeDisabled()

    await composer(page).fill("   ")

    await expect(page.getByRole("button", { name: "Send" })).toBeDisabled()
  })

  test("an idea on the start screen asks it straight away", async ({ page, user: _user, replies }) => {
    await replies.record({ to: "How did I do this week?", rounds: [[{ text: "You haven't traded yet this week." }]] })

    await page.getByRole("button", { name: /^How did I do this week\?/ }).click()

    await expect(lastTurn(page).getByText("You haven't traded yet this week.")).toBeVisible()
    await expect(page.getByRole("button", { name: /^What did my agents do today\?/ })).toBeHidden()
  })

  test("Stop ends an answer midway: what was written stays, then Stopped.", async ({ page, user: _user, replies }) => {
    const to = unique("Tell me everything about Nvidia")
    await replies.record({ to, rounds: [[{ text: "Nvidia makes chips for", partial: true }, { hang: true }]] })
    await composer(page).fill(to)
    await composer(page).press("Enter")
    await expect(lastTurn(page).getByText("Nvidia makes chips for")).toBeVisible()
    await expect(composer(page)).toHaveAttribute("placeholder", "bluechip is answering…")

    await page.getByRole("button", { name: "Stop" }).click()

    await expect(lastTurn(page).getByText("Stopped.", { exact: true })).toBeVisible()
    await expect(lastTurn(page).getByText("Nvidia makes chips for")).toBeVisible()
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
  })

  test("a message that couldn't start is sent again with Retry", async ({ page, user: _user, replies }) => {
    const to = unique("Are you there?")
    await replies.record({ to, rounds: [[{ text: "Yes, I'm here." }]] })
    // The server turns the first conversation away, as when it's busy.
    const starting = (url: URL) => url.pathname === "/api/assistant/conversations"
    await page.route(
      starting,
      (route) => route.request().method() === "POST" ? route.fulfill({ status: 429 }) : route.fallback()
    )
    await composer(page).fill(to)
    await composer(page).press("Enter")
    await expect(lastTurn(page).getByText("The assistant couldn't start just now. Try again in a moment."))
      .toBeVisible()

    await page.unroute(starting)
    await lastTurn(page).getByRole("button", { name: "Retry" }).click()

    await expect(lastTurn(page).getByText("Yes, I'm here.")).toBeVisible()
  })
})

test.describe("tool rows", () => {
  test("a price check shows what it checked and the price", async ({ page, user: _user, replies }) => {
    const to = unique("What's Nvidia at?")

    await ask(page, replies, {
      to,
      rounds: [[{ call: "getPrices", params: { symbols: ["NVDA"] } }], [{ text: "Nvidia is at $100.00." }]]
    })

    await expect(lastTurn(page).getByRole("status").filter({ hasText: "Checked prices" })).toContainText(
      /NVIDIA \$\d{1,3}(,\d{3})*\.\d\d/
    )
    // What it read, as a card under the row, with the way to every stock.
    const prices = lastTurn(page).getByRole("region", { name: "Prices" })
    await expect(prices).toContainText(/\$\d{1,3}(,\d{3})*\.\d\d/)
    await expect(prices.getByRole("link", { name: "All stocks" })).toHaveAttribute("href", "/stocks")
  })

  test("a portfolio read shows its value", async ({ page, user: _user, replies }) => {
    const to = unique("How much do I have?")

    await ask(page, replies, {
      to,
      rounds: [[{ call: "getPortfolio", params: {} }], [{ text: "You have nothing in bluechip yet." }]]
    })

    await expect(lastTurn(page).getByRole("status").filter({ hasText: "Read your portfolio" })).toContainText("$0.00")
    await expect(lastTurn(page).getByRole("region", { name: "Your portfolio" })).toContainText(
      "Nothing in your account yet."
    )
  })
})

test.describe("chats sidebar", () => {
  test("it lists each chat by the title bluechip gave it", async ({ page, user: _user, replies }) => {
    const to = unique("I'm saving for a flat in Porto")

    await ask(page, replies, {
      to,
      rounds: [[{ text: "Good luck with the flat." }]],
      notes: { title: "Saving for a flat in Porto", memories: [] }
    })

    const chats = page.getByRole("complementary", { name: "Chats" })
    await expect(chats.getByRole("link", { name: /^Saving for a flat in Porto/ })).toHaveAttribute(
      "aria-current",
      "page"
    )
    await expect(page.getByRole("heading", { name: "Saving for a flat in Porto", level: 1 })).toBeVisible()
  })

  test("an older chat opens with its thread", async ({ page, user: _user, replies }) => {
    const older = unique("Tell me about Apple")
    await ask(page, replies, {
      to: older,
      rounds: [[{ text: "Apple makes phones." }]],
      notes: { title: "About Apple", memories: [] }
    })
    await page.goto("/chat")
    const newer = unique("Tell me about Tesla")
    await ask(page, replies, {
      to: newer,
      rounds: [[{ text: "Tesla makes cars." }]],
      notes: { title: "About Tesla", memories: [] }
    })

    await page.getByRole("complementary", { name: "Chats" }).getByRole("link", { name: /^About Apple/ }).click()

    await expect(page.getByText(older, { exact: true })).toBeVisible()
    await expect(page.getByText("Apple makes phones.")).toBeVisible()
    await expect(page.getByText(newer, { exact: true })).toBeHidden()
    await expect(composer(page)).toBeFocused()
  })

  test("Delete in a chat's menu deletes it, and the open one makes way for a new chat", async ({ page, user: _user, replies }) => {
    const to = unique("Tell me about Ford")
    await ask(page, replies, {
      to,
      rounds: [[{ text: "Ford makes trucks." }]],
      notes: { title: "About Ford", memories: [] }
    })
    const chats = page.getByRole("complementary", { name: "Chats" })

    await chats.getByRole("button", { name: "More for About Ford" }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    const dialog = page.getByRole("alertdialog", { name: "Delete “About Ford”?" })
    await dialog.getByRole("button", { name: "Delete chat" }).click()

    await expect(page).toHaveURL(/\/chat$/)
    await expect(chats.getByRole("link", { name: /^About Ford/ })).toBeHidden()
    await expect(page.getByText(to, { exact: true })).toBeHidden()
  })

  test("Keep it leaves a chat as it was", async ({ page, user: _user, replies }) => {
    const to = unique("Tell me about Coca-Cola")
    await ask(page, replies, {
      to,
      rounds: [[{ text: "Coca-Cola makes drinks." }]],
      notes: { title: "About Coca-Cola", memories: [] }
    })
    const chats = page.getByRole("complementary", { name: "Chats" })

    await chats.getByRole("button", { name: "More for About Coca-Cola" }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Keep it" }).click()

    await expect(chats.getByRole("link", { name: /^About Coca-Cola/ })).toBeVisible()
    await expect(page.getByText(to, { exact: true })).toBeVisible()
  })

  test("New chat starts again from an empty thread", async ({ page, user: _user, replies }) => {
    const to = unique("Hi bluechip")
    await ask(page, replies, { to, rounds: [[{ text: "Hi!" }]] })

    await page.getByRole("complementary", { name: "Chats" }).getByRole("link", { name: "New chat" }).click()

    await expect(page).toHaveURL(/\/chat$/)
    await expect(page.getByText(to, { exact: true })).toBeHidden()
    await expect(page.getByRole("button", { name: /^What did my agents do today\?/ })).toBeVisible()
  })

  test("with no chats yet, it says where they come from", async ({ page, user: _user }) => {
    await page.goto("/chat")

    await expect(page.getByText("No chats yet. Your first message starts one.")).toBeVisible()
  })

  test("its trigger slides it away", async ({ page, user: _user }) => {
    await page.goto("/chat")

    await page.getByRole("button", { name: "Toggle chats" }).click()

    await expect(page.getByRole("complementary", { name: "Chats" })).toHaveAttribute("data-collapsible", "offcanvas")
  })
})

test.describe("who trades in a chat", () => {
  test("a new chat goes through your account until you pick an agent", async ({ page, funded: _funded }) => {
    await createAgent(page, { name: "Chip picker" })
    await page.goto("/chat")
    const picker = page.getByRole("combobox", { name: "Trades go through" })
    await expect(picker).toHaveText("My account")

    await picker.click()
    await page.getByRole("option", { name: "Chip picker" }).click()

    await expect(picker).toHaveText("Chip picker")
    await expect(page.getByRole("button", { name: "What has this agent done this week?" })).toBeVisible()
  })

  test("a started chat keeps its agent", async ({ page, funded: _funded, replies }) => {
    await createAgent(page, { name: "Chip picker" })
    await page.goto("/chat")
    await page.getByRole("combobox", { name: "Trades go through" }).click()
    await page.getByRole("option", { name: "Chip picker" }).click()

    await ask(page, replies, { to: unique("Who trades here?"), rounds: [[{ text: "Chip picker." }]] })

    await expect(page.getByRole("combobox", { name: "Trades go through" })).toBeHidden()
    await expect(page.locator("header").getByText("Chip picker")).toBeVisible()
  })
})
