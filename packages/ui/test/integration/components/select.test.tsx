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
  it("choosing an option reports it and shows it in the trigger", async () => {
    const chosen: Array<string | null> = []
    const screen = await render(
      <Select items={repeats} defaultValue="week" onValueChange={(value: string | null) => chosen.push(value)}>
        <SelectLabel>Repeat</SelectLabel>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {repeats.map((repeat) => <SelectItem key={repeat.value} value={repeat.value}>{repeat.label}</SelectItem>)}
        </SelectContent>
      </Select>
    )
    const trigger = screen.getByRole("combobox", { name: "Repeat" })
    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole("option", { name: "Every month" }))
    expect(chosen).toEqual(["month"])
    await expect.element(trigger).toHaveTextContent("Every month")
  })
})
