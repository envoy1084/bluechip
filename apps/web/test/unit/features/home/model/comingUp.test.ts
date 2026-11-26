import { Trigger } from "@bluechip/domain/automations/Automation"
import { AgentId, AutomationId } from "@bluechip/domain/Ids"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Schema from "effect/Schema"
import { comingUp } from "../../../../../src/features/home/model/comingUp.ts"
import { agent } from "../../../../fixtures/Agents.ts"

const NOW = new Date("2026-11-27T12:00:00Z")
const PICKER = AgentId.make("agent_01jd8v4t5m6n7a8q9r0s1t2v3a")
const WEEKLY = AutomationId.make("automation_01jd8v4t5m6n7a8q9r0s1t2v3a")
const ALERT = AutomationId.make("automation_01jd8v4t5m6n7a8q9r0s1t2v3b")

const SCHEDULE = Schema.decodeSync(Trigger)({
  type: "schedule",
  config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" }
})
const PRICE = Schema.decodeSync(Trigger)({
  type: "priceCross",
  config: { symbol: "AAPL", level: 200_000_000n, direction: "below" }
})

const scheduled = (
  nextRunAt: string | null,
  fields: { status?: "active" | "paused"; agentId?: AgentId | null } = {}
) => ({
  id: WEEKLY,
  name: "Weekly Apple",
  status: fields.status ?? "active",
  nextRunAt: nextRunAt === null ? null : DateTime.makeUnsafe(nextRunAt),
  agentId: fields.agentId === undefined ? PICKER : fields.agentId,
  trigger: SCHEDULE
})

const PICKER_AGENT = agent("active", { id: PICKER, name: "Tech picker", lockedUntil: "2027-02-01T00:00:00Z" })

describe("comingUp", () => {
  it("a run within the week, through its agent", () => {
    assert.deepStrictEqual(comingUp([scheduled("2026-11-30T15:00:00Z")], [PICKER_AGENT], NOW), {
      upcoming: [{
        _tag: "run",
        key: `run ${WEEKLY}`,
        at: new Date("2026-11-30T15:00:00Z"),
        automationId: WEEKLY,
        title: "Weekly Apple runs",
        detail: "Through Tech picker"
      }],
      watching: []
    })
  })

  it("your own automation runs with your Face ID", () => {
    const { upcoming } = comingUp([scheduled("2026-11-28T15:00:00Z", { agentId: null })], [], NOW)

    assert.deepStrictEqual(upcoming.map((each) => each.detail), ["For you, with your Face ID"])
  })

  it.each([
    { name: "a run more than a week away", run: scheduled("2026-12-05T12:00:01Z") },
    { name: "a paused automation", run: scheduled("2026-11-30T15:00:00Z", { status: "paused" }) }
  ])("nothing for $name", ({ run }) => {
    assert.deepStrictEqual(comingUp([run], [PICKER_AGENT], NOW), { upcoming: [], watching: [] })
  })

  it.each([
    { name: "in 10 days: on the timeline", lockedUntil: "2026-12-07T12:00:00Z", shown: ["Tech picker's rules end"] },
    { name: "in 2 days: needs you instead", lockedUntil: "2026-11-29T12:00:00Z", shown: [] },
    { name: "in 3 weeks: too far off", lockedUntil: "2026-12-18T12:00:00Z", shown: [] }
  ])("an agent's rules ending $name", ({ lockedUntil, shown }) => {
    const { upcoming } = comingUp([], [agent("active", { id: PICKER, name: "Tech picker", lockedUntil })], NOW)

    assert.deepStrictEqual(upcoming.map((each) => each.title), shown)
  })

  it("soonest first, five at most", () => {
    const runs = ["2026-12-02", "2026-11-28", "2026-11-30", "2026-11-29", "2026-12-01", "2026-12-03"].map((
      day,
      index
    ) => ({
      ...scheduled(`${day}T15:00:00Z`),
      id: AutomationId.make(`automation_01jd8v4t5m6n7a8q9r0s1t2v${index}a`),
      name: day
    }))

    assert.deepStrictEqual(
      comingUp(runs, [PICKER_AGENT], NOW).upcoming.map((each) => each.title),
      ["2026-11-28 runs", "2026-11-29 runs", "2026-11-30 runs", "2026-12-01 runs", "2026-12-02 runs"]
    )
  })

  it("an automation on a live trigger watches instead", () => {
    const alert = { ...scheduled(null), id: ALERT, name: "Apple under $200", trigger: PRICE }

    assert.deepStrictEqual(comingUp([alert], [], NOW), { upcoming: [], watching: ["Apple under $200 watches prices"] })
  })
})
