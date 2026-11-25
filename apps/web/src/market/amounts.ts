import type { Shares, Usdc } from "@bluechip/domain/market/Units"

/*
 * The market API speaks integers: price is USD × 1e8 per share, USDC has 6 decimals, shares 8, and bps are
 * hundredths of a percent. These convert them for display (numbers are fine there, never for arithmetic on money) and
 * turn what someone typed into exact units.
 */

const PRICE_DECIMALS = 8
const USDC_DECIMALS = 6
const SHARE_DECIMALS = 8

const toNumber = (units: bigint, decimals: number) => Number(units) / 10 ** decimals

export const priceDollars = (price: bigint) => toNumber(price, PRICE_DECIMALS)
export const shareCount = (shares: bigint) => toNumber(shares, SHARE_DECIMALS)
export const bpsPercent = (bps: number) => bps / 100

/** A decimal typed by a person ("12.5", "1,000") as base units, or `null` when it is empty, malformed or zero. */
const parseUnits = (text: string, decimals: number): bigint | null => {
  const match = /^(\d*)(?:\.(\d*))?$/.exec(text.replace(/[,\s]/g, ""))
  if (match === null) return null
  const [, whole = "", fraction = ""] = match
  if (whole === "" && fraction === "") return null
  const digits = `${whole}${fraction.slice(0, decimals).padEnd(decimals, "0")}`
  return /^0*$/.test(digits) ? null : BigInt(digits)
}

export const parseUsdc = (text: string) => parseUnits(text, USDC_DECIMALS) as Usdc | null
export const parseShares = (text: string) => parseUnits(text, SHARE_DECIMALS) as Shares | null
