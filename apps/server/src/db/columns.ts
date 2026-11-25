import { customType } from "drizzle-orm/pg-core"
import * as DateTime from "effect/DateTime"
import { fromString, fromUUID, toUUID } from "typeid-js"

/**
 * A TypeID (`agent_01jd…`) stored as a native `uuid`: compact and indexable in Postgres, readable and type-tagged
 * everywhere else.
 */
export const typeId = <const Prefix extends string>(prefix: Prefix) =>
  customType<{ data: `${Prefix}_${string}`; driverData: string }>({
    dataType: () => "uuid",
    toDriver: (value) => toUUID(fromString(value, prefix)),
    fromDriver: (value) => fromUUID(value, prefix) as `${Prefix}_${string}`
  })

/** `timestamptz` read and written as Effect's `DateTime.Utc` (never the driver's string mode, which drops offsets). */
export const dateTimeUtc = customType<{ data: DateTime.Utc; driverData: Date | string }>({
  dataType: () => "timestamp with time zone",
  toDriver: (value) => DateTime.toDateUtc(value),
  fromDriver: (value) => DateTime.makeUnsafe(value)
})

/** Integer amounts in base units or micro-dollars as `numeric(78, 0)` ↔ `bigint` (exact beyond 2^53). */
export const units = customType<{ data: bigint; driverData: string }>({
  dataType: () => "numeric(78, 0)",
  toDriver: (value) => value.toString(),
  fromDriver: (value) => BigInt(value)
})
