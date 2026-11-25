/**
 * Cursor pagination for list endpoints (AIP-158): ask for a page size, follow `nextPageToken` until it is `null`.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"

/**
 * Query parameters of every list endpoint.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const PageQuery = {
  pageSize: Schema.optionalKey(
    Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 }))
  ),
  pageToken: Schema.optionalKey(Schema.String)
}

/**
 * One page of `item`s; `nextPageToken` is `null` on the last page.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Page = <S extends Schema.Top>(item: S) =>
  Schema.Struct({ items: Schema.Array(item), nextPageToken: Schema.NullOr(Schema.String) })
