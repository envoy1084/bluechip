import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@bluechip/ui/components/alert-dialog"
import { Button } from "@bluechip/ui/components/button"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

const keep = () => {}

const RemoveAgent = ({ onRemove = keep }: { readonly onRemove?: () => void }) => (
  <AlertDialog defaultOpen>
    <AlertDialogTrigger render={<Button variant="danger" />}>Remove agent</AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Remove Rebalancer?</AlertDialogTitle>
        <AlertDialogDescription>It stops right away and can't trade again.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep agent</AlertDialogCancel>
        <AlertDialogAction onClick={onRemove}>Remove</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)

const dialog = () => page.getByRole("alertdialog", { name: "Remove Rebalancer?" })

// Press a button from the keyboard: a pointer click lands before the popup settles under Base UI's scroll lock.
const press = async (name: string) => {
  const button = page.getByRole("button", { name })
  button.element().focus()
  await expect.element(button).toHaveFocus()
  await userEvent.keyboard("{Enter}")
}

describe("AlertDialog", () => {
  it("focus starts on the first button, the safe choice", async () => {
    await render(<RemoveAgent />)
    await expect.element(page.getByRole("button", { name: "Keep agent" })).toHaveFocus()
  })

  it("a press outside leaves it open", async () => {
    await render(<RemoveAgent />)
    await expect.element(dialog()).toBeVisible()
    // At the page's top-left corner. The scroll lock keeps Playwright's stability check from settling in the test
    // iframe, so the click skips it; the press itself is real.
    await userEvent.click(page.elementLocator(document.body), { position: { x: 2, y: 2 }, force: true })
    await expect.element(dialog()).toBeVisible()
  })

  it("the action runs its onClick", async () => {
    let removed = 0
    await render(<RemoveAgent onRemove={() => removed++} />)
    await press("Remove")
    expect(removed).toBe(1)
  })

  it("the action closes it", async () => {
    await render(<RemoveAgent />)
    await press("Remove")
    await expect.element(dialog()).not.toBeInTheDocument()
  })

  it("cancel closes it without running the action", async () => {
    let removed = 0
    await render(<RemoveAgent onRemove={() => removed++} />)
    await press("Keep agent")
    await expect.element(dialog()).not.toBeInTheDocument()
    expect(removed).toBe(0)
  })
})
