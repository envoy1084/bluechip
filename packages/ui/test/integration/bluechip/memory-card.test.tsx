import { MemoryCard } from "@bluechip/ui/bluechip/memory-card"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

const noop = () => {}
const base = { kind: "Rule", text: "You never want Tesla.", busy: null, onConfirm: noop, onDismiss: noop } as const

describe("MemoryCard", () => {
  it("asks before keeping one it inferred", async () => {
    const screen = await render(<MemoryCard {...base} action="confirm" status="pending" />)
    await expect.element(screen.getByText("Keep this?")).toBeVisible()
    await expect.element(screen.getByRole("button", { name: "Remember" })).toBeVisible()
  })

  it("a saved one is remembered, with nothing to answer", async () => {
    const screen = await render(<MemoryCard {...base} action="saved" status="applied" />)
    await expect.element(screen.getByText("Remembered")).toBeVisible()
    await expect.element(screen.getByRole("button", { name: "Remember" })).not.toBeInTheDocument()
  })

  it("one left out is not kept", async () => {
    const screen = await render(<MemoryCard {...base} action="confirm" status="dismissed" />)
    await expect.element(screen.getByText("Not kept")).toBeVisible()
  })

  it("a forgotten one says so", async () => {
    const screen = await render(<MemoryCard {...base} action="forgotten" status="applied" />)
    await expect.element(screen.getByText("Forgotten")).toBeVisible()
  })
})
