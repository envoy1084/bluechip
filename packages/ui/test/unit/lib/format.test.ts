import {
  formatChange,
  formatDate,
  formatMarketTime,
  formatMoney,
  formatPercent,
  formatRelative,
  formatShareCount,
  formatShares,
  formatTime,
  formatTokenAmount
} from "@bluechip/ui/lib/format"
import { assert, describe, it } from "@effect/vitest"

// Mon 23 Nov 2026, 14:30 UTC (09:30 in New York, the market open).
const OPEN = Date.UTC(2026, 10, 23, 14, 30)

describe("formatMoney", () => {
  it.each([
    { name: "dollars with commas and two decimals", value: 12_480.36, expected: "$12,480.36" },
    { name: "zero", value: 0, expected: "$0.00" },
    { name: "whole dollars", value: 5, expected: "$5.00" },
    { name: "a negative, with a true minus", value: -12, expected: "−$12.00" },
    { name: "half a cent rounds as its float does (1.005 is 1.00499…)", value: 1.005, expected: "$1.00" },
    { name: "a fraction of a cent rounds up to a dollar", value: 0.999, expected: "$1.00" },
    { name: "a negative that rounds to zero is plain zero", value: -0.004, expected: "$0.00" },
    { name: "every digit of a huge amount", value: 1_234_567_890.12, expected: "$1,234,567,890.12" }
  ])("$name", ({ expected, value }) => {
    assert.strictEqual(formatMoney(value), expected)
  })

  it.each([
    { name: "compact: millions", value: 1_240_000, expected: "$1.2M" },
    { name: "compact: exactly $10,000", value: 10_000, expected: "$10K" },
    { name: "compact: just under $10,000 stays in full", value: 9_999.5, expected: "$9,999.50" },
    { name: "compact: a negative million", value: -2_500_000, expected: "−$2.5M" },
    { name: "compact: exactly −$10,000", value: -10_000, expected: "−$10K" }
  ])("$name", ({ expected, value }) => {
    assert.strictEqual(formatMoney(value, { compact: true }), expected)
  })

  it.each([
    { name: "signed: a gain", value: 224.1, expected: "+$224.10" },
    { name: "signed: zero has no sign", value: 0, expected: "$0.00" },
    { name: "signed: a gain that rounds to zero has no sign", value: 0.004, expected: "$0.00" }
  ])("$name", ({ expected, value }) => {
    assert.strictEqual(formatMoney(value, { signed: true }), expected)
  })
})

describe("formatChange", () => {
  it.each([
    { name: "a gain", value: 224.1, expected: "+$224.10" },
    { name: "a loss", value: -3, expected: "−$3.00" },
    { name: "no change", value: 0, expected: "$0.00" }
  ])("$name", ({ expected, value }) => {
    assert.strictEqual(formatChange(value), expected)
  })
})

describe("formatPercent", () => {
  it.each([
    { name: "a rise", value: 1.82, expected: "+1.82%" },
    { name: "a fall, with a true minus", value: -0.62, expected: "−0.62%" },
    { name: "zero", value: 0, expected: "0.00%" },
    { name: "a rise that rounds to zero", value: 0.004, expected: "0.00%" },
    { name: "a rise that rounds up to a hundredth", value: 0.006, expected: "+0.01%" },
    { name: "a large percent, grouped", value: 1234.5, expected: "+1,234.50%" }
  ])("$name", ({ expected, value }) => {
    assert.strictEqual(formatPercent(value), expected)
  })

  it.each([
    { name: "arrow: a rise", value: 1.82, expected: "▲ 1.82%" },
    { name: "arrow: a fall", value: -0.62, expected: "▼ 0.62%" },
    { name: "arrow: zero has none", value: 0, expected: "0.00%" },
    { name: "arrow: a fall that rounds to zero has none", value: -0.004, expected: "0.00%" }
  ])("$name", ({ expected, value }) => {
    assert.strictEqual(formatPercent(value, { arrow: true }), expected)
  })
})

describe("formatShares", () => {
  it.each([
    { name: "a fraction, trailing zeros trimmed", value: 0.00412, expected: "0.00412" },
    { name: "one decimal", value: 12.5, expected: "12.5" },
    { name: "a whole number", value: 3, expected: "3" },
    { name: "zero", value: 0, expected: "0" },
    { name: "the smallest unit (8 decimals)", value: 0.00000001, expected: "0.00000001" },
    { name: "a ninth decimal rounds", value: 0.123456789, expected: "0.12345679" },
    { name: "under the smallest unit is zero", value: 0.000000004, expected: "0" },
    { name: "a negative, with a true minus", value: -0.5, expected: "−0.5" },
    { name: "a negative under the smallest unit is plain zero", value: -0.000000001, expected: "0" },
    { name: "thousands, grouped", value: 1234.5, expected: "1,234.5" }
  ])("$name", ({ expected, value }) => {
    assert.strictEqual(formatShares(value), expected)
  })
})

describe("formatShareCount", () => {
  it.each([
    { name: "one share is singular", value: 1, expected: "1 share" },
    { name: "a fraction is plural", value: 0.5, expected: "0.5 shares" },
    { name: "just over one is plural", value: 1.5, expected: "1.5 shares" },
    { name: "a ninth decimal over one rounds to one share", value: 1.000000001, expected: "1 share" },
    { name: "zero is plural", value: 0, expected: "0 shares" },
    { name: "a whole number past one", value: 12, expected: "12 shares" }
  ])("$name", ({ expected, value }) => {
    assert.strictEqual(formatShareCount(value), expected)
  })
})

describe("formatTokenAmount", () => {
  it.each<
    {
      name: string
      amount: number | bigint
      symbol: string
      options?: Parameters<typeof formatTokenAmount>[2]
      expected: string
    }
  >([
    { name: "cash with two decimals", amount: 500, symbol: "USDC", expected: "500.00 USDC" },
    {
      name: "cash from base units",
      amount: 500_000_000n,
      symbol: "USDC",
      options: { decimals: 6 },
      expected: "500.00 USDC"
    },
    { name: "a stock token to 6 decimals", amount: 0.2756041, symbol: "NVDAc", expected: "0.275604 NVDAc" },
    { name: "a stock token's trailing zeros trimmed", amount: 2.5, symbol: "NVDAc", expected: "2.5 NVDAc" },
    {
      name: "a stock token from base units, 18 decimals by default",
      amount: 275_604_000_000_000_000n,
      symbol: "NVDAc",
      expected: "0.275604 NVDAc"
    },
    {
      name: "every digit of a large base-unit amount",
      amount: 123_456_789_012_345_678_901_234_567n,
      symbol: "NVDAc",
      options: { decimals: 18 },
      expected: "123,456,789.012346 NVDAc"
    },
    {
      name: "base units with no decimals",
      amount: 1234n,
      symbol: "NVDAc",
      options: { decimals: 0 },
      expected: "1,234 NVDAc"
    },
    {
      name: "a negative from base units",
      amount: -1_500_000n,
      symbol: "USDC",
      options: { decimals: 6 },
      expected: "−1.50 USDC"
    },
    { name: "a negative number", amount: -0.5, symbol: "NVDAc", expected: "−0.5 NVDAc" },
    { name: "dust shows as zero", amount: 1n, symbol: "USDC", options: { decimals: 6 }, expected: "0.00 USDC" },
    {
      name: "negative dust shows as plain zero",
      amount: -1n,
      symbol: "USDC",
      options: { decimals: 6 },
      expected: "0.00 USDC"
    },
    {
      name: "fewer decimals asked for",
      amount: 0.2756041,
      symbol: "NVDAc",
      options: { maximumFractionDigits: 2 },
      expected: "0.28 NVDAc"
    },
    {
      name: "cash with no decimals asked for",
      amount: 500.4,
      symbol: "USDC",
      options: { maximumFractionDigits: 0 },
      expected: "500 USDC"
    }
  ])("$name", ({ amount, expected, options, symbol }) => {
    assert.strictEqual(formatTokenAmount(amount, symbol, options), expected)
  })
})

describe("formatDate", () => {
  it.each<{ name: string; date: number; options?: Parameters<typeof formatDate>[1]; expected: string }>([
    { name: "in UTC by default", date: OPEN, expected: "Mon 23 Nov, 14:30" },
    { name: "with the zone named", date: OPEN, options: { zone: true }, expected: "Mon 23 Nov, 14:30 UTC" },
    { name: "without the time", date: OPEN, options: { time: false }, expected: "Mon 23 Nov" },
    {
      name: "in New York, named",
      date: OPEN,
      options: { timeZone: "America/New_York", zone: true },
      expected: "Mon 23 Nov, 09:30 New York"
    },
    {
      name: "in New York, the day before UTC's",
      date: Date.UTC(2026, 10, 23, 2, 0),
      options: { timeZone: "America/New_York" },
      expected: "Sun 22 Nov, 21:00"
    },
    {
      name: "in a zone without a label, named by its id",
      date: OPEN,
      options: { timeZone: "Asia/Tokyo", zone: true },
      expected: "Mon 23 Nov, 23:30 Asia/Tokyo"
    }
  ])("$name", ({ date, expected, options }) => {
    assert.strictEqual(formatDate(date, options), expected)
  })

  it("accepts a Date", () => {
    assert.strictEqual(formatDate(new Date(OPEN)), "Mon 23 Nov, 14:30")
  })
})

describe("formatTime", () => {
  it.each<{ name: string; date: number; options?: Parameters<typeof formatTime>[1]; expected: string }>([
    { name: "24-hour time in UTC", date: OPEN, expected: "14:30" },
    { name: "a leading zero after midnight", date: Date.UTC(2026, 10, 23, 0, 5), expected: "00:05" },
    {
      name: "in New York, named",
      date: OPEN,
      options: { timeZone: "America/New_York", zone: true },
      expected: "09:30 New York"
    },
    { name: "in UTC, named", date: OPEN, options: { zone: true }, expected: "14:30 UTC" }
  ])("$name", ({ date, expected, options }) => {
    assert.strictEqual(formatTime(date, options), expected)
  })
})

describe("formatMarketTime", () => {
  it.each([
    { name: "New York first, UTC after, in winter", date: OPEN, expected: "Mon 09:30 New York (14:30 UTC)" },
    {
      name: "New York four hours behind UTC in summer",
      date: Date.UTC(2026, 6, 13, 13, 30),
      expected: "Mon 09:30 New York (13:30 UTC)"
    },
    {
      name: "New York's weekday when UTC is already the next day",
      date: Date.UTC(2026, 10, 24, 2, 0),
      expected: "Mon 21:00 New York (02:00 UTC)"
    }
  ])("$name", ({ date, expected }) => {
    assert.strictEqual(formatMarketTime(date), expected)
  })
})

describe("formatRelative", () => {
  it.each([
    { name: "5 seconds in the future: just now", seconds: -5, expected: "Just now" },
    { name: "44 seconds: just now", seconds: 44, expected: "Just now" },
    { name: "45 seconds: 1 min, never 0", seconds: 45, expected: "1 min ago" },
    { name: "2 minutes", seconds: 120, expected: "2 min ago" },
    { name: "a second under an hour: 59 min, never 60", seconds: 3599, expected: "59 min ago" },
    { name: "an hour", seconds: 3600, expected: "1 h ago" },
    { name: "3 hours", seconds: 3 * 3600, expected: "3 h ago" },
    { name: "a second under a day: 23 h, never 24", seconds: 86_399, expected: "23 h ago" },
    { name: "a day: yesterday", seconds: 86_400, expected: "Yesterday" },
    { name: "a second under two days: yesterday", seconds: 172_799, expected: "Yesterday" },
    { name: "two days: the absolute form", seconds: 172_800, expected: "Sat 21 Nov, 14:30" },
    { name: "three days: the absolute form", seconds: 3 * 86_400, expected: "Fri 20 Nov, 14:30" }
  ])("$name", ({ expected, seconds }) => {
    assert.strictEqual(formatRelative(OPEN - seconds * 1000, OPEN), expected)
  })

  it("says the absolute form in the time zone it is given", () => {
    assert.strictEqual(
      formatRelative(OPEN - 3 * 86_400_000, OPEN, { timeZone: "America/New_York" }),
      "Fri 20 Nov, 09:30"
    )
  })
})
