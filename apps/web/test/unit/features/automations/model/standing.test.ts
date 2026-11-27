import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import {
  attentionOf,
  filterCounts,
  nowLine,
  runsToday,
  shows,
  sortListed,
  stripLabel,
  summaryDetail,
  summaryHeadline,
  tradesThrough,
  untilText
} from "../../../../../src/features/automations/model/standing.ts"

const AGENT = "agent_01kqpv00007008900000000001" as never

describe("attentionOf", () => {
  const running = { status: "active", agentId: AGENT } as const

  it.each(
    [
      {
        name: "its last run failed",
        automation: running,
        runs: [{ outcome: "failed", reason: "It couldn't read your balances just then, so nothing was traded." }],
        agent: { status: "active", paused: false },
        expected: "Its last run failed. It couldn't read your balances just then, so nothing was traded."
      },
      {
        name: "its agent is paused",
        automation: running,
        runs: [],
        agent: { status: "active", paused: true },
        expected: "Its agent is paused, so it won't trade until you resume it."
      },
      {
        name: "its agent's session ended",
        automation: running,
        runs: [],
        agent: { status: "expired", paused: false },
        expected: "Its agent's session ended, so it can't trade until you renew it."
      },
      {
        name: "its agent was removed",
        automation: running,
        runs: [],
        agent: { status: "removed", paused: false },
        expected: "Its agent was removed, so it can't trade."
      },
      {
        name: "none of your agents has its id",
        automation: running,
        runs: [],
        agent: null,
        expected: "Its agent was removed, so it can't trade."
      },
      { name: "your agents still loading", automation: running, runs: [], agent: undefined, expected: null },
      {
        name: "a running one whose agent can trade",
        automation: running,
        runs: [{ outcome: "skipped", reason: "The market is closed." }],
        agent: { status: "active", paused: false },
        expected: null
      },
      {
        name: "your own trades, never failed",
        automation: { status: "active", agentId: null },
        runs: [],
        agent: null,
        expected: null
      },
      {
        name: "a paused one, even though its last run failed",
        automation: { status: "paused", agentId: AGENT },
        runs: [{ outcome: "failed", reason: "Something went wrong on bluechip's side, so nothing was traded." }],
        agent: { status: "active", paused: true },
        expected: null
      }
    ] as const
  )("$name", ({ agent, automation, expected, runs }) => {
    assert.strictEqual(attentionOf(automation, runs, agent), expected)
  })
})

describe("shows", () => {
  it.each(
    [
      { name: "all shows an ended one", listed: { standing: "ended", attention: null }, filter: "all", expected: true },
      {
        name: "active shows a failing one",
        listed: { standing: "failing", attention: "x" },
        filter: "active",
        expected: true
      },
      {
        name: "active hides a paused one",
        listed: { standing: "paused", attention: null },
        filter: "active",
        expected: false
      },
      {
        name: "paused shows a paused one",
        listed: { standing: "paused", attention: null },
        filter: "paused",
        expected: true
      },
      {
        name: "paused hides an ended one",
        listed: { standing: "ended", attention: null },
        filter: "paused",
        expected: false
      },
      {
        name: "needs attention shows one with a reason",
        listed: { standing: "active", attention: "Its agent is paused" },
        filter: "attention",
        expected: true
      },
      {
        name: "needs attention hides one without",
        listed: { standing: "active", attention: null },
        filter: "attention",
        expected: false
      }
    ] as const
  )("$name", ({ expected, filter, listed }) => {
    assert.strictEqual(shows(listed, filter), expected)
  })
})

describe("filterCounts", () => {
  it("counts each filter, a failing one as active and needing attention", () => {
    const counts = filterCounts([
      { standing: "active", attention: null },
      { standing: "failing", attention: "Its last run didn't go through." },
      { standing: "paused", attention: null },
      { standing: "ended", attention: null }
    ])

    assert.deepStrictEqual(counts, { all: 4, active: 2, paused: 1, attention: 1 })
  })

  it("an empty list counts nothing", () => {
    assert.deepStrictEqual(filterCounts([]), { all: 0, active: 0, paused: 0, attention: 0 })
  })
})

describe("runsToday", () => {
  it("counts the runs that fired today in the viewer's zone, not in UTC", () => {
    const now = new Date("2026-11-27T02:00:00Z")
    const runs = [
      { firedAt: DateTime.makeUnsafe("2026-11-27T01:00:00Z") },
      { firedAt: DateTime.makeUnsafe("2026-11-26T20:00:00Z") },
      { firedAt: DateTime.makeUnsafe("2026-11-25T20:00:00Z") }
    ]

    assert.strictEqual(runsToday(runs, now, "America/New_York"), 2)
  })
})

describe("summaryHeadline", () => {
  it.each([
    {
      name: "one running",
      counts: { all: 2, active: 1, paused: 1, attention: 0 },
      expected: "1 automation watching for you"
    },
    {
      name: "several running",
      counts: { all: 3, active: 3, paused: 0, attention: 0 },
      expected: "3 automations watching for you"
    },
    {
      name: "none running",
      counts: { all: 2, active: 0, paused: 2, attention: 0 },
      expected: "Nothing running right now"
    },
    { name: "none at all", counts: { all: 0, active: 0, paused: 0, attention: 0 }, expected: "No automations yet" }
  ])("$name", ({ counts, expected }) => {
    assert.strictEqual(summaryHeadline(counts), expected)
  })
})

describe("summaryDetail", () => {
  it.each([
    { name: "one needs a look", needLook: ["Weekly Apple"], today: 3, expected: "Weekly Apple needs attention." },
    {
      name: "three need a look",
      needLook: ["Weekly Apple", "Stop-loss", "News"],
      today: 0,
      expected: "3 need attention: Weekly Apple, Stop-loss and News."
    },
    { name: "nothing ran today", needLook: [], today: 0, expected: "Nothing has run yet today." },
    { name: "one run today", needLook: [], today: 1, expected: "They ran once today." },
    { name: "several runs today", needLook: [], today: 4, expected: "They ran 4 times today." }
  ])("$name", ({ expected, needLook, today }) => {
    assert.strictEqual(summaryDetail(needLook, today), expected)
  })
})

describe("untilText", () => {
  const now = new Date("2026-11-27T12:00:00Z")

  it.each([
    { name: "already due", at: "2026-11-27T11:59:50Z", expected: "now" },
    { name: "due this instant", at: "2026-11-27T12:00:00Z", expected: "now" },
    { name: "a second away", at: "2026-11-27T12:00:01Z", expected: "in 1 min" },
    { name: "under a minute away", at: "2026-11-27T12:00:30Z", expected: "in 1 min" },
    { name: "a minute away", at: "2026-11-27T12:01:00Z", expected: "in 1 min" },
    { name: "just over a minute away", at: "2026-11-27T12:01:01Z", expected: "in 2 min" },
    { name: "minutes away", at: "2026-11-27T12:12:00Z", expected: "in 12 min" },
    { name: "just under an hour away", at: "2026-11-27T12:59:30Z", expected: "in 1 h" },
    { name: "an hour away", at: "2026-11-27T13:00:00Z", expected: "in 1 h" },
    { name: "hours away", at: "2026-11-27T15:00:00Z", expected: "in 3 h" },
    { name: "a day away", at: "2026-11-28T12:00:00Z", expected: "tomorrow" },
    { name: "days away", at: "2026-12-01T12:00:00Z", expected: "in 4 days" }
  ])("$name", ({ at, expected }) => {
    assert.strictEqual(untilText(DateTime.makeUnsafe(at), now), expected)
  })
})

describe("nowLine", () => {
  const now = new Date("2026-11-26T15:00:00Z")
  const schedule = {
    type: "schedule",
    config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" }
  } as const
  const news = { type: "news", config: { symbols: ["NVDA"], topics: [] } } as const

  it.each(
    [
      {
        name: "a running schedule: its next time in the viewer's zone, and how soon",
        automation: { status: "active", nextRunAt: DateTime.makeUnsafe("2026-11-30T15:00:00Z"), trigger: schedule },
        expected: { kind: "next", text: "Next run Mon 30 Nov, 10:00 your time, in 4 days" }
      },
      {
        name: "a running news trigger: what it watches",
        automation: { status: "active", nextRunAt: null, trigger: news },
        expected: { kind: "watching", text: "Watching the news" }
      },
      {
        name: "a paused schedule",
        automation: { status: "paused", nextRunAt: DateTime.makeUnsafe("2026-11-30T15:00:00Z"), trigger: schedule },
        expected: { kind: "paused", text: "Paused, nothing runs until you resume it" }
      },
      {
        name: "done",
        automation: { status: "done", nextRunAt: null, trigger: schedule },
        expected: { kind: "ended", text: "Done, it ran as many times as it may" }
      },
      {
        name: "expired",
        automation: { status: "expired", nextRunAt: null, trigger: news },
        expected: { kind: "ended", text: "Ended on its end date" }
      }
    ] as const
  )("$name", ({ automation, expected }) => {
    assert.deepStrictEqual(nowLine(automation, now, "America/New_York"), expected)
  })
})

describe("stripLabel", () => {
  it.each(
    [
      { name: "no runs", results: [], expected: "No runs yet" },
      { name: "one run", results: ["traded"], expected: "Last run: 1 traded" },
      {
        name: "several runs, counted by result",
        results: ["traded", "blocked", "traded", "failed"],
        expected: "Last 4 runs: 2 traded, 1 blocked, 1 failed"
      }
    ] as const
  )("$name", ({ expected, results }) => {
    assert.strictEqual(stripLabel(results), expected)
  })
})

describe("tradesThrough", () => {
  const OTHER = "agent_01kqpv00007008900000000002" as never

  it.each(
    [
      { name: "all agents shows yours", agentId: null, trader: "all", expected: true },
      { name: "all agents shows an agent's", agentId: AGENT, trader: "all", expected: true },
      { name: "you shows your own", agentId: null, trader: "you", expected: true },
      { name: "you hides an agent's", agentId: AGENT, trader: "you", expected: false },
      { name: "an agent shows its own", agentId: AGENT, trader: AGENT, expected: true },
      { name: "an agent hides another's", agentId: OTHER, trader: AGENT, expected: false },
      { name: "an agent hides yours", agentId: null, trader: AGENT, expected: false }
    ] as const
  )("$name", ({ agentId, expected, trader }) => {
    assert.strictEqual(tradesThrough({ agentId }, trader), expected)
  })
})

describe("sortListed", () => {
  const row = (
    name: string,
    standing: "active" | "failing" | "paused" | "ended",
    options: { readonly attention?: string; readonly nextRunAt?: string } = {}
  ) => ({
    standing,
    attention: options.attention ?? null,
    automation: {
      name,
      nextRunAt: options.nextRunAt === undefined ? null : DateTime.makeUnsafe(options.nextRunAt)
    }
  })

  it("needs a look first, then running by next run (live triggers after), then paused, then ended", () => {
    const sorted = sortListed([
      row("Ended one", "ended"),
      row("Paused schedule", "paused", { nextRunAt: "2026-11-28T10:00:00Z" }),
      row("News watcher", "active"),
      row("Friday buy", "active", { nextRunAt: "2026-11-30T15:00:00Z" }),
      row("Monday buy", "active", { nextRunAt: "2026-11-28T15:00:00Z" }),
      row("Agent paused", "active", { attention: "Its agent is paused." }),
      row("Broken", "failing", { attention: "Its last run didn't go through." })
    ])

    assert.deepStrictEqual(sorted.map((each) => each.automation.name), [
      "Agent paused",
      "Broken",
      "Monday buy",
      "Friday buy",
      "News watcher",
      "Paused schedule",
      "Ended one"
    ])
  })

  it("by name within a group", () => {
    const sorted = sortListed([row("Zebra", "paused"), row("Apple", "paused")])

    assert.deepStrictEqual(sorted.map((each) => each.automation.name), ["Apple", "Zebra"])
  })

  it("leaves the list it was given as it was", () => {
    const rows = [row("B", "ended"), row("A", "active")]

    sortListed(rows)

    assert.deepStrictEqual(rows.map((each) => each.automation.name), ["B", "A"])
  })
})
