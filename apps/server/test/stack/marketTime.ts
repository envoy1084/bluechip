// Prints the time the browser suite's chain runs at (ISO 8601): now, unless prices are paused (a weekend, a holiday)
// now or within two hours, then an hour after the market next opens. Prices follow the chain's clock, so every run
// trades on live prices whatever day it starts.
import * as DateTime from "effect/DateTime"
import { marketStatus } from "../../src/modules/market/Calendar.ts"

const now = DateTime.nowUnsafe()
const live = (at: DateTime.Utc) => marketStatus(at).session !== "paused"
const at = live(now) && live(DateTime.add(now, { hours: 2 }))
  ? now
  : DateTime.add(marketStatus(now).opensAt, { hours: 1 })

process.stdout.write(DateTime.formatIso(at))
