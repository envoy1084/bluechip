import { assert, describe, it } from "@effect/vitest"
import { emptyActivity, type History } from "../../../../../src/features/activity/model/emptyActivity.ts"

describe("emptyActivity", () => {
  it.each<{ name: string; history: History; filtered: boolean; expected: ReturnType<typeof emptyActivity> }>([
    {
      name: "no activity at all, filtered: where it will show",
      history: "none",
      filtered: true,
      expected: { title: "No activity yet", description: "Your trades, deposits and withdrawals show up here." }
    },
    {
      name: "no activity at all, unfiltered: where it will show",
      history: "none",
      filtered: false,
      expected: { title: "No activity yet", description: "Your trades, deposits and withdrawals show up here." }
    },
    {
      name: "activity elsewhere, filtered: try another filter",
      history: "some",
      filtered: true,
      expected: { title: "Nothing here yet", description: "Try another type or a longer period." }
    },
    {
      name: "history still loading, filtered: where it will show",
      history: "unknown",
      filtered: true,
      expected: { title: "Nothing here yet", description: "Your trades, deposits and withdrawals show up here." }
    },
    {
      name: "history still loading, unfiltered: where it will show",
      history: "unknown",
      filtered: false,
      expected: { title: "Nothing here yet", description: "Your trades, deposits and withdrawals show up here." }
    }
  ])("$name", ({ expected, filtered, history }) => {
    assert.deepStrictEqual(emptyActivity(history, filtered), expected)
  })
})
