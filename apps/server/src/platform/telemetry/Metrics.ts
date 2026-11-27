import type { Executor, IntentSource } from "@bluechip/domain/intents/Intent"
import type * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Metric from "effect/Metric"

/**
 * One metric of the catalogue and the attribute names it is recorded with. Attributes are low cardinality: never an
 * id (those live on spans), so a dashboard reads a handful of series per metric.
 */
export interface Instrument<K extends string = string> {
  readonly name: string
  readonly kind: "counter" | "histogram" | "gauge"
  readonly unit: string
  readonly attributes: ReadonlyArray<K>
  readonly metric: Metric.Metric<number, unknown>
}

type Values<K extends string> = { readonly [Key in K]: string }

// OtlpMetrics reads a metric's unit from its `unit` attribute.
const counter = <const K extends string = never>(
  name: string,
  unit: string,
  description: string,
  attributes: ReadonlyArray<K> = []
): Instrument<K> => ({
  name,
  kind: "counter",
  unit,
  attributes,
  metric: Metric.counter(name, { description, attributes: { unit }, incremental: true })
})

const histogram = <const K extends string = never>(
  name: string,
  unit: string,
  description: string,
  boundaries: ReadonlyArray<number>,
  attributes: ReadonlyArray<K> = []
): Instrument<K> => ({
  name,
  kind: "histogram",
  unit,
  attributes,
  metric: Metric.histogram(name, { description, attributes: { unit }, boundaries })
})

const gauge = <const K extends string = never>(
  name: string,
  unit: string,
  description: string,
  attributes: ReadonlyArray<K> = []
): Instrument<K> => ({
  name,
  kind: "gauge",
  unit,
  attributes,
  metric: Metric.gauge(name, { description, attributes: { unit } })
})

/** Records `value` on `instrument` (adds to a counter, observes in a histogram, sets a gauge). */
export const record = <K extends string>(instrument: Instrument<K>, value: number, attributes: Values<K>) =>
  Metric.update(Metric.withAttributes(instrument.metric, attributes as Record<string, string>), value)

/** {@link record} outside an effect (the tracer), against the metric registry in `context`. */
export const recordUnsafe = <K extends string>(
  instrument: Instrument<K>,
  value: number,
  attributes: Values<K>,
  context: Context.Context<never>
) => Metric.withAttributes(instrument.metric, attributes as Record<string, string>).updateUnsafe(value, context)

/** Adds one to a counter. */
export const count = <K extends string>(instrument: Instrument<K>, attributes: Values<K>) =>
  record(instrument, 1, attributes)

/** Who asked, as the dashboards group it: you, an agent on its own, an automation, the assistant or Telegram. */
export const sourceOf = (source: IntentSource, executor: Executor): string => {
  switch (source) {
    case "owner":
      return executor === "agent" ? "agent" : "you"
    case "mcp":
      return "agent"
    case "channel":
      return "telegram"
    default:
      return source
  }
}

/** Why a model call failed, as the models' error metric groups it, from the error's tag and message. */
export const modelErrorKind = (error: unknown): "overloaded" | "rate_limited" | "timeout" | "invalid" | "other" => {
  const text = `${(error as { _tag?: unknown })?._tag ?? ""} ${error instanceof Error ? error.message : String(error)}`
  if (/overloaded|\b529\b/i.test(text)) return "overloaded"
  if (/rate.?limit|\b429\b/i.test(text)) return "rate_limited"
  if (/timeout|timed out/i.test(text)) return "timeout"
  if (/invalid|\b400\b/i.test(text)) return "invalid"
  return "other"
}

/** USDC's base units (6 decimals) in dollars. */
export const usd = (usdc: bigint) => Number(usdc) / 1e6

/** How long since `start`, in seconds. */
export const secondsSince = (start: DateTime.DateTime) =>
  Effect.map(DateTime.now, (now) => (now.epochMilliseconds - start.epochMilliseconds) / 1000)

// Business

export const TradesFilled = counter("bluechip.trades.filled", "{trade}", "Trades filled", [
  "side",
  "source",
  "executor",
  "symbol"
])
export const TradesValue = counter("bluechip.trades.value", "USD", "Dollars traded", [
  "side",
  "source",
  "executor",
  "symbol"
])
export const TradesSize = histogram(
  "bluechip.trades.size",
  "USD",
  "Size of each filled trade",
  [5, 10, 25, 50, 100, 250, 500, 1_000, 5_000, 10_000],
  ["side", "source"]
)
export const TradesFees = counter("bluechip.trades.fees", "USD", "What fills cost: the pool's fee and slippage", [
  "kind",
  "gas_paid_by"
])
export const TradesSlippage = histogram(
  "bluechip.trades.slippage",
  "{bp}",
  "A fill's price against its Chainlink reference",
  [1, 5, 10, 25, 50, 100, 200],
  ["side", "symbol"]
)
export const TradesFailed = counter("bluechip.trades.failed", "{trade}", "Trades sent that didn't fill", [
  "reason",
  "source"
])
export const IntentsCreated = counter("bluechip.intents.created", "{intent}", "Intents created", [
  "source",
  "executor",
  "batched"
])
export const IntentsEnded = counter("bluechip.intents.ended", "{intent}", "Intents ended, by how", [
  "outcome",
  "source",
  "executor"
])
export const IntentsBlocked = counter("bluechip.intents.blocked", "{intent}", "Intents a policy refused", [
  "policy",
  "source"
])
export const IntentsWaited = counter("bluechip.intents.waited", "{wait}", "Intents told to wait, by why", ["reason"])
export const IntentsDuration = histogram(
  "bluechip.intents.duration",
  "s",
  "From an intent's creation to its end",
  [1, 2, 5, 10, 30, 60, 300, 3_600, 86_400],
  ["outcome", "source", "executor"]
)
export const IntentsOpen = gauge("bluechip.intents.open", "{intent}", "Intents not ended, by status", ["status"])
export const ApprovalsRequested = counter("bluechip.approvals.requested", "{approval}", "Trades waiting for you", [
  "reason"
])
export const ApprovalsResolved = counter("bluechip.approvals.resolved", "{approval}", "Approvals that ended", [
  "outcome",
  "surface"
])
export const ApprovalsTimeToResolve = histogram(
  "bluechip.approvals.time_to_resolve",
  "s",
  "From asking you to your answer (or its expiry)",
  [10, 30, 60, 300, 900, 3_600, 21_600, 86_400],
  ["outcome"]
)
export const BatchesCreated = counter("bluechip.batches.created", "{batch}", "Plans of several trades", [
  "legs",
  "waves"
])
export const BatchesWavesSent = counter("bluechip.batches.waves_sent", "{wave}", "Waves of a plan sent or split", [
  "outcome"
])
export const Deposits = counter("bluechip.deposits", "{deposit}", "USDC deposits seen", ["network"])
export const DepositsValue = counter("bluechip.deposits.value", "USD", "Dollars deposited", ["network"])
export const Withdrawals = counter("bluechip.withdrawals", "{withdrawal}", "Withdrawals", ["outcome"])
export const WithdrawalsValue = counter("bluechip.withdrawals.value", "USD", "Dollars withdrawn", ["outcome"])
export const FaucetMints = counter("bluechip.faucet.mints", "{mint}", "Paper money faucet requests", ["outcome"])
export const FaucetValue = counter("bluechip.faucet.value", "USD", "Paper dollars minted")
export const ReconcileUnexplained = counter(
  "bluechip.reconcile.unexplained",
  "{adjustment}",
  "Balance changes the ledger can't explain",
  ["asset"]
)
export const UsersSignedUp = counter("bluechip.users.signed_up", "{user}", "Sign-ups")
export const UsersSignedIn = counter("bluechip.users.signed_in", "{sign_in}", "Sign-ins", ["method", "outcome"])
export const UsersEligibility = counter("bluechip.users.eligibility", "{answer}", "Eligibility answers", ["answer"])
export const UsersActive = gauge("bluechip.users.active", "{user}", "People with a session or an intent", ["window"])
export const AgentsCreated = counter("bluechip.agents.created", "{agent}", "Agents drafted", ["template"])
export const AgentsLocked = counter("bluechip.agents.locked", "{agent}", "Agents locked onchain", [
  "template",
  "outcome"
])
export const AgentsLifecycle = counter("bluechip.agents.lifecycle", "{change}", "Agents paused, resumed, removed…", [
  "change"
])
export const AgentsActive = gauge("bluechip.agents.active", "{agent}", "Agents by state", ["state"])
export const AgentsSessionsExpiring = gauge(
  "bluechip.agents.sessions_expiring",
  "{session}",
  "Agent sessions ending soon",
  ["within"]
)
export const AutomationsCreated = counter("bluechip.automations.created", "{automation}", "Automations created", [
  "trigger",
  "action",
  "created_by"
])
export const AutomationsRuns = counter("bluechip.automations.runs", "{run}", "Automation runs", [
  "trigger",
  "action",
  "outcome"
])
export const AutomationsSkipped = counter("bluechip.automations.skipped", "{run}", "Runs a condition stopped", [
  "condition"
])
export const AutomationsJudgments = counter("bluechip.automations.judgments", "{judgment}", "Model judgments", [
  "preset",
  "verdict"
])
export const AutomationsActive = gauge("bluechip.automations.active", "{automation}", "Active automations", [
  "trigger"
])
export const AssistantTurns = counter("bluechip.assistant.turns", "{turn}", "Assistant turns", ["surface", "outcome"])
export const AssistantToolCalls = counter("bluechip.assistant.tool_calls", "{call}", "Assistant tool calls", [
  "tool",
  "risk",
  "outcome"
])
export const AssistantCards = counter("bluechip.assistant.cards", "{card}", "Cards shown and answered", [
  "kind",
  "outcome"
])
export const LlmTokens = counter("bluechip.llm.tokens", "{token}", "Model tokens", ["model", "feature", "kind"])
export const LlmCost = counter("bluechip.llm.cost", "USD", "Model cost", ["model", "feature"])
export const LlmDuration = histogram(
  "bluechip.llm.duration",
  "ms",
  "Model call latency",
  [250, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 60_000],
  ["model", "feature", "outcome"]
)
export const LlmErrors = counter("bluechip.llm.errors", "{error}", "Model calls that failed", [
  "model",
  "feature",
  "kind"
])
export const LlmBudgetExhausted = counter(
  "bluechip.llm.budget_exhausted",
  "{user_day}",
  "People whose daily assistant budget ran out"
)
export const EmbeddingsCalls = counter("bluechip.embeddings.calls", "{call}", "Embedding calls", ["model", "outcome"])
export const EmbeddingsBacklog = gauge("bluechip.embeddings.backlog", "{row}", "Recall rows not embedded yet")
export const TelegramMessages = counter("bluechip.telegram.messages", "{message}", "Telegram messages", [
  "direction",
  "kind"
])
export const ChannelsLinks = counter("bluechip.channels.links", "{link}", "Chat accounts linked and unlinked", [
  "platform",
  "change"
])
export const NotificationsCreated = counter(
  "bluechip.notifications.created",
  "{notification}",
  "Notifications created",
  ["kind", "severity"]
)
export const NotificationsDelivered = counter(
  "bluechip.notifications.delivered",
  "{delivery}",
  "Notification deliveries",
  ["channel", "kind", "outcome"]
)
export const NotificationsDelay = histogram(
  "bluechip.notifications.delay",
  "s",
  "From a notification to its delivery",
  [1, 5, 30, 60, 300, 3_600],
  ["channel"]
)
export const PushSubscriptions = counter("bluechip.push.subscriptions", "{subscription}", "Push subscriptions", [
  "change"
])
export const Recovery = counter("bluechip.recovery", "{request}", "Recovery keys and requests", ["change"])
export const Passkeys = counter("bluechip.passkeys", "{passkey}", "Passkeys added and removed", ["change"])
export const DevicesSignedOut = counter("bluechip.devices.signed_out", "{device}", "Devices signed out", ["scope"])

// Operational

export const HttpServerDuration = histogram(
  "http.server.request.duration",
  "ms",
  "HTTP request duration",
  [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000],
  ["http.route", "http.request.method", "http.response.status_class", "error.type"]
)
export const HttpActiveStreams = gauge("http.server.active_streams", "{stream}", "Open live event streams", [
  "http.route"
])
export const RpcProxyCalls = counter("bluechip.rpc_proxy.calls", "{call}", "The web app's chain reads", [
  "rpc.method",
  "outcome"
])
export const DbOperationDuration = histogram(
  "db.client.operation.duration",
  "ms",
  "SQL statement duration",
  [1, 2, 5, 10, 25, 50, 100, 250, 1_000],
  ["db.operation", "db.table"]
)
export const DbTransactionDuration = histogram(
  "db.client.transaction.duration",
  "ms",
  "SQL transaction duration",
  [1, 2, 5, 10, 25, 50, 100, 250, 1_000],
  ["outcome"]
)
export const DbConnections = gauge("db.client.connections", "{connection}", "Database connections", ["state"])
export const UserOpsLatency = histogram(
  "bluechip.user_ops.latency",
  "s",
  "From sending a user operation to its receipt",
  [1, 2, 4, 8, 15, 30, 60, 120],
  ["kind", "executor"]
)
export const UserOpsOutcome = counter("bluechip.user_ops.outcome", "{op}", "How user operations ended", [
  "kind",
  "outcome"
])
export const GasSponsored = counter("bluechip.gas.sponsored", "ETH", "Gas a sponsor paid", ["kind", "provider"])
export const GasPrice = gauge("bluechip.gas.price", "gwei", "Base's gas price")
export const WorkflowDuration = histogram(
  "bluechip.engine.workflow.duration",
  "s",
  "Workflow run duration",
  [0.1, 0.5, 1, 2, 5, 10, 30, 60, 300],
  ["workflow", "outcome"]
)
export const WorkflowRetries = counter("bluechip.engine.workflow.retries", "{retry}", "Activities tried again", [
  "workflow",
  "activity"
])
export const EngineBacklog = gauge("bluechip.engine.backlog", "{message}", "Engine messages not processed", ["entity"])
export const DeskQueue = gauge("bluechip.desk.queue", "{step}", "Desk steps waiting across accounts")
export const CronRuns = counter("bluechip.cron.runs", "{run}", "Cron runs", ["cron", "outcome"])
export const CronLag = histogram("bluechip.cron.lag", "s", "From a cron's time to its start", [1, 5, 30, 60, 300], [
  "cron"
])
export const OutboxPending = gauge("bluechip.outbox.pending", "{event}", "Outbox events not handled")
export const OutboxAge = gauge("bluechip.outbox.age", "s", "Age of the oldest outbox event")
export const MarketPriceAge = gauge("bluechip.market.price_age", "s", "Seconds since the newest price", [
  "source",
  "symbol"
])
export const MarketFeedGap = gauge("bluechip.market.feed_gap", "{bp}", "Alpaca and Chainlink apart", ["symbol"])
export const MarketStreamReconnects = counter(
  "bluechip.market.stream_reconnects",
  "{reconnect}",
  "Alpaca stream reconnects",
  ["stream"]
)
export const NewsItems = counter("bluechip.news.items", "{item}", "News items read")
export const PaperOperatorBalance = gauge("bluechip.paper.operator_balance", "ETH", "Paper operator's ETH")
export const PaperFeedPushes = counter("bluechip.paper.feed_pushes", "{push}", "Paper price feed pushes", [
  "outcome",
  "feeds"
])
export const PaperFeedAge = gauge("bluechip.paper.feed_age", "s", "Age of a paper feed's round", ["symbol"])
export const NotifierErrors = counter("bluechip.notifier.errors", "{error}", "Notifier failures", [
  "channel",
  "retryable"
])

/** What a user operation is for, as its latency and outcome are counted. */
export type UserOpKind = "trade" | "owner_change" | "agent_install" | "recovery" | "withdrawal"

/**
 * Counts how a user operation followed from its send ended (`included`, `reverted`, or `timeout` without a receipt),
 * its latency, and the gas a sponsor paid for it.
 */
export const recordUserOp = Effect.fnUntraced(function*(options: {
  readonly kind: UserOpKind
  readonly executor: "agent" | "owner"
  readonly provider: string
  readonly seconds: number
  readonly receipt:
    | { readonly success: boolean; readonly gas: { readonly wei: bigint; readonly paidBy: string } }
    | undefined
}) {
  const outcome = options.receipt === undefined ? "timeout" : options.receipt.success ? "included" : "reverted"
  yield* count(UserOpsOutcome, { kind: options.kind, outcome })
  if (options.receipt === undefined) return
  yield* record(UserOpsLatency, options.seconds, { kind: options.kind, executor: options.executor })
  if (options.receipt.gas.paidBy === "sponsor") {
    yield* record(GasSponsored, Number(options.receipt.gas.wei) / 1e18, {
      kind: options.kind,
      provider: options.provider
    })
  }
})
