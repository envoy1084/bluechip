// Frames of Alpaca's news stream (`wss://stream.data.alpaca.markets/v1beta1/news`), in the shape its documentation
// shows them (docs.alpaca.markets, "Real-time News"): confirmations, a story, and errors.

export const CONNECTED = `[{"T":"success","msg":"connected"}]`

export const AUTHENTICATED = `[{"T":"success","msg":"authenticated"}]`

export const SUBSCRIBED = `[{"T":"subscription","news":["NVDA","AAPL"]}]`

export const STORY = JSON.stringify([{
  T: "n",
  id: 24918784,
  headline: "NVIDIA Lowers Its Fourth-Quarter Guidance",
  summary: "The chipmaker now expects revenue below analysts' estimates.",
  author: "Benzinga Newsdesk",
  created_at: "2026-11-26T14:31:10Z",
  updated_at: "2026-11-26T14:31:11Z",
  url: "https://www.benzinga.com/news/26/11/24918784/nvidia-lowers-guidance",
  content: "<p>NVIDIA lowered its guidance…</p>",
  symbols: ["NVDA"],
  source: "benzinga"
}])

/** Two stories in one frame, the second without a url. */
export const TWO_STORIES = JSON.stringify([
  {
    T: "n",
    id: 24918790,
    headline: "Apple Opens A New Plant",
    summary: "",
    author: "Benzinga Newsdesk",
    created_at: "2026-11-26T14:40:00Z",
    updated_at: "2026-11-26T14:40:00Z",
    url: "https://www.benzinga.com/news/26/11/24918790/apple-plant",
    content: "",
    symbols: ["AAPL"],
    source: "benzinga"
  },
  {
    T: "n",
    id: 24918791,
    headline: "Chip Stocks Rally",
    summary: "Semiconductors lead the market.",
    author: "Benzinga Newsdesk",
    created_at: "2026-11-26T14:41:00Z",
    updated_at: "2026-11-26T14:41:00Z",
    url: null,
    content: "",
    symbols: ["NVDA", "INTC"],
    source: "benzinga"
  }
])

export const CONNECTION_LIMIT = `[{"T":"error","code":406,"msg":"connection limit exceeded"}]`

export const AUTH_FAILED = `[{"T":"error","code":402,"msg":"auth failed"}]`

export const NOT_IN_PLAN = `[{"T":"error","code":409,"msg":"insufficient subscription"}]`

export const INTERNAL_ERROR = `[{"T":"error","code":500,"msg":"internal error"}]`
