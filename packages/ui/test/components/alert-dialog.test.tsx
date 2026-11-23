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

describe("AlertDialog", () => {
  it("starts on the safe choice and ignores outside clicks", async () => {
    let removed = 0
    await render(
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="danger" />}>Remove agent</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Rebalancer?</AlertDialogTitle>
            <AlertDialogDescription>It stops right away and can't trade again.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep agent</AlertDialogCancel>
            <AlertDialogAction onClick={() => removed++}>Remove agent</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
    await userEvent.click(page.getByRole("button", { name: "Remove agent" }))
    const dialog = page.getByRole("alertdialog", { name: "Remove Rebalancer?" })
    await expect.element(dialog).toBeVisible()
    await expect.element(page.getByRole("button", { name: "Keep agent" })).toHaveFocus()

    // Press outside the popup, at the page's top-left corner. Base UI's scroll lock keeps Playwright's stability check
    // from settling in the test iframe, so the click skips it; the press itself is real.
    await userEvent.click(page.elementLocator(document.body), { position: { x: 2, y: 2 }, force: true })
    await expect.element(dialog).toBeVisible()

    dialog.getByRole("button", { name: "Remove agent" }).element().focus()
    await userEvent.keyboard("{Enter}")
    expect(removed).toBe(1)
    await expect.element(dialog).not.toBeInTheDocument()
  })
})
