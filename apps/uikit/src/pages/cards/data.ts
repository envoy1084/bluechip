/* ---------- Fixtures for the chat cards. Every name and number is an example. ---------- */

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Simulates a Face ID that passes after a moment, for the kit's buttons. Nothing is signed. */
export const faceId = () => wait(900)

/** Simulates a Face ID that's cancelled. */
export const cancelled = () => wait(700).then(() => Promise.reject(new Error("cancelled")))

export const PICKER_RULES = {
  can: [
    "Buy and sell Nvidia and Apple",
    "Spend up to $250 a day",
    "Trade up to $100 at a time, and ask you before anything bigger"
  ],
  never: ["Send money out of your account", "Put over 30% of your money in one stock"]
} as const

export const CHANGES = [
  { title: "Stocks and direction", change: "tighter" },
  { title: "Trade size", change: "looser" },
  { title: "Cash reserve", change: "added" },
  { title: "Weekly slippage", change: "removed" }
] as const

export const CITATIONS = [
  {
    url: "https://example.com/nvidia-q3",
    title: "Nvidia Q3: data center revenue rises",
    citedText: "Revenue rose 60% from a year ago, led by data center chips."
  },
  { url: "https://www.example.org/chip-makers", title: "", citedText: null },
  { url: "https://example.com/nvidia-q3", title: "Nvidia Q3: data center revenue rises", citedText: null }
] as const

export const ERRORS = [
  { reason: "Cancelled", icon: "stop", quiet: true, message: "You stopped this answer." },
  {
    reason: "Interrupted",
    icon: "bolt-off",
    quiet: true,
    message: "The connection dropped, so I stopped here. Ask again and I'll carry on."
  },
  {
    reason: "Budget",
    icon: "warning",
    quiet: false,
    message: "You've used today's assistant budget. It resets at midnight."
  },
  {
    reason: "Rounds",
    icon: "warning",
    quiet: false,
    message: "That took too many steps for one answer. Ask a smaller part of it."
  },
  {
    reason: "Unavailable",
    icon: "warning",
    quiet: false,
    message: "The assistant can't answer right now. Nothing was changed. Try again in a moment."
  }
] as const
