import { BluechipApiClient, templatesReactivityKey } from "../lib/api/client.ts"

/** The built-in templates and the ones the user saved. */
export const templatesAtom = BluechipApiClient.query("policies", "templates", {
  reactivityKeys: [templatesReactivityKey]
})

export const saveTemplateAtom = BluechipApiClient.mutation("policies", "saveTemplate")

export const deleteTemplateAtom = BluechipApiClient.mutation("policies", "deleteTemplate")

/** Reads a draft of policies against the catalog: what blocks it, what it allows, and how it compares. */
export const checkSpecAtom = BluechipApiClient.mutation("policies", "check")
