import { stepStates, TransactionStatus } from "@bluechip/ui/bluechip/transaction-status"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"

describe("stepStates", () => {
  it("sending", () => {
    expect(stepStates("sending", "confirming")).toStrictEqual(["now", "todo", "todo"])
  })

  it("confirming", () => {
    expect(stepStates("confirming", "confirming")).toStrictEqual(["done", "now", "todo"])
  })

  it("filled", () => {
    expect(stepStates("filled", "confirming")).toStrictEqual(["done", "done", "done"])
  })

  it("failed while sending", () => {
    expect(stepStates("failed", "sending")).toStrictEqual(["fail", "todo", "todo"])
  })

  it("failed while confirming", () => {
    expect(stepStates("failed", "confirming")).toStrictEqual(["done", "fail", "todo"])
  })
})

describe("TransactionStatus", () => {
  const stepTexts = (screen: Awaited<ReturnType<typeof render>>) =>
    screen.getByRole("listitem").elements().map((step) =>
      step.querySelector(":scope > span:last-child > span")?.textContent
    )

  it("marks the step in progress as the current one", async () => {
    const screen = await render(<TransactionStatus state="confirming" />)
    await expect.element(screen.getByRole("listitem").nth(1)).toHaveAttribute("aria-current", "step")
  })

  it("has no current step once filled", async () => {
    const screen = await render(<TransactionStatus state="filled" />)
    expect(screen.container.querySelector("[aria-current]")).toBeNull()
  })

  it("follows a trade into your portfolio", async () => {
    const screen = await render(<TransactionStatus state="filled" />)
    expect(stepTexts(screen)).toStrictEqual([
      "Your trade is on its way",
      "Base is confirming it",
      "Done. It's in your portfolio"
    ])
  })

  it("follows a withdrawal to the address, ending with Sent", async () => {
    const screen = await render(<TransactionStatus kind="withdrawal" state="filled" />)
    await expect.element(screen.getByRole("listitem").nth(2).getByText("Sent", { exact: true }).first()).toBeVisible()
    expect(stepTexts(screen)).toStrictEqual([
      "Your withdrawal is on its way",
      "Base is confirming it",
      "Done. The USDC is at the address"
    ])
  })

  it("names the reason at the step that failed", async () => {
    const screen = await render(
      <TransactionStatus state="failed" failedAt="sending" failureReason="Base didn't take the trade." />
    )
    expect(stepTexts(screen)[0]).toBe("Base didn't take the trade.")
    await expect.element(screen.getByText("Didn't go through").first()).toBeVisible()
  })

  it("blames the price by default when a trade fails", async () => {
    const screen = await render(<TransactionStatus state="failed" />)
    expect(stepTexts(screen)[1]).toBe("The price moved more than 1%. Nothing was bought.")
  })

  it("blames the price by default when a withdrawal fails, today", async () => {
    const screen = await render(<TransactionStatus kind="withdrawal" state="failed" />)
    expect(stepTexts(screen)[1]).toBe("The price moved more than 1%. Nothing was bought.")
  })

  it.skip("explains a failed withdrawal by default (bug: the default reason talks about a price and buying)", async () => {
    const screen = await render(<TransactionStatus kind="withdrawal" state="failed" />)
    expect(stepTexts(screen)[1]).not.toContain("Nothing was bought")
  })
})
