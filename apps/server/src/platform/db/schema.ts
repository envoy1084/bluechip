// Every table, for drizzle-kit and the relations builder. The one module of platform/ that imports modules/.
export { accounts, passkeys, users } from "../../modules/accounts/tables.ts"
export { agents, agentSessions, sessionKeys, sessionPolicies } from "../../modules/agents/tables.ts"
export { assistantCards, conversations, messages, usageBudgets } from "../../modules/assistant/tables.ts"
export { auditEvents } from "../../modules/audit/tables.ts"
export { authChallenges, sessions } from "../../modules/auth/tables.ts"
export { automationRuns, automations, automationState, judgments, newsItems } from "../../modules/automations/tables.ts"
export { channelLinkCodes, channelLinks } from "../../modules/channels/tables.ts"
export { transfers } from "../../modules/funding/tables.ts"
export { intents } from "../../modules/intents/tables.ts"
export { agentJournal } from "../../modules/journal/tables.ts"
export { chunks, documents } from "../../modules/knowledge/tables.ts"
export { ledgerAdjustments, lotClosings, lots, pnlDaily, reconciliationCursors } from "../../modules/ledger/tables.ts"
export { conversationSummaries, memories, memoryUses, recallEntries } from "../../modules/memory/tables.ts"
export {
  notificationDeliveries,
  notificationRules,
  notifications,
  notificationSettings
} from "../../modules/notifications/tables.ts"
export { driftHistory } from "../../modules/performance/tables.ts"
export { agentTemplates } from "../../modules/policies/tables.ts"
export { portfolioSnapshots } from "../../modules/portfolio/tables.ts"
export { pushSubscriptions } from "../../modules/push/tables.ts"
export { recoveryKeys, recoveryRequests } from "../../modules/recovery/tables.ts"
export { signingRequests } from "../../modules/signing/tables.ts"
export { trades } from "../../modules/trading/tables.ts"
export { jobRuns } from "../engine/tables.ts"
