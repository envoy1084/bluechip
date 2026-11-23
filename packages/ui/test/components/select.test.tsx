import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "@bluechip/ui/components/select"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const repeats = [
  { value: "day", label: "Every day" },
  { value: "week", label: "Every week" },
  { value: "month", label: "Every month" }
]

describe("Select", () => {
  it("opens with the keyboard and picks the highlighted option with Enter", async () => {
    let chosen: string | null = null
    const screen = await render(
      <Select items={repeats} defaultValue="week" onValueChange={(value: string | null) => (chosen = value)}>
        <SelectLabel>Repeat</SelectLabel>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {repeats.map((repeat) => <SelectItem key={repeat.value} value={repeat.value}>{repeat.label}</SelectItem>)}
        </SelectContent>
      </Select>
    )
    const trigger = screen.getByRole("combobox")
    await userEvent.click(screen.getByText("Repeat"))
    trigger.element().focus()
    await userEvent.keyboard("{ArrowDown}")
    await expect.element(screen.getByRole("listbox")).toBeVisible()
    await expect.element(screen.getByRole("option", { name: "Every week" })).toHaveAttribute("data-highlighted")
    await userEvent.keyboard("{ArrowDown}{Enter}")
    expect(chosen).toBe("month")
    await expect.element(trigger).toHaveTextContent("Every month")
    await expect.element(screen.getByRole("listbox")).not.toBeInTheDocument()
  })
})
