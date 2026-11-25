import { TransactionStatus } from "@bluechip/ui/bluechip/transaction-status"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

const states = (container: HTMLElement) =>
  [...container.querySelectorAll("li")].map((li) => li.getAttribute("data-state"))

describe("TransactionStatus", () => {
  it("marks the current step and the ones before it", async () => {
    const screen = await render(<TransactionStatus state="confirming" />)
    expect(states(screen.container)).toEqual(["done", "now", "todo"])
    await expect.element(screen.getByRole("listitem").nth(1)).toHaveAttribute("aria-current", "step")
  })

  it("checks every step once filled", async () => {
    const screen = await render(<TransactionStatus state="filled" />)
    expect(states(screen.container)).toEqual(["done", "done", "done"])
    expect(screen.container.querySelector("[aria-current]")).toBeNull()
  })

  it("ends a withdrawal with Sent", async () => {
    const screen = await render(<TransactionStatus kind="withdrawal" state="filled" />)
    await expect.element(screen.getByText("Sent")).toBeVisible()
    await expect.element(screen.getByText("Done. The USDC is at the address")).toBeVisible()
  })

  it("names the reason at the step that failed", async () => {
    const screen = await render(
      <TransactionStatus state="failed" failedAt="confirming" failureReason="The price moved more than 1%." />
    )
    expect(states(screen.container)).toEqual(["done", "fail", "todo"])
    await expect.element(screen.getByText("Didn't go through")).toBeVisible()
    await expect.element(screen.getByText("The price moved more than 1%.")).toBeVisible()
  })
})
