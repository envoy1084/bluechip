/* Number, date and time formats from the brand kit's typography rules (research/brand/kit/views/type.js).
   Everything is en-US on Intl with an explicit time zone, so the same input renders the same text everywhere. */

/** A true minus sign. Negative amounts never use a hyphen or brackets. */
export const MINUS = "−"

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1
})
const percent = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const shares = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 })

// Round before choosing a sign, so -0.004 shows as $0.00 rather than −$0.00.
const roundTo = (value: number, digits: number): number => {
  const rounded = Number(value.toFixed(digits))
  return Object.is(rounded, -0) ? 0 : rounded
}

export interface MoneyOptions {
  /** From $10,000 up, show "$1.2M". Only for charts, tiles and tickers; balances and trades are never compact. */
  readonly compact?: boolean
  /** Always show the sign: "+$224.10". */
  readonly signed?: boolean
}

/** Dollars with thousands commas and two decimals: "$12,480.36", "−$12.00", or "$1.2M" when compact. */
export const formatMoney = (value: number, options: MoneyOptions = {}): string => {
  const compact = options.compact === true && Math.abs(value) >= 10_000
  const rounded = compact ? value : roundTo(value, 2)
  const sign = rounded < 0 ? MINUS : options.signed === true && rounded > 0 ? "+" : ""
  return sign + (compact ? usdCompact : usd).format(Math.abs(rounded))
}

/** A change in money, always signed: "+$224.10", "−$3.00". Zero is "$0.00". */
export const formatChange = (value: number): string => formatMoney(value, { signed: true })

export interface PercentOptions {
  /** Carry the direction with ▲ or ▼ instead of + or −: "▲ 1.82%". */
  readonly arrow?: boolean
}

/** A percent change, given in percent units (1.82 means 1.82%): "+1.82%", or "▲ 1.82%" with `arrow`. Zero is "0.00%". */
export const formatPercent = (value: number, options: PercentOptions = {}): string => {
  const rounded = roundTo(value, 2)
  if (rounded === 0) return "0.00%"
  const digits = `${percent.format(Math.abs(rounded))}%`
  if (options.arrow === true) return `${rounded > 0 ? "▲" : "▼"} ${digits}`
  return `${rounded > 0 ? "+" : MINUS}${digits}`
}

/** Shares with up to 8 decimals, trailing zeros trimmed: "0.00412", "12.5". */
export const formatShares = (value: number): string => {
  const text = shares.format(Math.abs(value))
  return value < 0 && text !== "0" ? MINUS + text : text
}

/** Shares with their noun, singular only for exactly one: "1 share", "0.5 shares", "12 shares". */
export const formatShareCount = (value: number): string => {
  const text = formatShares(value)
  return `${text} ${text === "1" ? "share" : "shares"}`
}

export interface TokenAmountOptions {
  /** Base-unit decimals of a `bigint` amount (6 for USDC, 18 for most tokens). Ignored for numbers. */
  readonly decimals?: number
  /** Decimals shown at most, trailing zeros trimmed. Defaults to 2 for USDC and 6 otherwise. */
  readonly maximumFractionDigits?: number
}

// The magnitude of base units as an exact decimal string, so Intl rounds it without a float in between.
const unitsToDecimal = (units: bigint, decimals: number): `${number}` => {
  const digits = units.toString().padStart(decimals + 1, "0")
  const whole = digits.slice(0, digits.length - decimals)
  const fraction = digits.slice(digits.length - decimals)
  return (decimals > 0 ? `${whole}.${fraction}` : whole) as `${number}`
}

/**
 * A token amount with its symbol: "500.00 USDC", "0.275604 NVDAc". A `bigint` is read as base units with
 * `decimals`, without going through a float, so large balances keep every digit.
 */
export const formatTokenAmount = (
  amount: number | bigint,
  symbol: string,
  options: TokenAmountOptions = {}
): string => {
  const isCash = symbol === "USDC"
  const maximumFractionDigits = options.maximumFractionDigits ?? (isCash ? 2 : 6)
  const format = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: isCash ? Math.min(2, maximumFractionDigits) : 0,
    maximumFractionDigits
  })
  const negative = amount < 0
  const text = format.format(
    typeof amount === "bigint" ?
      unitsToDecimal(negative ? -amount : amount, options.decimals ?? 18) :
      Math.abs(amount)
  )
  const zero = /^[0.,]+$/.test(text)
  return `${negative && !zero ? MINUS : ""}${text} ${symbol}`
}

/** The time zone of US market hours. */
export const MARKET_TIME_ZONE = "America/New_York"

const ZONE_LABELS: Readonly<Record<string, string>> = { UTC: "UTC", [MARKET_TIME_ZONE]: "New York" }

export interface DateOptions {
  /** IANA time zone. Defaults to UTC. */
  readonly timeZone?: string
  /** Include the 24-hour time: "Mon 23 Nov, 14:30". Defaults to true. */
  readonly time?: boolean
  /** Name the zone after the time: "Mon 23 Nov, 14:30 UTC". Defaults to false. */
  readonly zone?: boolean
}

const parts = (date: Date | number, timeZone: string): Readonly<Record<string, string>> => {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  })
  return Object.fromEntries(format.formatToParts(date).map((part) => [part.type, part.value]))
}

const zoneLabel = (timeZone: string): string => ZONE_LABELS[timeZone] ?? timeZone

/** The 24-hour time: "14:30", or "09:30 New York" with `zone`. */
export const formatTime = (date: Date | number, options: Omit<DateOptions, "time"> = {}): string => {
  const timeZone = options.timeZone ?? "UTC"
  const p = parts(date, timeZone)
  return `${p["hour"]}:${p["minute"]}${options.zone === true ? ` ${zoneLabel(timeZone)}` : ""}`
}

/** Short weekday, day, short month and 24-hour time: "Mon 23 Nov, 14:30". Numeric dates are never used. */
export const formatDate = (date: Date | number, options: DateOptions = {}): string => {
  const timeZone = options.timeZone ?? "UTC"
  const p = parts(date, timeZone)
  const day = `${p["weekday"]} ${p["day"]} ${p["month"]}`
  if (options.time === false) return day
  return `${day}, ${formatTime(date, { timeZone, zone: options.zone ?? false })}`
}

/** Market hours are said in New York time first: "Mon 09:30 New York (14:30 UTC)". */
export const formatMarketTime = (date: Date | number): string => {
  const p = parts(date, MARKET_TIME_ZONE)
  return `${p["weekday"]} ${formatTime(date, { timeZone: MARKET_TIME_ZONE, zone: true })} (${
    formatTime(date, { zone: true })
  })`
}

/**
 * Relative time for the last day: "Just now", "2 min ago", "3 h ago", "Yesterday". Older than that it switches to
 * the absolute form, as the kit's rule says.
 */
export const formatRelative = (
  date: Date | number,
  now: Date | number = Date.now(),
  options: Pick<DateOptions, "timeZone"> = {}
): string => {
  const seconds = (Number(now) - Number(date)) / 1000
  if (seconds < 45) return "Just now"
  if (seconds < 3600) return `${Math.min(59, Math.max(1, Math.round(seconds / 60)))} min ago`
  if (seconds < 86_400) return `${Math.min(23, Math.round(seconds / 3600))} h ago`
  if (seconds < 172_800) return "Yesterday"
  return formatDate(date, options)
}
