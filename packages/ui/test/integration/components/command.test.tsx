import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogContent,
  type CommandDialogProps,
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

const ignore = () => {}

const Palette = ({ onRun = ignore }: { readonly onRun?: (value: string) => void }) => (
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

const PaletteDialog = (
  { onRun, ...props }: Omit<CommandDialogProps, "children"> & { readonly onRun?: (value: string) => void }
) => (
  <CommandDialog {...props}>
    <CommandDialogContent>
      <Palette {...(onRun ? { onRun } : {})} />
    </CommandDialogContent>
  </CommandDialog>
)

const palette = () => page.getByRole("dialog", { name: "Search bluechip" })

describe("Command", () => {
  it("lists every item before anything is typed", async () => {
    await render(<Palette />)
    await expect.element(page.getByRole("option", { name: "Apple" })).toBeVisible()
    expect(page.getByRole("option").elements().map((option) => option.textContent)).toEqual([
      "Create an agent",
      "Deposit cash",
      "Nvidia",
      "Apple"
    ])
  })

  it("typing narrows the list to the matches", async () => {
    await render(<Palette />)
    await userEvent.type(page.getByRole("combobox", { name: "Search commands" }), "nvi")
    await expect.element(page.getByRole("option", { name: "Nvidia" })).toBeVisible()
    await expect.element(page.getByRole("option", { name: "Apple" })).not.toBeInTheDocument()
  })

  it("Enter runs the first match without moving to it", async () => {
    const ran: Array<string> = []
    await render(<Palette onRun={(value) => ran.push(value)} />)
    await userEvent.type(page.getByRole("combobox", { name: "Search commands" }), "nvi")
    await expect.element(page.getByRole("option", { name: "Apple" })).not.toBeInTheDocument()
    await userEvent.keyboard("{Enter}")
    expect(ran).toEqual(["NVDA"])
  })

  it("says so when nothing matches", async () => {
    await render(<Palette />)
    await userEvent.type(page.getByRole("combobox", { name: "Search commands" }), "bitcoin")
    await expect.element(page.getByText("No results.")).toBeVisible()
  })
})

describe("CommandDialog", () => {
  it("starts closed", async () => {
    await render(<PaletteDialog />)
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
  })

  it("⌘K opens it", async () => {
    await render(<PaletteDialog />)
    await userEvent.keyboard("{Meta>}k{/Meta}")
    await expect.element(palette()).toBeVisible()
  })

  it("Ctrl+K opens it", async () => {
    await render(<PaletteDialog />)
    await userEvent.keyboard("{Control>}k{/Control}")
    await expect.element(palette()).toBeVisible()
  })

  it("⌘K closes it when open", async () => {
    await render(<PaletteDialog defaultOpen />)
    await expect.element(palette()).toBeVisible()
    await userEvent.keyboard("{Meta>}k{/Meta}")
    await expect.element(palette()).not.toBeInTheDocument()
  })

  it("K without ⌘ or Ctrl doesn't open it", async () => {
    const changes: Array<boolean> = []
    await render(<PaletteDialog onOpenChange={(open) => changes.push(open)} />)
    await userEvent.keyboard("k")
    expect(changes).toEqual([])
  })

  it("its hotkey can be another letter", async () => {
    await render(<PaletteDialog hotkey="j" />)
    await userEvent.keyboard("{Meta>}j{/Meta}")
    await expect.element(palette()).toBeVisible()
  })

  it("hotkey false turns ⌘K off", async () => {
    const changes: Array<boolean> = []
    await render(<PaletteDialog hotkey={false} onOpenChange={(open) => changes.push(open)} />)
    await userEvent.keyboard("{Meta>}k{/Meta}")
    expect(changes).toEqual([])
  })

  it("reports opening through onOpenChange", async () => {
    const changes: Array<boolean> = []
    await render(<PaletteDialog onOpenChange={(open) => changes.push(open)} />)
    await userEvent.keyboard("{Meta>}k{/Meta}")
    expect(changes).toEqual([true])
  })

  it("running an item runs it and closes the dialog", async () => {
    const ran: Array<string> = []
    await render(<PaletteDialog defaultOpen onRun={(value) => ran.push(value)} />)
    await expect.element(page.getByRole("combobox", { name: "Search commands" })).toHaveFocus()
    await userEvent.keyboard("{ArrowDown}{Enter}")
    expect(ran).toEqual(["deposit"])
    await expect.element(palette()).not.toBeInTheDocument()
  })
})
