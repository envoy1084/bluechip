import { TradeApprovalCard } from "@bluechip/ui/bluechip/trade-approval-card"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("TradeApprovalCard", () => {
  it("shows its order preview under the trade, before the Face ID button", async () => {
    const screen = await render(
      <TradeApprovalCard
        title="Buy $50.00 of Apple"
        detail="At the pool's price now"
        preview={<dl aria-label="Order">You pay $50.00</dl>}
        action={<button type="button">Buy with Face ID</button>}
      />
    )

    const card = screen.getByRole("region", { name: "Your trade" })
    await expect.element(card.getByText("You pay $50.00")).toBeVisible()
    await expect.element(card.getByRole("button", { name: "Buy with Face ID" })).toBeVisible()
  })
})
