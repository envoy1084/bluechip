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
import type { ReactNode } from "react"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

const AccountMenu = ({ children }: { readonly children: ReactNode }) => (
  <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="secondary" />}>Alex</DropdownMenuTrigger>
    <DropdownMenuContent>{children}</DropdownMenuContent>
  </DropdownMenu>
)

const open = async () => {
  await userEvent.click(page.getByRole("button", { name: "Alex" }))
  await expect.element(page.getByRole("menu")).toBeVisible()
}

describe("DropdownMenu", () => {
  it("an item runs its onClick and closes the menu", async () => {
    const selected: Array<string> = []
    await render(
      <AccountMenu>
        <DropdownMenuItem onClick={() => selected.push("settings")}>Settings</DropdownMenuItem>
      </AccountMenu>
    )
    await open()
    await userEvent.click(page.getByRole("menuitem", { name: "Settings" }))
    expect(selected).toEqual(["settings"])
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument()
  })

  it("a radio item in a submenu reports its value", async () => {
    const values: Array<unknown> = []
    await render(
      <AccountMenu>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Display currency</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup defaultValue="usd" onValueChange={(value) => values.push(value)}>
              <DropdownMenuRadioItem value="usd">US dollar</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="eur">Euro</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </AccountMenu>
    )
    await open()
    await userEvent.click(page.getByRole("menuitem", { name: "Display currency" }))
    await userEvent.click(page.getByRole("menuitemradio", { name: "Euro" }))
    expect(values).toEqual(["eur"])
  })
})
