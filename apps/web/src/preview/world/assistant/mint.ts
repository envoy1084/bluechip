// Made-up ids and times for the assistant's records. Each source of records counts in its own range (the scenario's
// threads, the panel's actions, the app's runs), so a panel action played again after a reload makes the same ids
// whatever the runs before it made: the conversation the panel opened is found again.
import * as DateTime from "effect/DateTime"
import type { Cast } from "../cast.ts"
import { previewId, previewUuid } from "../ids.ts"

/** Where records come from, each with its own id range. */
export type MintSource = "seed" | "action" | "run"

export type Counters = Record<MintSource, number>

const BASE: Readonly<Record<MintSource, number>> = { seed: 10_000, action: 500_000, run: 900_000 }

export interface Mint {
  readonly cast: Cast
  /** The next made-up id with `prefix`. */
  readonly id: <P extends string>(prefix: P) => `${P}_${string}`
  /** The next made-up UUID, for request ids. */
  readonly uuid: () => string
  /** `hoursAgo` before now. */
  readonly at: (hoursAgo: number) => DateTime.Utc
}

/** Ids from `source`'s range (counted in `counters`), times counted back from `now`. */
export const makeMint = (cast: Cast, now: Date, counters: Counters, source: MintSource): Mint => ({
  cast,
  id: (prefix) => previewId(prefix, BASE[source] + counters[source]++),
  uuid: () => previewUuid(BASE[source] + counters[source]++),
  at: (hoursAgo) => DateTime.makeUnsafe(now.getTime() - Math.round(hoursAgo * 3_600_000))
})
