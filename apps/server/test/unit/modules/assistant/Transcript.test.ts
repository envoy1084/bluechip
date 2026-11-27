import { Message } from "@bluechip/domain/assistant/Conversation"
import { CardId, MessageId } from "@bluechip/domain/Ids"
import { assert, describe, it } from "@effect/vitest"
import * as Response from "effect/ai/Response"
import * as DateTime from "effect/DateTime"
import { promptOf, storedParts } from "../../../../src/modules/assistant/Transcript.ts"

const AT = DateTime.makeUnsafe("2026-11-26T10:00:00Z")

describe("storedParts", () => {
  it("keeps a round's text, tool call and result, in order", () => {
    const parts = storedParts([
      Response.makePart("text-start", { id: "t1" }),
      Response.makePart("text-delta", { id: "t1", delta: "Let me " }),
      Response.makePart("text-delta", { id: "t1", delta: "look." }),
      Response.makePart("text-end", { id: "t1" }),
      Response.makePart("tool-call", { id: "c1", name: "listAgents", params: {}, providerExecuted: false }),
      Response.makePart("tool-result", {
        id: "c1",
        name: "listAgents",
        isFailure: false,
        result: [],
        encodedResult: [],
        providerExecuted: false,
        preliminary: false,
        modelOutput: [{ type: "text", text: "The user has no agents yet." } as never]
      })
    ])

    assert.deepStrictEqual(parts, [
      { type: "text", text: "Let me look." },
      { type: "toolCall", id: "c1", name: "listAgents", params: {}, providerExecuted: false },
      {
        type: "toolResult",
        id: "c1",
        name: "listAgents",
        result: [],
        isFailure: false,
        providerExecuted: false,
        modelOutput: "The user has no agents yet."
      }
    ])
  })

  it("drops a tool call the round never answered (cancelled mid-call)", () => {
    const parts = storedParts([
      Response.makePart("tool-call", { id: "c1", name: "getPortfolio", params: {}, providerExecuted: false })
    ])

    assert.deepStrictEqual(parts, [])
  })

  it("keeps the text a round was cut off in, as far as it got", () => {
    const parts = storedParts([
      Response.makePart("text-start", { id: "t1" }),
      Response.makePart("text-delta", { id: "t1", delta: "Nvidia is up " })
    ])

    assert.deepStrictEqual(parts, [{ type: "text", text: "Nvidia is up " }])
  })

  it("drops thinking a round was cut off in", () => {
    const parts = storedParts([
      Response.makePart("reasoning-start", { id: "r1" }),
      Response.makePart("reasoning-delta", { id: "r1", delta: "The user wants" })
    ])

    assert.deepStrictEqual(parts, [])
  })
})

describe("promptOf", () => {
  it("gives tool results as first given, after the call that asked for them, and leaves the user's cards out", () => {
    const prompt = promptOf([
      new Message({
        id: MessageId.make("message_01jd8v4t5m6n7a8q9r0s1t2v3w"),
        role: "user",
        parts: [{ type: "text", text: "Pause my picker" }],
        model: null,
        createdAt: AT
      }),
      new Message({
        id: MessageId.make("message_01jd8v4t5m6n7a8q9r0s1t2v3x"),
        role: "assistant",
        parts: [
          { type: "toolCall", id: "c1", name: "pauseAll", params: {}, providerExecuted: false },
          {
            type: "toolResult",
            id: "c1",
            name: "pauseAll",
            result: {},
            isFailure: false,
            providerExecuted: false,
            modelOutput:
              "Waiting for the user to confirm pausing every agent: trading stops at once, and nothing is sold."
          },
          {
            type: "card",
            toolCallId: "c1",
            card: {
              _tag: "AgentControl",
              id: CardId.make("card_01jd8v4t5m6n7a8q9r0s1t2v3w"),
              action: "pauseAll",
              agentId: null,
              agentName: null,
              status: "dismissed",
              agents: []
            }
          },
          { type: "error", message: "The assistant couldn't answer just now." }
        ],
        model: "claude-sonnet-5-5",
        createdAt: AT
      })
    ])

    assert.deepStrictEqual(
      prompt.content.map((message) => [
        message.role,
        typeof message.content === "string" ?
          message.content :
          message.content.map((part) =>
            part.type === "tool-result"
              ? part.modelOutput?.map((output) => "text" in output ? output.text : "")
              : part.type
          )
      ]),
      [["user", ["text"]], ["assistant", ["tool-call"]], [
        "tool",
        [["Waiting for the user to confirm pausing every agent: trading stops at once, and nothing is sold."]]
      ]]
    )
  })

  it("sends an earlier turn's thinking back with its signature", () => {
    const prompt = promptOf([
      new Message({
        id: MessageId.make("message_01jd8v4t5m6n7a8q9r0s1t2v3w"),
        role: "assistant",
        parts: [
          { type: "reasoning", text: "", options: { anthropic: { info: { type: "thinking", signature: "sig" } } } },
          { type: "text", text: "Your picker is paused." }
        ],
        model: "claude-sonnet-5-5",
        createdAt: AT
      })
    ])

    assert.deepStrictEqual(
      prompt.content.map((message) => [
        message.role,
        typeof message.content === "string" ?
          message.content :
          message.content.map((part) => part.type === "reasoning" ? [part.type, part.options] : part.type)
      ]),
      [["assistant", [["reasoning", { anthropic: { info: { type: "thinking", signature: "sig" } } }], "text"]]]
    )
  })

  it("leaves out thinking written before the summary the prompt starts with", () => {
    const prompt = promptOf([
      new Message({
        id: MessageId.make("message_01jd8v4t5m6n7a8q9r0s1t2v3w"),
        role: "assistant",
        parts: [
          { type: "reasoning", text: "", options: { anthropic: { info: { type: "thinking", signature: "sig" } } } },
          { type: "text", text: "Your picker is paused." }
        ],
        model: "claude-sonnet-5-5",
        createdAt: AT
      })
    ], { thinkingAfter: AT })

    assert.deepStrictEqual(
      prompt.content.map((message) => [
        message.role,
        typeof message.content === "string" ? message.content : message.content.map((part) => part.type)
      ]),
      [["assistant", ["text"]]]
    )
  })

  it("follows each user message with the context its turn gave, as a system message", () => {
    const prompt = promptOf([
      new Message({
        id: MessageId.make("message_01jd8v4t5m6n7a8q9r0s1t2v3w"),
        role: "user",
        parts: [{ type: "text", text: "Hi" }],
        model: null,
        createdAt: AT
      }),
      new Message({
        id: MessageId.make("message_01jd8v4t5m6n7a8q9r0s1t2v3x"),
        role: "assistant",
        parts: [{ type: "text", text: "Hello!" }],
        model: "claude-sonnet-5-5",
        createdAt: AT
      }),
      new Message({
        id: MessageId.make("message_01jd8v4t5m6n7a8q9r0s1t2v3y"),
        role: "user",
        parts: [{ type: "text", text: "Again" }],
        model: null,
        createdAt: AT
      })
    ], {
      contexts: new Map([
        ["message_01jd8v4t5m6n7a8q9r0s1t2v3w", "## Today\n2026-11-25 (UTC)"],
        ["message_01jd8v4t5m6n7a8q9r0s1t2v3y", "## Today\n2026-11-26 (UTC)"]
      ])
    })

    assert.deepStrictEqual(
      prompt.content.map((message) => [
        message.role,
        typeof message.content === "string" ? message.content : message.content.map((part) => part.type)
      ]),
      [
        ["user", ["text"]],
        ["system", "## Today\n2026-11-25 (UTC)"],
        ["assistant", ["text"]],
        ["user", ["text"]],
        ["system", "## Today\n2026-11-26 (UTC)"]
      ]
    )
  })

  it("keeps a search Anthropic ran inside the assistant's message", () => {
    const prompt = promptOf([
      new Message({
        id: MessageId.make("message_01jd8v4t5m6n7a8q9r0s1t2v3w"),
        role: "assistant",
        parts: [
          {
            type: "toolCall",
            id: "s1",
            name: "AnthropicWebSearch",
            params: { query: "nvidia" },
            providerExecuted: true
          },
          {
            type: "toolResult",
            id: "s1",
            name: "AnthropicWebSearch",
            result: [],
            isFailure: false,
            providerExecuted: true,
            modelOutput: null
          },
          { type: "text", text: "Here's what I found." }
        ],
        model: "claude-sonnet-5-5",
        createdAt: AT
      })
    ])

    assert.deepStrictEqual(
      prompt.content.map((message) => [
        message.role,
        typeof message.content === "string" ? message.content : message.content.map((part) => part.type)
      ]),
      [["assistant", ["tool-call", "tool-result", "text"]]]
    )
  })
})
