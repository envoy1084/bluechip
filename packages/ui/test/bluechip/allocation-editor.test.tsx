import {
  AllocationEditor,
  type AllocationTarget,
  balanceAllocation,
  cashTarget,
  setAllocationTarget
} from "@bluechip/ui/bluechip/allocation-editor"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const MIX: ReadonlyArray<AllocationTarget> = [
  { symbol: "NVDA", target: 30 },
  { symbol: "AAPL", target: 25 },
  { symbol: "MSFT", target: 20 },
  { symbol: "TSLA", target: 15 }
]
const total = (targets: ReadonlyArray<AllocationTarget>) =>
  targets.reduce((sum, t) => sum + t.target, 0) + cashTarget(targets)
const targetOf = (targets: ReadonlyArray<AllocationTarget>, symbol: string) =>
  targets.find((t) => t.symbol === symbol)?.target

describe("setAllocationTarget", () => {
  it("takes from cash first, then the largest unlocked stock", () => {
    const next = setAllocationTarget(MIX, "TSLA", 30)
    expect(cashTarget(next)).toBe(0)
    expect(targetOf(next, "NVDA")).toBe(25)
    expect(total(next)).toBe(100)
  })

  it("never moves a locked stock and stops at what's left", () => {
    const locked = MIX.map((t) => (t.symbol === "TSLA" ? t : { ...t, locked: true }))
    const next = setAllocationTarget(locked, "TSLA", 80)
    expect(targetOf(next, "TSLA")).toBe(25)
    expect(targetOf(next, "NVDA")).toBe(30)
    expect(total(next)).toBe(100)
  })

  it("gives what you lower back to cash", () => {
    const next = setAllocationTarget(MIX, "NVDA", 10)
    expect(cashTarget(next)).toBe(30)
  })

  it("adds up to 100 after any sequence of edits", () => {
    let targets = MIX
    for (const [symbol, value] of [["NVDA", 90], ["AAPL", 3], ["MSFT", 55], ["TSLA", -4], ["NVDA", 12.6]] as const) {
      targets = setAllocationTarget(targets, symbol, value)
      expect(total(targets)).toBe(100)
      expect(targets.every((t) => t.target >= 0)).toBe(true)
      expect(cashTarget(targets)).toBeGreaterThanOrEqual(0)
    }
  })
})

describe("balanceAllocation", () => {
  it("splits evenly, keeps the cash reserve and skips locked stocks", () => {
    const next = balanceAllocation(MIX.map((t) => (t.symbol === "NVDA" ? { ...t, locked: true } : t)), 10)
    expect(targetOf(next, "NVDA")).toBe(30)
    expect(next.filter((t) => t.symbol !== "NVDA").map((t) => t.target)).toEqual([20, 20, 20])
    expect(cashTarget(next)).toBe(10)
  })
})

describe("AllocationEditor", () => {
  it("keeps cash as the rest while you type a target", async () => {
    const changes: Array<ReadonlyArray<AllocationTarget>> = []
    const screen = await render(<AllocationEditor defaultValue={MIX} onValueChange={(t) => changes.push(t)} />)
    const nvidia = screen.getByLabelText("Nvidia target, percent")
    await userEvent.clear(nvidia)
    await userEvent.type(nvidia, "35")
    await expect.element(screen.getByText("Over your 30% max in one stock. Agents won't buy past 30%.")).toBeVisible()
    await expect.element(screen.getByText("5%", { exact: true })).toBeVisible()
    expect(changes.every((t) => total(t) === 100)).toBe(true)
  })

  it("splits evenly around a locked stock", async () => {
    const screen = await render(<AllocationEditor defaultValue={MIX} />)
    await userEvent.click(screen.getByRole("button", { name: "Lock Nvidia" }))
    await userEvent.click(screen.getByRole("button", { name: "Split evenly" }))
    await expect.element(screen.getByLabelText("Nvidia target, percent")).toHaveValue("30")
    await expect.element(screen.getByLabelText("Tesla target, percent")).toHaveValue("20")
  })

  it("gives a removed stock's share to cash", async () => {
    const screen = await render(<AllocationEditor defaultValue={MIX} />)
    await userEvent.click(screen.getByRole("button", { name: "Remove Tesla" }))
    await expect.element(screen.getByText("25%", { exact: true })).toBeVisible()
  })
})
