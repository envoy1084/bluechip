import { Button } from "@bluechip/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@bluechip/ui/components/dropdown-menu"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

function AccountMenu({ onSelect }: { readonly onSelect: (item: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="secondary" />}>Alex</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => onSelect("profile")}>Profile</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect("settings")}>Settings</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Display currency</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup defaultValue="usd" onValueChange={(value) => onSelect(String(value))}>
              <DropdownMenuRadioItem value="usd">US dollar</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="eur">Euro</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

describe("DropdownMenu", () => {
  it("moves with the arrow keys and runs the item on Enter", async () => {
    const selected: Array<string> = []
    await render(<AccountMenu onSelect={(item) => selected.push(item)} />)
    const trigger = page.getByRole("button", { name: "Alex" })
    trigger.element().focus()
    await userEvent.keyboard("{ArrowDown}")

    await expect.element(page.getByRole("menuitem", { name: "Profile" })).toHaveAttribute("data-highlighted")
    await userEvent.keyboard("{ArrowDown}")
    await expect.element(page.getByRole("menuitem", { name: "Settings" })).toHaveAttribute("data-highlighted")
    await userEvent.keyboard("{Enter}")

    expect(selected).toEqual(["settings"])
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument()
    await expect.element(trigger).toHaveFocus()
  })

  it("opens a submenu with ArrowRight and closes layer by layer with Esc", async () => {
    const selected: Array<string> = []
    await render(<AccountMenu onSelect={(item) => selected.push(item)} />)
    const trigger = page.getByRole("button", { name: "Alex" })
    trigger.element().focus()
    await userEvent.keyboard("{ArrowDown}")
    // Wait for the menu to mount before the next key, or End can land before the list exists.
    await expect.element(page.getByRole("menuitem", { name: "Profile" })).toHaveAttribute("data-highlighted")
    await userEvent.keyboard("{End}")
    await expect.element(page.getByRole("menuitem", { name: "Display currency" })).toHaveAttribute("data-highlighted")

    await userEvent.keyboard("{ArrowRight}")
    const euro = page.getByRole("menuitemradio", { name: "Euro" })
    await expect.element(euro).toBeVisible()
    await expect.element(page.getByRole("menuitemradio", { name: "US dollar" })).toHaveAttribute("aria-checked", "true")
    await userEvent.keyboard("{ArrowDown}{Enter}")
    expect(selected).toEqual(["eur"])

    await userEvent.keyboard("{Escape}")
    await expect.element(euro).not.toBeInTheDocument()
    await expect.element(page.getByRole("menuitem", { name: "Profile" })).toBeVisible()
    await userEvent.keyboard("{Escape}")
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument()
    await expect.element(trigger).toHaveFocus()
  })
})
