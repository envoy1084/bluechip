import { toast, Toaster, toastManagerOptions } from "@bluechip/ui/components/toast"
import { afterEach, assert, describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

describe("toastManagerOptions", () => {
  it("a plain toast: low priority, the default duration", () => {
    assert.deepStrictEqual(toastManagerOptions({ title: "Saved", type: "default" }), {
      title: "Saved",
      type: "default",
      priority: "low",
      timeout: 4500
    })
  })

  it("an error: high priority", () => {
    assert.deepStrictEqual(toastManagerOptions({ title: "Trade failed", type: "error" }), {
      title: "Trade failed",
      type: "error",
      priority: "high",
      timeout: 4500
    })
  })

  it("loading: stays until updated", () => {
    assert.deepStrictEqual(toastManagerOptions({ title: "Locking limits…", type: "loading" }), {
      title: "Locking limits…",
      type: "loading",
      priority: "low",
      timeout: 0
    })
  })

  it("loading with a duration: that duration", () => {
    assert.deepStrictEqual(toastManagerOptions({ title: "Locking limits…", type: "loading", duration: 8000 }), {
      title: "Locking limits…",
      type: "loading",
      priority: "low",
      timeout: 8000
    })
  })

  it("a duration of 0: kept until dismissed", () => {
    assert.deepStrictEqual(toastManagerOptions({ title: "Rebalancer paused", type: "default", duration: 0 }), {
      title: "Rebalancer paused",
      type: "default",
      priority: "low",
      timeout: 0
    })
  })

  it("an update without a type changes only what it names", () => {
    assert.deepStrictEqual(toastManagerOptions({ description: "Bought 2 NVDA.", duration: 2000 }), {
      description: "Bought 2 NVDA.",
      timeout: 2000
    })
  })

  it("an action becomes the action button's props", () => {
    const undo = () => {}
    assert.deepStrictEqual(toastManagerOptions({ action: { label: "Undo", onClick: undo } }), {
      actionProps: { children: "Undo", onClick: undo }
    })
  })
})

describe("toast", () => {
  afterEach(() => toast.dismiss())

  it("shows its title and description", async () => {
    await render(<Toaster />)
    toast.success("Trade approved", { description: "Bought 2 NVDA for $362.84." })
    await expect.element(page.getByText("Trade approved")).toBeVisible()
    await expect.element(page.getByText("Bought 2 NVDA for $362.84.")).toBeVisible()
  })

  it("its action runs the action's onClick", async () => {
    let undone = 0
    await render(<Toaster />)
    toast("Agent removed", { action: { label: "Undo", onClick: () => undone++ } })
    await userEvent.click(page.getByRole("button", { name: "Undo" }))
    assert.strictEqual(undone, 1)
  })

  it("its action dismisses the toast", async () => {
    await render(<Toaster />)
    toast("Agent removed", { action: { label: "Undo", onClick: () => {} } })
    await userEvent.click(page.getByRole("button", { name: "Undo" }))
    await expect.element(page.getByText("Agent removed")).not.toBeInTheDocument()
  })

  it("its Dismiss button dismisses it", async () => {
    await render(<Toaster />)
    toast("Rebalancer paused", { duration: 0 })
    // Base UI reveals the Dismiss button, to screen readers too, only while the toasts are hovered or focused.
    await userEvent.hover(page.getByText("Rebalancer paused"))
    await userEvent.click(page.getByRole("button", { name: "Dismiss" }))
    await expect.element(page.getByText("Rebalancer paused")).not.toBeInTheDocument()
  })

  it("update replaces a toast's title in place", async () => {
    await render(<Toaster />)
    const id = toast.loading("Sending…")
    await expect.element(page.getByText("Sending…")).toBeVisible()
    toast.update(id, { title: "Sent", type: "success" })
    await expect.element(page.getByText("Sent", { exact: true })).toBeVisible()
  })

  describe("promise", () => {
    it("shows the loading message while the promise is pending", async () => {
      await render(<Toaster />)
      void toast.promise(new Promise(() => {}), {
        loading: "Locking limits…",
        success: "Limits locked",
        error: "Couldn't lock limits"
      })
      await expect.element(page.getByText("Locking limits…")).toBeVisible()
    })

    it("turns into the success message when it resolves", async () => {
      await render(<Toaster />)
      void toast.promise(Promise.resolve("done"), {
        loading: "Locking limits…",
        success: "Limits locked",
        error: "Couldn't lock limits"
      })
      await expect.element(page.getByText("Limits locked")).toBeVisible()
    })

    it("builds the success message from the resolved value", async () => {
      await render(<Toaster />)
      void toast.promise(Promise.resolve(3), {
        loading: "Locking limits…",
        success: (count) => `${count} limits locked`,
        error: "Couldn't lock limits"
      })
      await expect.element(page.getByText("3 limits locked")).toBeVisible()
    })

    it("turns into the error message when it rejects", async () => {
      await render(<Toaster />)
      toast.promise(Promise.reject(new Error("offline")), {
        loading: "Locking limits…",
        success: "Limits locked",
        error: (error) => `Couldn't lock limits: ${(error as Error).message}`
      }).catch(() => {})
      // Base UI also copies an error toast into a live region, and hides the toast itself from screen readers until
      // focused; read the toast.
      await expect.element(page.getByRole("alertdialog", { includeHidden: true })).toHaveTextContent(
        "Couldn't lock limits: offline"
      )
    })
  })
})
