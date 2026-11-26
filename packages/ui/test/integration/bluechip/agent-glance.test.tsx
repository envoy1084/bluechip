import { AgentGlance } from "@bluechip/ui/bluechip/agent-glance"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("AgentGlance", () => {
  it("lists its stocks, which way it trades and its numbers", async () => {
    const screen = await render(
      <AgentGlance
        stocks={["NVDA", "AAPL"]}
        direction="Buys and sells"
        stats={[{ label: "A day", value: "$250" }, { label: "Per trade", value: "$100" }]}
      />
    )

    await expect.element(screen.getByRole("list", { name: "Its stocks" }).getByRole("listitem")).toHaveLength(2)
    await expect.element(screen.getByText("Buys and sells")).toBeVisible()
    await expect.element(screen.getByRole("definition").first()).toHaveTextContent("$250")
  })

  it("says when it has no stocks yet", async () => {
    const screen = await render(<AgentGlance stocks={[]} stats={[]} />)

    await expect.element(screen.getByText("No stocks yet")).toBeVisible()
  })
})
