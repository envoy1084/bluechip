import { Conflict, SignatureRejected } from "@bluechip/domain/Errors"
import type { Address, RecoveryRequestId } from "@bluechip/domain/Ids"
import { Recovering, RecoveryRequest } from "@bluechip/domain/recovery/Recovery"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { recoverProblem, recoverStep } from "../../../../../src/features/recover/model/recoverText.ts"

const at = (iso: string) => DateTime.makeUnsafe(iso)
const NOW = at("2026-11-28T10:00:00Z")

const recovering = (request: Partial<RecoveryRequest> | null) =>
  new Recovering({
    account: "0x00000000000000000000000000000000000000aa" as Address,
    request: request === null ? null : new RecoveryRequest({
      id: "recovery_01jdzm3q8gfr9ab6t7c5h2kxyz" as RecoveryRequestId,
      status: "waiting",
      newPasskey: null,
      requestedAt: at("2026-11-27T10:00:00Z"),
      executableAt: at("2026-11-29T10:00:00Z"),
      cancelledAt: null,
      cancelledFrom: null,
      executedAt: null,
      ...request
    })
  })

describe("recoverStep", () => {
  it.each(
    [
      { name: "nothing asked yet: ask", request: null, offer: "ask", title: "Ask for a recovery" },
      {
        name: "cancelled: ask again",
        request: { status: "cancelled" },
        offer: "ask",
        title: "The last recovery was cancelled"
      },
      { name: "waiting, not due: wait", request: {}, offer: "wait", title: "Your recovery is waiting" },
      {
        name: "waiting, due: make it",
        request: { executableAt: at("2026-11-28T10:00:00Z") },
        offer: "make",
        title: "Your recovery is ready"
      },
      { name: "on its way: wait", request: { status: "requesting" }, offer: "wait", title: "Asking for the recovery" },
      { name: "made: sign in", request: { status: "completed" }, offer: "signIn", title: "Your account is yours again" }
    ] as const
  )("$name", ({ offer, request, title }) => {
    const step = recoverStep(recovering(request), NOW, "UTC")
    assert.deepStrictEqual([step.offer, step.title], [offer, title])
  })

  it("waiting: says when it can go through", () => {
    assert.match(recoverStep(recovering({}), NOW, "UTC").description, /^It can go through from Sun 29 Nov, 10:00\./)
  })
})

describe("recoverProblem", () => {
  it.each([
    {
      name: "not a recovery key",
      error: new SignatureRejected({ reason: "unknownPasskey" }),
      expected: "That isn't a recovery key for a bluechip account. Use the passkey you set up as your recovery key."
    },
    {
      name: "too early",
      error: new Conflict({ reason: "recoveryNotDue" }),
      expected: "It isn't time yet. Come back once the 48 hours have passed."
    }
  ])("$name", ({ error, expected }) => {
    assert.strictEqual(recoverProblem(error), expected)
  })
})
