/**
 * An agent: a template, its limits, and where its onchain session stands. Its limits are locked with Face ID as a
 * Namera session on the user's account; every change to them is signed again, and removing it revokes the session.
 *
 * @since 0.0.0
 */
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import { AgentId, SigningRequestId } from "../Ids.ts"
import { Usdc } from "../market/Units.ts"
import { CeremonyOptions } from "../WebAuthn.ts"
import { Limits } from "./Limits.ts"
import { Template } from "./Templates.ts"

/**
 * Where an agent's session stands: not locked yet (`draft`), its lock, change or removal on its way to Base, locked
 * (`active`), or removed for good.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const AgentStatus = Schema.Literals(["draft", "locking", "active", "updating", "removing", "removed"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type AgentStatus = typeof AgentStatus.Type

/**
 * What happens to an agent's session: an owner operation sent (to lock, change or remove it), the operation landed
 * or failed, or a draft discarded before anything was sent.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type AgentEvent =
  | { readonly _tag: "Sent"; readonly action: AgentAction }
  | { readonly _tag: "Landed" }
  | { readonly _tag: "Failed" }
  | { readonly _tag: "Discarded" }

/**
 * What an owner operation does to an agent's session.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const AgentAction = Schema.Literals(["lock", "update", "remove"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type AgentAction = typeof AgentAction.Type

const SENDS_FROM: Readonly<Record<AgentAction, { readonly from: AgentStatus; readonly to: AgentStatus }>> = {
  lock: { from: "draft", to: "locking" },
  update: { from: "active", to: "updating" },
  remove: { from: "active", to: "removing" }
}

/**
 * The next status after `event`, or why it can't happen. One operation at a time: a lock only from a draft, a change
 * or removal only while active; a failed operation leaves the session as it was, and a removed agent never changes.
 *
 * **Example** (Locking an agent)
 *
 * ```ts import.meta.vitest
 * import { transition } from "@bluechip/domain/agents/Agent"
 * import * as Result from "effect/Result"
 *
 * Result.getOrThrow(transition("draft", { _tag: "Sent", action: "lock" })) // => "locking"
 * Result.getOrThrow(transition("locking", { _tag: "Landed" })) // => "active"
 * ```
 *
 * @stability unstable
 * @category transitions
 * @since 0.0.0
 */
export const transition = (status: AgentStatus, event: AgentEvent): Result.Result<AgentStatus, string> => {
  switch (event._tag) {
    case "Sent": {
      const step = SENDS_FROM[event.action]
      return status === step.from ? Result.succeed(step.to) : Result.fail(`a ${status} agent can't ${event.action}`)
    }
    case "Landed":
      if (status === "locking" || status === "updating") return Result.succeed("active")
      return status === "removing" ? Result.succeed("removed") : Result.fail(`a ${status} agent has nothing landing`)
    case "Failed":
      if (status === "locking") return Result.succeed("draft")
      return status === "updating" || status === "removing"
        ? Result.succeed("active")
        : Result.fail(`a ${status} agent has nothing to fail`)
    case "Discarded":
      return status === "draft" ? Result.succeed("removed") : Result.fail(`a ${status} agent can't be discarded`)
  }
}

/**
 * The longest name an agent may have.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const MAX_NAME_LENGTH = 40

/**
 * An agent's name: what you call it, 1 to 40 characters without leading or trailing spaces.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const AgentName = Schema.Trimmed.check(Schema.isMinLength(1), Schema.isMaxLength(MAX_NAME_LENGTH))

/**
 * An agent as the user sees it: its limits in force (or, for a draft, the ones it will lock), a change on its way,
 * whether bluechip has paused it, and until when its lock lasts.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Agent extends Schema.Class<Agent>("@bluechip/domain/agents/Agent/Agent")({
  id: AgentId,
  name: AgentName,
  template: Template,
  status: AgentStatus,
  /** Paused by you: bluechip sends none of its trades. Its session stays locked onchain. */
  paused: Schema.Boolean,
  limits: Limits,
  /** The limits a change on its way will lock (while `updating`). */
  pendingLimits: Schema.NullOr(Limits),
  /** When its session ends: 90 days after it was locked. */
  lockedUntil: Schema.NullOr(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc
}) {}

/**
 * A lock, change or removal prepared for the user's passkey: the WebAuthn request (its challenge is the owner
 * operation's hash), and the agent as it will be.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class AgentRequest extends Schema.Class<AgentRequest>("@bluechip/domain/agents/Agent/AgentRequest")({
  id: SigningRequestId,
  options: CeremonyOptions,
  action: AgentAction,
  agent: Agent,
  /** Whether this also deploys the account (its first transaction). */
  deploysAccount: Schema.Boolean,
  expiresAt: Schema.DateTimeUtc
}) {}

/**
 * What an agent has used, read from its session onchain: USDC put into buys and operations sent this UTC day, and
 * value lost to prices over the last 7 days.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class AgentUsage extends Schema.Class<AgentUsage>("@bluechip/domain/agents/Agent/AgentUsage")({
  spentToday: Usdc,
  tradesToday: Schema.Int,
  slippageThisWeek: Usdc
}) {}
