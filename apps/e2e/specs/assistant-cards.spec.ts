import { expect, test } from "../fixtures/test.ts"
import { createAgent } from "../utils/agents.ts"
import { ask, lastTurn, unique } from "../utils/assistant.ts"

test.describe("trade cards", () => {
  test("a buy through an agent, within its policies, is filled on the card", async ({ page, funded: _funded, replies }) => {
    const agent = await createAgent(page, { name: "Chip buyer" })
    await page.goto("/home")
    const to = unique("Buy $20 of Nvidia with Chip buyer")

    await ask(page, replies, {
      to,
      rounds: [
        [{
          call: "proposeTrade",
          params: {
            agentId: agent.id,
            symbol: "NVDA",
            side: "buy",
            dollars: 20,
            shares: null,
            reason: "You asked for $20 of Nvidia."
          }
        }],
        [{ text: "Chip buyer is on it, as the card shows." }]
      ]
    })

    await expect(lastTurn(page).getByRole("status").filter({ hasText: "Prepared the trade" })).toBeVisible()
    await expect(lastTurn(page).getByText("Done. It's in your portfolio")).toBeVisible()
  })

  test("your own buy waits for Face ID, then is filled", async ({ page, funded: _funded, replies }) => {
    const to = unique("Buy $20 of Nvidia for me")
    await ask(page, replies, {
      to,
      rounds: [
        [{
          call: "proposeTrade",
          params: { agentId: null, symbol: "NVDA", side: "buy", dollars: 20, shares: null, reason: "You asked." }
        }],
        [{ text: "Approve it on the card." }]
      ]
    })
    const card = page.getByRole("region", { name: "Your trade" })
    await expect(card.getByText("Waiting for your Face ID")).toBeVisible()
    await expect(card.getByText("Nothing happens unless you approve it.")).toBeVisible()

    await card.getByRole("button", { name: "Buy with Face ID" }).click()

    await expect(lastTurn(page).getByText("Done. It's in your portfolio")).toBeVisible()
  })
})

test.describe("research cards", () => {
  test("the pages a web search read are cited as links", async ({ page, user: _user, replies }) => {
    const to = unique("What did Nvidia report last quarter?")

    await ask(page, replies, {
      to,
      rounds: [[
        {
          search: "Nvidia quarterly results",
          results: [
            { url: "https://example.com/nvidia-q3", title: "Nvidia Q3", citedText: "Revenue rose 60%." },
            { url: "https://www.example.org/chips", title: "Chip makers" }
          ]
        },
        { text: "Revenue rose, as the pages on the card say." }
      ]]
    })

    const card = page.getByRole("region", { name: "From the web" })
    await expect(card.getByText("Not checked by bluechip")).toBeVisible()
    await expect(card.getByText("Searched for \"Nvidia quarterly results\"")).toBeVisible()
    await expect(card.getByRole("link", { name: "Nvidia Q3" })).toHaveAttribute("href", "https://example.com/nvidia-q3")
    await expect(card.getByText("Revenue rose 60%.")).toBeVisible()
    await expect(card.getByRole("link", { name: "Chip makers" })).toHaveAttribute(
      "href",
      "https://www.example.org/chips"
    )
    await expect(card.getByText("example.org", { exact: true })).toBeVisible()
  })
})

test.describe("template cards", () => {
  const saveSteady = (to: string) => ({
    to,
    rounds: [
      [{
        call: "saveTemplate",
        params: {
          name: "Steady picks",
          agentId: null,
          draft: { template: "stockPicker", preset: "conservative", stocks: ["AAPL"] }
        }
      }],
      [{ text: "Confirm on the card to save it." }]
    ]
  })

  test("a confirmed template is offered when you make an agent", async ({ page, user: _user, replies }) => {
    await ask(page, replies, saveSteady(unique("Save a careful Apple template")))
    const card = page.getByRole("region", { name: "Template" })
    await expect(card.getByText("Waiting for you")).toBeVisible()

    await card.getByRole("button", { name: "Save template" }).click()

    await expect(card.getByText("Saved. It's in your templates when you make an agent.")).toBeVisible()
    await card.getByRole("button", { name: "Start an agent" }).click()
    await expect(page).toHaveURL(/\/agents\/new$/)
    await expect(page.getByRole("radio", { name: /^Steady picks/ })).toBeVisible()
  })

  test("a template left with Not now isn't saved", async ({ page, user: _user, replies }) => {
    await ask(page, replies, saveSteady(unique("Maybe save a careful Apple template")))
    const card = page.getByRole("region", { name: "Template" })

    await card.getByRole("button", { name: "Not now" }).click()

    await expect(card.getByText("Dismissed")).toBeVisible()
    await page.goto("/agents/new")
    await expect(page.getByRole("radio", { name: /^Stock picker/ })).toBeVisible()
    await expect(page.getByRole("radio", { name: /^Steady picks/ })).toBeHidden()
  })
})
