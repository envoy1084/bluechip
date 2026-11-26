import { WorstCaseCard } from "@bluechip/ui/bluechip/worst-case-card"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("WorstCaseCard", () => {
  it("is a region with its title and sentence", async () => {
    const screen = await render(<WorstCaseCard>On its worst day it could spend $250.</WorstCaseCard>)

    const card = screen.getByRole("region", { name: "The worst case" })
    await expect.element(card.getByRole("heading", { name: "The worst case" })).toBeVisible()
    await expect.element(card.getByText("On its worst day it could spend $250.")).toBeVisible()
  })

  it("quiet, inside another card", async () => {
    const screen = await render(<WorstCaseCard tone="quiet">It only sells.</WorstCaseCard>)

    await expect.element(screen.getByRole("region", { name: "The worst case" })).toHaveAttribute("data-tone", "quiet")
  })
})
