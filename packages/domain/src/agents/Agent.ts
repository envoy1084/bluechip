/**
 * An agent: a session key on the user's account carrying onchain policies (its spec), locked with Face ID as a Namera
 * session. A change of policies is signed again and kept as a new session in its history, renewing it locks a new key
 * with the same policies, and removing it revokes the session.
 *
 * @since 0.0.0
 */
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import { AgentId, AgentSessionId, SigningRequestId } from "../Ids.ts"
import { AgentSpec, PolicyId } from "../policies/AgentSpec.ts"
import { FieldUnit } from "../policies/Policy.ts"
import { CeremonyOptions } from "../WebAuthn.ts"

/**
 * Where an agent's session stands: not locked yet (`draft`), its lock, change or removal on its way to Base, locked
 * (`active`), past its end (`expired`: it can't trade until you renew it), or removed for good.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const AgentStatus = Schema.Literals([
  "draft",
  "locking",
  "active",
  "updating",
  "removing",
  "expired",
  "removed"
])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type AgentStatus = typeof AgentStatus.Type

/**
 * What happens to an agent's session: an owner operation sent (to lock, change, renew or remove it), the operation landed
 * or failed, a draft discarded before anything was sent, or the session reaching its end.
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
  | { readonly _tag: "Expired" }

/**
 * What an owner operation does to an agent's session.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const AgentAction = Schema.Literals(["lock", "update", "renew", "remove"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type AgentAction = typeof AgentAction.Type

/**
 * The next status after `event`, or why it can't happen. One operation at a time: a lock only from a draft, a change
 * only while active, a renewal or removal while active or expired; a failed operation leaves the agent active (an
 * expired one expires again, its session still past its end), only an active agent expires, and a removed agent never
 * changes.
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
      const sends: Readonly<
        Record<AgentAction, { readonly from: ReadonlyArray<AgentStatus>; readonly to: AgentStatus }>
      > = {
        lock: { from: ["draft"], to: "locking" },
        update: { from: ["active"], to: "updating" },
        renew: { from: ["active", "expired"], to: "updating" },
        remove: { from: ["active", "expired"], to: "removing" }
      }
      const step = sends[event.action]
      return step.from.includes(status) ?
        Result.succeed(step.to) :
        Result.fail(`a ${status} agent can't ${event.action}`)
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
    case "Expired":
      return status === "active" ? Result.succeed("expired") : Result.fail(`a ${status} agent can't expire`)
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
 * How long a session lasts before the agent needs your Face ID again: 90 days.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const SESSION_DAYS = 90

/**
 * Where a session stands: not locked yet, its lock or change on its way, in force, replaced by a change or a renewal,
 * revoked, past its end, or never locked because its operation failed.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const SessionStatus = Schema.Literals([
  "draft",
  "locking",
  "active",
  "replaced",
  "revoked",
  "expired",
  "failed"
])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type SessionStatus = typeof SessionStatus.Type

/**
 * Who asked for a session: you, the assistant, or an automation. You always sign it.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const SessionAuthor = Schema.Literals(["owner", "assistant", "automation"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type SessionAuthor = typeof SessionAuthor.Type

/**
 * One entry of an agent's history: a set of policies you locked (or are locking) for it, and how long it lasts.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class AgentSession extends Schema.Class<AgentSession>("@bluechip/domain/agents/Agent/AgentSession")({
  id: AgentSessionId,
  status: SessionStatus,
  spec: AgentSpec,
  createdBy: SessionAuthor,
  validUntil: Schema.NullOr(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
  installedAt: Schema.NullOr(Schema.DateTimeUtc),
  endedAt: Schema.NullOr(Schema.DateTimeUtc)
}) {}

/**
 * An agent as the user sees it: the policies in force (or, for a draft, the ones it will lock), a change on its way,
 * whether bluechip has paused it, and until when its session lasts.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Agent extends Schema.Class<Agent>("@bluechip/domain/agents/Agent/Agent")({
  id: AgentId,
  name: AgentName,
  /** The template it started from: a built-in's id or a saved template's, `null` when built from scratch. */
  template: Schema.NullOr(Schema.String),
  status: AgentStatus,
  /** Paused by you: bluechip sends none of its trades. Its session stays locked onchain. */
  paused: Schema.Boolean,
  spec: AgentSpec,
  /** The policies a change or renewal on its way will lock (while `updating`). */
  pendingSpec: Schema.NullOr(AgentSpec),
  /** When its session ends: 90 days after it was locked or renewed. */
  lockedUntil: Schema.NullOr(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc
}) {}

/**
 * A lock, change, renewal or removal prepared for the user's passkey: the WebAuthn request (its challenge is the
 * owner operation's hash), and the agent as it will be.
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
 * What one policy has counted onchain: dollars put into buys today, dollars lost to prices this week, trades today, or
 * gas today, against its limit when the limit is in the same unit.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class PolicyUsage extends Schema.Class<PolicyUsage>("@bluechip/domain/agents/Agent/PolicyUsage")({
  policy: PolicyId,
  unit: FieldUnit,
  used: Schema.BigInt,
  limit: Schema.NullOr(Schema.BigInt)
}) {}

/**
 * What an agent has used, read from its session onchain, policy by policy.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class AgentUsage extends Schema.Class<AgentUsage>("@bluechip/domain/agents/Agent/AgentUsage")({
  policies: Schema.Array(PolicyUsage)
}) {}
