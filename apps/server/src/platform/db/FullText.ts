import { type AnyColumn, type SQL, sql } from "drizzle-orm"

/**
 * Full-text search for any of a query's words (Postgres's English configuration, so "savings" finds "saving"), for
 * recall and knowledge: `matches` filters the rows with at least one word, and `rank` orders them by how many of the
 * query's words they have, then by Postgres's own rank. Counting the words matched keeps a row that mentions a common
 * word many times ("trade") under one that has the rarer words asked for ("NVIDIA", "pool"). `undefined` when the
 * query has no words.
 */
export const fullTextQuery = (
  column: AnyColumn,
  text: string
): { readonly matches: SQL; readonly rank: SQL } | undefined => {
  const words = [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].slice(0, 32)
  if (words.length === 0) return undefined

  const any = sql`to_tsquery('english', ${words.join(" | ")})`
  const matched = sql.join(
    words.map((word) => sql`(${column} @@ plainto_tsquery('english', ${word}))::int`),
    sql` + `
  )
  return {
    matches: sql`${column} @@ ${any}`,
    rank: sql`(${matched}) * 1000 + ts_rank_cd(${column}, ${any})`
  }
}
