/** Whether the person has any activity at all, any kind and any time; `unknown` while that is still loading. */
export type History = "none" | "some" | "unknown"

/**
 * What an empty Activity list says. Someone with no activity at all is told where it will show, whatever the filter;
 * only someone with activity elsewhere is pointed at another type or period.
 */
export const emptyActivity = (
  history: History,
  filtered: boolean
): { readonly title: string; readonly description: string } => {
  if (history === "none") return { title: "No activity yet", description: "Your trades and withdrawals show up here." }
  if (filtered && history === "some") {
    return { title: "Nothing here yet", description: "Try another type or a longer period." }
  }
  return { title: "Nothing here yet", description: "Your trades and withdrawals show up here." }
}
