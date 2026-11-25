import { DepositCard } from "@bluechip/ui/bluechip/deposit-card"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

const ADDRESS = "0x7a3F9C41b2E08d5A6c1F4e9B03D7a2C58e61B9d4"
const SENDER = "0x1111222233334444555566667777888899990000"

describe("DepositCard", () => {
  describe("waiting", () => {
    it("draws a real QR code of the address on Base", async () => {
      const screen = await render(<DepositCard address={ADDRESS} status="waiting" />)
      const qr = screen.getByRole("img", { name: "QR code for 0x7a3F…B9d4" })
      // A version 6 code (41 modules) is what `ethereum:<address>@8453` takes at high error correction.
      await expect.element(qr).toHaveAttribute("viewBox", "0 0 41 41")
    })

    it("shows the address to copy", async () => {
      const screen = await render(<DepositCard address={ADDRESS} status="waiting" />)
      await expect.element(screen.getByRole("button", { name: "Copy address" })).toBeVisible()
      await expect.element(screen.getByText("0x7a3F…B9d4", { exact: true })).toBeVisible()
    })

    it("warns that only USDC on Base is safe to send", async () => {
      const screen = await render(<DepositCard address={ADDRESS} status="waiting" />)
      await expect.element(screen.getByRole("note")).toHaveTextContent(
        "Base network, USDC only. Sending other coins, or USDC on another network, can't be undone and may be lost."
      )
    })

    it("shows its footer", async () => {
      const screen = await render(<DepositCard address={ADDRESS} status="waiting" footer={<a href="#help">Help</a>} />)
      await expect.element(screen.getByRole("link", { name: "Help" })).toBeVisible()
    })
  })

  describe("arrived", () => {
    it("shows the amount that came in", async () => {
      const screen = await render(<DepositCard address={ADDRESS} status="arrived" amount={250} />)
      await expect.element(screen.getByRole("region", { name: "Cash arrived" })).toBeVisible()
      await expect.element(screen.getByText("$250.00", { exact: true })).toBeInTheDocument()
    })

    it("names who sent it", async () => {
      const screen = await render(<DepositCard address={ADDRESS} status="arrived" amount={250} from={SENDER} />)
      await expect.element(screen.getByRole("status")).toHaveTextContent(
        "USDC on Base, from 0x1111…0000. It's ready to invest."
      )
    })

    it("leaves the sender out when it isn't known", async () => {
      const screen = await render(<DepositCard address={ADDRESS} status="arrived" amount={250} />)
      await expect.element(screen.getByRole("status")).toHaveTextContent("USDC on Base. It's ready to invest.")
    })
  })
})
