import { DepositCard } from "@bluechip/ui/bluechip/deposit-card"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

const ADDRESS = "0x7a3F9C41b2E08d5A6c1F4e9B03D7a2C58e61B9d4"
const REQUEST = `ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=${ADDRESS}`

describe("DepositCard", () => {
  it("draws the payment request as a QR code", async () => {
    const screen = await render(<DepositCard address={ADDRESS} paymentRequest={REQUEST} />)
    const qr = screen.getByRole("img", { name: "QR code to send USDC on Base to 0x7a3F…B9d4" })
    await expect.element(qr).toHaveAttribute("src", expect.stringMatching(/^blob:/))
  })

  it("shows the address by its ends, whole in its tooltip, to copy", async () => {
    const screen = await render(<DepositCard address={ADDRESS} paymentRequest={REQUEST} />)
    await expect.element(screen.getByRole("button", { name: "Copy address" })).toBeVisible()
    await expect.element(screen.getByText("0x7a3F…B9d4", { exact: true })).toHaveAttribute("title", ADDRESS)
  })

  it("warns that only USDC on Base is safe to send", async () => {
    const screen = await render(<DepositCard address={ADDRESS} paymentRequest={REQUEST} />)
    await expect.element(screen.getByRole("note")).toHaveTextContent(
      "Base network, USDC only. Sending other coins, or USDC on another network, can't be undone and may be lost."
    )
  })

  it("has no heading of its own when the page says what it's for", async () => {
    const screen = await render(<DepositCard address={ADDRESS} paymentRequest={REQUEST} />)
    await expect.element(screen.getByRole("region", { name: "Your deposit address" })).toBeVisible()
    await expect.element(screen.getByRole("heading")).not.toBeInTheDocument()
  })

  it("names itself by its title when it has one", async () => {
    const screen = await render(<DepositCard address={ADDRESS} paymentRequest={REQUEST} title="Add cash" />)
    await expect.element(screen.getByRole("region", { name: "Add cash" })).toBeVisible()
  })

  it("shows its footer", async () => {
    const screen = await render(
      <DepositCard address={ADDRESS} paymentRequest={REQUEST} footer={<a href="#help">Help</a>} />
    )
    await expect.element(screen.getByRole("link", { name: "Help" })).toBeVisible()
  })
})
