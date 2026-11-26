import { actionsOf } from "@bluechip/domain/notifications/Actions"
import { assert, describe, it } from "@effect/vitest"

describe("actionsOf", () => {
  it.each(
    [
      { kind: "intentFilled", actions: ["pauseAll"] },
      { kind: "intentBlocked", actions: ["pauseAll"] },
      { kind: "intentWaiting", actions: ["pauseAll"] },
      { kind: "approvalNeeded", actions: ["pauseAll"] },
      { kind: "approvalExpiring", actions: ["pauseAll"] },
      { kind: "recoveryRequested", actions: ["cancelRecovery"] },
      { kind: "recoveryCancelled", actions: [] },
      { kind: "agentPaused", actions: [] },
      { kind: "dailyDigest", actions: [] }
    ] as const
  )("$kind", ({ actions, kind }) => {
    assert.deepStrictEqual(actionsOf(kind), actions)
  })
})
