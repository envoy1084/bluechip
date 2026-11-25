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
})
