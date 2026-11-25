/**
 * Memory tools: what the user asks the assistant to remember or forget, and what it remembers.
 *
 * @since 0.0.0
 */
import * as Tool from "effect/ai/Tool"
import * as Schema from "effect/Schema"
import { Card, describeCard } from "../assistant/Card.ts"
import { Memory, MemoryKind, MemoryText } from "../assistant/Memory.ts"
import { Caller, ToolProblem } from "./Caller.ts"
import { AgentIdParam, MemoryIdParam } from "./Params.ts"
import { Risk } from "./Risk.ts"
import { say } from "./Words.ts"

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const Remember = Tool.make("remember", {
  description: "Remembers something the user asked you to remember, in their words, as one short sentence in the " +
    "second person. Only for what they asked to be remembered; other facts are picked up after the turn.",
  parameters: Schema.Struct({
    kind: MemoryKind,
    text: MemoryText,
    agentId: Schema.NullOr(AgentIdParam).annotate({
      description: "The agent it is about; null when it is about the user."
    })
  }),
  success: Card,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (card) => say(describeCard(card))
}).annotate(Risk, "configure")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const Forget = Tool.make("forget", {
  description: "Forgets a memory the user no longer wants kept (its id from listMemories or the system prompt).",
  parameters: Schema.Struct({ memoryId: MemoryIdParam }),
  success: Card,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (card) => say(describeCard(card))
}).annotate(Risk, "configure")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const ListMemories = Tool.make("listMemories", {
  description: "Everything remembered about the user, confirmed or waiting for their confirmation.",
  success: Schema.Array(Memory),
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (memories) =>
    say(
      memories.length === 0 ?
        "Nothing remembered yet." :
        memories.map((memory) =>
          `${memory.id} (${memory.kind}, ${memory.source}${memory.confirmedAt === null ? ", unconfirmed" : ""}): ` +
          memory.text
        )
    )
}).annotate(Risk, "read")
