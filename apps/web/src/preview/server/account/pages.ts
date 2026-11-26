// A page of a list, newest first, as every list endpoint answers: its page token is how many items came before.
export const pageOf = <A>(
  items: ReadonlyArray<A>,
  query: { readonly pageSize: number; readonly pageToken: string | undefined }
): { readonly items: ReadonlyArray<A>; readonly nextPageToken: string | null } => {
  const start = query.pageToken === undefined ? 0 : Math.max(0, Number.parseInt(query.pageToken, 10) || 0)
  const end = start + query.pageSize
  return { items: items.slice(start, end), nextPageToken: end < items.length ? String(end) : null }
}
