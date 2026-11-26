// The editor's sentence as its phrases: what starts it, each check, what it does. Each leads to its section, and the
// ones an edit changed are marked.
import type { AutomationDescription } from "@bluechip/domain/automations/Automation"

export interface Phrase {
  readonly part: "trigger" | "conditions" | "action"
  /** Its place among the conditions; `null` for the trigger and the action. */
  readonly index: number | null
  readonly text: string
}

/**
 * The phrases of a description in the sentence's order, the first capitalized, so that joined with commas and ended
 * with a full stop they read as its sentence.
 */
export const phrasesOf = (
  description: Pick<AutomationDescription, "trigger" | "conditions" | "action">
): Array<Phrase> => {
  const phrases: Array<Phrase> = [
    { part: "trigger", index: null, text: description.trigger },
    ...description.conditions.map((text, index): Phrase => ({ part: "conditions", index, text })),
    { part: "action", index: null, text: description.action }
  ]
  const first = phrases[0]!
  phrases[0] = { ...first, text: first.text.length === 0 ? "" : first.text[0]!.toUpperCase() + first.text.slice(1) }
  return phrases
}

/**
 * The phrases of `next` that `previous` didn't say: a new trigger, check or action, or one that reads differently. A
 * removed check, and the checks that move up after it, change nothing.
 */
export const changedPhrases = (
  previous: ReadonlyArray<Phrase>,
  next: ReadonlyArray<Phrase>
): Array<Phrase> => {
  const said = new Set(previous.map((phrase) => phrase.text.toLowerCase()))
  return next.filter((phrase) => !said.has(phrase.text.toLowerCase()))
}
