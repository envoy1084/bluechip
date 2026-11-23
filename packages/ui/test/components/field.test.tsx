import { Button } from "@bluechip/ui/components/button"
import { Field, FieldError, FieldLabel, Form } from "@bluechip/ui/components/field"
import { Input } from "@bluechip/ui/components/input"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { userEvent } from "vitest/browser"

const SetupForm = ({ onSubmit }: { readonly onSubmit: () => void }) => (
  <Form onFormSubmit={onSubmit}>
    <Field name="name" validate={(value) => (String(value ?? "").trim() ? null : "Give your agent a name.")}>
      <FieldLabel>Agent name</FieldLabel>
      <Input />
      <FieldError />
    </Field>
    <Field
      name="amount"
      validate={(value) => {
        const amount = Number(value)
        return amount >= 10 && amount <= 1000 ? null : "Enter an amount from $10 to $1,000."
      }}
    >
      <FieldLabel>Amount each week</FieldLabel>
      <Input inputMode="decimal" />
      <FieldError />
    </Field>
    <Button type="submit">Create Weekly buyer</Button>
  </Form>
)

describe("Field and Form", () => {
  it("shows each error and focuses the first invalid field on submit", async () => {
    let submits = 0
    const screen = await render(<SetupForm onSubmit={() => submits++} />)
    await userEvent.click(screen.getByRole("button", { name: "Create Weekly buyer" }))
    await expect.element(screen.getByText("Give your agent a name.")).toBeVisible()
    await expect.element(screen.getByText("Enter an amount from $10 to $1,000.")).toBeVisible()
    await expect.element(screen.getByLabelText("Agent name")).toHaveFocus()
    await expect.element(screen.getByLabelText("Agent name")).toHaveAttribute("aria-invalid", "true")
    expect(submits).toBe(0)
  })

  it("revalidates as the user fixes a field, then submits", async () => {
    let submits = 0
    const screen = await render(<SetupForm onSubmit={() => submits++} />)
    await userEvent.click(screen.getByRole("button", { name: "Create Weekly buyer" }))
    await userEvent.fill(screen.getByLabelText("Agent name"), "Friday buyer")
    await expect.element(screen.getByText("Give your agent a name.")).not.toBeInTheDocument()
    await userEvent.fill(screen.getByLabelText("Amount each week"), "50")
    await userEvent.click(screen.getByRole("button", { name: "Create Weekly buyer" }))
    expect(submits).toBe(1)
  })
})
