/**
 * Identifiers shared by the server and the web app.
 *
 * Entity ids are TypeIDs: a lowercase prefix, an underscore and a base32 UUIDv7 (`agent_01jd…`), so an id says what
 * it identifies and sorts by creation time.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"

/**
 * A TypeID string with the given prefix. Brand it per entity, so ids of different entities never mix.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const typeId = (prefix: string) =>
  Schema.String.check(Schema.isPattern(new RegExp(`^${prefix}_[0-7][0-9a-hjkmnp-tv-z]{25}$`)))

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const UserId = typeId("user").pipe(
  Schema.brand("UserId"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/UserId" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type UserId = typeof UserId.Type

/**
 * A client-generated UUID that makes a write idempotent: the same request id returns the first result.
 *
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const RequestId = Schema.String.check(Schema.isUUID()).pipe(
  Schema.brand("RequestId"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/RequestId" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type RequestId = typeof RequestId.Type

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const PasskeyId = typeId("passkey").pipe(
  Schema.brand("PasskeyId"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/PasskeyId" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type PasskeyId = typeof PasskeyId.Type

/**
 * An EVM address, checksummed or not (`0x` and 40 hex digits).
 *
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const Address = Schema.String.check(Schema.isPattern(/^0x[0-9a-fA-F]{40}$/)).pipe(
  Schema.brand("Address"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/Address" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type Address = typeof Address.Type

/**
 * A transaction hash on Base (`0x` and 64 hex digits).
 *
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const TxHash = Schema.String.check(Schema.isPattern(/^0x[0-9a-fA-F]{64}$/)).pipe(
  Schema.brand("TxHash"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/TxHash" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type TxHash = typeof TxHash.Type

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const TransferId = typeId("transfer").pipe(
  Schema.brand("TransferId"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/TransferId" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type TransferId = typeof TransferId.Type

/**
 * A prepared owner operation waiting for the user's passkey.
 *
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const SigningRequestId = typeId("signing").pipe(
  Schema.brand("SigningRequestId"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/SigningRequestId" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type SigningRequestId = typeof SigningRequestId.Type

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const TradeId = typeId("trade").pipe(
  Schema.brand("TradeId"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/TradeId" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type TradeId = typeof TradeId.Type

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const AgentId = typeId("agent").pipe(
  Schema.brand("AgentId"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/AgentId" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type AgentId = typeof AgentId.Type

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const AgentSessionId = typeId("agentsession").pipe(
  Schema.brand("AgentSessionId"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/AgentSessionId" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type AgentSessionId = typeof AgentSessionId.Type

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const SavedTemplateId = typeId("template").pipe(
  Schema.brand("SavedTemplateId"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/SavedTemplateId" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type SavedTemplateId = typeof SavedTemplateId.Type

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const IntentId = typeId("intent").pipe(
  Schema.brand("IntentId"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/IntentId" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type IntentId = typeof IntentId.Type

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const AuditEventId = typeId("audit").pipe(
  Schema.brand("AuditEventId"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/AuditEventId" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type AuditEventId = typeof AuditEventId.Type

/**
 * A conversation with the assistant; also the AG-UI thread id of its runs.
 *
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const ConversationId = typeId("conversation").pipe(
  Schema.brand("ConversationId"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/ConversationId" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type ConversationId = typeof ConversationId.Type

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const MessageId = typeId("message").pipe(
  Schema.brand("MessageId"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/MessageId" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type MessageId = typeof MessageId.Type

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const MemoryId = typeId("memory").pipe(
  Schema.brand("MemoryId"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/MemoryId" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type MemoryId = typeof MemoryId.Type

/**
 * A card the assistant showed: a trade, a draft agent, a change to confirm, a memory.
 *
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const CardId = typeId("card").pipe(
  Schema.brand("CardId"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/CardId" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type CardId = typeof CardId.Type

/**
 * An AG-UI run, named by the client that starts it (`RunAgentInput.runId`).
 *
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export const RunId = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100)).pipe(
  Schema.brand("RunId"),
  Schema.annotate({ identifier: "@bluechip/domain/Ids/RunId" })
)

/**
 * @stability unstable
 * @category ids
 * @since 0.0.0
 */
export type RunId = typeof RunId.Type
