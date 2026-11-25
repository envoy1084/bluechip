import { Field, FieldDescription, FieldLabel } from "@bluechip/ui/components/field"
import { Textarea } from "@bluechip/ui/components/textarea"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const label = "Tell your agent what to do"

describe("Textarea", () => {
  it("without a limit, shows no counter", async () => {
    const screen = await render(<Textarea aria-label={label} defaultValue="Rebalance" />)
    await expect.element(screen.getByText("/", { exact: false })).not.toBeInTheDocument()
  })

  it("counts the default value", async () => {
    const screen = await render(<Textarea aria-label={label} limit={20} defaultValue="Rebalance" />)
    await expect.element(screen.getByText("9 / 20")).toBeVisible()
  })

  it("counts as you type", async () => {
    const screen = await render(<Textarea aria-label={label} limit={20} defaultValue="Rebalance" />)
    await userEvent.type(screen.getByRole("textbox"), " weekly")
    await expect.element(screen.getByText("16 / 20")).toBeVisible()
  })

  it("counts a controlled value", async () => {
    const screen = await render(<Textarea aria-label={label} limit={20} value="Buy NVDA" onChange={() => {}} />)
    await expect.element(screen.getByText("8 / 20")).toBeVisible()
  })

  it("still calls onChange as you type", async () => {
    const typed: Array<string> = []
    const screen = await render(<Textarea aria-label={label} limit={20} onChange={(e) => typed.push(e.target.value)} />)
    await userEvent.type(screen.getByRole("textbox"), "Hi")
    expect(typed).toEqual(["H", "Hi"])
  })

  it("describes the field with its counter", async () => {
    const screen = await render(<Textarea aria-label={label} limit={20} defaultValue="Rebalance" />)
    await expect.element(screen.getByRole("textbox")).toHaveAccessibleDescription("9 / 20")
  })

  describe("limit", () => {
    it("one under the limit: valid", async () => {
      const screen = await render(<Textarea aria-label={label} limit={10} defaultValue="Buy stock" />)
      await expect.element(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid")
    })

    it("on the limit: valid", async () => {
      const screen = await render(<Textarea aria-label={label} limit={10} defaultValue="Buy stocks" />)
      await expect.element(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid")
    })

    it("one past the limit: invalid", async () => {
      const screen = await render(<Textarea aria-label={label} limit={10} defaultValue="Buy stocks!" />)
      await expect.element(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true")
    })

    it("past the limit, the counter is marked over", async () => {
      const screen = await render(<Textarea aria-label={label} limit={10} defaultValue="Buy stocks!" />)
      await expect.element(screen.getByText("11 / 10")).toHaveAttribute("data-over")
    })

    it("typing past the limit makes it invalid", async () => {
      const screen = await render(<Textarea aria-label={label} limit={10} defaultValue="Buy stocks" />)
      await userEvent.type(screen.getByRole("textbox"), "!")
      await expect.element(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true")
    })
  })

  describe("inside a Field", () => {
    it("is the field's labelled control", async () => {
      const screen = await render(
        <Field>
          <FieldLabel>Instructions</FieldLabel>
          <Textarea />
        </Field>
      )
      await expect.element(screen.getByRole("textbox", { name: "Instructions" })).toBeInTheDocument()
    })

    it("keeps the field's description alongside its counter", async () => {
      const screen = await render(
        <Field>
          <FieldLabel>Instructions</FieldLabel>
          <Textarea limit={20} defaultValue="Rebalance" />
          <FieldDescription>Plain words are fine.</FieldDescription>
        </Field>
      )
      await expect.element(screen.getByRole("textbox")).toHaveAccessibleDescription("Plain words are fine. 9 / 20")
    })
  })
})
