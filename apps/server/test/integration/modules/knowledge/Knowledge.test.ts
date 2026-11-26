import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { Knowledge } from "../../../../src/modules/knowledge/Knowledge.ts"
import { TestUsers } from "../../../utils/TestUsers.ts"

// The server's services run on the real clock (see `TestServer`).
layer(TestUsers.layer, { excludeTestServices: true })("Knowledge", (it) => {
  describe("search", () => {
    it.effect.each([
      {
        name: "who pays gas",
        query: "Who pays the gas for my trades?",
        first: ["Gas", "Who pays gas", "/help/gas#who-pays-gas"]
      },
      {
        name: "a lost passkey",
        query: "What if I lose every passkey?",
        first: ["Recovery", "If you lose every passkey", "/help/recovery#if-you-lose-every-passkey"]
      },
      {
        name: "approvals expire",
        query: "Do approvals expire?",
        first: ["Approvals", "Approvals expire", "/help/approvals#approvals-expire"]
      },
      {
        name: "a stock's pool",
        query: "Which pool does NVIDIA trade in?",
        first: ["NVIDIA (NVDA)", null, "https://basescan.org/token/0xb20000000000000000000078ee7ce2fE4908108C"]
      },
      {
        name: "how long a lock lasts",
        query: "How long does locking an agent last?",
        first: ["Agents", "Locking it with Face ID", "/help/agents#locking-it-with-face-id"]
      }
    ])("$name", ({ first, query }) =>
      Effect.gen(function*() {
        const knowledge = yield* Knowledge
        yield* knowledge.refresh

        const [passage] = yield* knowledge.search(query)

        assert.deepStrictEqual(
          [passage?.citation.title, passage?.citation.section, passage?.citation.url],
          first
        )
      }))

    it.effect("only help articles, when asked", () =>
      Effect.gen(function*() {
        const knowledge = yield* Knowledge
        yield* knowledge.refresh

        const passages = yield* knowledge.search("NVIDIA pool", { kinds: ["help"] })

        assert.deepStrictEqual(passages.filter((passage) => passage.citation.kind !== "help"), [])
      }))

    it.effect("words that match nothing find nothing", () =>
      Effect.gen(function*() {
        const knowledge = yield* Knowledge
        yield* knowledge.refresh

        const passages = yield* knowledge.search("zxqv")

        assert.deepStrictEqual(passages, [])
      }))
  })

  describe("refresh", () => {
    it.effect("sources that didn't change write nothing", () =>
      Effect.gen(function*() {
        const knowledge = yield* Knowledge
        yield* knowledge.refresh

        const changed = yield* knowledge.refresh

        assert.strictEqual(changed, 0)
      }))
  })

  describe("stockFacts", () => {
    it.effect("a stock's token, feed and pool, in words", () =>
      Effect.gen(function*() {
        const facts = (yield* Knowledge).stockFacts("NVDA")

        assert.strictEqual(
          facts?.facts,
          "NVIDIA (NVDA) is one of Coinbase's tokenized stocks on Base; its token is " +
            "0xb20000000000000000000078ee7ce2fE4908108C. bluechip prices it with Chainlink's NAV feed at " +
            "0x04689a41629776563E6822F76f2e57D148d28513, and checks every trade's price against it. It trades in its " +
            "USDC pool on Aerodrome's Slipstream at 0xF668e21993f0ACd7ab00BB1cFbAeD0df28A3C8EC (tick spacing 10)."
        )
      }))
  })
})
