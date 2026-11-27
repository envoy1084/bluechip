import * as Cause from "effect/Cause"
import type * as Context from "effect/Context"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import * as Tracer from "effect/Tracer"
import { DbOperationDuration, DbTransactionDuration, recordUnsafe } from "./Metrics.ts"

/** How the tracer trims and samples, and where it records the database's metrics. */
export interface BluechipTracerOptions {
  /** The share (0 to 1) of `GET` requests traced; every other request, workflow and background run is. */
  readonly sampleReads: number
  /**
   * Background runs that may find nothing to do: their descendants wait for them, and a run that ends with
   * `bluechip.idle` set (and no error) is dropped with them.
   */
  readonly ticks: ReadonlySet<string>
  /** The metric registry's context, for `db.client.*` (every statement, kept or not). */
  readonly context: Context.Context<never>
  readonly random?: (() => number) | undefined
}

// A statement under this many milliseconds, that worked, shows only in its parent's `db.statements` and `db.time_ms`.
const FAST_STATEMENT_MS = 2
// `BEGIN` and `COMMIT` that worked and took less than this add nothing the `sql.transaction` span doesn't say.
const FAST_CONTROL_MS = 20
// A tick that buffers more than this lets its spans go out as they end.
const MAX_BUFFERED = 1_000

const STATEMENT_TARGETS: ReadonlyArray<readonly [operation: string, target: RegExp]> = [
  ["select", /\bfrom\s+"?([\w]+)"?(?:\."?([\w]+)"?)?/i],
  ["insert", /^\s*insert\s+into\s+"?([\w]+)"?(?:\."?([\w]+)"?)?/i],
  ["update", /^\s*update\s+"?([\w]+)"?(?:\."?([\w]+)"?)?/i],
  ["delete", /^\s*delete\s+from\s+"?([\w]+)"?(?:\."?([\w]+)"?)?/i]
]

/**
 * What a SQL statement does and to which table, read from its text (`select … from "intents"` is `select` on
 * `intents`); `other` on `unknown` when it doesn't say.
 */
export const statementOf = (text: string): { readonly operation: string; readonly table: string } => {
  const operation = /^\s*(\w+)/.exec(text)?.[1]?.toLowerCase()
  const known = STATEMENT_TARGETS.find(([name]) => name === operation)
  if (known === undefined) return { operation: "other", table: "unknown" }
  const match = known[1].exec(text)
  if (match === null) return { operation: known[0], table: "unknown" }
  return { operation: known[0], table: match[2] ?? match[1]! }
}

class TrimmedSpan implements Tracer.Span {
  readonly _tag = "Span"
  readonly name: string
  readonly parent: Option.Option<Tracer.AnySpan>
  readonly annotations: Context.Context<never>
  readonly links: Array<Tracer.SpanLink>
  readonly kind: Tracer.SpanKind
  readonly sampled: boolean
  readonly startTime: bigint
  readonly root: boolean
  status: Tracer.SpanStatus

  readonly local: TrimmedSpan | undefined
  readonly tick: TrimmedSpan | undefined
  readonly #tracer: Tracer.Tracer
  readonly #options: BluechipTracerOptions
  readonly #attributes = new Map<string, unknown>()
  readonly #events: Array<[name: string, startTime: bigint, attributes: Record<string, unknown> | undefined]> = []
  #inner: Tracer.Span | undefined
  buffer: Array<() => void> | undefined
  children = 0
  statements = 0
  statementMs = 0

  constructor(
    tracer: Tracer.Tracer,
    options: Parameters<Tracer.Tracer["span"]>[0],
    sampled: boolean,
    trimOptions: BluechipTracerOptions
  ) {
    this.#tracer = tracer
    this.#options = trimOptions
    this.name = options.name
    this.parent = options.parent
    this.annotations = options.annotations
    this.links = options.links
    this.kind = options.kind
    this.sampled = sampled
    this.startTime = options.startTime
    this.root = options.root
    this.status = { _tag: "Started", startTime: options.startTime }

    const parent = Option.getOrUndefined(options.parent)
    this.local = parent instanceof TrimmedSpan ? parent : undefined
    if (this.local !== undefined) this.local.children++
    this.tick = this.local?.tick ?? (trimOptions.ticks.has(options.name) ? this : undefined)
    if (this.tick === this) this.buffer = []
    // Client spans (SQL statements, HTTP and chain calls) are made when they end, so a dropped one costs nothing and
    // a kept statement goes out under its own name; anything that needs one's ids makes it earlier.
    if (this.kind !== "client") this.#materialize(this.name)
  }

  get spanId(): string {
    return this.#materialize(this.name).spanId
  }

  get traceId(): string {
    return this.#materialize(this.name).traceId
  }

  get attributes(): ReadonlyMap<string, unknown> {
    return this.#attributes
  }

  attribute(key: string, value: unknown): void {
    if (this.status._tag === "Ended") return
    this.#attributes.set(key, value)
    this.#inner?.attribute(key, value)
  }

  event(name: string, startTime: bigint, attributes?: Record<string, unknown>): void {
    if (this.status._tag === "Ended") return
    if (this.#inner === undefined) this.#events.push([name, startTime, attributes])
    else this.#inner.event(name, startTime, attributes)
  }

  addLinks(links: ReadonlyArray<Tracer.SpanLink>): void {
    if (this.status._tag === "Ended") return
    // oxlint-disable-next-line no-restricted-syntax
    this.links.push(...links)
    this.#inner?.addLinks(links)
  }

  end(endTime: bigint, exit: Exit.Exit<unknown, unknown>): void {
    if (this.status._tag === "Ended") return
    this.status = { _tag: "Ended", startTime: this.startTime, endTime, exit }
    const ms = Number(endTime - this.startTime) / 1e6
    const failed = Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)

    let name = this.name
    let keep = true
    const text = this.#attributes.get("db.query.text")
    const control = this.#attributes.get("db.operation.name")
    if (this.name === "sql.transaction") {
      recordUnsafe(
        DbTransactionDuration,
        ms,
        { outcome: Exit.isSuccess(exit) ? "commit" : "rollback" },
        this.#options.context
      )
    } else if (this.kind === "client" && typeof control === "string" && typeof text !== "string") {
      keep = failed || ms >= FAST_CONTROL_MS || !/^(BEGIN|COMMIT)\b/i.test(control)
    } else if (this.kind === "client" && typeof text === "string") {
      const { operation, table } = statementOf(text)
      recordUnsafe(DbOperationDuration, ms, { "db.operation": operation, "db.table": table }, this.#options.context)
      if (this.local !== undefined) {
        this.local.statements++
        this.local.statementMs += ms
      }
      keep = failed || ms >= FAST_STATEMENT_MS || this.children > 0
      if (table !== "unknown") name = `${operation} ${table}`
    }

    if (!keep) return
    const inner = this.#materialize(name)
    if (this.statements > 0) {
      inner.attribute("db.statements", this.statements)
      inner.attribute("db.time_ms", Math.round(this.statementMs * 100) / 100)
    }
    const emit = () => inner.end(endTime, exit)

    if (this.tick === this) {
      const buffered = this.buffer!
      this.buffer = undefined
      if (this.#attributes.get("bluechip.idle") === true && !failed) return
      for (const each of buffered) each()
      return emit()
    }
    const buffer = this.tick?.buffer
    if (buffer !== undefined && buffer.length < MAX_BUFFERED) return void buffer.push(emit)
    emit()
  }

  #materialize(name: string): Tracer.Span {
    if (this.#inner !== undefined) return this.#inner
    const inner = this.#tracer.span({
      name,
      parent: this.parent,
      annotations: this.annotations,
      links: this.links,
      startTime: this.startTime,
      kind: this.kind,
      root: this.root,
      sampled: this.sampled
    })
    for (const [key, value] of this.#attributes) inner.attribute(key, value)
    for (const [event, startTime, attributes] of this.#events) inner.event(event, startTime, attributes)
    this.#events.length = 0
    this.#inner = inner
    return inner
  }
}

/**
 * bluechip's tracer around another (`OtlpTracer` in production), so a trace reads as what happened rather than as
 * every query:
 *
 * - `BEGIN` and `COMMIT` that worked in under 20 ms are dropped (the `sql.transaction` span shows the time);
 * - statements that worked in under 2 ms with no children are dropped; their parent counts every statement under it
 *   (`db.statements`) and their time (`db.time_ms`);
 * - kept statements are named for what they do (`select intents`, `insert audit_events`);
 * - every statement and transaction is measured (`db.client.operation.duration`, `db.client.transaction.duration`);
 * - a trace started here by a `GET` request is kept with probability `sampleReads` (every other root is kept; a
 *   trace continued from elsewhere keeps its sampling, except a write the browser left unsampled, which is kept: the
 *   browser samples tabs, but trades and other writes are always traced);
 * - a tick (`ticks`) marked `bluechip.idle` that ended without an error is dropped whole.
 */
export const make = (inner: Tracer.Tracer, options: BluechipTracerOptions): Tracer.Tracer => {
  const random = options.random ?? Math.random
  return Tracer.make({
    span(spanOptions) {
      const server = spanOptions.kind === "server"
      const read = Option.isNone(spanOptions.parent) && server && spanOptions.name.startsWith("GET ")
      const unsampledWrite = server && !spanOptions.name.startsWith("GET ") &&
        Option.isSome(spanOptions.parent) && spanOptions.parent.value._tag === "ExternalSpan" &&
        !spanOptions.parent.value.sampled
      const sampled = unsampledWrite || (spanOptions.sampled && (!read || random() < options.sampleReads))
      return new TrimmedSpan(inner, spanOptions, sampled, options)
    },
    ...(inner.context === undefined ? {} : { context: inner.context })
  })
}
