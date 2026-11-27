import { TimePicker } from "@bluechip/ui/components/time-picker"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("TimePicker", () => {
  it("a time typed without its colon reads as that time once the box is left", async () => {
    const chosen: Array<string> = []
    const screen = await render(
      <TimePicker aria-label="Time" value="10:00" onValueChange={(time) => chosen.push(time)} />
    )

    await userEvent.fill(screen.getByRole("textbox", { name: "Time" }), "930")
    await userEvent.tab()

    expect(chosen).toEqual(["09:30"])
  })

  it("a time that isn't one goes back to the time it had on Enter", async () => {
    const chosen: Array<string> = []
    const screen = await render(
      <TimePicker aria-label="Time" value="10:00" onValueChange={(time) => chosen.push(time)} />
    )
    const box = screen.getByRole("textbox", { name: "Time" })

    await userEvent.fill(box, "25:00")
    await userEvent.keyboard("{Enter}")

    expect(chosen).toEqual([])
    await expect.element(box).toHaveValue("10:00")
  })

  it("an hour picked from its column keeps the minutes", async () => {
    const chosen: Array<string> = []
    const screen = await render(
      <TimePicker aria-label="Time" value="10:30" onValueChange={(time) => chosen.push(time)} />
    )

    await userEvent.click(screen.getByRole("button", { name: "Pick a time" }))
    await userEvent.click(screen.getByRole("group", { name: "Hour" }).getByRole("button", { name: "14" }))

    expect(chosen).toEqual(["14:30"])
  })

  it("a minute picked closes the picker", async () => {
    const chosen: Array<string> = []
    const screen = await render(
      <TimePicker aria-label="Time" value="10:00" onValueChange={(time) => chosen.push(time)} />
    )

    await userEvent.click(screen.getByRole("button", { name: "Pick a time" }))
    await userEvent.click(screen.getByRole("group", { name: "Minute" }).getByRole("button", { name: "45" }))

    expect(chosen).toEqual(["10:45"])
    await expect.element(screen.getByRole("group", { name: "Hour" })).not.toBeInTheDocument()
  })

  it("arrow keys move down the hours from the one in force", async () => {
    const chosen: Array<string> = []
    const screen = await render(
      <TimePicker aria-label="Time" value="10:00" onValueChange={(time) => chosen.push(time)} />
    )

    await userEvent.click(screen.getByRole("button", { name: "Pick a time" }))
    await expect.element(screen.getByRole("button", { name: "10", pressed: true })).toHaveFocus()
    await userEvent.keyboard("{ArrowDown}{Enter}")

    expect(chosen).toEqual(["11:00"])
  })

  it("a minute off the step is still offered, picked", async () => {
    const screen = await render(<TimePicker aria-label="Time" value="10:07" onValueChange={() => undefined} />)

    await userEvent.click(screen.getByRole("button", { name: "Pick a time" }))

    await expect.element(
      screen.getByRole("group", { name: "Minute" }).getByRole("button", { name: "07", pressed: true })
    ).toBeVisible()
  })
})
