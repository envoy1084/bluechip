import { kindOf } from "@bluechip/domain/notifications/Kinds"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import {
  deviceName,
  isChangeable,
  notificationDays,
  notificationTime,
  settingsSections,
  withChannel
} from "../../../../../src/features/notifications/model/notificationText.ts"

const NOW = DateTime.makeUnsafe("2026-11-26T12:00:00Z")

describe("notificationTime", () => {
  it.each(
    [
      { name: "under a minute", at: "2026-11-26T11:59:30Z", zone: "UTC", expected: "Just now" },
      { name: "5 minutes", at: "2026-11-26T11:55:00Z", zone: "UTC", expected: "5 min ago" },
      { name: "an hour ago: the clock time", at: "2026-11-26T11:00:00Z", zone: "UTC", expected: "11:00" },
      { name: "earlier today", at: "2026-11-26T00:30:00Z", zone: "UTC", expected: "00:30" },
      { name: "yesterday", at: "2026-11-25T13:00:00Z", zone: "UTC", expected: "Yesterday, 13:00" },
      { name: "older: the date", at: "2026-11-20T09:00:00Z", zone: "UTC", expected: "Fri 20 Nov, 09:00" },
      {
        name: "in the viewer's zone: today in UTC is yesterday in New York",
        at: "2026-11-26T03:00:00Z",
        zone: "America/New_York",
        expected: "Yesterday, 22:00"
      }
    ] as const
  )("$name", ({ at, expected, zone }) => {
    assert.strictEqual(notificationTime(DateTime.makeUnsafe(at), NOW, zone), expected)
  })
})

describe("notificationDays", () => {
  const at = (iso: string) => ({ createdAt: DateTime.makeUnsafe(iso) })

  it("today's, then earlier", () => {
    const today = at("2026-11-26T09:00:00Z")
    const yesterday = at("2026-11-25T22:00:00Z")

    assert.deepStrictEqual(notificationDays([today, yesterday], NOW, "UTC"), [
      { title: "Today", notifications: [today] },
      { title: "Earlier", notifications: [yesterday] }
    ])
  })

  it("only earlier ones: no Today", () => {
    const old = at("2026-11-20T09:00:00Z")

    assert.deepStrictEqual(notificationDays([old], NOW, "UTC"), [{ title: "Earlier", notifications: [old] }])
  })

  it("none: nothing", () => {
    assert.deepStrictEqual(notificationDays([], NOW, "UTC"), [])
  })
})

describe("withChannel", () => {
  const rule = { kind: "intentFilled", channels: ["inApp", "telegram"], digest: true } as const

  it.each(
    [
      { name: "push on", channel: "push", on: true, expected: ["inApp", "telegram", "push"] },
      { name: "Telegram off", channel: "telegram", on: false, expected: ["inApp"] },
      { name: "Telegram on again: once", channel: "telegram", on: true, expected: ["inApp", "telegram"] },
      { name: "the center off: stays on", channel: "inApp", on: false, expected: ["inApp", "telegram"] }
    ] as const
  )("$name", ({ channel, expected, on }) => {
    assert.deepStrictEqual(withChannel(rule, channel, on), { channels: expected, digest: true })
  })
})

describe("isChangeable", () => {
  it.each(
    [
      { name: "a trade's push", kind: "intentFilled", channel: "push", expected: true },
      { name: "the center", kind: "intentFilled", channel: "inApp", expected: false },
      { name: "a security kind", kind: "chatLinked", channel: "telegram", expected: false },
      { name: "the digest's push (it has none)", kind: "dailyDigest", channel: "push", expected: false }
    ] as const
  )("$name", ({ channel, expected, kind }) => {
    assert.strictEqual(isChangeable(kindOf(kind), channel), expected)
  })
})

describe("settingsSections", () => {
  it("every section in order, a rule for every kind (defaults where none was given)", () => {
    const sections = settingsSections([{ kind: "deposit", channels: ["inApp"], digest: false }])

    assert.deepStrictEqual(
      [
        sections.map((section) => section.group),
        sections.find((section) => section.group === "money")?.kinds.map(({ rule }) => rule)
      ],
      [
        ["trades", "agents", "automations", "money", "security", "digest"],
        [
          { kind: "deposit", channels: ["inApp"], digest: false },
          { kind: "withdrawal", channels: ["inApp", "push", "telegram"], digest: false },
          { kind: "balanceUnexplained", channels: ["inApp", "push", "telegram"], digest: false }
        ]
      ]
    )
  })
})

describe("deviceName", () => {
  it.each(
    [
      {
        agent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        expected: "Chrome on Mac"
      },
      {
        agent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
        expected: "Safari on iPhone"
      },
      {
        agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
        expected: "Firefox on Windows"
      },
      {
        agent:
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36 EdgA/131.0 Edg/131.0",
        expected: "Edge on Android"
      },
      { agent: "curl/8.0", expected: "A browser" }
    ] as const
  )("$expected", ({ agent, expected }) => {
    assert.strictEqual(deviceName(agent), expected)
  })
})
