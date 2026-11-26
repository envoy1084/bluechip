// A memory in words on the memory page: where it came from, how often answers used it, and the groups it sits in.
import type { Memory, MemoryKind } from "@bluechip/domain/assistant/Memory"
import { formatDate, formatRelative } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"

/** "You said it on Fri 20 Nov, 10:00" or "Inferred on Fri 20 Nov, 10:00, 72% sure", in the viewer's time zone. */
export const provenance = (memory: Memory, timeZone: string): string => {
  const on = formatDate(DateTime.toDateUtc(memory.createdAt), { timeZone })
  return memory.source === "said" ?
    `You said it on ${on}` :
    `Inferred on ${on}, ${Math.round(memory.confidence * 100)}% sure`
}

/**
 * "Not used in an answer yet", or how many answers used it and when the last did: "Used in 3 answers, last 2 h ago",
 * "Used in 1 answer, last yesterday", "Used in 4 answers, last on Wed 18 Nov".
 */
export const usage = (memory: Pick<Memory, "uses" | "lastUsedAt">, now: Date, timeZone: string): string => {
  if (memory.uses === 0) return "Not used in an answer yet"
  const used = `Used in ${memory.uses} ${memory.uses === 1 ? "answer" : "answers"}`
  if (memory.lastUsedAt === null) return used

  const last = DateTime.toDateUtc(memory.lastUsedAt)
  const ago = now.getTime() - last.getTime() < 172_800_000 ?
    formatRelative(last, now, { timeZone }).toLowerCase() :
    `on ${formatDate(last, { timeZone, time: false })}`
  return `${used}, last ${ago}`
}

/** The kinds of memory, in the page's order, each group's title in its words. */
export const MEMORY_GROUPS: ReadonlyArray<{ readonly kind: MemoryKind; readonly label: string }> = [
  { kind: "constraint", label: "Rules" },
  { kind: "preference", label: "Preferences" },
  { kind: "goal", label: "Goals" },
  { kind: "fact", label: "Facts" }
]

/**
 * The page's groups: the guesses waiting for you first, then what it uses by kind, each in the order it came (newest
 * first, or best first for a search); kinds with nothing are left out.
 */
export const groupMemories = <M extends Pick<Memory, "kind" | "confirmedAt">>(memories: ReadonlyArray<M>): {
  readonly toConfirm: ReadonlyArray<M>
  readonly groups: ReadonlyArray<{ readonly kind: MemoryKind; readonly label: string; readonly memories: Array<M> }>
} => ({
  toConfirm: memories.filter((memory) => memory.confirmedAt === null),
  groups: MEMORY_GROUPS.map((group) => ({
    ...group,
    memories: memories.filter((memory) => memory.confirmedAt !== null && memory.kind === group.kind)
  })).filter((group) => group.memories.length > 0)
})

/** Whether a memory matches what is typed: every word of it in the memory, its kind or its agent's name. */
export const matchesMemory = (fields: ReadonlyArray<string>, search: string): boolean => {
  const haystack = fields.join(" ").toLowerCase()
  return search.toLowerCase().split(/\s+/).filter((word) => word !== "").every((word) => haystack.includes(word))
}

/** The export's file name, by the UTC day it was made: `bluechip-memory-2026-11-26.json`. */
export const exportFileName = (exportedAt: DateTime.Utc): string =>
  `bluechip-memory-${DateTime.formatIsoDateUtc(exportedAt)}.json`
