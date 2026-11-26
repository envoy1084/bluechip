import { DepositArrivedCard } from "@bluechip/ui/bluechip/deposit-arrived-card"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

const SENDER = "0x1111222233334444555566667777888899990000"

describe("DepositArrivedCard", () => {
  it("shows the amount that came in", async () => {
    const screen = await render(<DepositArrivedCard amount={250} />)
    await expect.element(screen.getByRole("region", { name: "Cash arrived" })).toBeVisible()
    await expect.element(screen.getByText("$250.00", { exact: true })).toBeInTheDocument()
  })

  it("names who sent it", async () => {
    const screen = await render(<DepositArrivedCard amount={250} from={SENDER} />)
    await expect.element(screen.getByRole("status")).toHaveTextContent(
      "USDC on Base, from 0x1111…0000. It's ready to invest."
    )
  })

  it("leaves the sender out when it isn't known", async () => {
    const screen = await render(<DepositArrivedCard amount={250} />)
    await expect.element(screen.getByRole("status")).toHaveTextContent("USDC on Base. It's ready to invest.")
  })
})
