import type { Page } from "@playwright/test"
import type { Replies } from "../fixtures/replies.ts"
import { expect, test } from "../fixtures/test.ts"
import { apiHeaders } from "../fixtures/users.ts"
import { createAgent } from "../utils/agents.ts"
import { ask, unique } from "../utils/assistant.ts"

/** Asks the assistant to draft "Apple weekly", a stock picker for Apple; resolves on its card. */
const draftAppleWeekly = async (page: Page, replies: Replies) => {
  await ask(page, replies, {
    to: unique("Make me an agent that picks Apple"),
    rounds: [
      [{
        call: "draftAgent",
        params: { name: "Apple weekly", draft: { template: "stockPicker", preset: "balanced", stocks: ["AAPL"] } }
      }],
      [{ text: "Here's the draft. Lock it with Face ID when you're happy." }]
    ]
  })
  return page.getByRole("region", { name: "Draft from chat" })
}

/** Makes "Chip picker" through the new agent flow, then opens a new chat. */
const chipPicker = async (page: Page) => {
  const agent = await createAgent(page, { name: "Chip picker" })
  await page.goto("/chat")
  return agent
}

test.describe("draft agent cards", () => {
  test("a draft locked with Face ID from the card goes live", async ({ page, funded: _funded, replies }) => {
    const card = await draftAppleWeekly(page, replies)
    await expect(card.getByRole("heading", { name: "Apple weekly" })).toBeVisible()
    await expect(card.getByText("Lasts 90 days once locked. You can pause it any time.")).toBeVisible()
    await expect(card.getByText("Not running yet")).toBeVisible()

    await card.getByRole("button", { name: "Lock with Face ID" }).click()

    await expect(card.getByText("Running").first()).toBeVisible()
    await card.getByRole("link", { name: "Open Apple weekly" }).click()
    await expect(page).toHaveURL(/\/agents\/agent_[0-9a-z]+$/)
  })

  test("Customize opens the new agent flow at the draft's rules", async ({ page, funded: _funded, replies }) => {
    const card = await draftAppleWeekly(page, replies)

    await card.getByRole("link", { name: "Customize" }).click()

    await expect(page).toHaveURL(/\/agents\/new\?draft=agent_[0-9a-z]+$/)
    await expect(page.getByRole("heading", { name: "Its limits" })).toBeVisible()
  })
})

test.describe("policy change cards", () => {
  test("a tighter trade size is approved with Face ID from the card", async ({ page, funded: _funded, replies }) => {
    const agent = await chipPicker(page)
    await ask(page, replies, {
      to: unique("Let Chip picker trade up to $50 only"),
      rounds: [
        [{
          call: "changeAgentPolicies",
          params: {
            agentId: agent.id,
            changes: { settings: [{ policy: "tradeSize", field: "maxPerTrade", value: 50 }] }
          }
        }],
        [{ text: "Approve the change on the card." }]
      ]
    })
    const card = page.getByRole("region", { name: "Change of policies" })
    await expect(card.getByText("Its new policies are locked onchain once you approve.")).toBeVisible()
    await expect(card.getByText("Tighter", { exact: true })).toBeVisible()

    await card.getByRole("button", { name: "Approve with Face ID" }).click()

    await expect(card.getByText("Running")).toBeVisible()
    await expect(card.getByRole("link", { name: "Open Chip picker" })).toBeVisible()
  })

  test("a renewal is signed with Face ID from the card", async ({ page, funded: _funded, replies }) => {
    const agent = await chipPicker(page)
    await ask(page, replies, {
      to: unique("Renew Chip picker"),
      rounds: [[{ call: "renewAgent", params: { agentId: agent.id } }], [{ text: "Renew it on the card." }]]
    })
    const card = page.getByRole("region", { name: "Renewal" })
    await expect(card.getByText("Locks the same policies with a new key for 90 more days.")).toBeVisible()

    await card.getByRole("button", { name: "Renew with Face ID" }).click()

    await expect(card.getByText("Running")).toBeVisible()
    await expect(card.getByRole("link", { name: "Open Chip picker" })).toBeVisible()
  })

  test("a removal is signed with Face ID from the card", async ({ page, funded: _funded, replies }) => {
    const agent = await chipPicker(page)
    await ask(page, replies, {
      to: unique("Remove Chip picker"),
      rounds: [[{ call: "removeAgent", params: { agentId: agent.id } }], [{ text: "Remove it on the card." }]]
    })
    const card = page.getByRole("region", { name: "Removal" })
    await expect(card.getByText("It stops for good. Your stocks and cash stay in your account.")).toBeVisible()

    await card.getByRole("button", { name: "Remove with Face ID" }).click()

    await expect(card.getByText("Removed")).toBeVisible()
  })

  test("a draft is removed right away, with nothing to sign", async ({ page, funded: _funded, replies }) => {
    const draft = await draftAppleWeekly(page, replies)
    const href = await draft.getByRole("link", { name: "Customize" }).getAttribute("href")
    const agentId = new URL(href!, page.url()).searchParams.get("draft")!

    await ask(page, replies, {
      to: unique("Actually, remove that draft"),
      rounds: [[{ call: "removeAgent", params: { agentId } }], [{ text: "Removed." }]]
    })

    const card = page.getByRole("region", { name: "Removal" })
    await expect(card.getByText("Apple weekly was a draft, so it was removed right away. Nothing was onchain."))
      .toBeVisible()
    await expect(card.getByRole("button")).toHaveCount(0)
  })
})

test.describe("agent control cards", () => {
  test("pausing an agent waits for your confirm, then it's paused", async ({ page, funded: _funded, replies }) => {
    const agent = await chipPicker(page)
    await ask(page, replies, {
      to: unique("Pause Chip picker"),
      rounds: [[{ call: "pauseAgent", params: { agentId: agent.id } }], [{ text: "Confirm on the card to pause it." }]]
    })
    const card = page.getByRole("region", { name: "Pause" })
    await expect(card.getByText("Waiting for you")).toBeVisible()
    await expect(card.getByText("It stops trading right away. Nothing is sold.")).toBeVisible()

    await card.getByRole("button", { name: "Pause Chip picker" }).click()

    await expect(card.getByText("Done. Resume it any time.")).toBeVisible()
    await page.goto(`/agents/${agent.id}`)
    await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible()
  })

  test("Not now leaves the agent running", async ({ page, funded: _funded, replies }) => {
    const agent = await chipPicker(page)
    await ask(page, replies, {
      to: unique("Maybe pause Chip picker"),
      rounds: [[{ call: "pauseAgent", params: { agentId: agent.id } }], [{ text: "Confirm on the card to pause it." }]]
    })
    const card = page.getByRole("region", { name: "Pause" })

    await card.getByRole("button", { name: "Not now" }).click()

    await expect(card.getByText("You left it as it was.")).toBeVisible()
    await expect(card.getByText("Dismissed")).toBeVisible()
    await page.goto(`/agents/${agent.id}`)
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible()
  })

  test("a paused agent is resumed from the card", async ({ page, funded: _funded, replies }) => {
    const agent = await chipPicker(page)
    const paused = await page.request.post(`/api/agents/${agent.id}/pause`, { headers: apiHeaders })
    expect(paused.status(), "POST /api/agents/:id/pause").toBe(200)
    await ask(page, replies, {
      to: unique("Resume Chip picker"),
      rounds: [[{ call: "resumeAgent", params: { agentId: agent.id } }], [{ text: "Confirm on the card." }]]
    })
    const card = page.getByRole("region", { name: "Resume" })
    await expect(card.getByText("It trades again inside its policies.")).toBeVisible()

    await card.getByRole("button", { name: "Resume Chip picker" }).click()

    await expect(card.getByText("Done. It's trading again.")).toBeVisible()
  })

  test("every agent is paused at once from the card", async ({ page, funded: _funded, replies }) => {
    await chipPicker(page)
    await ask(page, replies, {
      to: unique("Pause all my agents"),
      rounds: [[{ call: "pauseAll", params: {} }], [{ text: "Confirm on the card." }]]
    })
    const card = page.getByRole("region", { name: "Pause" })
    await expect(card.getByText("They stop trading right away. Nothing is sold.")).toBeVisible()

    await card.getByRole("button", { name: "Pause every agent" }).click()

    await expect(card.getByText("Done. Resume it any time.")).toBeVisible()
  })
})

test.describe("ask about this agent", () => {
  test("an agent's page opens a conversation about it", async ({ page, funded: _funded, replies }) => {
    await createAgent(page, { name: "Chip picker" })

    await page.getByRole("link", { name: "Ask about this agent" }).click()

    await expect(page).toHaveURL(/\/chat\?agent=agent_[0-9a-z]+$/)
    await expect(page.getByRole("combobox", { name: "Trades go through" })).toHaveText("Chip picker")
    await expect(page.getByRole("button", { name: "What has this agent done this week?" })).toBeVisible()
    await ask(page, replies, { to: unique("How is it doing?"), rounds: [[{ text: "It hasn't traded yet." }]] })
    await expect(page.locator("header").getByText("Chip picker")).toBeVisible()
    await expect(page.getByRole("complementary", { name: "Chats" }).getByText("Chip picker, Just now")).toBeVisible()
  })
})
