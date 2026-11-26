import { Outcome } from "@bluechip/ui/bluechip/outcome"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("Outcome", () => {
  it("a success is announced politely, with its title and line", async () => {
    const screen = await render(
      <Outcome tone="success" title="Bought $50.00 of Apple" description="It's in your portfolio." />
    )
    await expect.element(screen.getByRole("status")).toHaveTextContent("Bought $50.00 of AppleIt's in your portfolio.")
    await expect.element(screen.getByRole("heading", { name: "Bought $50.00 of Apple" })).toBeVisible()
  })

  it("a failure is an alert", async () => {
    const screen = await render(
      <Outcome tone="failure" title="Your buy didn't go through" description="Nothing was bought." />
    )
    await expect.element(screen.getByText("Your buy didn't go through")).toBeVisible()
    expect(screen.container.querySelector("[data-slot=outcome]")?.getAttribute("role")).toBe("alert")
  })

  it("while on its way, it says it's busy", async () => {
    const screen = await render(<Outcome tone="pending" title="Buying $50.00 of Apple" />)
    await expect.element(screen.getByRole("status")).toHaveAttribute("aria-busy", "true")
  })

  it("a finished one isn't busy", async () => {
    const screen = await render(<Outcome tone="success" title="Bought $50.00 of Apple" />)
    await expect.element(screen.getByRole("status")).not.toHaveAttribute("aria-busy")
  })

  it("shows its next step", async () => {
    const screen = await render(
      <Outcome tone="failure" title="Your buy didn't go through" actions={<button type="button">Try again</button>} />
    )
    await expect.element(screen.getByRole("button", { name: "Try again" })).toBeVisible()
  })

  it("leaves the facts out when there are none", async () => {
    const screen = await render(<Outcome tone="success" title="Done">{undefined}{null}</Outcome>)
    expect(screen.container.querySelector("[data-slot=outcome] > div.text-left")).toBeNull()
  })
})
