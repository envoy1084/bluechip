import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import type { TradeMoment } from "../../../../../src/features/agents/model/journalStory.ts"
import {
  judgmentAnswer,
  momentNote,
  rulesDetail,
  runIllustration,
  runsWhen
} from "../../../../../src/features/agents/model/journalText.ts"
import type { RulesMoment } from "../../../../../src/features/agents/model/journalTimeline.ts"

describe("momentNote", () => {
  it.each<{ moment: TradeMoment; side: "buy" | "sell"; expected: string | null }>([
    { moment: "filled", side: "buy", expected: null },
    { moment: "needsApproval", side: "buy", expected: null },
    { moment: "waiting", side: "buy", expected: null },
    { moment: "sent", side: "buy", expected: "Within its policies, so it sends it itself." },
    { moment: "approved", side: "buy", expected: "You approved it, and it waited for your Face ID." },
    { moment: "blocked", side: "buy", expected: "Nothing was bought. Your cash is where it was." },
    { moment: "failed", side: "sell", expected: "Nothing was sold. Your stocks are where they were." },
    { moment: "declined", side: "buy", expected: "Nothing was bought. Your cash is where it was." },
    { moment: "expired", side: "sell", expected: "Nothing was sold. Your stocks are where they were." },
    { moment: "cancelled", side: "buy", expected: "Nothing was bought. Your cash is where it was." }
  ])("$moment, a $side", ({ expected, moment, side }) => {
    assert.strictEqual(momentNote(moment, side), expected)
  })
})

describe("runIllustration", () => {
  it.each([
    { trigger: "schedule", expected: "calendar" },
    { trigger: "priceMove", expected: "price-move" },
    { trigger: "priceCross", expected: "price-level" },
    { trigger: "drift", expected: "target" },
    { trigger: "portfolio", expected: "pie" },
    { trigger: "news", expected: "newspaper" },
    { trigger: "somethingNew", expected: "bolt" },
    { trigger: undefined, expected: "bolt" }
  ])("$trigger", ({ trigger, expected }) => {
    assert.strictEqual(runIllustration(trigger), expected)
  })
})

describe("runsWhen", () => {
  it("what sets it off, as a sentence", () => {
    assert.strictEqual(runsWhen("every Monday at 10:00 New York time"), "Runs every Monday at 10:00 New York time")
  })
})

describe("judgmentAnswer", () => {
  it.each<{ verdict: boolean; confidence: number; expected: string }>([
    { verdict: true, confidence: 0.82, expected: "Yes, 82% sure" },
    { verdict: false, confidence: 0.555, expected: "No, 56% sure" }
  ])("$expected", ({ confidence, expected, verdict }) => {
    assert.strictEqual(judgmentAnswer(verdict, confidence), expected)
  })
})

describe("rulesDetail", () => {
  const until = DateTime.makeUnsafe("2027-02-21T10:00:00Z")
  it.each<{ name: string; moment: Pick<RulesMoment, "change" | "moved" | "until">; expected: string }>([
    {
      name: "the first lock, in force",
      moment: { change: "locked", moved: [], until },
      expected: "Its first rules, until 21 Feb."
    },
    {
      name: "the first lock, since replaced",
      moment: { change: "locked", moved: [], until: null },
      expected: "Its first rules."
    },
    {
      name: "a change",
      moment: { change: "changed", moved: ["Trade size tightened", "Cash reserve added"], until: null },
      expected: "Trade size tightened, Cash reserve added."
    },
    {
      name: "a renewal, in force",
      moment: { change: "renewed", moved: [], until },
      expected: "The same rules with a new key, until 21 Feb."
    },
    {
      name: "ran out",
      moment: { change: "ranOut", moved: [], until: null },
      expected: "It can't trade until you renew them."
    }
  ])("$name", ({ expected, moment }) => {
    assert.strictEqual(rulesDetail(moment), expected)
  })
})
