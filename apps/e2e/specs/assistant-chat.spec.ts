import { expect, test } from "../fixtures/test.ts"
import { ask, composer, lastTurn, unique } from "../utils/assistant.ts"

test.describe("the assistant on home", () => {
  test("Enter sends a message and bluechip's answer streams in", async ({ page, user: _user, replies }) => {
    const to = unique("Hello there")
    await replies.record({ to, rounds: [[{ text: "Hello! Ask me about your money or your agents." }]] })

    await composer(page).fill(to)
    await composer(page).press("Enter")

    await expect(page.getByText(to, { exact: true })).toBeVisible()
    await expect(lastTurn(page).getByText("Hello! Ask me about your money or your agents.")).toBeVisible()
    await expect(page).toHaveURL(/\/home\?conversation=conversation_[0-9a-z]+$/)
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

  test("a suggestion fills the box with its text, ready to send", async ({ page, user: _user, replies }) => {
    await replies.record({ to: "How did I do this week?", rounds: [[{ text: "You haven't traded yet this week." }]] })

    await page.getByRole("button", { name: "How did I do this week?" }).click()
    await expect(composer(page)).toHaveValue("How did I do this week?")
    await composer(page).press("Enter")

    await expect(lastTurn(page).getByText("You haven't traded yet this week.")).toBeVisible()
    await expect(page.getByRole("button", { name: "What did my agents do today?" })).toBeHidden()
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
  })

  test("a portfolio read shows its value", async ({ page, user: _user, replies }) => {
    const to = unique("How much do I have?")

    await ask(page, replies, {
      to,
      rounds: [[{ call: "getPortfolio", params: {} }], [{ text: "You have nothing in bluechip yet." }]]
    })

    await expect(lastTurn(page).getByRole("status").filter({ hasText: "Read your portfolio" })).toContainText("$0.00")
  })
})

test.describe("conversations", () => {
  test("the sheet lists each conversation by the title bluechip gave it", async ({ page, user: _user, replies }) => {
    const to = unique("I'm saving for a flat in Porto")

    await ask(page, replies, {
      to,
      rounds: [[{ text: "Good luck with the flat." }]],
      notes: { title: "Saving for a flat in Porto", memories: [] }
    })
    await page.getByRole("button", { name: "Conversations" }).click()

    const sheet = page.getByRole("dialog", { name: "Conversations" })
    await expect(sheet.getByRole("link", { name: /^Saving for a flat in Porto/ })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  test("an older conversation opens with its thread", async ({ page, user: _user, replies }) => {
    const older = unique("Tell me about Apple")
    await ask(page, replies, {
      to: older,
      rounds: [[{ text: "Apple makes phones." }]],
      notes: { title: "About Apple", memories: [] }
    })
    await page.goto("/home")
    const newer = unique("Tell me about Tesla")
    await ask(page, replies, {
      to: newer,
      rounds: [[{ text: "Tesla makes cars." }]],
      notes: { title: "About Tesla", memories: [] }
    })

    await page.getByRole("button", { name: "Conversations" }).click()
    await page.getByRole("dialog", { name: "Conversations" }).getByRole("link", { name: /^About Apple/ }).click()

    await expect(page.getByText(older, { exact: true })).toBeVisible()
    await expect(page.getByText("Apple makes phones.")).toBeVisible()
    await expect(page.getByText(newer, { exact: true })).toBeHidden()
  })

  test("New conversation starts again from an empty thread", async ({ page, user: _user, replies }) => {
    const to = unique("Hi bluechip")
    await ask(page, replies, { to, rounds: [[{ text: "Hi!" }]] })

    await page.getByRole("button", { name: "Conversations" }).click()
    await page.getByRole("dialog", { name: "Conversations" }).getByRole("button", { name: "New conversation" }).click()

    await expect(page).toHaveURL(/\/home$/)
    await expect(page.getByText(to, { exact: true })).toBeHidden()
    await expect(page.getByRole("button", { name: "What did my agents do today?" })).toBeVisible()
  })

  test("with no conversations yet, the sheet says where to start", async ({ page, user: _user }) => {
    await page.getByRole("button", { name: "Conversations" }).click()

    await expect(page.getByText("No conversations yet. Ask bluechip anything on Home.")).toBeVisible()
  })
})
