import { assert, describe, it } from "@effect/vitest"

import { appHost } from "../../../posthog/Api.ts"
import { matches } from "../../../posthog/Matches.ts"

describe("matches", () => {
  it.each([
    { name: "the same value", desired: { a: 1 }, current: { a: 1 }, expected: true },
    { name: "fields the API added: ignored", desired: { a: 1 }, current: { a: 1, id: 7 }, expected: true },
    { name: "a field that differs", desired: { a: 1 }, current: { a: 2 }, expected: false },
    { name: "a field missing", desired: { a: 1 }, current: {}, expected: false },
    { name: "null against an absent field", desired: { a: null }, current: {}, expected: true },
    {
      name: "nested objects: by desired's keys",
      desired: { a: { b: 1 } },
      current: { a: { b: 1, c: 2 } },
      expected: true
    },
    { name: "plain values in another order", desired: ["x", "y"], current: ["y", "x"], expected: true },
    { name: "one value more", desired: ["x"], current: ["x", "y"], expected: false },
    { name: "objects in order", desired: [{ a: 1 }, { a: 2 }], current: [{ a: 1 }, { a: 2 }], expected: true },
    { name: "objects in another order", desired: [{ a: 1 }, { a: 2 }], current: [{ a: 2 }, { a: 1 }], expected: false },
    { name: "an object against an array", desired: { a: 1 }, current: [1], expected: false }
  ])("$name", ({ current, desired, expected }) => {
    assert.strictEqual(matches(desired, current), expected)
  })
})

describe("appHost", () => {
  it.each([
    { name: "US ingestion: the US app", host: "https://us.i.posthog.com", expected: "https://us.posthog.com" },
    { name: "EU ingestion: the EU app", host: "https://eu.i.posthog.com/", expected: "https://eu.posthog.com" },
    { name: "another host: as it is", host: "https://posthog.example.com", expected: "https://posthog.example.com" }
  ])("$name", ({ expected, host }) => {
    assert.strictEqual(appHost(host), expected)
  })
})
