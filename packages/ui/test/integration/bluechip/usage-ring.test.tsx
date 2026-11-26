import { UsageRing } from "@bluechip/ui/bluechip/usage-ring"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

const usd = (value: number) => `$${value}`

describe("UsageRing", () => {
  it("names what's used of the limit", async () => {
    const screen = await render(<UsageRing label="Spent today" used={60} limit={250} format={usd} />)

    await expect.element(screen.getByRole("img", { name: "Spent today: $60 of $250" })).toBeVisible()
    await expect.element(screen.getByText("of $250")).toBeVisible()
  })

  it("small, for a card: a 64 px ring without the limit in its middle", async () => {
    const screen = await render(<UsageRing size="sm" label="Spent today" used={60} limit={250} format={usd} />)

    await expect.element(screen.getByRole("img", { name: "Spent today: $60 of $250" })).toHaveAttribute("width", "64")
    await expect.element(screen.getByText("of $250")).not.toBeInTheDocument()
  })
})
