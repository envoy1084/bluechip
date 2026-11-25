import { Button } from "@bluechip/ui/components/button"
import { Field, FieldError, FieldLabel, Form } from "@bluechip/ui/components/field"
import { Input } from "@bluechip/ui/components/input"
import { describe, expect, it } from "@effect/vitest"
import type { ReactNode } from "react"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

const nameRequired = (value: unknown) => (String(value ?? "").trim() ? null : "Give your agent a name.")

const ignore = () => {}

const SetupForm = (
  { onSubmit = ignore, children }: { readonly onSubmit?: () => void; readonly children: ReactNode }
) => (
  <Form onFormSubmit={onSubmit}>
    {children}
    <Button type="submit">Create agent</Button>
  </Form>
)

const submit = () => userEvent.click(page.getByRole("button", { name: "Create agent" }))

describe("Form", () => {
  it("doesn't submit while a field is invalid", async () => {
    let submits = 0
    await render(
      <SetupForm onSubmit={() => submits++}>
        <Field name="name" validate={nameRequired}>
          <FieldLabel>Agent name</FieldLabel>
          <Input />
          <FieldError />
        </Field>
      </SetupForm>
    )
    await submit()
    await expect.element(page.getByLabelText("Agent name")).toHaveAttribute("aria-invalid", "true")
    expect(submits).toBe(0)
  })

  it("submits once every field is valid", async () => {
    let submits = 0
    await render(
      <SetupForm onSubmit={() => submits++}>
        <Field name="name" validate={nameRequired}>
          <FieldLabel>Agent name</FieldLabel>
          <Input defaultValue="Friday buyer" />
          <FieldError />
        </Field>
      </SetupForm>
    )
    await submit()
    expect(submits).toBe(1)
  })

  it("focuses the first invalid field on submit", async () => {
    await render(
      <SetupForm>
        <Field name="name">
          <FieldLabel>Agent name</FieldLabel>
          <Input defaultValue="Friday buyer" />
        </Field>
        <Field name="amount" validate={() => "Enter an amount from $10 to $1,000."}>
          <FieldLabel>Amount each week</FieldLabel>
          <Input />
        </Field>
      </SetupForm>
    )
    await submit()
    await expect.element(page.getByLabelText("Amount each week")).toHaveFocus()
  })
})

describe("FieldError", () => {
  it("without children, shows the message from validate", async () => {
    await render(
      <SetupForm>
        <Field name="name" validate={nameRequired}>
          <FieldLabel>Agent name</FieldLabel>
          <Input />
          <FieldError />
        </Field>
      </SetupForm>
    )
    await submit()
    await expect.element(page.getByText("Give your agent a name.")).toBeVisible()
  })

  it("without children, shows the browser's message for a native constraint", async () => {
    await render(
      <SetupForm>
        <Field name="name">
          <FieldLabel>Agent name</FieldLabel>
          <Input required />
          <FieldError />
        </Field>
      </SetupForm>
    )
    await submit()
    await expect.element(page.getByText("Please fill out this field.")).toBeVisible()
  })

  it("with children, shows them instead", async () => {
    await render(
      <SetupForm>
        <Field name="name" validate={nameRequired}>
          <FieldLabel>Agent name</FieldLabel>
          <Input />
          <FieldError>Every agent needs a name.</FieldError>
        </Field>
      </SetupForm>
    )
    await submit()
    await expect.element(page.getByText("Every agent needs a name.")).toBeVisible()
  })

  it("stays hidden while the field is valid", async () => {
    await render(
      <SetupForm>
        <Field name="name" validate={nameRequired}>
          <FieldLabel>Agent name</FieldLabel>
          <Input defaultValue="Friday buyer" />
          <FieldError>Every agent needs a name.</FieldError>
        </Field>
      </SetupForm>
    )
    await submit()
    await expect.element(page.getByText("Every agent needs a name.")).not.toBeInTheDocument()
  })
})
