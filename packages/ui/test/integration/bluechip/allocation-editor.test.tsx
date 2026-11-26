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

// 90% in stocks, so 10% cash.
const MIX: ReadonlyArray<AllocationTarget> = [
  { symbol: "NVDA", target: 30 },
  { symbol: "AAPL", target: 25 },
  { symbol: "MSFT", target: 20 },
  { symbol: "TSLA", target: 15 }
]

const lockAllBut = (symbol: string) => MIX.map((t) => (t.symbol === symbol ? t : { ...t, locked: true }))

describe("cashTarget", () => {
  it("is what the stocks leave of 100", () => {
    expect(cashTarget(MIX)).toBe(10)
  })

  it("is 100 with no stocks", () => {
    expect(cashTarget([])).toBe(100)
  })
})

describe("setAllocationTarget", () => {
  it("a raise that fits in cash takes only from cash", () => {
    expect(setAllocationTarget(MIX, "TSLA", 25)).toStrictEqual([
      { symbol: "NVDA", target: 30 },
      { symbol: "AAPL", target: 25 },
      { symbol: "MSFT", target: 20 },
      { symbol: "TSLA", target: 25 }
    ])
  })

  it("a raise past cash takes the rest from the largest stock", () => {
    expect(setAllocationTarget(MIX, "TSLA", 30)).toStrictEqual([
      { symbol: "NVDA", target: 25 },
      { symbol: "AAPL", target: 25 },
      { symbol: "MSFT", target: 20 },
      { symbol: "TSLA", target: 30 }
    ])
  })

  it("a raise past tied stocks takes from each in turn", () => {
    expect(setAllocationTarget(MIX, "TSLA", 32)).toStrictEqual([
      { symbol: "NVDA", target: 24 },
      { symbol: "AAPL", target: 24 },
      { symbol: "MSFT", target: 20 },
      { symbol: "TSLA", target: 32 }
    ])
  })

  it("a cut gives the difference to cash", () => {
    expect(setAllocationTarget(MIX, "NVDA", 10)).toStrictEqual([
      { symbol: "NVDA", target: 10 },
      { symbol: "AAPL", target: 25 },
      { symbol: "MSFT", target: 20 },
      { symbol: "TSLA", target: 15 }
    ])
  })

  it("a raise around locked stocks stops at what cash leaves", () => {
    expect(setAllocationTarget(lockAllBut("TSLA"), "TSLA", 80)).toStrictEqual([
      { symbol: "NVDA", target: 30, locked: true },
      { symbol: "AAPL", target: 25, locked: true },
      { symbol: "MSFT", target: 20, locked: true },
      { symbol: "TSLA", target: 25 }
    ])
  })

  it("a raise to 100 takes everything", () => {
    expect(setAllocationTarget(MIX, "TSLA", 100)).toStrictEqual([
      { symbol: "NVDA", target: 0 },
      { symbol: "AAPL", target: 0 },
      { symbol: "MSFT", target: 0 },
      { symbol: "TSLA", target: 100 }
    ])
  })

  it("a raise past 100 stops at 100", () => {
    expect(setAllocationTarget(MIX, "TSLA", 140)).toStrictEqual([
      { symbol: "NVDA", target: 0 },
      { symbol: "AAPL", target: 0 },
      { symbol: "MSFT", target: 0 },
      { symbol: "TSLA", target: 100 }
    ])
  })

  it("a negative target is 0", () => {
    expect(setAllocationTarget(MIX, "TSLA", -4)).toStrictEqual([
      { symbol: "NVDA", target: 30 },
      { symbol: "AAPL", target: 25 },
      { symbol: "MSFT", target: 20 },
      { symbol: "TSLA", target: 0 }
    ])
  })

  it("a fraction rounds to a whole percent", () => {
    expect(setAllocationTarget(MIX, "TSLA", 12.6)).toStrictEqual([
      { symbol: "NVDA", target: 30 },
      { symbol: "AAPL", target: 25 },
      { symbol: "MSFT", target: 20 },
      { symbol: "TSLA", target: 13 }
    ])
  })

  it("a locked stock doesn't change", () => {
    const locked = lockAllBut("TSLA")
    expect(setAllocationTarget(locked, "NVDA", 10)).toBe(locked)
  })

  it("a stock not in the mix changes nothing", () => {
    expect(setAllocationTarget(MIX, "AMZN", 10)).toBe(MIX)
  })
})

describe("balanceAllocation", () => {
  it("splits what the reserve leaves evenly, the remainder going to cash", () => {
    expect(balanceAllocation(MIX, 10, 30)).toStrictEqual([
      { symbol: "NVDA", target: 22 },
      { symbol: "AAPL", target: 22 },
      { symbol: "MSFT", target: 22 },
      { symbol: "TSLA", target: 22 }
    ])
  })

  it("keeps locked stocks and splits what's left", () => {
    const locked = MIX.map((t) => (t.symbol === "NVDA" ? { ...t, locked: true } : t))
    expect(balanceAllocation(locked, 10, 30)).toStrictEqual([
      { symbol: "NVDA", target: 30, locked: true },
      { symbol: "AAPL", target: 20 },
      { symbol: "MSFT", target: 20 },
      { symbol: "TSLA", target: 20 }
    ])
  })

  it("gives nothing when locked stocks and the reserve fill 100", () => {
    const locked = MIX.map((t) => (t.symbol === "TSLA" ? t : { ...t, locked: true }))
    expect(balanceAllocation(locked, 30, 30)).toStrictEqual([
      { symbol: "NVDA", target: 30, locked: true },
      { symbol: "AAPL", target: 25, locked: true },
      { symbol: "MSFT", target: 20, locked: true },
      { symbol: "TSLA", target: 0 }
    ])
  })

  it("keeps each stock at your max, the rest going to cash", () => {
    expect(balanceAllocation(MIX.slice(0, 2), 10, 30)).toStrictEqual([
      { symbol: "NVDA", target: 30 },
      { symbol: "AAPL", target: 30 }
    ])
  })

  it("an even split landing on your max keeps it", () => {
    expect(balanceAllocation(MIX.slice(0, 3), 10, 30)).toStrictEqual([
      { symbol: "NVDA", target: 30 },
      { symbol: "AAPL", target: 30 },
      { symbol: "MSFT", target: 30 }
    ])
  })

  it("changes nothing when every stock is locked", () => {
    const locked = MIX.map((t) => ({ ...t, locked: true }))
    expect(balanceAllocation(locked, 10, 30)).toBe(locked)
  })
})

describe("AllocationEditor", () => {
  it("shows cash as the rest after you type a target", async () => {
    const screen = await render(<AllocationEditor defaultValue={MIX} />)
    await userEvent.fill(screen.getByLabelText("Nvidia target, percent"), "35")
    await expect.element(screen.getByText("Adds up to 100%, 5% cash")).toBeInTheDocument()
  })

  it("reports the targets you type", async () => {
    const changes: Array<ReadonlyArray<AllocationTarget>> = []
    const screen = await render(<AllocationEditor defaultValue={MIX} onValueChange={(t) => changes.push(t)} />)
    await userEvent.fill(screen.getByLabelText("Nvidia target, percent"), "35")
    expect(changes.at(-1)).toStrictEqual([
      { symbol: "NVDA", target: 35 },
      { symbol: "AAPL", target: 25 },
      { symbol: "MSFT", target: 20 },
      { symbol: "TSLA", target: 15 }
    ])
  })

  it("flags a target over your max", async () => {
    const screen = await render(<AllocationEditor defaultValue={MIX} />)
    const nvidia = screen.getByLabelText("Nvidia target, percent")
    await userEvent.fill(nvidia, "35")
    await expect.element(nvidia).toHaveAttribute("aria-invalid", "true")
    await expect.element(screen.getByText("Over your 30% max in one stock. Agents won't buy past 30%.")).toBeVisible()
  })

  it("flags cash under your reserve", async () => {
    const screen = await render(<AllocationEditor defaultValue={MIX} />)
    await userEvent.fill(screen.getByLabelText("Tesla target, percent"), "20")
    await expect.element(screen.getByText("Below your 10% cash reserve. Agents keep 10% anyway.")).toBeVisible()
  })

  it("takes a custom max and reserve", async () => {
    const screen = await render(<AllocationEditor defaultValue={MIX} cap={25} reserve={15} />)
    await expect.element(screen.getByText("Over your 25% max in one stock. Agents won't buy past 25%.")).toBeVisible()
    await expect.element(screen.getByText("Below your 15% cash reserve. Agents keep 15% anyway.")).toBeVisible()
  })

  it("won't let you type a locked target", async () => {
    const screen = await render(<AllocationEditor defaultValue={MIX} />)
    await userEvent.click(screen.getByRole("button", { name: "Lock Nvidia" }))
    await expect.element(screen.getByLabelText("Nvidia target, percent")).toBeDisabled()
  })

  it("splits evenly around a locked stock", async () => {
    const screen = await render(<AllocationEditor defaultValue={MIX} />)
    await userEvent.click(screen.getByRole("button", { name: "Lock Nvidia" }))
    await userEvent.click(screen.getByRole("button", { name: "Split evenly" }))
    await expect.element(screen.getByLabelText("Nvidia target, percent")).toHaveValue("30")
    await expect.element(screen.getByLabelText("Tesla target, percent")).toHaveValue("20")
  })

  it("can't split evenly when every stock is locked", async () => {
    const screen = await render(<AllocationEditor defaultValue={MIX.map((t) => ({ ...t, locked: true }))} />)
    await expect.element(screen.getByRole("button", { name: "Split evenly" })).toBeDisabled()
  })

  it("gives a removed stock's share to cash", async () => {
    const screen = await render(<AllocationEditor defaultValue={MIX} />)
    await userEvent.click(screen.getByRole("button", { name: "Remove Tesla" }))
    await expect.element(screen.getByText("Adds up to 100%, 25% cash")).toBeInTheDocument()
  })
})
