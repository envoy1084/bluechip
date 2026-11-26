/**
 * Your hours: quiet hours (when push and Telegram wait, and until when) and the daily digest's morning, both in your
 * time zone.
 *
 * @since 0.0.0
 */
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import { isWithin, localClock, minutesOf, zoneOf } from "../automations/Time.ts"
import type { QuietHours, Severity } from "./Notification.ts"

/**
 * When a notification of `severity` may go out on push or Telegram: `undefined` for now, or the end of the quiet
 * hours `now` falls in, in `zone` (UTC when unknown). Security notifications never wait.
 *
 * **Example** (A trade at 23:30 UTC with quiet hours 22:00 to 07:00)
 *
 * ```ts import.meta.vitest
 * import { quietUntil } from "@bluechip/domain/notifications/QuietHours"
 * import * as DateTime from "effect/DateTime"
 *
 * const until = quietUntil(
 *   { from: "22:00", to: "07:00" },
 *   "info",
 *   DateTime.makeUnsafe("2026-11-26T23:30:00Z"),
 *   "UTC"
 * )
 * until === undefined ? undefined : DateTime.formatIso(until) // => "2026-11-27T07:00:00.000Z"
 * ```
 *
 * @stability unstable
 * @category rules
 * @since 0.0.0
 */
export const quietUntil = (
  quiet: QuietHours | null,
  severity: Severity,
  now: DateTime.Utc,
  zone: string
): DateTime.Utc | undefined => {
  if (quiet === null || severity === "security") return undefined
  const { minutes } = localClock(now, zone)
  if (!isWithin(minutes, quiet.from, quiet.to)) return undefined
  const left = (minutesOf(quiet.to) - minutes + 24 * 60) % (24 * 60)
  return DateTime.startOf(DateTime.add(now, { minutes: left }), "minute")
}

/**
 * The hour the daily digest goes out, local time.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const DIGEST_HOUR = 8

/**
 * The local date (`2026-11-26`) whose digest is due at `now` in `zone` (UTC when unknown): `now` falls in the
 * digest's hour there, else `undefined`. An hourly sweep sends each user's digest once a day, at 08:00 their time.
 *
 * **Example** (08:15 in New York)
 *
 * ```ts import.meta.vitest
 * import { digestDue } from "@bluechip/domain/notifications/QuietHours"
 * import * as DateTime from "effect/DateTime"
 *
 * digestDue(DateTime.makeUnsafe("2026-11-26T13:15:00Z"), "America/New_York") // => "2026-11-26"
 * digestDue(DateTime.makeUnsafe("2026-11-26T08:15:00Z"), "America/New_York") // => undefined
 * ```
 *
 * @stability unstable
 * @category rules
 * @since 0.0.0
 */
export const digestDue = (now: DateTime.Utc, zone: string): string | undefined => {
  const local = Option.match(zoneOf(zone), {
    onNone: () => DateTime.toParts(now),
    onSome: (named) => DateTime.toParts(DateTime.setZone(now, named))
  })
  if (local.hour !== DIGEST_HOUR) return undefined
  return `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`
}
