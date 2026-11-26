// The mock API's agents groups: agents, policies and templates, and automations, each answered from the preview
// world's agents slice (`server/agents/`).
import * as Layer from "effect/Layer"
import { AgentsHandlers } from "./agents/AgentsHandlers.ts"
import { AutomationsHandlers } from "./agents/AutomationsHandlers.ts"
import { PoliciesHandlers } from "./agents/PoliciesHandlers.ts"

export const AgentsGroupsLive = Layer.mergeAll(AgentsHandlers, PoliciesHandlers, AutomationsHandlers)
