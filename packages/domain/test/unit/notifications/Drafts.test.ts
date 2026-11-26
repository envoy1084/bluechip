import type { Agent } from "@bluechip/domain/agents/Agent"
import type { AutomationRun } from "@bluechip/domain/automations/Run"
import type { Intent } from "@bluechip/domain/intents/Intent"
import { Usdc } from "@bluechip/domain/market/Units"
import {
  digestOf,
  notificationOfAgent,
  notificationOfChatLink,
  notificationOfExpiring,
  notificationOfIntent,
  notificationOfRun,
  notificationOfSessionEnding,
  notificationOfTransfer,
  notificationOfWaiting
} from "@bluechip/domain/notifications/Drafts"
import type { Transfer } from "@bluechip/domain/portfolio/Transfer"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"

const BUY = { symbol: "NVDA", side: "buy", amount: { usdc: Usdc.make(50_000_000n) } } as const

const intent = (fields: Partial<Intent>) =>
  ({ id: "intent_1", agentId: "agent_1", source: "automation", leg: BUY, decision: null, ...fields }) as Intent

const names = { agent: "Tech picker", stock: () => "NVIDIA" }

describe("notificationOfIntent", () => {
  it.each(
    [
      {
        name: "an agent's buy filled",
        intent: intent({ status: "filled" }),
        expected: {
          kind: "intentFilled",
          title: "Tech picker bought $50.00 of NVIDIA",
          body: "It filled. The receipt is in Activity.",
          link: "/activity",
          subjectType: "intent",
          subjectId: "intent_1",
          dedupeKey: "intentFilled:intent_1:filled"
        }
      },
      {
        name: "a trade failed onchain",
        intent: intent({ status: "failed" }),
        expected: {
          kind: "intentFilled",
          title: "Tech picker: buy $50.00 of NVIDIA failed",
          body: "It failed onchain, so nothing was traded.",
          link: "/agents/agent_1",
          subjectType: "intent",
          subjectId: "intent_1",
          dedupeKey: "intentFilled:intent_1:failed"
        }
      },
      {
        name: "blocked by a policy",
        intent: intent({
          status: "blocked",
          decision: { _tag: "Refused", policy: "trade", error: null, stock: "NVDA", message: "Not this one." }
        }),
        expected: {
          kind: "intentBlocked",
          title: "A policy stopped Tech picker",
          body: "Buy $50.00 of NVIDIA. Blocked by Stocks and direction: Not this one.",
          link: "/agents/agent_1",
          subjectType: "intent",
          subjectId: "intent_1",
          dedupeKey: "intentBlocked:intent_1:blocked"
        }
      },
      {
        name: "over the largest trade",
        intent: intent({ status: "needsApproval" }),
        expected: {
          kind: "approvalNeeded",
          title: "Tech picker needs your OK",
          body: "Buy $50.00 of NVIDIA. Approve or decline it in bluechip with Face ID.",
          link: "/home?sheet=approvals",
          subjectType: "intent",
          subjectId: "intent_1",
          dedupeKey: "approvalNeeded:intent_1:needsApproval"
        }
      },
      {
        name: "expired unanswered",
        intent: intent({ status: "expired" }),
        expected: {
          kind: "intentBlocked",
          title: "Tech picker: buy $50.00 of NVIDIA expired",
          body: "It wasn't answered in time, so nothing was traded.",
          link: "/agents/agent_1",
          subjectType: "intent",
          subjectId: "intent_1",
          dedupeKey: "intentBlocked:intent_1:expired"
        }
      }
    ] as const
  )("$name", ({ expected, intent }) => {
    assert.deepStrictEqual(notificationOfIntent(intent, names), expected)
  })

  it.each(
    ["proposed", "deciding", "sending", "confirming", "waiting", "awaitingSignature", "declined", "cancelled"] as const
  )(
    "%s: nothing",
    (status) => {
      assert.strictEqual(notificationOfIntent(intent({ status }), names), undefined)
    }
  )

  it("your own trade in the app: nothing", () => {
    assert.strictEqual(
      notificationOfIntent(intent({ agentId: null, source: "owner", status: "filled" }), { ...names, agent: null }),
      undefined
    )
  })

  it("your own trade from Telegram, filled", () => {
    assert.strictEqual(
      notificationOfIntent(intent({ agentId: null, source: "channel", status: "filled" }), { ...names, agent: null })
        ?.title,
      "You bought $50.00 of NVIDIA"
    )
  })
})

describe("notificationOfWaiting", () => {
  it("an agent's trade waiting for gas", () => {
    assert.deepStrictEqual(
      notificationOfWaiting(
        intent({
          status: "waiting",
          decision: { _tag: "Wait", reason: "noGas", until: DateTime.makeUnsafe("2026-11-26T10:00:00Z") }
        }),
        names
      ),
      {
        kind: "intentWaiting",
        title: "Tech picker is still waiting",
        body: "Buy $50.00 of NVIDIA. Waiting: your account needs a little ETH for gas.",
        link: "/agents/agent_1",
        subjectType: "intent",
        subjectId: "intent_1",
        dedupeKey: "intentWaiting:intent_1"
      }
    )
  })
})

describe("notificationOfExpiring", () => {
  it("an approval expiring", () => {
    assert.deepStrictEqual(notificationOfExpiring(intent({ status: "needsApproval" }), names), {
      kind: "approvalExpiring",
      title: "Tech picker expires within the hour",
      body: "Buy $50.00 of NVIDIA waits for your OK. Approve or decline it in bluechip.",
      link: "/home?sheet=approvals",
      subjectType: "intent",
      subjectId: "intent_1",
      dedupeKey: "approvalExpiring:intent_1"
    })
  })
})

describe("notificationOfAgent", () => {
  const agent = { id: "agent_1", name: "Tech picker" } as Agent

  it.each(
    [
      {
        change: "paused",
        expected: {
          kind: "agentPaused",
          title: "Tech picker is paused",
          body: "It can't trade until you resume it. Nothing was sold.",
          link: "/agents/agent_1",
          subjectType: "agent",
          subjectId: "agent_1",
          dedupeKey: "agentPaused:agent_1:2026-11-26T10:00:00.000Z"
        }
      },
      {
        change: "renewed",
        expected: {
          kind: "sessionRenewed",
          title: "Tech picker was renewed",
          body: "Its policies hold for another 90 days.",
          link: "/agents/agent_1",
          subjectType: "agent",
          subjectId: "agent_1",
          dedupeKey: "sessionRenewed:agent_1:2026-11-26T10:00:00.000Z"
        }
      }
    ] as const
  )("$change", ({ change, expected }) => {
    assert.deepStrictEqual(notificationOfAgent(agent, change, "2026-11-26T10:00:00.000Z"), expected)
  })
})

describe("notificationOfSessionEnding", () => {
  it.each(
    [
      { days: 7, title: "Tech picker stops in a week" },
      { days: 1, title: "Tech picker stops tomorrow" }
    ] as const
  )("$days days left", ({ days, title }) => {
    assert.deepStrictEqual(
      notificationOfSessionEnding({ id: "agent_1", name: "Tech picker" } as Agent, {
        sessionId: "agentsession_1",
        validUntil: DateTime.makeUnsafe("2027-02-24T10:00:00Z"),
        days
      }),
      {
        kind: "sessionEnding",
        title,
        body: "It stops trading on 24 Feb unless you renew it with Face ID.",
        link: "/agents/agent_1",
        subjectType: "agent",
        subjectId: "agent_1",
        dedupeKey: `sessionEnding:agentsession_1:${days}`
      }
    )
  })
})

describe("notificationOfTransfer", () => {
  const transfer = (fields: Partial<Transfer>) =>
    ({ id: "transfer_1", kind: "withdrawal", asset: "USDC", amount: 25_500_000n, ...fields }) as Transfer

  it.each(
    [
      {
        name: "a deposit",
        transfer: transfer({ kind: "deposit", status: "confirmed" }),
        expected: ["deposit", "$25.50 of USDC arrived", "It's in your account, ready to trade."]
      },
      {
        name: "a withdrawal landed",
        transfer: transfer({ status: "confirmed" }),
        expected: ["withdrawal", "$25.50 of USDC withdrawn", "It landed at the address you chose."]
      },
      {
        name: "a withdrawal failed",
        transfer: transfer({ status: "failed" }),
        expected: ["withdrawal", "A withdrawal failed", "$25.50 of USDC stayed in your account."]
      },
      {
        name: "shares withdrawn",
        transfer: transfer({ status: "confirmed", asset: "NVDA", amount: 150_000_000n }),
        expected: ["withdrawal", "1.5 shares of NVIDIA withdrawn", "It landed at the address you chose."]
      }
    ] as const
  )("$name", ({ expected, transfer }) => {
    const draft = notificationOfTransfer(transfer, () => "NVIDIA")
    assert.deepStrictEqual<ReadonlyArray<unknown>>([draft?.kind, draft?.title, draft?.body], expected)
  })

  it("a withdrawal on its way: nothing", () => {
    assert.strictEqual(notificationOfTransfer(transfer({ status: "pending" }), () => "NVIDIA"), undefined)
  })
})

describe("notificationOfRun", () => {
  const run = (fields: Partial<AutomationRun>) =>
    ({
      id: "run_1",
      automationId: "automation_1",
      trigger: { summary: "NVIDIA at $90, 10% under its $100 high" },
      conditions: [],
      reason: "Bought the dip.",
      ...fields
    }) as unknown as AutomationRun

  it.each(
    [
      {
        name: "proposed trades",
        run: run({ outcome: "proposed" }),
        expected: [
          "automationFired",
          "Dip buyer ran",
          "NVIDIA at $90, 10% under its $100 high. It proposed trades to its agent."
        ]
      },
      {
        name: "asked you",
        run: run({ outcome: "asked" }),
        expected: [
          "automationFired",
          "Dip buyer ran",
          "NVIDIA at $90, 10% under its $100 high. It asks you first: approve it in bluechip."
        ]
      },
      {
        name: "a message for you",
        run: run({ outcome: "notified", reason: "Apple is up 5% today." }),
        expected: ["automationMessage", "Dip buyer", "Apple is up 5% today."]
      },
      {
        name: "failed",
        run: run({ outcome: "failed", reason: "No quote." }),
        expected: ["automationFired", "Dip buyer ran", "It failed: No quote."]
      },
      {
        name: "skipped by a judgment",
        run: run({
          outcome: "skipped",
          reason: "The story isn't about earnings.",
          conditions: [{ type: "judgment", pass: false, reason: "No.", judgmentId: "judgment_1" as never }]
        }),
        expected: ["automationSkipped", "A judgment held back Dip buyer", "The story isn't about earnings."]
      }
    ] as const
  )("$name", ({ expected, run }) => {
    const draft = notificationOfRun(run, "Dip buyer")
    assert.deepStrictEqual<ReadonlyArray<unknown>>([draft?.kind, draft?.title, draft?.body], expected)
  })

  it("a message: one notification per run, about its automation", () => {
    const draft = notificationOfRun(run({ outcome: "notified", reason: "Apple is up 5% today." }), "Dip buyer")

    assert.deepStrictEqual(
      [draft?.dedupeKey, draft?.subjectType, draft?.subjectId, draft?.link],
      ["run:run_1", "automation", "automation_1", "/automations/automation_1"]
    )
  })

  it("skipped by a time window: nothing", () => {
    assert.strictEqual(
      notificationOfRun(
        run({ outcome: "skipped", conditions: [{ type: "time", pass: false, reason: "Closed.", judgmentId: null }] }),
        "Dip buyer"
      ),
      undefined
    )
  })
})

describe("notificationOfChatLink", () => {
  it.each(
    [
      {
        change: "linked",
        expected: [
          "chatLinked",
          "Telegram is linked",
          "Telegram (Maya) can now talk to the assistant about your account. Unlink it in Settings if this wasn't you."
        ]
      },
      {
        change: "unlinked",
        expected: ["chatUnlinked", "Telegram is unlinked", "Telegram (Maya) can no longer reach your account."]
      },
      {
        change: "blocked",
        expected: [
          "chatUnlinked",
          "Telegram is unlinked",
          "The bot was blocked in Telegram (Maya), so bluechip unlinked it. Link it again in Settings to hear from " +
          "bluechip there."
        ]
      }
    ] as const
  )("$change", ({ change, expected }) => {
    const draft = notificationOfChatLink({ id: "channellink_1", platform: "telegram", name: "Maya" }, change)
    assert.deepStrictEqual<ReadonlyArray<unknown>>([draft.kind, draft.title, draft.body], expected)
  })

  it("a chat without a name", () => {
    assert.strictEqual(
      notificationOfChatLink({ id: "channellink_1", platform: "telegram", name: null }, "unlinked").body,
      "A Telegram chat can no longer reach your account."
    )
  })
})

describe("digestOf", () => {
  it("nothing held: no digest", () => {
    assert.strictEqual(digestOf("2026-11-26", []), undefined)
  })

  it("one update", () => {
    assert.deepStrictEqual(digestOf("2026-11-26", [{ title: "Dip buyer ran" }]), {
      kind: "dailyDigest",
      title: "Your day: 1 update",
      body: "Dip buyer ran.",
      link: "/home",
      subjectType: null,
      subjectId: null,
      dedupeKey: "dailyDigest:2026-11-26"
    })
  })

  it("more than twelve: the rest counted", () => {
    const body = digestOf("2026-11-26", Array.from({ length: 14 }, (_, at) => ({ title: `Update ${at + 1}` })))?.body
    assert.strictEqual(body?.split("\n").at(-1), "And 2 more in bluechip.")
  })
})
