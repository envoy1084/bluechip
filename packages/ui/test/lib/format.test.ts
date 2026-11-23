import {
  formatChange,
  formatDate,
  formatMarketTime,
  formatMoney,
  formatPercent,
  formatRelative,
  formatShares,
  formatTime,
  formatTokenAmount
} from "@bluechip/ui/lib/format"
import { describe, expect, it } from "@effect/vitest"

// Mon 23 Nov 2026, 14:30 UTC (09:30 in New York, the market open).
const OPEN = Date.UTC(2026, 10, 23, 14, 30)

describe("formatMoney", () => {
  it("shows dollars with commas and two decimals", () => {
    expect(formatMoney(12480.36)).toBe("$12,480.36")
    expect(formatMoney(0)).toBe("$0.00")
    expect(formatMoney(5)).toBe("$5.00")
  })

  it("uses a true minus for negatives, never a hyphen or brackets", () => {
    expect(formatMoney(-12)).toBe("−$12.00")
  })

  it("rounds to cents, and a negative that rounds to zero is plain zero", () => {
    expect(formatMoney(1.005)).toBe("$1.00")
    expect(formatMoney(2.675)).toBe("$2.67")
    expect(formatMoney(0.999)).toBe("$1.00")
    expect(formatMoney(-0.004)).toBe("$0.00")
  })

  it("keeps every digit of huge amounts", () => {
    expect(formatMoney(1_234_567_890.12)).toBe("$1,234,567,890.12")
  })

  it("goes compact only from $10,000 up", () => {
    expect(formatMoney(1_240_000, { compact: true })).toBe("$1.2M")
    expect(formatMoney(10_000, { compact: true })).toBe("$10K")
    expect(formatMoney(9_999.5, { compact: true })).toBe("$9,999.50")
    expect(formatMoney(-2_500_000, { compact: true })).toBe("−$2.5M")
  })
})

describe("formatChange", () => {
  it("is always signed", () => {
    expect(formatChange(224.1)).toBe("+$224.10")
    expect(formatChange(-3)).toBe("−$3.00")
    expect(formatChange(0)).toBe("$0.00")
  })
})

describe("formatPercent", () => {
  it("shows two decimals with a sign", () => {
    expect(formatPercent(1.82)).toBe("+1.82%")
    expect(formatPercent(-0.62)).toBe("−0.62%")
  })

  it("lets the arrow carry the sign", () => {
    expect(formatPercent(1.82, { arrow: true })).toBe("▲ 1.82%")
    expect(formatPercent(-0.62, { arrow: true })).toBe("▼ 0.62%")
  })

  it("shows zero, and anything that rounds to zero, with no sign or arrow", () => {
    expect(formatPercent(0, { arrow: true })).toBe("0.00%")
    expect(formatPercent(-0.004, { arrow: true })).toBe("0.00%")
    expect(formatPercent(0.004)).toBe("0.00%")
  })

  it("groups large percents", () => {
    expect(formatPercent(1234.5)).toBe("+1,234.50%")
  })
})

describe("formatShares", () => {
  it("trims trailing zeros", () => {
    expect(formatShares(0.00412)).toBe("0.00412")
    expect(formatShares(12.5)).toBe("12.5")
    expect(formatShares(3)).toBe("3")
    expect(formatShares(0)).toBe("0")
  })

  it("keeps up to 8 decimals and rounds beyond", () => {
    expect(formatShares(0.00000001)).toBe("0.00000001")
    expect(formatShares(0.123456789)).toBe("0.12345679")
    expect(formatShares(0.000000004)).toBe("0")
  })

  it("uses a true minus for negatives", () => {
    expect(formatShares(-0.5)).toBe("−0.5")
    expect(formatShares(-0.000000001)).toBe("0")
  })
})

describe("formatTokenAmount", () => {
  it("shows cash (USDC) with two decimals", () => {
    expect(formatTokenAmount(500, "USDC")).toBe("500.00 USDC")
    expect(formatTokenAmount(500_000_000n, "USDC", { decimals: 6 })).toBe("500.00 USDC")
  })

  it("trims stock tokens to 6 decimals", () => {
    expect(formatTokenAmount(0.2756041, "NVDAc")).toBe("0.275604 NVDAc")
    expect(formatTokenAmount(275_604_000_000_000_000n, "NVDAc", { decimals: 18 })).toBe("0.275604 NVDAc")
  })

  it("keeps every digit of large base-unit amounts", () => {
    expect(formatTokenAmount(123_456_789_012_345_678_901_234_567n, "NVDAc", { decimals: 18 })).toBe(
      "123,456,789.012346 NVDAc"
    )
  })

  it("handles negatives and dust", () => {
    expect(formatTokenAmount(-1_500_000n, "USDC", { decimals: 6 })).toBe("−1.50 USDC")
    expect(formatTokenAmount(1n, "USDC", { decimals: 6 })).toBe("0.00 USDC")
    expect(formatTokenAmount(-1n, "USDC", { decimals: 6 })).toBe("0.00 USDC")
  })
})

describe("dates and times", () => {
  it("formats the absolute form in UTC by default", () => {
    expect(formatDate(OPEN)).toBe("Mon 23 Nov, 14:30")
    expect(formatDate(OPEN, { zone: true })).toBe("Mon 23 Nov, 14:30 UTC")
    expect(formatDate(OPEN, { time: false })).toBe("Mon 23 Nov")
  })

  it("uses the time zone it is given, including the date line", () => {
    expect(formatDate(OPEN, { timeZone: "America/New_York", zone: true })).toBe("Mon 23 Nov, 09:30 New York")
    expect(formatDate(Date.UTC(2026, 10, 23, 2, 0), { timeZone: "America/New_York" })).toBe("Sun 22 Nov, 21:00")
  })

  it("uses 24-hour time with leading zeros", () => {
    expect(formatTime(Date.UTC(2026, 10, 23, 0, 5))).toBe("00:05")
    expect(formatTime(OPEN, { timeZone: "America/New_York", zone: true })).toBe("09:30 New York")
  })

  it("says market hours in New York time first", () => {
    expect(formatMarketTime(OPEN)).toBe("Mon 09:30 New York (14:30 UTC)")
    // Summer time: New York is four hours behind UTC.
    expect(formatMarketTime(Date.UTC(2026, 6, 13, 13, 30))).toBe("Mon 09:30 New York (13:30 UTC)")
  })
})

describe("formatRelative", () => {
  const ago = (seconds: number) => formatRelative(OPEN - seconds * 1000, OPEN)

  it("follows the kit's steps for the last day", () => {
    expect(ago(42)).toBe("Just now")
    expect(ago(120)).toBe("2 min ago")
    expect(ago(50)).toBe("1 min ago")
    expect(ago(3 * 3600)).toBe("3 h ago")
    expect(ago(30 * 3600)).toBe("Yesterday")
  })

  it("never says 60 min or 24 h", () => {
    expect(ago(3599)).toBe("59 min ago")
    expect(ago(86_399)).toBe("23 h ago")
  })

  it("switches to the absolute form after a day", () => {
    expect(ago(3 * 86_400)).toBe("Fri 20 Nov, 14:30")
  })

  it("treats a time slightly in the future as now", () => {
    expect(ago(-5)).toBe("Just now")
  })
})
