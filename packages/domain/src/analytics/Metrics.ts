/**
 * The metric catalogue: every metric the server exports to Axiom, its kind, unit and attributes. The server declares
 * its `Metric`s from these names, and the Axiom dashboards chart only metrics listed here. Attributes are low
 * cardinality: never a user, agent or intent id (those live on spans and PostHog events).
 *
 * @since 0.0.0
 */

/**
 * One metric: its OpenTelemetry name, kind, UCUM unit and attribute names (besides the resource's
 * `deployment.environment` and `network`).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface MetricInfo {
  readonly name: string
  readonly kind: "counter" | "histogram" | "gauge"
  readonly unit: string
  readonly attributes: ReadonlyArray<string>
}

const counter = (name: string, unit: string, attributes: ReadonlyArray<string> = []): MetricInfo => ({
  name,
  kind: "counter",
  unit,
  attributes
})

const histogram = (name: string, unit: string, attributes: ReadonlyArray<string> = []): MetricInfo => ({
  name,
  kind: "histogram",
  unit,
  attributes
})

const gauge = (name: string, unit: string, attributes: ReadonlyArray<string> = []): MetricInfo => ({
  name,
  kind: "gauge",
  unit,
  attributes
})

/**
 * Business metrics: trades, intents, money, people, agents, automations, the assistant and notifications.
 *
 * @stability unstable
 * @category catalog
 * @since 0.0.0
 */
export const BUSINESS_METRICS: ReadonlyArray<MetricInfo> = [
  counter("bluechip.trades.filled", "{trade}", ["side", "source", "executor", "symbol"]),
  counter("bluechip.trades.value", "USD", ["side", "source", "executor", "symbol"]),
  histogram("bluechip.trades.size", "USD", ["side", "source"]),
  counter("bluechip.trades.fees", "USD", ["kind", "gas_paid_by"]),
  histogram("bluechip.trades.slippage", "{bp}", ["side", "symbol"]),
  counter("bluechip.trades.failed", "{trade}", ["reason", "source"]),
  counter("bluechip.intents.created", "{intent}", ["source", "executor", "batched"]),
  counter("bluechip.intents.ended", "{intent}", ["outcome", "source", "executor"]),
  counter("bluechip.intents.blocked", "{intent}", ["policy", "source"]),
  counter("bluechip.intents.waited", "{wait}", ["reason"]),
  histogram("bluechip.intents.duration", "s", ["outcome", "source", "executor"]),
  gauge("bluechip.intents.open", "{intent}", ["status"]),
  counter("bluechip.approvals.requested", "{approval}", ["reason"]),
  counter("bluechip.approvals.resolved", "{approval}", ["outcome", "surface"]),
  histogram("bluechip.approvals.time_to_resolve", "s", ["outcome"]),
  counter("bluechip.batches.created", "{batch}", ["legs", "waves"]),
  counter("bluechip.batches.waves_sent", "{wave}", ["outcome"]),
  counter("bluechip.deposits", "{deposit}", ["network"]),
  counter("bluechip.deposits.value", "USD", ["network"]),
  counter("bluechip.withdrawals", "{withdrawal}", ["outcome"]),
  counter("bluechip.withdrawals.value", "USD", ["outcome"]),
  counter("bluechip.faucet.mints", "{mint}", ["outcome"]),
  counter("bluechip.faucet.value", "USD"),
  counter("bluechip.reconcile.unexplained", "{adjustment}", ["asset"]),
  counter("bluechip.users.signed_up", "{user}"),
  counter("bluechip.users.signed_in", "{sign_in}", ["method", "outcome"]),
  counter("bluechip.users.eligibility", "{answer}", ["answer"]),
  gauge("bluechip.users.active", "{user}", ["window"]),
  counter("bluechip.agents.created", "{agent}", ["template"]),
  counter("bluechip.agents.locked", "{agent}", ["template", "outcome"]),
  counter("bluechip.agents.lifecycle", "{change}", ["change"]),
  gauge("bluechip.agents.active", "{agent}", ["state"]),
  gauge("bluechip.agents.sessions_expiring", "{session}", ["within"]),
  counter("bluechip.automations.created", "{automation}", ["trigger", "action", "created_by"]),
  counter("bluechip.automations.runs", "{run}", ["trigger", "action", "outcome"]),
  counter("bluechip.automations.skipped", "{run}", ["condition"]),
  counter("bluechip.automations.judgments", "{judgment}", ["preset", "verdict"]),
  gauge("bluechip.automations.active", "{automation}", ["trigger"]),
  counter("bluechip.assistant.turns", "{turn}", ["surface", "outcome"]),
  counter("bluechip.assistant.tool_calls", "{call}", ["tool", "risk", "outcome"]),
  counter("bluechip.assistant.cards", "{card}", ["kind", "outcome"]),
  counter("bluechip.llm.tokens", "{token}", ["model", "feature", "kind"]),
  counter("bluechip.llm.cost", "USD", ["model", "feature"]),
  histogram("bluechip.llm.duration", "ms", ["model", "feature", "outcome"]),
  counter("bluechip.llm.errors", "{error}", ["model", "feature", "kind"]),
  counter("bluechip.llm.budget_exhausted", "{user_day}"),
  counter("bluechip.embeddings.calls", "{call}", ["model", "outcome"]),
  gauge("bluechip.embeddings.backlog", "{row}"),
  counter("bluechip.telegram.messages", "{message}", ["direction", "kind"]),
  counter("bluechip.channels.links", "{link}", ["platform", "change"]),
  counter("bluechip.notifications.created", "{notification}", ["kind", "severity"]),
  counter("bluechip.notifications.delivered", "{delivery}", ["channel", "kind", "outcome"]),
  histogram("bluechip.notifications.delay", "s", ["channel"]),
  counter("bluechip.push.subscriptions", "{subscription}", ["change"]),
  counter("bluechip.recovery", "{request}", ["change"]),
  counter("bluechip.passkeys", "{passkey}", ["change"]),
  counter("bluechip.devices.signed_out", "{device}", ["scope"])
]

/**
 * Operational metrics: HTTP, the database, the chain and bundler, the engine, crons, the market and paper's
 * operator.
 *
 * @stability unstable
 * @category catalog
 * @since 0.0.0
 */
export const OPERATIONAL_METRICS: ReadonlyArray<MetricInfo> = [
  histogram("http.server.request.duration", "ms", [
    "http.route",
    "http.request.method",
    "http.response.status_class",
    "error.type"
  ]),
  gauge("http.server.active_streams", "{stream}", ["http.route"]),
  counter("bluechip.rpc_proxy.calls", "{call}", ["rpc.method", "outcome"]),
  histogram("db.client.operation.duration", "ms", ["db.operation", "db.table"]),
  histogram("db.client.transaction.duration", "ms", ["outcome"]),
  gauge("db.client.connections", "{connection}", ["state"]),
  histogram("bluechip.chain.rpc.duration", "ms", ["operation", "outcome"]),
  counter("bluechip.chain.rpc.errors", "{error}", ["operation", "kind"]),
  counter("bluechip.bundler.calls", "{call}", ["rpc.method", "provider", "outcome", "error_code"]),
  histogram("bluechip.bundler.duration", "ms", ["rpc.method", "provider"]),
  histogram("bluechip.user_ops.latency", "s", ["kind", "executor"]),
  counter("bluechip.user_ops.outcome", "{op}", ["kind", "outcome"]),
  counter("bluechip.gas.sponsored", "ETH", ["kind", "provider"]),
  gauge("bluechip.gas.price", "gwei"),
  histogram("bluechip.engine.workflow.duration", "s", ["workflow", "outcome"]),
  counter("bluechip.engine.workflow.retries", "{retry}", ["workflow", "activity"]),
  gauge("bluechip.engine.backlog", "{message}", ["entity"]),
  gauge("bluechip.desk.queue", "{step}"),
  counter("bluechip.cron.runs", "{run}", ["cron", "outcome"]),
  histogram("bluechip.cron.lag", "s", ["cron"]),
  gauge("bluechip.outbox.pending", "{event}"),
  gauge("bluechip.outbox.age", "s"),
  gauge("bluechip.market.price_age", "s", ["source", "symbol"]),
  gauge("bluechip.market.feed_gap", "{bp}", ["symbol"]),
  counter("bluechip.market.stream_reconnects", "{reconnect}", ["stream"]),
  counter("bluechip.news.items", "{item}"),
  gauge("bluechip.paper.operator_balance", "ETH"),
  counter("bluechip.paper.feed_pushes", "{push}", ["outcome", "feeds"]),
  gauge("bluechip.paper.feed_age", "s", ["symbol"]),
  counter("bluechip.notifier.errors", "{error}", ["channel", "retryable"])
]

/**
 * Every metric, business first.
 *
 * @stability unstable
 * @category catalog
 * @since 0.0.0
 */
export const METRICS: ReadonlyArray<MetricInfo> = [...BUSINESS_METRICS, ...OPERATIONAL_METRICS]

/**
 * Attribute names a metric must never have: they would make one series per person or per object.
 *
 * @stability unstable
 * @category privacy
 * @since 0.0.0
 */
export const FORBIDDEN_METRIC_ATTRIBUTES: ReadonlyArray<string> = [
  "user.id",
  "user_id",
  "agent.id",
  "agent_id",
  "intent.id",
  "intent_id",
  "automation.id",
  "automation_id",
  "trade.id",
  "batch.id",
  "conversation.id",
  "trace_id"
]
