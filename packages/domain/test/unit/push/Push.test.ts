import type { NotificationKind } from "@bluechip/domain/notifications/Notification"
import { pushMessageOf } from "@bluechip/domain/push/Push"
import { assert, describe, it } from "@effect/vitest"

describe("pushMessageOf", () => {
  it.each<{ name: string; kind: NotificationKind; link: string | null; expected: unknown }>([
    {
      name: "a recovery asked for: Cancel recovery",
      kind: "recoveryRequested",
      link: "/settings/security",
      expected: {
        id: "notification_1",
        title: "Title",
        body: "Body.",
        link: "/settings/security",
        actions: [{ action: "cancelRecovery", title: "Cancel recovery", done: "Recovery cancelled" }]
      }
    },
    {
      name: "a policy stopped a trade: Pause all agents",
      kind: "intentBlocked",
      link: "/agents/agent_1",
      expected: {
        id: "notification_1",
        title: "Title",
        body: "Body.",
        link: "/agents/agent_1",
        actions: [{ action: "pauseAll", title: "Pause all agents", done: "Every agent is paused" }]
      }
    },
    {
      name: "an approval: Review, which opens its page",
      kind: "approvalNeeded",
      link: "/home?sheet=approvals",
      expected: {
        id: "notification_1",
        title: "Title",
        body: "Body.",
        link: "/home?sheet=approvals",
        actions: [{ action: "review", title: "Review", done: "Reviewed" }]
      }
    },
    {
      name: "a trade filled: no buttons",
      kind: "intentFilled",
      link: "/activity",
      expected: { id: "notification_1", title: "Title", body: "Body.", link: "/activity", actions: [] }
    },
    {
      name: "the digest, without a page: no buttons, and home",
      kind: "dailyDigest",
      link: null,
      expected: { id: "notification_1", title: "Title", body: "Body.", link: "/home", actions: [] }
    }
  ])("$name", ({ expected, kind, link }) => {
    assert.deepStrictEqual(
      pushMessageOf({ id: "notification_1", kind, title: "Title", body: "Body.", link } as never),
      expected
    )
  })
})
