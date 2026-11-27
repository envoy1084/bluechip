// Analytics and traces name a page by its route, never by the ids in its address: an id in a path would split one
// page into thousands and say which agent, automation or conversation someone opened.

// TypeIDs (`agent_01jd…`), UUIDs, hex (addresses, hashes) and plain numbers.
const ID_SEGMENT =
  /^(?:[a-z]+(?:_[a-z]+)*_[0-9a-z]{26}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|0x[0-9a-f]+|\d+)$/i

/** A page's path as its route says it: ids become `:id` and a stock's symbol `:symbol` (`/agents/:id/journal`). */
export const templatePath = (pathname: string): string =>
  pathname
    .split("/")
    .map((segment, index, segments) => {
      if (segments[index - 1] === "stocks" && segment !== "") return ":symbol"
      return ID_SEGMENT.test(segment) ? ":id" : segment
    })
    .join("/")

/**
 * A page's address with its path templated and its query kept only for campaign tags (`utm_*`): the rest can hold
 * ids and words someone typed (`/chat?ask=…`). `null` for anything that isn't an address on `origin`.
 */
export const templateUrl = (url: string, origin: string): string | null => {
  const parsed = URL.parse(url)
  if (parsed === null || parsed.origin !== origin) return null
  const campaign = new URLSearchParams([...parsed.searchParams].filter(([name]) => name.startsWith("utm_")))
  const query = campaign.size === 0 ? "" : `?${campaign.toString()}`
  return `${parsed.origin}${templatePath(parsed.pathname)}${query}`
}

/**
 * Where a stock's page was opened from, by the page before it (`stock_viewed`): home, a list of stocks (the market
 * or your holdings), an agent's page, or anywhere else, the assistant or a link (`search`).
 */
export const stockViewSource = (previousPathname: string | undefined): "home" | "list" | "agent" | "search" => {
  if (previousPathname === "/home") return "home"
  if (previousPathname === "/stocks" || previousPathname === "/portfolio") return "list"
  if (previousPathname?.startsWith("/agents/") === true) return "agent"
  return "search"
}
