import { assert, describe, it } from "@effect/vitest"
import * as Cause from "effect/Cause"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import * as Tracer from "effect/Tracer"
import * as BluechipTracer from "../../../../src/platform/telemetry/BluechipTracer.ts"
import { ms, spanRecorder as setup } from "../../../utils/SpanRecorder.ts"

const statement = (text: string) => ({ "db.query.text": text, "db.system.name": "postgresql" })
const control = (operation: string) => ({ "db.operation.name": operation, "db.system.name": "postgresql" })
const failure = Exit.failCause(Cause.fail("boom"))

describe("BluechipTracer", () => {
  describe("SQL statements", () => {
    it("a statement under 2 ms is dropped and counted on its parent", () => {
      const { exported, names, start } = setup()
      const parent = start("IntentStore.find")

      start("bluechip", parent, "client", statement(`select "id" from "intents" where "id" = $1`)).end(
        ms(1.5),
        Exit.void
      )
      parent.end(ms(3), Exit.void)

      assert.deepStrictEqual(names(), ["IntentStore.find"])
      assert.deepStrictEqual(
        [exported[0]!.attributes.get("db.statements"), exported[0]!.attributes.get("db.time_ms")],
        [1, 1.5]
      )
    })

    it("a statement of 2 ms is kept, named for its operation and table", () => {
      const { names, start } = setup()
      const parent = start("IntentStore.find")

      start("bluechip", parent, "client", statement(`select "id" from "intents" where "id" = $1`)).end(ms(2), Exit.void)
      parent.end(ms(3), Exit.void)

      assert.deepStrictEqual(names(), ["select intents", "IntentStore.find"])
    })

    it("a fast statement that failed is kept", () => {
      const { names, start } = setup()
      const parent = start("AuditLog.record")

      start("bluechip", parent, "client", statement(`insert into "audit_events" ("id") values ($1)`)).end(
        ms(0.4),
        failure
      )
      parent.end(ms(1), failure)

      assert.deepStrictEqual(names(), ["insert audit_events", "AuditLog.record"])
    })

    it("a fast BEGIN and COMMIT are dropped; a slow COMMIT is kept", () => {
      const { names, start } = setup()
      const transaction = start("sql.transaction")

      start("BEGIN bluechip", transaction, "client", control("BEGIN")).end(ms(1), Exit.void)
      start("COMMIT bluechip", transaction, "client", control("COMMIT")).end(ms(20), Exit.void)
      transaction.end(ms(25), Exit.void)

      assert.deepStrictEqual(names(), ["COMMIT bluechip", "sql.transaction"])
    })
  })

  describe("statementOf", () => {
    it.each([
      [`select "a" from "intents" where "id" = $1`, { operation: "select", table: "intents" }],
      [`insert into "audit_events" ("id") values ($1)`, { operation: "insert", table: "audit_events" }],
      [`update "trades" set "status" = $1`, { operation: "update", table: "trades" }],
      [`delete from "drizzle"."sessions" where 1 = 1`, { operation: "delete", table: "sessions" }],
      [`with x as (select 1) select * from x`, { operation: "other", table: "unknown" }],
      [`select 1`, { operation: "select", table: "unknown" }]
    ])("%s", (text, expected) => {
      assert.deepStrictEqual(BluechipTracer.statementOf(text), expected)
    })
  })

  describe("sampling", () => {
    it("a GET request is dropped above the share of reads traced", () => {
      const { names, start } = setup({ sampleReads: 0.2, random: 0.5 })

      start("GET /api/portfolio", undefined, "server").end(ms(5), Exit.void)

      assert.deepStrictEqual(names(), [])
    })

    it("a GET request is kept within the share of reads traced", () => {
      const { names, start } = setup({ sampleReads: 0.2, random: 0.1 })

      start("GET /api/portfolio", undefined, "server").end(ms(5), Exit.void)

      assert.deepStrictEqual(names(), ["GET /api/portfolio"])
    })

    it("a POST request is always kept", () => {
      const { names, start } = setup({ sampleReads: 0, random: 0.9 })

      start("POST /api/intents", undefined, "server").end(ms(5), Exit.void)

      assert.deepStrictEqual(names(), ["POST /api/intents"])
    })

    it("a GET continued from the browser keeps the browser's sampling", () => {
      const { names, start } = setup({ sampleReads: 0, random: 0.9 })
      const browser = Tracer.externalSpan({ traceId: "a".repeat(32), spanId: "b".repeat(16), sampled: true })

      start("GET /api/portfolio", browser, "server").end(ms(5), Exit.void)

      assert.deepStrictEqual(names(), ["GET /api/portfolio"])
    })

    it("a GET the browser left unsampled is dropped", () => {
      const { names, start } = setup({ sampleReads: 1, random: 0 })
      const browser = Tracer.externalSpan({ traceId: "a".repeat(32), spanId: "b".repeat(16), sampled: false })

      start("GET /api/portfolio", browser, "server").end(ms(5), Exit.void)

      assert.deepStrictEqual(names(), [])
    })

    it("a POST the browser left unsampled is still kept", () => {
      const { names, start } = setup({ sampleReads: 0, random: 0.9 })
      const browser = Tracer.externalSpan({ traceId: "a".repeat(32), spanId: "b".repeat(16), sampled: false })

      start("POST /api/intents", browser, "server").end(ms(5), Exit.void)

      assert.deepStrictEqual(names(), ["POST /api/intents"])
    })
  })

  describe("ticks", () => {
    it("an idle tick is dropped with everything under it", () => {
      const { names, start } = setup()
      const tick = start("ScheduleWatcher.runDue")
      start("Automations.due", tick).end(ms(4), Exit.void)

      tick.attribute("bluechip.idle", true)
      tick.end(ms(5), Exit.void)

      assert.deepStrictEqual(names(), [])
    })

    it("a tick that did something goes out whole, children first", () => {
      const { names, start } = setup()
      const tick = start("ScheduleWatcher.runDue")
      start("Automations.due", tick).end(ms(4), Exit.void)

      assert.deepStrictEqual(names(), [])
      tick.end(ms(5), Exit.void)

      assert.deepStrictEqual(names(), ["Automations.due", "ScheduleWatcher.runDue"])
    })

    it("an idle tick that failed goes out", () => {
      const { names, start } = setup()
      const tick = start("ScheduleWatcher.runDue")

      tick.attribute("bluechip.idle", true)
      tick.end(ms(5), failure)

      assert.deepStrictEqual(names(), ["ScheduleWatcher.runDue"])
    })
  })

  it("a child keeps its parent's ids though the parent was made late", () => {
    const { exported, start } = setup()
    const call = start("chain.read prices", undefined, "client")
    const inner = start("http.client POST", call, "client")

    inner.end(ms(1), Exit.void)
    call.end(ms(2), Exit.void)

    assert.deepStrictEqual(
      [Option.getOrUndefined(exported[0]!.parent)?.spanId, exported[0]!.traceId],
      [exported[1]!.spanId, exported[1]!.traceId]
    )
  })
})
