import { AutomationRunId } from "@bluechip/domain/Ids"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { filterOf, journalLines, rulesMoments } from "../../../../../src/features/agents/model/journalTimeline.ts"
import { agentSession, CAUTIOUS, firstLock, journalEntry, nameOf } from "../../../../fixtures/Journal.ts"

describe("rulesMoments", () => {
  it("the first lock, a change, a renewal in force, newest first", () => {
    const sessions = [
      agentSession(1),
      agentSession(2, { spec: CAUTIOUS }),
      agentSession(3, {
        spec: CAUTIOUS,
        status: "active",
        validUntil: DateTime.makeUnsafe("2027-02-01T10:00:00Z")
      })
    ]

    assert.deepStrictEqual(
      rulesMoments(sessions).map(({ change, id, moved, until }) => ({ id, change, moved, until })),
      [
        {
          id: "agentsession_01jd8v4t5m6n7a8q9r0s1t2v33 took",
          change: "renewed",
          moved: [],
          until: DateTime.makeUnsafe("2027-02-01T10:00:00Z")
        },
        {
          id: "agentsession_01jd8v4t5m6n7a8q9r0s1t2v32 took",
          change: "changed",
          moved: [
            "Stocks and direction tightened",
            "Trade size tightened",
            "Max in one stock tightened",
            "Cash reserve tightened"
          ],
          until: null
        },
        { id: "agentsession_01jd8v4t5m6n7a8q9r0s1t2v31 took", change: "locked", moved: [], until: null }
      ]
    )
  })

  it("one that ran out: when it took force and when it ended", () => {
    const ran = agentSession(1, { status: "expired", endedAt: DateTime.makeUnsafe("2026-11-05T10:00:00Z") })

    assert.deepStrictEqual(rulesMoments([ran]).map(({ at, change }) => ({ at, change })), [
      { at: DateTime.makeUnsafe("2026-11-05T10:00:00Z"), change: "ranOut" },
      { at: DateTime.makeUnsafe("2026-11-01T10:01:00Z"), change: "locked" }
    ])
  })

  it("one that never landed: nothing, and the next is still the first", () => {
    const sessions = [agentSession(1, { status: "failed", installedAt: null }), agentSession(2, { spec: CAUTIOUS })]

    assert.deepStrictEqual(rulesMoments(sessions).map(({ change }) => change), ["locked"])
  })

  it("its stocks and who asked", () => {
    const [locked] = rulesMoments([agentSession(1)])

    assert.deepStrictEqual([locked!.stocks, locked!.by], [["NVDA", "AAPL"], "owner"])
  })
})

describe("journalLines", () => {
  const entries = [journalEntry(2, "2026-11-04T12:00:00Z"), journalEntry(1, "2026-11-03T12:00:00Z")]
  const rules = [firstLock("new", "2026-11-03T18:00:00Z"), firstLock("old", "2026-11-01T10:00:00Z")]

  it("more pages to come: only the rules moments as new as the oldest entry", () => {
    assert.deepStrictEqual(
      journalLines(entries, rules, { complete: false, nameOf }).map((line) => line.id),
      ["journal_01jd8v4t5m6n7a8q9r0s1t2v32", "new", "journal_01jd8v4t5m6n7a8q9r0s1t2v31"]
    )
  })

  it("every page loaded: every rules moment", () => {
    assert.deepStrictEqual(
      journalLines(entries, rules, { complete: true, nameOf }).map((line) => line.id),
      ["journal_01jd8v4t5m6n7a8q9r0s1t2v32", "new", "journal_01jd8v4t5m6n7a8q9r0s1t2v31", "old"]
    )
  })

  it("no entries at all: its rules moments alone", () => {
    assert.deepStrictEqual(journalLines([], rules, { complete: true, nameOf }).map((line) => line.id), ["new", "old"])
  })

  it("an entry read into its parts", () => {
    const [line] = journalLines([entries[0]!], [], { complete: true, nameOf })

    assert.deepStrictEqual(line!._tag === "Entry" ? line.story : undefined, {
      _tag: "Trade",
      trade: "Buy $50.00 of NVIDIA",
      side: "buy",
      symbol: "NVDA",
      moment: "filled",
      policy: null,
      decision: null,
      why: null
    })
  })
})

describe("journalLines, a run's judgments", () => {
  const runId = AutomationRunId.make("run_01jd8v4t5m6n7a8q9r0s1t2v3w")
  const run = journalEntry(3, "2026-11-04T10:00:00Z", {
    kind: "automation",
    entry: "Automation \"News watch\" proposed trades: Apple fell after the news.",
    refs: { runId }
  })
  const judgment = journalEntry(4, "2026-11-04T10:00:05Z", {
    kind: "judgment",
    entry: "Automation \"News watch\" judged \"Apple misses\": yes, 82% sure. It hurts sales.",
    refs: { runId }
  })

  it("its run loaded too: told inside the run, not as a line of its own", () => {
    const lines = journalLines([judgment, run], [], { complete: true, nameOf })

    assert.deepStrictEqual(
      lines.map((line) => ({
        id: line.id,
        judgments: line._tag === "Entry" ? line.judgments.map(({ entry }): string => entry.id) : []
      })),
      [{ id: "journal_01jd8v4t5m6n7a8q9r0s1t2v33", judgments: ["journal_01jd8v4t5m6n7a8q9r0s1t2v34"] }]
    )
  })

  it("its run on a page not loaded yet: a line of its own", () => {
    const lines = journalLines([judgment], [], { complete: false, nameOf })

    assert.deepStrictEqual(lines.map((line) => line.id), ["journal_01jd8v4t5m6n7a8q9r0s1t2v34"])
  })
})

describe("filterOf", () => {
  it.each<{ name: string; line: Parameters<typeof filterOf>[0]; expected: string }>([
    {
      name: "a trade",
      line: journalLines([journalEntry(1, "2026-11-01T10:00:00Z")], [], { complete: true, nameOf })[0]!,
      expected: "trades"
    },
    {
      name: "a run",
      line: journalLines([journalEntry(1, "2026-11-01T10:00:00Z", { kind: "automation" })], [], {
        complete: true,
        nameOf
      })[0]!,
      expected: "automations"
    },
    {
      name: "a judgment",
      line: journalLines([journalEntry(1, "2026-11-01T10:00:00Z", { kind: "judgment" })], [], {
        complete: true,
        nameOf
      })[0]!,
      expected: "automations"
    },
    { name: "a rules moment", line: firstLock("m", "2026-11-01T10:00:00Z"), expected: "rules" }
  ])("$name", ({ expected, line }) => {
    assert.strictEqual(filterOf(line), expected)
  })
})
