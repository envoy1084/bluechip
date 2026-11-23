import { Button } from "@bluechip/ui/components/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@bluechip/ui/components/sheet"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

function AgentDetails() {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="secondary" />}>Agent details</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Rebalancer</SheetTitle>
        </SheetHeader>
        <SheetFooter>
          <SheetClose render={<Button variant="secondary" />}>Done</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

describe("Sheet", () => {
  it("closes from its buttons and from Esc, returning focus to the trigger", async () => {
    await render(<AgentDetails />)
    const trigger = page.getByRole("button", { name: "Agent details" })
    const sheet = page.getByRole("dialog", { name: "Rebalancer" })

    await userEvent.click(trigger)
    await expect.element(sheet).toBeVisible()
    // Base UI's scroll lock keeps Playwright's stability check from settling in the test iframe; the click is real.
    await userEvent.click(page.getByRole("button", { name: "Close" }), { force: true })
    await expect.element(sheet).not.toBeInTheDocument()
    await expect.element(trigger).toHaveFocus()

    await userEvent.click(trigger)
    await userEvent.click(page.getByRole("button", { name: "Done" }), { force: true })
    await expect.element(sheet).not.toBeInTheDocument()

    await userEvent.click(trigger)
    await expect.element(sheet).toBeVisible()
    await userEvent.keyboard("{Escape}")
    await expect.element(sheet).not.toBeInTheDocument()
  })
})
