import { Dialog, DialogContent, DialogTitle } from "@bluechip/ui/components/dialog"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

describe("DialogContent", () => {
  it("its × button closes the dialog", async () => {
    await render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Rename agent</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    // Base UI's scroll lock keeps Playwright's stability check from settling in the test iframe; the click is real.
    await userEvent.click(page.getByRole("button", { name: "Close" }), { force: true })
    await expect.element(page.getByRole("dialog", { name: "Rename agent" })).not.toBeInTheDocument()
  })

  it("showCloseButton false leaves the × button out", async () => {
    await render(
      <Dialog defaultOpen>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Rename agent</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    await expect.element(page.getByRole("dialog", { name: "Rename agent" })).toBeVisible()
    await expect.element(page.getByRole("button", { name: "Close" })).not.toBeInTheDocument()
  })

  it("keeps showing what it showed while it closes, when closing resets it", async () => {
    // The tests load no stylesheet, so this gives the popup an exit transition to wait for.
    const transition = document.head.appendChild(document.createElement("style"))
    transition.textContent =
      "[data-slot=dialog-content] { transition: opacity 300ms } [data-ending-style] { opacity: 0 }"

    const screen = await render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Passkey added</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    await screen.rerender(
      <Dialog open={false}>
        <DialogContent>
          <DialogTitle>Add a passkey</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    await expect.element(page.getByText("Passkey added")).toBeInTheDocument()
    await expect.element(page.getByText("Add a passkey")).not.toBeInTheDocument()
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
    transition.remove()
  })
})
