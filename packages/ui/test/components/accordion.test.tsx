import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@bluechip/ui/components/accordion"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

describe("Accordion", () => {
  it("opens one question at a time with Enter and Space, moving between them with Tab", async () => {
    await render(
      <Accordion defaultValue={["cash"]}>
        <AccordionItem value="cash">
          <AccordionTrigger>What can an agent do with my cash?</AccordionTrigger>
          <AccordionContent>Only what its limits allow.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="withdraw">
          <AccordionTrigger>Can an agent withdraw my money?</AccordionTrigger>
          <AccordionContent>No. Moving cash out always needs you and Face ID.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="remove" disabled>
          <AccordionTrigger>How do I remove an agent?</AccordionTrigger>
          <AccordionContent>Open the agent and choose Remove agent.</AccordionContent>
        </AccordionItem>
      </Accordion>
    )
    const cash = page.getByRole("button", { name: "What can an agent do with my cash?" })
    const withdraw = page.getByRole("button", { name: "Can an agent withdraw my money?" })
    await expect.element(cash).toHaveAttribute("aria-expanded", "true")

    // Base UI follows the updated APG pattern: triggers are plain Tab stops, no arrow-key roving.
    cash.element().focus()
    await userEvent.keyboard("{Tab}")
    await expect.element(withdraw).toHaveFocus()
    await userEvent.keyboard("{Enter}")

    await expect.element(withdraw).toHaveAttribute("aria-expanded", "true")
    await expect.element(page.getByText("Moving cash out always needs you", { exact: false })).toBeVisible()
    await expect.element(cash).toHaveAttribute("aria-expanded", "false")

    await userEvent.keyboard(" ")
    await expect.element(withdraw).toHaveAttribute("aria-expanded", "false")
  })
})
