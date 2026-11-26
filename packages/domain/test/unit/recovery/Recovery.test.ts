import { isDue, isOpen } from "@bluechip/domain/recovery/Recovery"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"

const at = (iso: string) => DateTime.makeUnsafe(iso)

describe("isDue", () => {
  it.each(
    [
      { name: "a second before it can be made", status: "waiting", executableAt: "2026-11-29T10:00:01Z", due: false },
      { name: "the moment it can be made", status: "waiting", executableAt: "2026-11-29T10:00:00Z", due: true },
      { name: "a second after", status: "waiting", executableAt: "2026-11-29T09:59:59Z", due: true },
      { name: "its request not onchain yet", status: "requesting", executableAt: null, due: false },
      { name: "cancelled", status: "cancelled", executableAt: "2026-11-27T10:00:00Z", due: false },
      { name: "being made", status: "executing", executableAt: "2026-11-27T10:00:00Z", due: false }
    ] as const
  )("$name", ({ due, executableAt, status }) => {
    assert.strictEqual(
      isDue({ status, executableAt: executableAt === null ? null : at(executableAt) }, at("2026-11-29T10:00:00Z")),
      due
    )
  })
})

describe("isOpen", () => {
  it.each(
    [
      { status: "requesting", open: true },
      { status: "waiting", open: true },
      { status: "executing", open: true },
      { status: "cancelled", open: false },
      { status: "completed", open: false },
      { status: "failed", open: false }
    ] as const
  )("$status", ({ open, status }) => {
    assert.strictEqual(isOpen({ status }), open)
  })
})
