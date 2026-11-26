// The parts of the API the panel can slow down, hang or break, by the paths they answer.
export interface NetworkArea {
  readonly id: string
  readonly label: string
  readonly prefixes: ReadonlyArray<string>
}

export const NETWORK_AREAS: ReadonlyArray<NetworkArea> = [
  { id: "account", label: "Account and sign-in", prefixes: ["/api/account", "/api/auth", "/api/recovery"] },
  { id: "market", label: "Market and stocks", prefixes: ["/api/market"] },
  {
    id: "portfolio",
    label: "Portfolio and results",
    prefixes: ["/api/portfolio", "/api/performance", "/api/transfers"]
  },
  { id: "agents", label: "Agents", prefixes: ["/api/agents", "/api/policies", "/api/templates", "/api/sessions"] },
  { id: "intents", label: "Trades and approvals", prefixes: ["/api/intents", "/api/approvals", "/api/trades"] },
  { id: "automations", label: "Automations", prefixes: ["/api/automations"] },
  { id: "activity", label: "Activity and audit", prefixes: ["/api/activity", "/api/audit"] },
  { id: "assistant", label: "Assistant", prefixes: ["/api/assistant"] },
  { id: "notifications", label: "Notifications", prefixes: ["/api/notifications", "/api/push", "/api/channels"] }
]

/** The area a request path belongs to, if any. */
export const areaOf = (path: string): string | undefined =>
  NETWORK_AREAS.find((area) => area.prefixes.some((prefix) => path.startsWith(prefix)))?.id
