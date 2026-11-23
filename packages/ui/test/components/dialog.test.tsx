import { Button } from "@bluechip/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@bluechip/ui/components/dialog"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

function RenameAgent() {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>Rename agent</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename agent</DialogTitle>
          <DialogDescription>Only you see this name. Its limits stay the same.</DialogDescription>
        </DialogHeader>
        <input aria-label="Name" defaultValue="Rebalancer" />
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
          <Button>Save name</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

describe("Dialog", () => {
  it("moves focus in, keeps Tab inside, closes on Esc and gives focus back", async () => {
    await render(<RenameAgent />)
    const trigger = page.getByRole("button", { name: "Rename agent" })
    await userEvent.click(trigger)

    const dialog = page.getByRole("dialog", { name: "Rename agent" })
    await expect.element(dialog).toBeVisible()
    await expect.poll(() => dialog.element().contains(document.activeElement)).toBe(true)

    // Four tabbable controls (input, Cancel, Save name, Close): six presses wrap around at least once.
    for (let press = 0; press < 6; press++) {
      await userEvent.keyboard("{Tab}")
      expect(dialog.element().contains(document.activeElement)).toBe(true)
    }
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}")
    expect(dialog.element().contains(document.activeElement)).toBe(true)

    await userEvent.keyboard("{Escape}")
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(trigger).toHaveFocus()
  })

  it("closes from its Close button", async () => {
    await render(<RenameAgent />)
    await userEvent.click(page.getByRole("button", { name: "Rename agent" }))
    // Base UI's scroll lock keeps Playwright's stability check from settling in the test iframe; the click is real.
    await userEvent.click(page.getByRole("button", { name: "Close" }), { force: true })
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
  })
})
