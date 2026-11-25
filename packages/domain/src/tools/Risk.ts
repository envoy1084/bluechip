/**
 * Risk levels: how far a tool can go on the model's word. Every tool carries one as an annotation, and every surface
 * (the web chat, chat platforms, MCP clients) treats a level the same way.
 *
 * @since 0.0.0
 */
import type * as Tool from "effect/ai/Tool"
import * as Context from "effect/Context"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

/**
 * - `read`: runs at once and changes nothing.
 * - `propose`: creates an intent; the pipeline decides it (an agent within its policies sends it, anything else waits
 *   for your approval or is blocked).
 * - `configure`: returns a card, applied when you confirm it. Memory tools are the exception: what you tell the
 *   assistant to remember or forget is your own instruction, applied at once and undoable from the memory page.
 * - `sign`: prepares a signing request; only your Face ID in the app completes it.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const RiskLevel = Schema.Literals(["read", "propose", "configure", "sign"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type RiskLevel = typeof RiskLevel.Type

/**
 * The tool annotation holding its risk level.
 *
 * @stability unstable
 * @category annotations
 * @since 0.0.0
 */
export class Risk extends Context.Service<Risk, RiskLevel>()("@bluechip/domain/tools/Risk") {}

/**
 * A tool's risk level, `undefined` when it has none (the conformance test fails on that).
 *
 * @stability unstable
 * @category annotations
 * @since 0.0.0
 */
export const riskOf = (tool: Tool.Any): RiskLevel | undefined =>
  Option.getOrUndefined(Context.getOption(tool.annotations, Risk))
