import { assert, describe, it } from "@effect/vitest"
import {
  applyEvent,
  type BluechipTurn,
  emptyTurn,
  entriesOf,
  type Entry,
  replaceCard,
  resumeEntries,
  shownCards
} from "../../../../../src/features/assistant/model/thread.ts"
import { budgetCard, CARD_ID, message } from "../../../../fixtures/Messages.ts"

const turn = (fields: Partial<BluechipTurn>): BluechipTurn => ({ ...emptyTurn("turn"), ...fields })

describe("entriesOf", () => {
  it("nothing stored: no entries", () => {
    assert.deepStrictEqual(entriesOf([]), [])
  })

  it("your message: its text parts joined by lines", () => {
    const stored = message("w1", "user", [{ type: "text", text: "Buy" }, { type: "text", text: "Nvidia" }])
    assert.deepStrictEqual(entriesOf([stored]), [{ _tag: "You", id: stored.id, text: "Buy\nNvidia" }])
  })

  it("rounds after one message merge into one turn, their texts as paragraphs", () => {
    const you = message("w1", "user", [{ type: "text", text: "What's in my portfolio?" }])
    const round = message("w2", "assistant", [
      { type: "toolCall", id: "call-1", name: "getPortfolio", params: {}, providerExecuted: false },
      {
        type: "toolResult",
        id: "call-1",
        name: "getPortfolio",
        result: {},
        isFailure: false,
        providerExecuted: false,
        modelOutput: null
      }
    ])
    const answer = message("w3", "assistant", [{ type: "text", text: "Mostly cash." }])
    const extra = message("w4", "assistant", [{ type: "text", text: "And some Nvidia." }])

    assert.deepStrictEqual(entriesOf([you, round, answer, extra]), [
      { _tag: "You", id: you.id, text: "What's in my portfolio?" },
      {
        _tag: "Bluechip",
        id: round.id,
        tools: [{ id: "call-1", name: "getPortfolio", state: "done", summary: null }],
        text: "Mostly cash.\n\nAnd some Nvidia.",
        cards: [],
        status: "done",
        error: null
      }
    ])
  })

  it("a tool's result decoded into its row's summary", () => {
    const round = message("w2", "assistant", [
      { type: "toolCall", id: "call-1", name: "getPrices", params: {}, providerExecuted: false },
      {
        type: "toolResult",
        id: "call-1",
        name: "getPrices",
        result: [],
        isFailure: false,
        providerExecuted: false,
        modelOutput: null
      }
    ])
    assert.deepStrictEqual(entriesOf([round]), [{
      _tag: "Bluechip",
      id: round.id,
      tools: [{ id: "call-1", name: "getPrices", state: "done", summary: "No stocks" }],
      text: "",
      cards: [],
      status: "done",
      error: null
    }])
  })

  it("a failed tool result", () => {
    const round = message("w2", "assistant", [
      { type: "toolCall", id: "call-1", name: "getQuote", params: {}, providerExecuted: false },
      {
        type: "toolResult",
        id: "call-1",
        name: "getQuote",
        result: {},
        isFailure: true,
        providerExecuted: false,
        modelOutput: null
      }
    ])
    assert.deepStrictEqual(entriesOf([round]), [{
      _tag: "Bluechip",
      id: round.id,
      tools: [{ id: "call-1", name: "getQuote", state: "failed", summary: null }],
      text: "",
      cards: [],
      status: "done",
      error: null
    }])
  })

  it("a call never answered (a cancelled round) didn't finish", () => {
    const round = message("w2", "assistant", [
      { type: "toolCall", id: "call-1", name: "getPrices", params: {}, providerExecuted: false }
    ])
    assert.deepStrictEqual(entriesOf([round]), [{
      _tag: "Bluechip",
      id: round.id,
      tools: [{ id: "call-1", name: "getPrices", state: "failed", summary: null }],
      text: "",
      cards: [],
      status: "done",
      error: null
    }])
  })

  it("a result without its call is left out", () => {
    const round = message("w2", "assistant", [
      {
        type: "toolResult",
        id: "call-9",
        name: "getPrices",
        result: [],
        isFailure: false,
        providerExecuted: false,
        modelOutput: null
      }
    ])
    assert.deepStrictEqual(entriesOf([round]), [{
      _tag: "Bluechip",
      id: round.id,
      tools: [],
      text: "",
      cards: [],
      status: "done",
      error: null
    }])
  })

  it("a card stored twice shows once, as stored last", () => {
    const first = budgetCard("Out for today.")
    const later = budgetCard("Out until midnight.")
    const round = message("w2", "assistant", [
      { type: "card", toolCallId: null, card: first },
      { type: "card", toolCallId: null, card: later }
    ])
    assert.deepStrictEqual(entriesOf([round])[0], {
      _tag: "Bluechip",
      id: round.id,
      tools: [],
      text: "",
      cards: [{ toolCallId: null, card: later }],
      status: "done",
      error: null
    })
  })

  it("an error part ends the turn in an error", () => {
    const round = message("w2", "assistant", [
      { type: "text", text: "Let me check" },
      { type: "error", message: "The model can't answer right now." }
    ])
    assert.deepStrictEqual(entriesOf([round]), [{
      _tag: "Bluechip",
      id: round.id,
      tools: [],
      text: "Let me check",
      cards: [],
      status: "error",
      error: "The model can't answer right now."
    }])
  })

  it("a round cut off by a dropped connection: its text so far, then the interrupted card", () => {
    const interrupted = {
      _tag: "Error",
      id: CARD_ID,
      reason: "interrupted",
      message: "The connection dropped, so the answer stopped here."
    } as const
    const round = message("w2", "assistant", [
      { type: "text", text: "Nvidia is up 2% to" },
      { type: "card", toolCallId: null, card: interrupted }
    ])
    assert.deepStrictEqual(entriesOf([round]), [{
      _tag: "Bluechip",
      id: round.id,
      tools: [],
      text: "Nvidia is up 2% to",
      cards: [{ toolCallId: null, card: interrupted }],
      status: "done",
      error: null
    }])
  })

  it("a new message of yours starts a new turn", () => {
    const first = message("w2", "assistant", [{ type: "text", text: "Hello!" }])
    const you = message("w3", "user", [{ type: "text", text: "Hi" }])
    const second = message("w4", "assistant", [{ type: "text", text: "Hello again!" }])
    assert.deepStrictEqual(entriesOf([first, you, second]).map((entry) => [entry._tag, entry.id]), [
      ["Bluechip", first.id],
      ["You", you.id],
      ["Bluechip", second.id]
    ])
  })
})

describe("applyEvent", () => {
  it("the first text message starts the text", () => {
    assert.deepStrictEqual(
      applyEvent(turn({}), { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant" }),
      turn({})
    )
  })

  it("a later text message starts a new paragraph", () => {
    assert.deepStrictEqual(
      applyEvent(turn({ text: "First." }), { type: "TEXT_MESSAGE_START", messageId: "m2", role: "assistant" }),
      turn({ text: "First.\n\n" })
    )
  })

  it("text content appends", () => {
    assert.deepStrictEqual(
      applyEvent(turn({ text: "Nvidia is " }), { type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "$152." }),
      turn({ text: "Nvidia is $152." })
    )
  })

  it("a tool call starts a running row", () => {
    assert.deepStrictEqual(
      applyEvent(turn({}), { type: "TOOL_CALL_START", toolCallId: "call-1", toolCallName: "getPrices" }),
      turn({ tools: [{ id: "call-1", name: "getPrices", state: "running", summary: null }] })
    )
  })

  it("a tool result marks its row done, the others still running", () => {
    const running = turn({
      tools: [
        { id: "call-1", name: "getQuote", state: "running", summary: null },
        { id: "call-2", name: "getStock", state: "running", summary: null }
      ]
    })
    assert.deepStrictEqual(
      applyEvent(running, { type: "TOOL_CALL_RESULT", messageId: "r1", toolCallId: "call-1", content: "{}" }),
      turn({
        tools: [
          { id: "call-1", name: "getQuote", state: "done", summary: null },
          { id: "call-2", name: "getStock", state: "running", summary: null }
        ]
      })
    )
  })

  it("a tool result's JSON decoded into its row's summary", () => {
    const running = turn({ tools: [{ id: "call-1", name: "listAgents", state: "running", summary: null }] })
    assert.deepStrictEqual(
      applyEvent(running, { type: "TOOL_CALL_RESULT", messageId: "r1", toolCallId: "call-1", content: "[]" }),
      turn({ tools: [{ id: "call-1", name: "listAgents", state: "done", summary: "No agents yet" }] })
    )
  })

  it("a tool result that isn't JSON: done, without a summary", () => {
    const running = turn({ tools: [{ id: "call-1", name: "listAgents", state: "running", summary: null }] })
    assert.deepStrictEqual(
      applyEvent(running, { type: "TOOL_CALL_RESULT", messageId: "r1", toolCallId: "call-1", content: "not json" }),
      turn({ tools: [{ id: "call-1", name: "listAgents", state: "done", summary: null }] })
    )
  })

  it("a failed tool result marks its row failed", () => {
    const running = turn({ tools: [{ id: "call-1", name: "getQuote", state: "running", summary: null }] })
    assert.deepStrictEqual(
      applyEvent(running, {
        type: "TOOL_CALL_RESULT",
        messageId: "r1",
        toolCallId: "call-1",
        content: "{}",
        metadata: { "effect/ai": { isFailure: true } }
      }),
      turn({ tools: [{ id: "call-1", name: "getQuote", state: "failed", summary: null }] })
    )
  })

  it("a card event adds its card, decoded from JSON", () => {
    assert.deepStrictEqual(
      applyEvent(turn({}), {
        type: "CUSTOM",
        name: "bluechip.card",
        value: {
          toolCallId: null,
          card: { _tag: "Error", id: CARD_ID, reason: "budget", message: "Out for today." }
        }
      }),
      turn({ cards: [{ toolCallId: null, card: budgetCard("Out for today.") }] })
    )
  })

  it("a card event for a card shown already replaces it in place", () => {
    assert.deepStrictEqual(
      applyEvent(turn({ cards: [{ toolCallId: null, card: budgetCard("Out for today.") }] }), {
        type: "CUSTOM",
        name: "bluechip.card",
        value: {
          toolCallId: "call-1",
          card: { _tag: "Error", id: CARD_ID, reason: "budget", message: "Out until midnight." }
        }
      }),
      turn({ cards: [{ toolCallId: "call-1", card: budgetCard("Out until midnight.") }] })
    )
  })

  it("a card event that doesn't decode is ignored", () => {
    assert.deepStrictEqual(
      applyEvent(turn({}), { type: "CUSTOM", name: "bluechip.card", value: { card: { _tag: "Nope" } } }),
      turn({})
    )
  })

  it("another custom event is ignored", () => {
    assert.deepStrictEqual(applyEvent(turn({}), { type: "CUSTOM", name: "other", value: {} }), turn({}))
  })

  it("the run finishing: done, trailing space trimmed, running rows done", () => {
    const streaming = turn({
      text: "Done.\n\n",
      tools: [{ id: "call-1", name: "getPrices", state: "running", summary: null }]
    })
    assert.deepStrictEqual(
      applyEvent(streaming, { type: "RUN_FINISHED", threadId: "t1", runId: "r1" }),
      turn({
        text: "Done.",
        status: "done",
        tools: [{ id: "call-1", name: "getPrices", state: "done", summary: null }]
      })
    )
  })

  it("the run failing: an error, running rows failed", () => {
    const streaming = turn({
      text: "Checking ",
      tools: [{ id: "call-1", name: "getPrices", state: "running", summary: null }]
    })
    assert.deepStrictEqual(
      applyEvent(streaming, { type: "RUN_ERROR", message: "The model can't answer right now." }),
      turn({
        text: "Checking",
        status: "error",
        error: "The model can't answer right now.",
        tools: [{ id: "call-1", name: "getPrices", state: "failed", summary: null }]
      })
    )
  })

  it("any other event leaves the turn as it was", () => {
    assert.deepStrictEqual(
      applyEvent(turn({ text: "Hi" }), { type: "STEP_STARTED", stepName: "round-1" }),
      turn({
        text: "Hi"
      })
    )
  })
})

describe("shownCards", () => {
  const unavailable = "The assistant can't answer right now. Nothing was changed. Try again in a moment."
  const errorCard = (reason: "budget" | "unavailable", text: string) => ({
    toolCallId: null,
    card: { ...budgetCard(text), reason }
  })

  it.each<{ name: string; error: string | null; reason: "budget" | "unavailable"; text: string; shown: number }>([
    {
      name: "an unavailable card the turn's error repeats is hidden",
      error: unavailable,
      reason: "unavailable",
      text: unavailable,
      shown: 0
    },
    {
      name: "an error card saying something else stays",
      error: unavailable,
      reason: "budget",
      text: "Today's budget is spent.",
      shown: 1
    },
    {
      name: "an error card in a turn that ended fine stays",
      error: null,
      reason: "budget",
      text: "Today's budget is spent.",
      shown: 1
    }
  ])("$name", ({ error, reason, shown, text }) => {
    assert.strictEqual(shownCards(turn({ error, cards: [errorCard(reason, text)] })).length, shown)
  })
})

describe("replaceCard", () => {
  it("the card where it's shown, every other entry as it was", () => {
    const you = { _tag: "You", id: "you", text: "Hi" } as const
    const other = turn({ id: "other" })
    const withCard = turn({ id: "with", cards: [{ toolCallId: "call-1", card: budgetCard("Out for today.") }] })

    assert.deepStrictEqual(replaceCard([you, other, withCard], budgetCard("Out until midnight.")), [
      you,
      other,
      turn({ id: "with", cards: [{ toolCallId: "call-1", card: budgetCard("Out until midnight.") }] })
    ])
  })
})

describe("resumeEntries", () => {
  const you = (id: string): Entry => ({ _tag: "You", id, text: "How's Nvidia?" })
  const dropped = turn({ id: "local", status: "error", error: "The connection dropped." })
  const kept = turn({ id: "stored", text: "Nvidia is up", status: "done" })

  it("the stored thread answers your last message: the stored thread", () => {
    assert.deepStrictEqual(resumeEntries([you("a"), dropped], [you("a"), kept]), [you("a"), kept])
  })

  it("the stored thread has your message but no answer yet: the one on screen", () => {
    assert.deepStrictEqual(resumeEntries([you("a"), dropped], [you("a")]), [you("a"), dropped])
  })

  it("the stored thread is a message behind: the one on screen", () => {
    const earlier = turn({ id: "earlier", text: "Hello", status: "done" })
    assert.deepStrictEqual(resumeEntries([you("a"), earlier, you("b"), dropped], [you("a"), earlier]), [
      you("a"),
      earlier,
      you("b"),
      dropped
    ])
  })

  it("nothing stored: the one on screen", () => {
    assert.deepStrictEqual(resumeEntries([you("a"), dropped], []), [you("a"), dropped])
  })
})
