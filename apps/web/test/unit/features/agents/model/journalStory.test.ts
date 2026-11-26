import type { Intent } from "@bluechip/domain/intents/Intent"
import { journalOfIntent } from "@bluechip/domain/journal/Journal"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import { type JournalStory, storyOf } from "../../../../../src/features/agents/model/journalStory.ts"
import { appleBuy, nameOf } from "../../../../fixtures/Journal.ts"

describe("storyOf", () => {
  describe("a trade, from the sentence the server writes", () => {
    const apple = { symbol: "AAPL", side: "buy", amount: { usdc: Usdc.make(500_000_000n) } } as const
    const why = "Momentum after a strong earnings week."

    it.each<{ name: string; intent: Pick<Intent, "status" | "decision">; expected: JournalStory }>([
      { name: "filled", intent: { status: "filled", decision: null }, expected: appleBuy({ moment: "filled" }) },
      {
        name: "sent within its policies",
        intent: { status: "sending", decision: { _tag: "Passes", callGasLimit: 420_000n } },
        expected: appleBuy({ moment: "sent", why })
      },
      {
        name: "blocked by a policy",
        intent: {
          status: "blocked",
          decision: {
            _tag: "Refused",
            policy: "cashReserve",
            error: null,
            stock: null,
            message: "It keeps some of your money in cash."
          }
        },
        expected: appleBuy({
          moment: "blocked",
          policy: "Cash reserve",
          decision: "It keeps some of your money in cash.",
          why
        })
      },
      {
        name: "over its largest trade",
        intent: {
          status: "needsApproval",
          decision: { _tag: "OverLargestTrade", maxPerTrade: Usdc.make(100_000_000n) }
        },
        expected: appleBuy({
          moment: "needsApproval",
          decision: "Over its $100 limit, so it needs your approval.",
          why
        })
      },
      {
        name: "asking first",
        intent: { status: "needsApproval", decision: { _tag: "Ask" } },
        expected: appleBuy({ moment: "needsApproval", decision: "It asks you first, so it needs your approval.", why })
      },
      {
        name: "waiting",
        intent: { status: "waiting", decision: { _tag: "Wait", reason: "noGas", until: null as never } },
        expected: appleBuy({ moment: "waiting", decision: "Waiting: your account needs a little ETH for gas.", why })
      },
      {
        name: "approved, waiting for Face ID",
        intent: { status: "awaitingSignature", decision: null },
        expected: appleBuy({ moment: "approved" })
      },
      {
        name: "failed onchain",
        intent: { status: "failed", decision: null },
        expected: appleBuy({ moment: "failed" })
      },
      { name: "declined", intent: { status: "declined", decision: null }, expected: appleBuy({ moment: "declined" }) },
      { name: "expired", intent: { status: "expired", decision: null }, expected: appleBuy({ moment: "expired" }) },
      {
        name: "cancelled",
        intent: { status: "cancelled", decision: null },
        expected: appleBuy({ moment: "cancelled" })
      }
    ])("$name", ({ expected, intent }) => {
      const entry = journalOfIntent({ ...intent, leg: apple, reason: why }, nameOf)!

      assert.deepStrictEqual(storyOf({ kind: "intent", entry }, nameOf), expected)
    })
  })

  it.each<{ name: string; entry: string; expected: JournalStory }>([
    {
      name: "a sale by shares",
      entry: "Sell 0.5 shares of NVIDIA: filled.",
      expected: appleBuy({ trade: "Sell 0.5 shares of NVIDIA", side: "sell", symbol: "NVDA" })
    },
    {
      name: "a stock bluechip doesn't know: no symbol",
      entry: "Buy $50.00 of Acme Corp: filled.",
      expected: appleBuy({ trade: "Buy $50.00 of Acme Corp", symbol: null })
    },
    {
      name: "a stock named by its symbol",
      entry: "Buy $50.00 of TSLA: filled.",
      expected: appleBuy({ trade: "Buy $50.00 of TSLA", symbol: "TSLA" })
    },
    {
      name: "approval with no decision recorded",
      entry: "Buy $500.00 of Apple.  Why: Its scheduled buy.",
      expected: appleBuy({ moment: "needsApproval", why: "Its scheduled buy." })
    },
    {
      name: "a refusal by a policy it doesn't know",
      entry: "Buy $500.00 of Apple, blocked by Old rule: No. Why: Momentum.",
      expected: appleBuy({ moment: "blocked", decision: "Old rule: No.", why: "Momentum." })
    },
    {
      name: "a sentence in other words: a note",
      entry: "Bought some Apple.",
      expected: { _tag: "Note", text: "Bought some Apple." }
    }
  ])("$name", ({ entry, expected }) => {
    assert.deepStrictEqual(storyOf({ kind: "intent", entry }, nameOf), expected)
  })

  it.each<{ name: string; entry: string; expected: JournalStory }>([
    {
      name: "skipped, with its reason",
      entry: "Automation \"Keep the mix\" skipped: There was nothing to trade.",
      expected: { _tag: "Run", automation: "Keep the mix", outcome: "skipped", reason: "There was nothing to trade." }
    },
    {
      name: "proposed trades",
      entry: "Automation \"Buy the dip\" proposed trades: Apple fell 5% today.",
      expected: { _tag: "Run", automation: "Buy the dip", outcome: "proposed", reason: "Apple fell 5% today." }
    },
    {
      name: "a name with quotes in it",
      entry: "Automation \"The \"big\" one\" let you know: Done.",
      expected: { _tag: "Run", automation: "The \"big\" one", outcome: "notified", reason: "Done." }
    },
    {
      name: "a sentence in other words: a note",
      entry: "It ran.",
      expected: { _tag: "Note", text: "It ran." }
    }
  ])("a run: $name", ({ entry, expected }) => {
    assert.deepStrictEqual(storyOf({ kind: "automation", entry }, nameOf), expected)
  })

  it("a judgment: its headline, answer and reason", () => {
    const entry = "Automation \"News watch\" judged \"Apple beats on earnings\": yes, 82% sure. Revenue grew 9%."

    assert.deepStrictEqual(storyOf({ kind: "judgment", entry }, nameOf), {
      _tag: "Judgment",
      automation: "News watch",
      headline: "Apple beats on earnings",
      verdict: true,
      confidence: 0.82,
      reason: "Revenue grew 9%."
    })
  })
})
