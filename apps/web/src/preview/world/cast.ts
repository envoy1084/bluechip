// Who and what each preview scenario has: the account, its agents, automations and chats, by id. Every slice of the
// made-up world builds its records from this cast, so an intent, a notification and a chat all name the same agent.
import type { AgentId, AutomationId, ConversationId, UserId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { TemplateId } from "@bluechip/domain/policies/Templates"
import { previewId } from "./ids.ts"

export type ScenarioId = "newPerson" | "starter" | "typical" | "heavy"

/** The scenarios the panel offers. */
export const SCENARIOS: ReadonlyArray<
  { readonly id: ScenarioId; readonly label: string; readonly description: string }
> = [
  {
    id: "newPerson",
    label: "New person",
    description: "Just signed up: no money, agents, automations, chats or notifications. Every empty state."
  },
  {
    id: "starter",
    label: "Just started",
    description: "Signed up two days ago: $200 in, one agent, a first trade or two, a stop-loss that hasn't run yet."
  },
  {
    id: "typical",
    label: "Typical",
    description: "Some cash and stocks, three agents, a few automations and chats, one trade waiting for you."
  },
  {
    id: "heavy",
    label: "Heavy user",
    description: "A big portfolio, an agent in every state, many automations, long histories and chats, a recovery."
  }
]

/**
 * What an agent is doing in the preview, as its page shows it: the onchain status and pause, plus what usage and
 * intents make of it ("done for today" is an active agent whose budget is used up; "asking" has a trade waiting for you).
 */
export type CastAgentState =
  | "active"
  | "doneForToday"
  | "asking"
  | "paused"
  | "draft"
  | "locking"
  | "updating"
  | "removing"
  | "expired"
  | "removed"

export interface CastAgent {
  readonly id: AgentId
  readonly name: string
  readonly template: TemplateId
  readonly preset: "conservative" | "balanced" | "active"
  readonly stocks: ReadonlyArray<StockSymbol>
  /** A rebalancer's target mix in basis points, cash as `USDC`. */
  readonly targets: ReadonlyArray<{ readonly asset: StockSymbol | "USDC"; readonly weight: number }>
  readonly state: CastAgentState
  /** How many days ago it was created. */
  readonly ageDays: number
}

export interface CastAutomation {
  readonly id: AutomationId
  readonly name: string
  /** `null`: trades for you, through your Face ID. */
  readonly agentId: AgentId | null
  readonly kind: "weeklyBuy" | "stopLoss" | "rebalance" | "newsSell" | "priceAlert" | "monthlySplit"
  readonly state: "active" | "paused" | "done" | "failing"
  readonly asks: boolean
  /** How many days ago it was set up, for one newer than its kind's usual runs: it has only the runs since. */
  readonly ageDays?: number
}

export interface CastConversation {
  readonly id: ConversationId
  readonly title: string
  readonly agentId: AgentId | null
  /** Which cards and moments it shows, for the chat slice to build. */
  readonly kind: "welcome" | "buyIdea" | "newAgent" | "automationSetup" | "approval" | "research" | "longThread"
  readonly hoursAgo: number
}

export interface Cast {
  readonly scenario: ScenarioId
  readonly userId: UserId
  readonly displayName: string | null
  /** Cash in dollars, and shares held by stock. */
  readonly cash: number
  readonly holdings: ReadonlyArray<
    { readonly symbol: StockSymbol; readonly shares: number; readonly costPerShare: number }
  >
  readonly agents: ReadonlyArray<CastAgent>
  readonly automations: ReadonlyArray<CastAutomation>
  readonly conversations: ReadonlyArray<CastConversation>
}

export const USER_ID = previewId("user", 1) as UserId
export const ACCOUNT_ADDRESS = "0x5e1f0000000000000000000000000000000b1c4f" as const

const agentId = (n: number) => previewId("agent", n) as AgentId
const automationId = (n: number) => previewId("automation", n) as AutomationId
const conversationId = (n: number) => previewId("conversation", n) as ConversationId

const picker: CastAgent = {
  id: agentId(1),
  name: "Tech picker",
  template: "stockPicker",
  preset: "balanced",
  stocks: ["NVDA", "AAPL", "MSFT"],
  targets: [],
  state: "active",
  ageDays: 21
}
const weekly: CastAgent = {
  id: agentId(2),
  name: "Weekly buyer",
  template: "weeklyBuyer",
  preset: "conservative",
  stocks: ["AAPL"],
  targets: [],
  state: "doneForToday",
  ageDays: 14
}
const keeper: CastAgent = {
  id: agentId(3),
  name: "Index keeper",
  template: "rebalancer",
  preset: "balanced",
  stocks: ["AAPL", "MSFT", "NVDA", "AMZN"],
  targets: [
    { asset: "AAPL", weight: 2000 },
    { asset: "MSFT", weight: 2000 },
    { asset: "NVDA", weight: 2000 },
    { asset: "AMZN", weight: 2000 },
    { asset: "USDC", weight: 2000 }
  ],
  state: "asking",
  ageDays: 40
}

const typical: Cast = {
  scenario: "typical",
  userId: USER_ID,
  displayName: "Alex",
  cash: 2_480,
  holdings: [
    { symbol: "AAPL", shares: 4.2, costPerShare: 228 },
    { symbol: "NVDA", shares: 6.5, costPerShare: 131 },
    { symbol: "MSFT", shares: 1.1, costPerShare: 419 }
  ],
  agents: [picker, weekly, keeper],
  automations: [
    { id: automationId(1), name: "Weekly Apple", agentId: weekly.id, kind: "weeklyBuy", state: "active", asks: false },
    { id: automationId(2), name: "Keep the mix", agentId: keeper.id, kind: "rebalance", state: "active", asks: true },
    {
      id: automationId(3),
      name: "Nvidia stop-loss",
      agentId: picker.id,
      kind: "stopLoss",
      state: "paused",
      asks: false
    }
  ],
  conversations: [
    { id: conversationId(1), title: "Buy some Nvidia", agentId: picker.id, kind: "buyIdea", hoursAgo: 2 },
    { id: conversationId(2), title: "Set up a weekly buyer", agentId: null, kind: "newAgent", hoursAgo: 30 },
    { id: conversationId(3), title: "What is bluechip?", agentId: null, kind: "welcome", hoursAgo: 340 }
  ]
}

const heavy: Cast = {
  scenario: "heavy",
  userId: USER_ID,
  displayName: "Sam Rivera",
  cash: 18_240,
  holdings: [
    { symbol: "AAPL", shares: 38, costPerShare: 214 },
    { symbol: "NVDA", shares: 61, costPerShare: 118 },
    { symbol: "MSFT", shares: 14, costPerShare: 402 },
    { symbol: "AMZN", shares: 22, costPerShare: 188 },
    { symbol: "TSLA", shares: 9, costPerShare: 262 },
    { symbol: "META", shares: 7, costPerShare: 590 },
    { symbol: "GOOGL", shares: 25, costPerShare: 171 }
  ],
  agents: [
    picker,
    weekly,
    keeper,
    {
      id: agentId(4),
      name: "Tesla guard",
      template: "stopLossGuard",
      preset: "balanced",
      stocks: ["TSLA"],
      targets: [],
      state: "paused",
      ageDays: 60
    },
    {
      id: agentId(5),
      name: "Weekend rebalancer",
      template: "rebalancer",
      preset: "active",
      stocks: ["META", "GOOGL"],
      targets: [{ asset: "META", weight: 4000 }, { asset: "GOOGL", weight: 4000 }, { asset: "USDC", weight: 2000 }],
      state: "updating",
      ageDays: 33
    },
    {
      id: agentId(6),
      name: "Amazon idea",
      template: "stockPicker",
      preset: "conservative",
      stocks: ["AMZN"],
      targets: [],
      state: "draft",
      ageDays: 1
    },
    {
      id: agentId(7),
      name: "Old Microsoft buyer",
      template: "weeklyBuyer",
      preset: "balanced",
      stocks: ["MSFT"],
      targets: [],
      state: "expired",
      ageDays: 120
    },
    {
      id: agentId(8),
      name: "Fresh picker",
      template: "stockPicker",
      preset: "active",
      stocks: ["GOOGL", "META"],
      targets: [],
      state: "locking",
      ageDays: 0
    },
    {
      id: agentId(9),
      name: "Retired trader",
      template: "stockPicker",
      preset: "balanced",
      stocks: ["NVDA"],
      targets: [],
      state: "removed",
      ageDays: 200
    }
  ],
  automations: [
    { id: automationId(1), name: "Weekly Apple", agentId: weekly.id, kind: "weeklyBuy", state: "active", asks: false },
    { id: automationId(2), name: "Keep the mix", agentId: keeper.id, kind: "rebalance", state: "active", asks: true },
    {
      id: automationId(3),
      name: "Nvidia stop-loss",
      agentId: picker.id,
      kind: "stopLoss",
      state: "active",
      asks: false
    },
    {
      id: automationId(4),
      name: "Sell Tesla on bad news",
      agentId: agentId(4),
      kind: "newsSell",
      state: "paused",
      asks: true
    },
    { id: automationId(5), name: "Apple under $200", agentId: null, kind: "priceAlert", state: "active", asks: false },
    {
      id: automationId(6),
      name: "Monthly split buy",
      agentId: picker.id,
      kind: "monthlySplit",
      state: "failing",
      asks: false
    },
    { id: automationId(7), name: "One-off Meta buy", agentId: picker.id, kind: "weeklyBuy", state: "done", asks: false }
  ],
  conversations: [
    { id: conversationId(1), title: "Buy some Nvidia", agentId: picker.id, kind: "buyIdea", hoursAgo: 1 },
    { id: conversationId(2), title: "Set up a weekly buyer", agentId: null, kind: "newAgent", hoursAgo: 5 },
    { id: conversationId(3), title: "Protect my Tesla", agentId: agentId(4), kind: "automationSetup", hoursAgo: 26 },
    { id: conversationId(4), title: "Approve the rebalance", agentId: keeper.id, kind: "approval", hoursAgo: 50 },
    { id: conversationId(5), title: "How is Microsoft doing?", agentId: null, kind: "research", hoursAgo: 75 },
    { id: conversationId(6), title: "Planning my portfolio", agentId: null, kind: "longThread", hoursAgo: 150 },
    { id: conversationId(7), title: "What is bluechip?", agentId: null, kind: "welcome", hoursAgo: 900 }
  ]
}

const newPerson: Cast = {
  scenario: "newPerson",
  userId: USER_ID,
  displayName: null,
  cash: 0,
  holdings: [],
  agents: [],
  automations: [],
  conversations: []
}

// Signed up two days ago: a $200 deposit, a small Apple buy of their own, and yesterday's first agent, which bought
// some Nvidia and has a second buy waiting for gas.
const starter: Cast = {
  scenario: "starter",
  userId: USER_ID,
  displayName: "Jordan",
  cash: 150,
  holdings: [
    { symbol: "AAPL", shares: 0.105, costPerShare: 236.9 },
    { symbol: "NVDA", shares: 0.17, costPerShare: 146.2 }
  ],
  agents: [{
    id: agentId(1),
    name: "Tech picker",
    template: "stockPicker",
    preset: "conservative",
    stocks: ["NVDA", "MSFT"],
    targets: [],
    state: "active",
    ageDays: 1
  }],
  automations: [{
    id: automationId(1),
    name: "Nvidia stop-loss",
    agentId: agentId(1),
    kind: "stopLoss",
    state: "active",
    asks: false,
    ageDays: 0.3
  }],
  conversations: []
}

const CASTS: Readonly<Record<ScenarioId, Cast>> = { newPerson, starter, typical, heavy }

/** The cast of `scenario`. */
export const castOf = (scenario: ScenarioId): Cast => CASTS[scenario]
