// A memory in words on the memory page: where it came from, and how often answers used it.
import type { Memory } from "@bluechip/domain/assistant/Memory"
import { formatDate } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"

/** "You said it, on Fri 20 Nov, 10:00" or "Inferred, 72% sure, on …", in the viewer's time zone. */
export const provenance = (memory: Memory, timeZone: string): string => {
  const from = memory.source === "said" ? "You said it" : `Inferred, ${Math.round(memory.confidence * 100)}% sure`
  return `${from}, on ${formatDate(DateTime.toDateUtc(memory.createdAt), { timeZone })}`
}

/** "Used in 3 answers", "Used in 1 answer", or "Not used in an answer yet". */
export const usage = (memory: Pick<Memory, "uses">): string =>
  memory.uses === 0 ? "Not used in an answer yet" : `Used in ${memory.uses} ${memory.uses === 1 ? "answer" : "answers"}`

/** The export's file name, by the UTC day it was made: `bluechip-memory-2026-11-26.json`. */
export const exportFileName = (exportedAt: DateTime.Utc): string =>
  `bluechip-memory-${DateTime.formatIsoDateUtc(exportedAt)}.json`
