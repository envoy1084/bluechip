export const LIMITS: ReadonlyArray<readonly [string, string]> = [
  ["Stocks allowed", "NVDA · AAPL · MSFT"],
  ["Spend per day", "$250"],
  ["Max per trade", "$100"],
  ["Max in one stock", "25%"],
  ["Cash reserve", "$200"],
  ["Fair price check", "Within 1%"],
  ["Approval needed above", "$500"],
  ["Rebalance only", "Yes"]
]
export const COMMAND_GROUPS = [
  {
    value: "Suggestions",
    items: [
      {
        value: "create",
        label: "Create an agent",
        icon: "plus",
        shortcut: "⌘N",
        run: "Opening chat: “Create an agent that…”"
      },
      { value: "deposit", label: "Deposit cash", icon: "cash", run: "Opening deposit" },
      { value: "ask", label: "Ask about my portfolio", icon: "chat", run: "Opening chat" }
    ]
  },
  {
    value: "Stocks",
    items: [
      { value: "NVDA", label: "Nvidia", ticker: "NVDA", price: "$181.42", run: "Opening Nvidia" },
      { value: "AAPL", label: "Apple", ticker: "AAPL", price: "$241.18", run: "Opening Apple" },
      { value: "MSFT", label: "Microsoft", ticker: "MSFT", price: "$455.60", run: "Opening Microsoft" }
    ]
  },
  {
    value: "Agents",
    items: [
      { value: "rebalancer", label: "Rebalancer", icon: "scales", run: "Opening Rebalancer" },
      { value: "weekly-buyer", label: "Weekly buyer", icon: "calendar", run: "Opening Weekly buyer" }
    ]
  },
  {
    value: "Settings",
    items: [
      { value: "face-id", label: "Face ID & passkeys", icon: "face-id", run: "Opening Face ID settings" },
      { value: "pause", label: "Pause all agents", icon: "pause", shortcut: "⇧⌘P", run: "All agents paused" }
    ]
  }
] as const

export type CommandEntry = (typeof COMMAND_GROUPS)[number]["items"][number]
