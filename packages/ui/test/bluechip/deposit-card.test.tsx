import { DepositCard } from "@bluechip/ui/bluechip/deposit-card"
import { describe, expect, it } from "@effect/vitest"
import { encode } from "uqr"
import { render } from "vitest-browser-react"

const ADDRESS = "0x7a3F9C41b2E08d5A6c1F4e9B03D7a2C58e61B9d4"

describe("DepositCard", () => {
  it("shows a scannable QR code of the address on Base, not a placeholder", async () => {
    const screen = await render(<DepositCard address={ADDRESS} status="waiting" />)
    const qr = screen.getByRole("img", { name: "QR code for 0x7a3F…B9d4" })
    await expect.element(qr).toBeVisible()
    const { size } = encode(`ethereum:${ADDRESS}@8453`, { ecc: "H", border: 0 })
    expect(qr.element().getAttribute("viewBox")).toBe(`0 0 ${size} ${size}`)
    expect(screen.container.textContent).not.toContain("Example")
  })
})
