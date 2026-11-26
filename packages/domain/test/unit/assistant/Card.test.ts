import { type Card, describeCard } from "@bluechip/domain/assistant/Card"
import { describeAutomation } from "@bluechip/domain/automations/Automation"
import { CardId } from "@bluechip/domain/Ids"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import { draft } from "../../fixtures/Automations.ts"
import { AGENT_ID, nvidiaBuy } from "../../fixtures/Intents.ts"

const CARD = CardId.make("card_01jd8v4t5m6n7p8q9r0s1t2v3w")

describe("describeCard", () => {
  it.each<{ name: string; card: Card; expected: string }>([
    {
      name: "a trade still being decided",
      card: { _tag: "Trade", id: CARD, intent: nvidiaBuy("proposed") },
      expected: "Shown as a trade card for intent intent_01jd8v4t5m6n7p8q9r0s1t2v3w (buy NVDA). " +
        "Its policies are deciding it now; the card shows the outcome."
    },
    {
      name: "a trade over the agent's largest trade",
      card: {
        _tag: "Trade",
        id: CARD,
        intent: nvidiaBuy("needsApproval", { _tag: "OverLargestTrade", maxPerTrade: Usdc.make(100_000_000n) })
      },
      expected: "Shown as a trade card for intent intent_01jd8v4t5m6n7p8q9r0s1t2v3w (buy NVDA). " +
        "It waits for the user's approval with Face ID on the card."
    },
    {
      name: "a trade a policy blocked, with the policy in words",
      card: {
        _tag: "Trade",
        id: CARD,
        intent: nvidiaBuy("blocked", {
          _tag: "Refused",
          policy: "stockCap",
          error: "OverStockCap",
          stock: "NVDA",
          message: "Would put too much of your money in NVDA."
        })
      },
      expected: "Shown as a trade card for intent intent_01jd8v4t5m6n7p8q9r0s1t2v3w (buy NVDA). " +
        "Blocked by Max in one stock: Would put too much of your money in NVDA."
    },
    {
      name: "a trade the agent is sending",
      card: { _tag: "Trade", id: CARD, intent: nvidiaBuy("sending") },
      expected:
        "Shown as a trade card for intent intent_01jd8v4t5m6n7p8q9r0s1t2v3w (buy NVDA). The agent is sending it."
    },
    {
      name: "a filled trade",
      card: { _tag: "Trade", id: CARD, intent: nvidiaBuy("filled") },
      expected: "Shown as a trade card for intent intent_01jd8v4t5m6n7p8q9r0s1t2v3w (buy NVDA). It is filled."
    },
    {
      name: "a pause waiting for the user",
      card: {
        _tag: "AgentControl",
        id: CARD,
        action: "pause",
        agentId: AGENT_ID,
        agentName: "Tech picker",
        status: "pending",
        agents: []
      },
      expected: "Shown as a card. Nothing changes until the user confirms it on the card."
    },
    {
      name: "a pause the user confirmed",
      card: {
        _tag: "AgentControl",
        id: CARD,
        action: "pause",
        agentId: AGENT_ID,
        agentName: "Tech picker",
        status: "applied",
        agents: []
      },
      expected: "The card is applied."
    },
    {
      name: "an automation waiting for the user, read back",
      card: {
        _tag: "Automation",
        id: CARD,
        action: "create",
        automationId: null,
        draft: draft({}),
        description: describeAutomation(draft({}), () => "Apple"),
        status: "pending",
        automation: null
      },
      expected: "Shown as a card reading the automation back: \"Every Monday at 10:00 New York time, buy $50 of " +
        "Apple.\" Nothing is saved until the user confirms it on the card."
    },
    {
      name: "research citing two pages",
      card: {
        _tag: "Research",
        id: CARD,
        query: "nvidia earnings",
        citations: [
          { url: "https://example.com/a", title: "A", citedText: null },
          { url: "https://example.com/b", title: "B", citedText: "Revenue rose." }
        ]
      },
      expected: "Shown as a research card citing 2 pages."
    },
    {
      name: "an error says why",
      card: { _tag: "Error", id: CARD, reason: "budget", message: "You've used today's assistant budget." },
      expected: "You've used today's assistant budget."
    }
  ])("$name", ({ card, expected }) => {
    assert.strictEqual(describeCard(card), expected)
  })
})
