import { toast, Toaster } from "@bluechip/ui/components/toast"
import { afterEach, describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

describe("toast", () => {
  afterEach(() => toast.dismiss())

  it("appears with its description", async () => {
    await render(<Toaster />)
    toast.success("Trade approved", { description: "Bought 2 NVDA for $362.84." })
    await expect.element(page.getByText("Trade approved")).toBeVisible()
    await expect.element(page.getByText("Bought 2 NVDA for $362.84.")).toBeVisible()
  })

  it("runs its action and goes away", async () => {
    let undone = 0
    await render(<Toaster />)
    toast("Agent removed", { action: { label: "Undo", onClick: () => undone++ } })
    await userEvent.click(page.getByRole("button", { name: "Undo" }))
    expect(undone).toBe(1)
    await expect.element(page.getByText("Agent removed")).not.toBeInTheDocument()
  })

  it("dismisses from its close button", async () => {
    await render(<Toaster />)
    toast("Rebalancer paused", { duration: 0 })
    await userEvent.click(page.getByRole("button", { name: "Dismiss" }))
    await expect.element(page.getByText("Rebalancer paused")).not.toBeInTheDocument()
  })

  it("turns a loading toast into success when its promise settles", async () => {
    await render(<Toaster />)
    let lock = (_: string) => {}
    const locked = new Promise<string>((resolve) => (lock = resolve))
    void toast.promise(locked, { loading: "Locking limits…", success: "Limits locked", error: "Couldn't lock limits" })
    await expect.element(page.getByText("Locking limits…")).toBeVisible()
    lock("done")
    await expect.element(page.getByText("Limits locked")).toBeVisible()
  })
})
