import { actionsOf } from "@bluechip/domain/notifications/Actions"
import { assert, describe, it } from "@effect/vitest"

describe("actionsOf", () => {
  it.each(
    [
      { kind: "approvalNeeded", actions: ["review"] },
      { kind: "approvalExpiring", actions: ["review"] },
      { kind: "intentBlocked", actions: ["pauseAll"] },
      { kind: "intentFilled", actions: [] },
      { kind: "intentWaiting", actions: [] },
      { kind: "automationFired", actions: [] },
      { kind: "recoveryRequested", actions: ["cancelRecovery"] },
      { kind: "recoveryCancelled", actions: [] },
      { kind: "agentPaused", actions: [] },
      { kind: "deposit", actions: [] },
      { kind: "dailyDigest", actions: [] }
    ] as const
  )("$kind", ({ actions, kind }) => {
    assert.deepStrictEqual(actionsOf(kind), actions)
  })
})
