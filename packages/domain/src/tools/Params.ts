/**
 * Ids as tool parameters. Domain ids carry an `identifier`, which JSON Schema turns into a definition named after it
 * (`@bluechip/domain/Ids/AgentId`); Anthropic rejects definitions named with slashes, so tool parameters use the same
 * ids without one, inlined in each tool's schema.
 *
 * @since 0.0.0
 */
import { AgentId, IntentId, MemoryId, SavedTemplateId } from "../Ids.ts"

/**
 * @stability unstable
 * @category parameters
 * @since 0.0.0
 */
export const AgentIdParam = AgentId.annotate({
  identifier: undefined,
  description: "An agent's id (agent_…), from listAgents or the system prompt."
})

/**
 * @stability unstable
 * @category parameters
 * @since 0.0.0
 */
export const IntentIdParam = IntentId.annotate({
  identifier: undefined,
  description: "A trade's intent id (intent_…), from a card or getAgentHistory."
})

/**
 * @stability unstable
 * @category parameters
 * @since 0.0.0
 */
export const MemoryIdParam = MemoryId.annotate({
  identifier: undefined,
  description: "A memory's id (memory_…), from listMemories or the system prompt."
})

/**
 * @stability unstable
 * @category parameters
 * @since 0.0.0
 */
export const SavedTemplateIdParam = SavedTemplateId.annotate({
  identifier: undefined,
  description: "A saved template's id (template_…), from listTemplates."
})
