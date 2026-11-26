import { assert, describe, it } from "@effect/vitest"
import { changedPhrases, type Phrase, phrasesOf } from "../../../../../src/features/automations/model/phrases.ts"

describe("phrasesOf", () => {
  it.each<{
    name: string
    description: { trigger: string; conditions: ReadonlyArray<string>; action: string }
    expected: ReadonlyArray<Phrase>
  }>([
    {
      name: "a trigger and an action, the trigger capitalized",
      description: { trigger: "every Monday at 10:00 New York time", conditions: [], action: "buy $50 of Apple" },
      expected: [
        { part: "trigger", index: null, text: "Every Monday at 10:00 New York time" },
        { part: "action", index: null, text: "buy $50 of Apple" }
      ]
    },
    {
      name: "each check between them, by its place",
      description: {
        trigger: "when Apple falls 10% from its high",
        conditions: ["while the market is open", "while you hold Apple"],
        action: "tell you"
      },
      expected: [
        { part: "trigger", index: null, text: "When Apple falls 10% from its high" },
        { part: "conditions", index: 0, text: "while the market is open" },
        { part: "conditions", index: 1, text: "while you hold Apple" },
        { part: "action", index: null, text: "tell you" }
      ]
    }
  ])("$name", ({ description, expected }) => {
    assert.deepStrictEqual(phrasesOf(description), expected)
  })
})

describe("changedPhrases", () => {
  const weekly: ReadonlyArray<Phrase> = [
    { part: "trigger", index: null, text: "Every Monday at 10:00 New York time" },
    { part: "action", index: null, text: "buy $50 of Apple" }
  ]
  const checked: ReadonlyArray<Phrase> = [
    weekly[0]!,
    { part: "conditions", index: 0, text: "while the market is open" },
    { part: "conditions", index: 1, text: "while you hold Apple" },
    weekly[1]!
  ]

  it("nothing, when it reads the same", () => {
    assert.deepStrictEqual(changedPhrases(weekly, weekly), [])
  })

  it("a new amount marks the action", () => {
    const next: ReadonlyArray<Phrase> = [weekly[0]!, { part: "action", index: null, text: "buy $80 of Apple" }]

    assert.deepStrictEqual(changedPhrases(weekly, next), [{ part: "action", index: null, text: "buy $80 of Apple" }])
  })

  it("an added check marks only the check", () => {
    const next: ReadonlyArray<Phrase> = [
      weekly[0]!,
      { part: "conditions", index: 0, text: "while the market is open" },
      weekly[1]!
    ]

    assert.deepStrictEqual(changedPhrases(weekly, next), [
      { part: "conditions", index: 0, text: "while the market is open" }
    ])
  })

  it("a removed check marks nothing, though the next one moves up", () => {
    const next: ReadonlyArray<Phrase> = [
      weekly[0]!,
      { part: "conditions", index: 0, text: "while you hold Apple" },
      weekly[1]!
    ]

    assert.deepStrictEqual(changedPhrases(checked, next), [])
  })

  it("a phrase that only moves to the front, capitalized, isn't new", () => {
    const previous: ReadonlyArray<Phrase> = [{ part: "trigger", index: null, text: "when Apple opens" }]
    const next: ReadonlyArray<Phrase> = [{ part: "trigger", index: null, text: "When Apple opens" }]

    assert.deepStrictEqual(changedPhrases(previous, next), [])
  })
})
