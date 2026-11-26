import { DatePicker } from "@bluechip/ui/components/date-picker"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("DatePicker", () => {
  it("says its day in words", async () => {
    const screen = await render(<DatePicker aria-label="Last day" value="2026-12-27" onValueChange={() => undefined} />)

    await expect.element(screen.getByRole("button", { name: "Last day" })).toHaveTextContent("Sun 27 Dec 2026")
  })

  it("a day clicked is picked, and closes it", async () => {
    const chosen: Array<string> = []
    const screen = await render(
      <DatePicker aria-label="Last day" value="2026-12-27" onValueChange={(day) => chosen.push(day)} />
    )

    await userEvent.click(screen.getByRole("button", { name: "Last day" }))
    await userEvent.click(screen.getByRole("button", { name: "Thursday 31 December 2026" }))

    expect(chosen).toEqual(["2026-12-31"])
    await expect.element(screen.getByRole("button", { name: "Next month" })).not.toBeInTheDocument()
  })

  it("opens on its day; the arrow keys move from it, a week down and a day across", async () => {
    const chosen: Array<string> = []
    const screen = await render(
      <DatePicker aria-label="Last day" value="2026-12-27" onValueChange={(day) => chosen.push(day)} />
    )

    await userEvent.click(screen.getByRole("button", { name: "Last day" }))
    await expect.element(screen.getByRole("button", { name: "Sunday 27 December 2026" })).toHaveFocus()
    await userEvent.keyboard("{ArrowDown}{ArrowLeft}{Enter}")

    expect(chosen).toEqual(["2027-01-02"])
  })

  it("Next month shows the month after", async () => {
    const screen = await render(<DatePicker aria-label="Last day" value="2026-12-27" onValueChange={() => undefined} />)

    await userEvent.click(screen.getByRole("button", { name: "Last day" }))
    await userEvent.click(screen.getByRole("button", { name: "Next month" }))

    await expect.element(screen.getByText("January 2027")).toBeVisible()
  })

  it("a day before its first can't be picked", async () => {
    const screen = await render(
      <DatePicker aria-label="Last day" value="2026-12-27" min="2026-12-20" onValueChange={() => undefined} />
    )

    await userEvent.click(screen.getByRole("button", { name: "Last day" }))

    await expect.element(screen.getByRole("button", { name: "Saturday 19 December 2026" })).toBeDisabled()
  })
})
