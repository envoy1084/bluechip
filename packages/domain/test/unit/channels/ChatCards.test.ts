import type { Card } from "@bluechip/domain/assistant/Card"
import { chatCard, chatNotification } from "@bluechip/domain/channels/ChatCards"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"

const BUY = { symbol: "NVDA", side: "buy", amount: { usdc: Usdc.make(50_000_000n) } } as const

const context = { stock: () => "NVIDIA", conversationPath: "/chat/conversation_1" }

const card = (fields: object) => ({ id: "card_1", ...fields }) as unknown as Card

const answer = { _tag: "Answer", cardId: "card_1" } as const

const inApp = { _tag: "Open", label: "Open in bluechip", path: "/chat/conversation_1" } as const

describe("chatCard", () => {
  it.each(
    [
      {
        name: "an agent's trade sent",
        card: card({ _tag: "Trade", intent: { leg: BUY, status: "sending", decision: null } }),
        expected: { markdown: "**Buy $50.00 of NVIDIA**: sent within the agent's policies.", actions: [] }
      },
      {
        name: "an agent's trade filled",
        card: card({ _tag: "Trade", intent: { leg: BUY, status: "filled", decision: null } }),
        expected: { markdown: "**Buy $50.00 of NVIDIA**: filled.", actions: [] }
      },
      {
        name: "an agent's trade over its largest trade: a link to approve",
        card: card({
          _tag: "Trade",
          intent: {
            leg: BUY,
            status: "needsApproval",
            decision: { _tag: "OverLargestTrade", maxPerTrade: Usdc.make(25_000_000n) }
          }
        }),
        expected: {
          markdown:
            "**Buy $50.00 of NVIDIA**. Over the agent's largest trade ($25): it needs your Face ID. Approve it in bluechip.",
          actions: [{ _tag: "Open", label: "Approve in bluechip", path: "/home?sheet=approvals" }]
        }
      },
      {
        name: "an agent's trade blocked",
        card: card({
          _tag: "Trade",
          intent: {
            leg: BUY,
            status: "blocked",
            decision: { _tag: "Refused", policy: "trade", error: null, stock: null, message: "Not this one." }
          }
        }),
        expected: {
          markdown: "**Buy $50.00 of NVIDIA**. Blocked by Stocks and direction: Not this one.",
          actions: []
        }
      },
      {
        name: "your own trade: a link, never a signature",
        card: card({ _tag: "Approval", intent: { leg: BUY } }),
        expected: {
          markdown:
            "**Buy $50.00 of NVIDIA** is ready for your Face ID. Nothing happens until you approve it in bluechip.",
          actions: [inApp]
        }
      },
      {
        name: "a draft agent: a link",
        card: card({ _tag: "DraftAgent", agent: { name: "Tech picker" } }),
        expected: {
          markdown: "**Tech picker** is drafted. It runs only once you lock it with Face ID in bluechip.",
          actions: [inApp]
        }
      },
      {
        name: "a renewal: a link",
        card: card({ _tag: "PolicyChange", action: "renew", agent: { name: "Tech picker" }, request: {} }),
        expected: {
          markdown: "Ready to renew **Tech picker**. It happens once you approve it with Face ID in bluechip.",
          actions: [inApp]
        }
      },
      {
        name: "a draft removed",
        card: card({ _tag: "PolicyChange", action: "remove", agent: { name: "Tech picker" }, request: null }),
        expected: { markdown: "The draft **Tech picker** was removed.", actions: [] }
      },
      {
        name: "pause every agent: confirm or cancel",
        card: card({ _tag: "AgentControl", action: "pauseAll", agentName: null, status: "pending" }),
        expected: { markdown: "Pause every agent? They stop trading until you resume them.", actions: [answer] }
      },
      {
        name: "a resume confirmed",
        card: card({ _tag: "AgentControl", action: "resume", agentName: "Tech picker", status: "applied" }),
        expected: { markdown: "Tech picker is running again.", actions: [] }
      },
      {
        name: "a pause cancelled",
        card: card({ _tag: "AgentControl", action: "pause", agentName: "Tech picker", status: "dismissed" }),
        expected: { markdown: "Nothing changed.", actions: [] }
      },
      {
        name: "a template to save",
        card: card({ _tag: "SaveTemplate", name: "Careful", status: "pending" }),
        expected: { markdown: "Save \"Careful\" as a template?", actions: [answer] }
      },
      {
        name: "an automation to create",
        card: card({
          _tag: "Automation",
          action: "create",
          status: "pending",
          description: { sentence: "Every Monday at 10:00 UTC, buy $50 of Apple." }
        }),
        expected: {
          markdown: "Create this automation? Every Monday at 10:00 UTC, buy $50 of Apple.",
          actions: [answer]
        }
      },
      {
        name: "an automation paused",
        card: card({ _tag: "AutomationControl", action: "pause", automationName: "Dip buyer", status: "applied" }),
        expected: { markdown: "Dip buyer is paused.", actions: [] }
      },
      {
        name: "a memory to confirm",
        card: card({ _tag: "Memory", action: "confirm", status: "pending", memory: { text: "Prefers tech." } }),
        expected: { markdown: "Remember this? \"Prefers tech.\"", actions: [answer] }
      },
      {
        name: "a memory forgotten",
        card: card({ _tag: "Memory", action: "forgotten", status: "applied", memory: { text: "Prefers tech." } }),
        expected: { markdown: "Forgotten: \"Prefers tech.\"", actions: [] }
      },
      {
        name: "research with sources",
        card: card({ _tag: "Research", citations: [{ title: "Earnings", url: "https://example.com/a" }] }),
        expected: { markdown: "Sources:\n- [Earnings](https://example.com/a)", actions: [] }
      },
      {
        name: "an error",
        card: card({ _tag: "Error", reason: "budget", message: "You've used today's budget." }),
        expected: { markdown: "You've used today's budget.", actions: [] }
      }
    ] as const
  )("$name", ({ card, expected }) => {
    assert.deepStrictEqual<unknown>(chatCard(card, context), expected)
  })

  it("research without sources: nothing", () => {
    assert.strictEqual(chatCard(card({ _tag: "Research", citations: [] }), context), undefined)
  })
})

describe("chatNotification", () => {
  it.each(
    [
      {
        name: "with a page",
        notification: {
          kind: "intentFilled",
          title: "Tech picker bought $50.00 of NVIDIA",
          body: "It filled.",
          link: "/activity"
        },
        expected: {
          markdown: "**Tech picker bought $50.00 of NVIDIA**\nIt filled.",
          actions: [{ _tag: "Open", label: "Open in bluechip", path: "/activity" }]
        }
      },
      {
        name: "an approval expiring",
        notification: { kind: "approvalExpiring", title: "Expiring", body: "Soon.", link: "/home?sheet=approvals" },
        expected: {
          markdown: "**Expiring**\nSoon.",
          actions: [{ _tag: "Open", label: "Approve in bluechip", path: "/home?sheet=approvals" }]
        }
      },
      {
        name: "nothing to open",
        notification: { kind: "dailyDigest", title: "Your day", body: "Quiet.", link: null },
        expected: { markdown: "**Your day**\nQuiet.", actions: [] }
      }
    ] as const
  )("$name", ({ expected, notification }) => {
    assert.deepStrictEqual(chatNotification(notification), expected)
  })
})
