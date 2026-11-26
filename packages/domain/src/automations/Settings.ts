/**
 * An automation's settings: how often it may fire (a cooldown, a most number of fires, an expiry), when it stays
 * quiet, whether it waits for the market to open, and whether trades started by news or a judgment may go ahead
 * without asking you. `gate` decides, when a trigger fires, whether the automation goes on.
 *
 * @since 0.0.0
 */
import * as DateTime from "effect/DateTime"
import * as Schema from "effect/Schema"
import { isWithin, localClock, TimeOfDay, TimeZoneName, zoneName } from "./Time.ts"

/**
 * Hours to stay quiet in, `from` included and `to` not; past midnight wraps.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const QuietHours = Schema.Struct({ from: TimeOfDay, to: TimeOfDay, timeZone: TimeZoneName })

/**
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Settings = Schema.Struct({
  /** The least time between two fires. */
  cooldownMinutes: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 7 * 24 * 60 })),
  /** It ends (`done`) after this many fires; `null`: no limit. */
  maxFires: Schema.NullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
  /** It ends (`expired`) after this; `null`: never. */
  expiresAt: Schema.NullOr(Schema.DateTimeUtc),
  quietHours: Schema.NullOr(QuietHours),
  /** Fires only while the market is open; `null`: the trigger's default (on for price triggers). */
  marketHoursOnly: Schema.NullOr(Schema.Boolean),
  /** Trades started by news or a judgment go ahead within the agent's policies instead of asking you first. */
  actDirectly: Schema.Boolean
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Settings = typeof Settings.Type

/**
 * An hour's cooldown, no limit on fires, no expiry, no quiet hours, the trigger's market hours, and asking first.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_SETTINGS: Settings = {
  cooldownMinutes: 60,
  maxFires: null,
  expiresAt: null,
  quietHours: null,
  marketHoursOnly: null,
  actDirectly: false
}

/**
 * Why a fire doesn't go on: the automation isn't active, fired too recently, is in its quiet hours, or waits for
 * the market; or it has ended (`done` after its last fire, `expired` past its expiry).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const SkipReason = Schema.Literals(["inactive", "cooldown", "quietHours", "marketClosed", "done", "expired"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type SkipReason = typeof SkipReason.Type

/**
 * Whether a fire goes on (`null`) or why not.
 *
 * **Example** (Fired 10 minutes ago, with an hour's cooldown)
 *
 * ```ts import.meta.vitest
 * import { DEFAULT_SETTINGS, gate } from "@bluechip/domain/automations/Settings"
 * import * as DateTime from "effect/DateTime"
 *
 * gate(DEFAULT_SETTINGS, {
 *   active: true,
 *   fires: 1,
 *   lastFiredAt: DateTime.makeUnsafe("2026-11-30T15:00:00Z"),
 *   now: DateTime.makeUnsafe("2026-11-30T15:10:00Z"),
 *   marketOpen: true,
 *   marketHours: true
 * }) // => "cooldown"
 * ```
 *
 * @stability unstable
 * @category gating
 * @since 0.0.0
 */
export const gate = (settings: Settings, state: {
  readonly active: boolean
  readonly fires: number
  readonly lastFiredAt: DateTime.Utc | null
  readonly now: DateTime.Utc
  readonly marketOpen: boolean
  /** The trigger's default for `marketHoursOnly`. */
  readonly marketHours: boolean
}): SkipReason | null => {
  if (!state.active) return "inactive"
  if (settings.expiresAt !== null && !DateTime.isLessThan(state.now, settings.expiresAt)) return "expired"
  if (settings.maxFires !== null && state.fires >= settings.maxFires) return "done"
  if (
    state.lastFiredAt !== null &&
    DateTime.isLessThan(state.now, DateTime.add(state.lastFiredAt, { minutes: settings.cooldownMinutes }))
  ) return "cooldown"
  if (settings.quietHours !== null) {
    const { minutes } = localClock(state.now, settings.quietHours.timeZone)
    if (isWithin(minutes, settings.quietHours.from, settings.quietHours.to)) return "quietHours"
  }
  if ((settings.marketHoursOnly ?? state.marketHours) && !state.marketOpen) return "marketClosed"
  return null
}

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

const cooldownText = (minutes: number): string => {
  if (minutes === 60) return "At most once an hour"
  if (minutes === 24 * 60) return "At most once a day"
  if (minutes % 60 === 0) return `At most once every ${minutes / 60} hours`
  return `At most once every ${minutes} minutes`
}

/**
 * The settings as sentences: "At most once an hour", "Up to 3 times", "Until 1 Dec 2026", "Quiet between 22:00 and
 * 07:00 New York time", "Only while the market is open", "Asks you before trading on news".
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const describeSettings = (
  settings: Settings,
  trigger: { readonly marketHours: boolean; readonly asks: boolean }
): ReadonlyArray<string> => [
  ...(settings.cooldownMinutes > 0 ? [cooldownText(settings.cooldownMinutes)] : []),
  ...(settings.maxFires === null ? [] : [settings.maxFires === 1 ? "Only once" : `Up to ${settings.maxFires} times`]),
  ...(settings.expiresAt === null ? [] : [`Until ${dayFormat.format(DateTime.toDateUtc(settings.expiresAt))}`]),
  ...(settings.quietHours === null ?
    [] :
    [
      `Quiet between ${settings.quietHours.from} and ${settings.quietHours.to} ${
        zoneName(settings.quietHours.timeZone)
      }`
    ]),
  ...((settings.marketHoursOnly ?? trigger.marketHours) ? ["Only while the market is open"] : []),
  ...(trigger.asks
    ? [settings.actDirectly ? "Trades on news without asking you" : "Asks you before trading on news"]
    : [])
]
