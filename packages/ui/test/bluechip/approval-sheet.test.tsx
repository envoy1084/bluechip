import { ApprovalCard, type ApprovalProgress, ApprovalSheet } from "@bluechip/ui/bluechip/approval-sheet"
import type { TradeOrder } from "@bluechip/ui/bluechip/order-preview"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

const ORDER: TradeOrder = { side: "buy", symbol: "NVDA", name: "Nvidia", amount: 600, price: 181.42, fee: 0.03 }

const deferred = () => {
  let resolve = () => {}
  let reject = (_: Error) => {}
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve: () => resolve(), reject: (error: Error) => reject(error) }
}

describe("ApprovalSheet", () => {
  it("goes from pending to approved to filled", async () => {
    const faceId = deferred()
    const confirmed = deferred()
    const onApprove = async (progress: (step: ApprovalProgress) => void) => {
      await faceId.promise
      progress("approved")
      await confirmed.promise
    }
    await render(
      <ApprovalSheet
        open
        onOpenChange={() => {}}
        agentName="Tech picker"
        order={ORDER}
        onApprove={onApprove}
        onDecline={() => Promise.resolve()}
      />
    )
    await expect.element(page.getByRole("heading", { name: "Approve Tech picker's trade" })).toBeVisible()
    // Base UI's scroll lock keeps Playwright from clicking inside the open sheet in the test iframe; Enter is as real.
    page.getByRole("button", { name: "Approve with Face ID" }).element().focus()
    await userEvent.keyboard("{Enter}")
    await expect.element(page.getByRole("button", { name: "Waiting for Face ID…" })).toBeVisible()
    faceId.resolve()
    await expect.element(page.getByRole("heading", { name: "Approved" })).toBeVisible()
    confirmed.resolve()
    await expect.element(page.getByRole("heading", { name: "Bought $600.00 of Nvidia" })).toBeVisible()
    await expect.element(page.getByRole("button", { name: "Done" })).toBeVisible()
  })

  it("lets you try Face ID again when it fails", async () => {
    let attempts = 0
    const screen = await render(
      <ApprovalCard
        agentName="Tech picker"
        order={ORDER}
        onApprove={() => (++attempts === 1 ? Promise.reject(new Error("cancelled")) : Promise.resolve())}
        onDecline={() => Promise.resolve()}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Approve with Face ID" }))
    await expect.element(screen.getByRole("alert")).toHaveTextContent("Face ID didn't work. Try again.")
    await userEvent.click(screen.getByRole("button", { name: "Try Face ID again" }))
    await expect.element(screen.getByRole("heading", { name: "Bought $600.00 of Nvidia" })).toBeVisible()
  })

  it("says why the trade failed after you approved it", async () => {
    const screen = await render(
      <ApprovalCard
        agentName="Tech picker"
        order={ORDER}
        onApprove={async (progress) => {
          progress("approved")
          progress("confirming")
          throw new Error("The price moved more than 1% while confirming. Your $600.00 is still cash.")
        }}
        onDecline={() => Promise.resolve()}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Approve with Face ID" }))
    await expect.element(screen.getByRole("heading", { name: "Trade didn't go through" })).toBeVisible()
    await expect.element(screen.getByText("Didn't go through")).toBeVisible()
    expect(screen.container.querySelector("li[data-state=fail]")?.textContent).toContain("Didn't go through")
  })

  it("declines without approving", async () => {
    let approved = false
    let declined = 0
    const screen = await render(
      <ApprovalCard
        agentName="Tech picker"
        order={ORDER}
        onApprove={() => {
          approved = true
          return Promise.resolve()
        }}
        onDecline={() => {
          declined++
          return Promise.resolve()
        }}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Decline" }))
    await expect.element(screen.getByRole("heading", { name: "Declined" })).toBeVisible()
    await expect.element(screen.getByText("Nothing was bought. Tech picker won't ask about this trade again."))
      .toBeVisible()
    expect(declined).toBe(1)
    expect(approved).toBe(false)
  })
})
