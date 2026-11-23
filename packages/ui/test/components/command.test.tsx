import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogContent,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList
} from "@bluechip/ui/components/command"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

interface Entry {
  readonly value: string
  readonly label: string
}

const groups: ReadonlyArray<{ readonly value: string; readonly items: ReadonlyArray<Entry> }> = [
  {
    value: "Suggestions",
    items: [{ value: "create", label: "Create an agent" }, { value: "deposit", label: "Deposit cash" }]
  },
  { value: "Stocks", items: [{ value: "NVDA", label: "Nvidia" }, { value: "AAPL", label: "Apple" }] }
]

function Palette({ onRun }: { readonly onRun: (value: string) => void }) {
  return (
    <Command items={groups}>
      <CommandInput placeholder="Search or type a command…" aria-label="Search commands" />
      <CommandEmpty>No results.</CommandEmpty>
      <CommandList>
        {(group: (typeof groups)[number]) => (
          <CommandGroup key={group.value} items={group.items}>
            <CommandGroupLabel>{group.value}</CommandGroupLabel>
            <CommandCollection>
              {(entry: Entry) => (
                <CommandItem key={entry.value} value={entry} onClick={() => onRun(entry.value)}>
                  {entry.label}
                </CommandItem>
              )}
            </CommandCollection>
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )
}

describe("Command", () => {
  it("filters as you type and runs the highlighted item on Enter", async () => {
    const ran: Array<string> = []
    await render(<Palette onRun={(value) => ran.push(value)} />)
    await userEvent.type(page.getByRole("combobox", { name: "Search commands" }), "nvi")

    await expect.element(page.getByRole("option", { name: "Nvidia" })).toBeVisible()
    await expect.element(page.getByRole("option", { name: "Apple" })).not.toBeInTheDocument()
    await expect.element(page.getByRole("option", { name: "Deposit cash" })).not.toBeInTheDocument()
    await userEvent.keyboard("{Enter}")
    expect(ran).toEqual(["NVDA"])
  })

  it("says so when nothing matches", async () => {
    await render(<Palette onRun={() => {}} />)
    await userEvent.type(page.getByRole("combobox", { name: "Search commands" }), "bitcoin")
    await expect.element(page.getByText("No results.")).toBeVisible()
  })

  it("opens as a dialog with ⌘K and closes after running an item", async () => {
    const ran: Array<string> = []
    await render(
      <CommandDialog>
        <CommandDialogContent>
          <Palette onRun={(value) => ran.push(value)} />
        </CommandDialogContent>
      </CommandDialog>
    )
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()

    await userEvent.keyboard("{Meta>}k{/Meta}")
    const dialog = page.getByRole("dialog", { name: "Search bluechip" })
    await expect.element(dialog).toBeVisible()
    await expect.element(page.getByRole("combobox", { name: "Search commands" })).toHaveFocus()

    await userEvent.keyboard("{ArrowDown}{Enter}")
    expect(ran).toEqual(["deposit"])
    await expect.element(dialog).not.toBeInTheDocument()
  })
})
