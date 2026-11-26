import { expect, test } from "../fixtures/test.ts"
import { apiHeaders } from "../fixtures/users.ts"
import { ask, composer, lastTurn, unique } from "../utils/assistant.ts"

test.describe("when the assistant stops early", () => {
  test("a spent day's budget stops the next answer and says when it resets", async ({ page, user: _user, replies }) => {
    // The recorded model is priced as Sonnet: 100,000 tokens out are $1, the whole of the suite's daily budget.
    await ask(page, replies, {
      to: unique("Write me a long essay"),
      rounds: [[{ text: "Here is a long essay." }]],
      usage: { input: 0, output: 100_000 }
    })
    await expect(
      page.getByText(
        "You've used today's assistant budget. It resets at midnight UTC, and everything else in bluechip still works."
      )
    ).toBeVisible()

    const to = unique("Are you still there?")
    await ask(page, replies, { to, rounds: [[{ text: "Yes." }]] })

    await expect(
      lastTurn(page).getByText(
        "You've used today's assistant budget, so I'll stop here. It resets at midnight UTC; everything else in " +
          "bluechip still works."
      )
    ).toBeVisible()
    await expect(lastTurn(page).getByText("Yes.", { exact: true })).toBeHidden()
  })

  test("a model that can't answer says nothing changed, and Retry asks again", async ({ page, user: _user, replies }) => {
    const to = unique("What's new today?")
    await ask(page, replies, { to, rounds: [[{ text: "Lots." }]], conversationFails: true })
    await expect(
      lastTurn(page).getByText("The assistant can't answer right now. Nothing was changed. Try again in a moment.")
        .first()
    ).toBeVisible()

    await replies.record({ to, rounds: [[{ text: "Markets are calm today." }]] })
    await lastTurn(page).getByRole("button", { name: "Retry" }).click()

    await expect(lastTurn(page).getByText("Markets are calm today.")).toBeVisible()
  })

  test(
    "a model that can't answer says so once",
    async ({ page, user: _user, replies }) => {
      const to = unique("Anything new?")

      await ask(page, replies, { to, rounds: [[{ text: "Lots." }]], conversationFails: true })

      await expect(
        lastTurn(page).getByText("The assistant can't answer right now. Nothing was changed. Try again in a moment.")
      ).toHaveCount(1)
    }
  )

  test("an answer cut off by leaving the page is kept, and says the connection dropped", async ({ page, user: _user, replies }) => {
    const to = unique("Explain index funds")
    await replies.record({ to, rounds: [[{ text: "An index fund holds", partial: true }, { hang: true }]] })
    await composer(page).fill(to)
    await composer(page).press("Enter")
    await expect(lastTurn(page).getByText("An index fund holds")).toBeVisible()
    const conversation = new URL(page.url()).searchParams.get("conversation")!

    // Leaving the page drops the answer's stream; the server keeps the round as far as it got.
    await page.goto("/portfolio")
    await expect.poll(async () => {
      const thread = await (await page.request.get(`/api/assistant/conversations/${conversation}`, {
        headers: apiHeaders
      })).text()
      return thread.includes("\"interrupted\"")
    }).toBe(true)
    await page.goBack()

    await expect(lastTurn(page).getByText("An index fund holds")).toBeVisible()
    await expect(
      lastTurn(page).getByText("The connection dropped, so I stopped here. Ask again and I'll carry on.")
    ).toBeVisible()
  })
})
