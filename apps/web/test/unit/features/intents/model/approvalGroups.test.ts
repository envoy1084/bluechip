import { IntentId } from "@bluechip/domain/Ids"
import { Intent } from "@bluechip/domain/intents/Intent"
import { assert, describe, it } from "@effect/vitest"
import { approvalGroups } from "../../../../../src/features/intents/model/approvalGroups.ts"
import { nvidiaBuy } from "../../../../fixtures/Intents.ts"

const asked = (id: string, symbol: "NVDA" | "AAPL", batch: string | null) =>
  new Intent({
    ...nvidiaBuy("2026-11-26T10:00:00Z"),
    id: IntentId.make(`intent_01jd8v4t5m6n7a8q9r0s1t2v${id}`),
    leg: { ...nvidiaBuy("2026-11-26T10:00:00Z").leg, symbol },
    batch: batch === null ? null : { id: batch, wave: 0 }
  })

describe("approvalGroups", () => {
  it.each<{ name: string; approvals: ReadonlyArray<Intent>; expected: ReadonlyArray<[string, ReadonlyArray<string>]> }>(
    [
      { name: "none", approvals: [], expected: [] },
      {
        name: "two trades on their own: a card each",
        approvals: [asked("0a", "NVDA", null), asked("0b", "AAPL", null)],
        expected: [["0a", []], ["0b", []]]
      },
      {
        name: "two stocks of one plan: one card",
        approvals: [asked("0a", "NVDA", "run1"), asked("0b", "AAPL", "run1")],
        expected: [["0a", ["0b"]]]
      },
      {
        name: "two plans: a card each",
        approvals: [asked("0a", "NVDA", "run1"), asked("0b", "AAPL", "run2")],
        expected: [["0a", []], ["0b", []]]
      },
      {
        name: "one stock twice in a plan: the second leads its own card",
        approvals: [asked("0a", "NVDA", "run1"), asked("0b", "NVDA", "run1"), asked("0c", "AAPL", "run1")],
        expected: [["0a", ["0c"]], ["0b", []]]
      }
    ]
  )("$name", ({ approvals, expected }) => {
    assert.deepStrictEqual(
      approvalGroups(approvals).map(({ intent, together }): [string, ReadonlyArray<string>] => [
        intent.id.slice(-2),
        together.map((other) => other.id.slice(-2))
      ]),
      expected
    )
  })
})
