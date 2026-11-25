import { Checkbox } from "@bluechip/ui/components/checkbox"
import { HAPTIC_EVENT } from "@bluechip/ui/lib/haptics"
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

describe("Checkbox", () => {
  let played: Array<unknown> = []
  const listen = (event: Event) => played.push((event as CustomEvent).detail)
  beforeEach(() => {
    played = []
    window.addEventListener(HAPTIC_EVENT, listen)
  })
  afterEach(() => window.removeEventListener(HAPTIC_EVENT, listen))

  // Components are unstyled in tests, so an empty checkbox has no box to click: press it from the keyboard.
  const press = async (screen: Awaited<ReturnType<typeof render>>) => {
    const checkbox = screen.getByRole("checkbox")
    checkbox.element().focus()
    await expect.element(checkbox).toHaveFocus()
    await userEvent.keyboard(" ")
  }

  it("a press plays the select haptic", async () => {
    const screen = await render(<Checkbox aria-label="Email me a receipt" />)
    await press(screen)
    expect(played).toEqual(["select"])
  })

  it("a press still reports the new state", async () => {
    const changes: Array<boolean> = []
    const screen = await render(<Checkbox aria-label="Email me a receipt" onCheckedChange={(c) => changes.push(c)} />)
    await press(screen)
    expect(changes).toEqual([true])
  })
})
