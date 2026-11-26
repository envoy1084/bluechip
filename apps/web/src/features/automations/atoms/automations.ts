import type { AutomationRun } from "@bluechip/domain/automations/Run"
import type { AgentId, AutomationId } from "@bluechip/domain/Ids"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import {
  automationsReactivityKey,
  BluechipApiClient,
  intentsReactivityKey,
  liveReactivityKey
} from "../../../lib/api/client.ts"

const reactivityKeys = [automationsReactivityKey, liveReactivityKey]

/** What every mutation here changes, so lists and details refetch. */
export const changedKeys = [automationsReactivityKey]

/** Your automations, every agent's and your own; `"all"`, or one agent's. */
export const automationsAtom = Atom.family((agentId: AgentId | "all") =>
  BluechipApiClient.query("automations", "list", {
    query: agentId === "all" ? {} : { agentId },
    reactivityKeys
  })
)

/** One automation with its latest runs and judgments; a run's trades refetch it as they change. */
export const automationAtom = Atom.family((id: AutomationId) =>
  BluechipApiClient.query("automations", "automation", {
    params: { id },
    reactivityKeys: [...reactivityKeys, intentsReactivityKey]
  })
)

/**
 * The latest runs (newest first) of each automation `automationsAtom(agentId)` lists, read from their details, so a
 * list can say how each last ran and which need a look. One whose details haven't loaded is missing.
 */
export const automationRunsAtom = Atom.family((agentId: AgentId | "all") =>
  Atom.make((get): ReadonlyMap<AutomationId, ReadonlyArray<AutomationRun>> => {
    const listed = get(automationsAtom(agentId))
    if (!AsyncResult.isSuccess(listed)) return new Map()

    return new Map(listed.value.flatMap((automation) => {
      const detail = get(automationAtom(automation.id))
      return AsyncResult.isSuccess(detail) ? [[automation.id, detail.value.runs] as const] : []
    }))
  })
)

/** Reads a draft back: what can't run, and what it does in sentences. */
export const checkAutomationAtom = BluechipApiClient.mutation("automations", "check")

/** Saves a new automation (once per request id). */
export const createAutomationAtom = BluechipApiClient.mutation("automations", "create")

/** Pauses, resumes or edits an automation. */
export const updateAutomationAtom = BluechipApiClient.mutation("automations", "update")

/** Deletes an automation: it stops at once and leaves your lists. */
export const removeAutomationAtom = BluechipApiClient.mutation("automations", "remove")
