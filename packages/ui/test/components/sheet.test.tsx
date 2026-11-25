import { Button } from "@bluechip/ui/components/button"
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@bluechip/ui/components/sheet"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

const AgentDetails = ({ showCloseButton = true }: { readonly showCloseButton?: boolean }) => (
  <Sheet defaultOpen>
    <SheetContent showCloseButton={showCloseButton}>
      <SheetHeader>
        <SheetTitle>Rebalancer</SheetTitle>
      </SheetHeader>
      <SheetFooter>
        <SheetClose render={<Button variant="secondary" />}>Done</SheetClose>
      </SheetFooter>
    </SheetContent>
  </Sheet>
)

const sheet = () => page.getByRole("dialog", { name: "Rebalancer" })

// Base UI's scroll lock keeps Playwright's stability check from settling in the test iframe; the clicks are real.
describe("Sheet", () => {
  it("its × button closes it", async () => {
    await render(<AgentDetails />)
    await userEvent.click(page.getByRole("button", { name: "Close" }), { force: true })
    await expect.element(sheet()).not.toBeInTheDocument()
  })

  it("a SheetClose closes it", async () => {
    await render(<AgentDetails />)
    await userEvent.click(page.getByRole("button", { name: "Done" }), { force: true })
    await expect.element(sheet()).not.toBeInTheDocument()
  })

  it("showCloseButton false leaves the × button out", async () => {
    await render(<AgentDetails showCloseButton={false} />)
    await expect.element(sheet()).toBeVisible()
    await expect.element(page.getByRole("button", { name: "Close" })).not.toBeInTheDocument()
  })
})
