import { ApprovalCard, type ApprovalProgress, ApprovalSheet } from "@bluechip/ui/bluechip/approval-sheet"
import type { TradeOrder } from "@bluechip/ui/bluechip/order-preview"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

const BUY: TradeOrder = { side: "buy", symbol: "NVDA", name: "Nvidia", amount: 600, price: 181.42, fee: 0.03 }
const SELL: TradeOrder = { ...BUY, side: "sell" }

const deferred = () => {
  let resolve = () => {}
  let reject = (_: Error) => {}
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve: () => resolve(), reject: (error: Error) => reject(error) }
}

const approves = () => Promise.resolve()
const declines = () => Promise.resolve()

describe("ApprovalSheet", () => {
  it("follows an approved trade from Face ID to filled", async () => {
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
        order={BUY}
        onApprove={onApprove}
        onDecline={declines}
      />
    )
    await expect.element(page.getByRole("heading", { name: "Tech picker wants to buy $600.00 of Nvidia" }))
      .toBeVisible()

    // Base UI's scroll lock keeps Playwright from clicking inside the open sheet in the test iframe; Enter is as real.
    page.getByRole("button", { name: "Approve with Face ID" }).element().focus()
    await userEvent.keyboard("{Enter}")
    await expect.element(page.getByRole("button", { name: "Waiting for Face ID…" })).toBeDisabled()

    faceId.resolve()
    await expect.element(page.getByRole("heading", { name: "Buying $600.00 of Nvidia" })).toBeVisible()

    confirmed.resolve()
    await expect.element(page.getByRole("heading", { name: "Bought $600.00 of Nvidia" })).toBeVisible()
  })
})

describe("ApprovalCard", () => {
  it("says why it needs you by default", async () => {
    const screen = await render(
      <ApprovalCard agentName="Tech picker" order={BUY} onApprove={approves} onDecline={declines} />
    )
    await expect.element(screen.getByText("It's over your ask-me amount, so it needs your approval.")).toBeVisible()
  })

  it("says the reason it's given", async () => {
    const screen = await render(
      <ApprovalCard
        agentName="Tech picker"
        order={BUY}
        reason="Nvidia would be 34% of your money."
        onApprove={approves}
        onDecline={declines}
      />
    )
    await expect.element(screen.getByText("Nvidia would be 34% of your money.")).toBeVisible()
  })

  it("says what a filled buy bought", async () => {
    const screen = await render(
      <ApprovalCard agentName="Tech picker" order={BUY} onApprove={approves} onDecline={declines} />
    )
    await userEvent.click(screen.getByRole("button", { name: "Approve with Face ID" }))
    await expect.element(screen.getByRole("heading", { name: "Bought $600.00 of Nvidia" })).toBeVisible()
    await expect.element(screen.getByText("3.307 shares at $181.42. It's in your portfolio.")).toBeVisible()
  })

  it("says what a filled sell sold", async () => {
    const screen = await render(
      <ApprovalCard agentName="Tech picker" order={SELL} onApprove={approves} onDecline={declines} />
    )
    await userEvent.click(screen.getByRole("button", { name: "Approve with Face ID" }))
    await expect.element(screen.getByRole("heading", { name: "Sold $600.00 of Nvidia" })).toBeVisible()
  })

  it("lets you try Face ID again when it fails", async () => {
    let attempts = 0
    const screen = await render(
      <ApprovalCard
        agentName="Tech picker"
        order={BUY}
        onApprove={() => (++attempts === 1 ? Promise.reject(new Error("cancelled")) : Promise.resolve())}
        onDecline={declines}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Approve with Face ID" }))
    await expect.element(screen.getByRole("alert")).toHaveTextContent("Face ID didn't work. Try again.")

    await userEvent.click(screen.getByRole("button", { name: "Try Face ID again" }))
    await expect.element(screen.getByRole("heading", { name: "Bought $600.00 of Nvidia" })).toBeVisible()
  })

  it("names the reason a trade failed after you approved it", async () => {
    const screen = await render(
      <ApprovalCard
        agentName="Tech picker"
        order={BUY}
        onApprove={async (progress) => {
          progress("approved")
          progress("confirming")
          throw new Error("The price moved more than 1% while confirming. Your $600.00 is still cash.")
        }}
        onDecline={declines}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Approve with Face ID" }))
    await expect.element(screen.getByRole("heading", { name: "Tech picker's trade didn't go through" })).toBeVisible()
    await expect.element(
      screen.getByText("The price moved more than 1% while confirming. Your $600.00 is still cash.")
    ).toBeVisible()
  })

  it("explains a failed buy itself when the error has no message", async () => {
    const screen = await render(
      <ApprovalCard
        agentName="Tech picker"
        order={BUY}
        onApprove={async (progress) => {
          progress("approved")
          throw new Error("")
        }}
        onDecline={declines}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Approve with Face ID" }))
    await expect.element(
      screen.getByText(
        "The price moved more than 1%. Nothing was bought. Your $600.00 is still cash."
      )
    ).toBeVisible()
  })

  it("explains a failed sell itself when the error has no message", async () => {
    const screen = await render(
      <ApprovalCard
        agentName="Tech picker"
        order={SELL}
        onApprove={async (progress) => {
          progress("approved")
          throw new Error("")
        }}
        onDecline={declines}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Approve with Face ID" }))
    await expect.element(
      screen.getByText(
        "The price moved more than 1%. Nothing was sold. Your shares are where they were."
      )
    ).toBeVisible()
  })

  it("declines without approving", async () => {
    let approved = 0
    let declined = 0
    const screen = await render(
      <ApprovalCard
        agentName="Tech picker"
        order={BUY}
        onApprove={() => {
          approved++
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
    expect(approved).toBe(0)
  })

  it("waits for you again when declining fails", async () => {
    const screen = await render(
      <ApprovalCard
        agentName="Tech picker"
        order={BUY}
        onApprove={approves}
        onDecline={() => Promise.reject(new Error("offline"))}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Decline" }))
    await expect.element(screen.getByRole("button", { name: "Approve with Face ID" })).toBeEnabled()
  })

  it("calls onDone from Done once the trade is settled", async () => {
    let done = 0
    const screen = await render(
      <ApprovalCard
        agentName="Tech picker"
        order={BUY}
        onApprove={approves}
        onDecline={declines}
        onDone={() => done++}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Decline" }))
    await userEvent.click(screen.getByRole("button", { name: "Done" }))
    expect(done).toBe(1)
  })
})
