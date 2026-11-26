import { deliveryChannels, KINDS, ruleFor } from "@bluechip/domain/notifications/Kinds"
import { assert, describe, it } from "@effect/vitest"

describe("ruleFor", () => {
  it.each(
    [
      {
        name: "a kind never changed: its defaults",
        kind: "intentFilled",
        saved: undefined,
        expected: { kind: "intentFilled", channels: ["inApp", "telegram"], digest: false }
      },
      {
        name: "a saved rule: its channels",
        kind: "intentFilled",
        saved: { channels: ["push"], digest: false },
        expected: { kind: "intentFilled", channels: ["inApp", "push"], digest: false }
      },
      {
        name: "the center turned off: still on",
        kind: "deposit",
        saved: { channels: [], digest: false },
        expected: { kind: "deposit", channels: ["inApp"], digest: false }
      },
      {
        name: "a security kind turned off: everywhere",
        kind: "chatLinked",
        saved: { channels: [], digest: true },
        expected: { kind: "chatLinked", channels: ["inApp", "push", "telegram"], digest: false }
      },
      {
        name: "a channel the kind can't use: dropped",
        kind: "dailyDigest",
        saved: { channels: ["push", "telegram"], digest: false },
        expected: { kind: "dailyDigest", channels: ["inApp", "telegram"], digest: false }
      },
      {
        name: "digest on an info kind: kept",
        kind: "automationFired",
        saved: { channels: ["telegram"], digest: true },
        expected: { kind: "automationFired", channels: ["inApp", "telegram"], digest: true }
      },
      {
        name: "digest on an important kind: dropped",
        kind: "approvalNeeded",
        saved: { channels: ["push"], digest: true },
        expected: { kind: "approvalNeeded", channels: ["inApp", "push"], digest: false }
      }
    ] as const
  )("$name", ({ expected, kind, saved }) => {
    assert.deepStrictEqual(ruleFor(kind, saved), expected)
  })
})

describe("deliveryChannels", () => {
  it.each(
    [
      { name: "push and Telegram", digest: false, expected: ["push", "telegram"] },
      { name: "waiting for the digest: none now", digest: true, expected: [] }
    ] as const
  )("$name", ({ digest, expected }) => {
    assert.deepStrictEqual(
      deliveryChannels({ kind: "automationFired", channels: ["inApp", "push", "telegram"], digest }),
      expected
    )
  })
})

describe("KINDS", () => {
  it("every security kind is locked and goes everywhere by default", () => {
    assert.deepStrictEqual(
      KINDS.filter((info) => info.severity === "security").map((info) => [info.kind, info.locked, info.defaults]),
      [
        ["passkeyAdded", true, { channels: ["inApp", "push", "telegram"], digest: false }],
        ["chatLinked", true, { channels: ["inApp", "push", "telegram"], digest: false }],
        ["chatUnlinked", true, { channels: ["inApp", "push", "telegram"], digest: false }]
      ]
    )
  })
})
