import { AutomationProblem } from "@bluechip/domain/automations/Automation"
import { Conflict, InvalidAutomation, NotFound } from "@bluechip/domain/Errors"
import { assert, describe, it } from "@effect/vitest"
import {
  asOneLine,
  choiceLabel,
  judgmentText,
  problemText,
  saveProblem
} from "../../../../../src/features/automations/model/automationText.ts"

describe("judgmentText", () => {
  it.each([
    { name: "a yes, rounded", answer: { verdict: true, confidence: 0.824, reason: "" }, expected: "Yes, 82% sure" },
    { name: "a no", answer: { verdict: false, confidence: 0.6, reason: "" }, expected: "No, 60% sure" }
  ])("$name", ({ answer, expected }) => {
    assert.strictEqual(judgmentText(answer), expected)
  })
})

describe("choiceLabel", () => {
  it.each([
    {
      name: "a fall is from its high",
      type: "priceMove",
      field: "reference",
      value: "trailingHigh",
      config: { direction: "down" },
      expected: "Its high"
    },
    {
      name: "a rise is from its low",
      type: "priceMove",
      field: "reference",
      value: "trailingHigh",
      config: { direction: "up" },
      expected: "Its low"
    },
    {
      name: "a previous close",
      type: "priceMove",
      field: "reference",
      value: "previousClose",
      config: {},
      expected: "Its last close"
    },
    { name: "a fall", type: "priceMove", field: "direction", value: "down", config: {}, expected: "Falls" },
    {
      name: "a cross above",
      type: "priceCross",
      field: "direction",
      value: "above",
      config: {},
      expected: "Goes above"
    },
    {
      name: "cash falling under",
      type: "portfolio",
      field: "direction",
      value: "below",
      config: {},
      expected: "Falls under"
    },
    { name: "a holding", type: "portfolio", field: "measure", value: "holding", config: {}, expected: "A holding" },
    {
      name: "a question",
      type: "judgment",
      field: "preset",
      value: "materiallyNegative",
      config: {},
      expected: "Bad news"
    },
    { name: "anything else as it is", type: "news", field: "topics", value: "chips", config: {}, expected: "chips" }
  ])("$name", ({ type, field, value, config, expected }) => {
    assert.strictEqual(choiceLabel(type, field, value, config), expected)
  })
})

describe("problemText", () => {
  it.each(
    [
      {
        name: "a condition says which",
        problem: { part: "conditions", index: 1, message: "Pick a price above $0." },
        expected: "Only if (condition 2): Pick a price above $0."
      },
      {
        name: "the action",
        problem: { part: "action", index: null, message: "This agent only buys." },
        expected: "Then: This agent only buys."
      },
      {
        name: "the trigger",
        problem: { part: "trigger", index: null, message: "Too small." },
        expected: "When: Too small."
      }
    ] as const
  )("$name", ({ problem, expected }) => {
    assert.strictEqual(problemText(problem), expected)
  })
})

describe("saveProblem", () => {
  it.each([
    {
      name: "422: each problem, in words",
      error: new InvalidAutomation({
        problems: [
          new AutomationProblem({ part: "action", index: null, field: "amount", message: "Too large." }),
          new AutomationProblem({ part: "name", index: null, field: null, message: "Give it a name." })
        ]
      }),
      expected: "Then: Too large. Name: Give it a name."
    },
    {
      name: "409: an automation that ended",
      error: new Conflict({ reason: "automationEnded" }),
      expected: "This automation has ended, so it can't change. Set up a new one instead."
    },
    {
      name: "409: a request saved already",
      error: new Conflict({ reason: "requestIdReused" }),
      expected: "This was already saved. Refresh the page to see it."
    },
    {
      name: "404: it or its agent is gone",
      error: new NotFound({ resource: "agent", id: "agent_1" }),
      expected: "This automation or its agent is gone, so nothing was saved."
    },
    {
      name: "anything else: the connection",
      error: new Error("offline"),
      expected: "We couldn't reach bluechip just now. Nothing changed, so try again."
    }
  ])("$name", ({ error, expected }) => {
    assert.strictEqual(saveProblem(error), expected)
  })
})

describe("asOneLine", () => {
  it.each([
    {
      name: "the first phrase leads, the rest follow it",
      phrases: ["At most once an hour", "Only while the market is open"],
      expected: "At most once an hour, only while the market is open"
    },
    { name: "one phrase", phrases: ["Only once"], expected: "Only once" },
    { name: "none", phrases: [], expected: "" }
  ])("$name", ({ phrases, expected }) => {
    assert.strictEqual(asOneLine(phrases), expected)
  })
})
