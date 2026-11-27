import { type Card, describeCard } from "@bluechip/domain/assistant/Card"
import { describeAutomation } from "@bluechip/domain/automations/Automation"
import { CardId, SigningRequestId } from "@bluechip/domain/Ids"
import { Intent, IntentRequest } from "@bluechip/domain/intents/Intent"
import { Quote, ReferencePrice } from "@bluechip/domain/market/Market"
import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { draft } from "../../fixtures/Automations.ts"
import { AGENT_ID, nvidiaBuy } from "../../fixtures/Intents.ts"

const CARD = CardId.make("card_01jd8v4t5m6n7a8q9r0s1t2v3w")
const AT = DateTime.makeUnsafe("2026-11-26T21:00:00Z")
const OWN = new Intent({ ...nvidiaBuy("awaitingSignature"), agentId: null, source: "assistant", executor: "owner" })

describe("describeCard", () => {
  it.each<{ name: string; card: Card; expected: string }>([
    {
      name: "a trade still being decided",
      card: { _tag: "Trade", id: CARD, intent: nvidiaBuy("proposed") },
      expected: "Agent agent_01jd8v4t5m6n7a8q9r0s1t2v3w's trade: Buy $50.00 of NVDA (intent " +
        "intent_01jd8v4t5m6n7a8q9r0s1t2v3w). Its policies are still deciding it; nothing has been sent yet."
    },
    {
      name: "a trade over the agent's largest trade",
      card: {
        _tag: "Trade",
        id: CARD,
        intent: nvidiaBuy("needsApproval", { _tag: "OverLargestTrade", maxPerTrade: Usdc.make(100_000_000n) })
      },
      expected: "Agent agent_01jd8v4t5m6n7a8q9r0s1t2v3w's trade: Buy $50.00 of NVDA (intent " +
        "intent_01jd8v4t5m6n7a8q9r0s1t2v3w). Over its $100 limit, so it needs your approval. It waits for the user " +
        "to approve it with Face ID; nothing is sent until they do."
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
      expected: "Agent agent_01jd8v4t5m6n7a8q9r0s1t2v3w's trade: Buy $50.00 of NVDA (intent " +
        "intent_01jd8v4t5m6n7a8q9r0s1t2v3w). Blocked by Max in one stock: Would put too much of your money in NVDA. " +
        "Nothing was sent."
    },
    {
      name: "a trade the agent is sending",
      card: { _tag: "Trade", id: CARD, intent: nvidiaBuy("sending") },
      expected: "Agent agent_01jd8v4t5m6n7a8q9r0s1t2v3w's trade: Buy $50.00 of NVDA (intent " +
        "intent_01jd8v4t5m6n7a8q9r0s1t2v3w). Within its policies, so it is being sent now; it isn't filled yet."
    },
    {
      name: "a filled trade",
      card: { _tag: "Trade", id: CARD, intent: nvidiaBuy("filled") },
      expected: "Agent agent_01jd8v4t5m6n7a8q9r0s1t2v3w's trade: Buy $50.00 of NVDA (intent " +
        "intent_01jd8v4t5m6n7a8q9r0s1t2v3w). It is filled (getActivity has the fill)."
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
      expected: "Waiting for the user to confirm pausing Tech picker: trading stops at once, and nothing is sold."
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
      expected: "Tech picker is paused."
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
      expected: "Waiting for the user to confirm a new automation: \"Every Monday at 10:00 New York time, buy $50 of " +
        "Apple.\" Nothing is saved until they do."
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
      expected: "Searched the web for \"nvidia earnings\" and cited: A (https://example.com/a); B " +
        "(https://example.com/b)."
    },
    {
      name: "a pause the user dismissed",
      card: {
        _tag: "AgentControl",
        id: CARD,
        action: "pause",
        agentId: AGENT_ID,
        agentName: "Tech picker",
        status: "dismissed",
        agents: []
      },
      expected: "The user left it as it was; nothing changed."
    },
    {
      name: "the user's own trade, with its quote, while the market is closed",
      card: {
        _tag: "Approval",
        id: CARD,
        intent: OWN,
        request: new IntentRequest({
          id: SigningRequestId.make("signing_01jd8v4t5m6n7a8q9r0s1t2v3w"),
          options: {},
          intent: OWN,
          quote: new Quote({
            symbol: "NVDA",
            side: "buy",
            usdc: Usdc.make(50_000_000n),
            shares: Shares.make(27_460_000n),
            price: Price.make(18_208_000_000n),
            reference: new ReferencePrice({
              symbol: "NVDA",
              price: Price.make(18_190_000_000n),
              updatedAt: AT,
              status: "paused"
            }),
            gapBps: 10,
            minimumOut: 27_322_700n,
            pool: "0xF668e21993f0ACd7ab00BB1cFbAeD0df28A3C8EC" as never,
            quotedAt: AT,
            expiresAt: AT
          }),
          warnings: ["pricesPaused"],
          together: [],
          deploysAccount: true,
          expiresAt: AT
        })
      },
      expected: "The user's own trade, prepared for their Face ID: Buy $50.00 of NVDA (intent " +
        "intent_01jd8v4t5m6n7a8q9r0s1t2v3w), about 0.2746 NVDA for $50.00, at $182.08 a share, 0.1% worse than " +
        "Chainlink's $181.90. It also sets up their account onchain, in the same Face ID. The market is closed, so " +
        "prices are paused and it trades at the pool's price. Nothing happens until they approve it with Face ID."
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
