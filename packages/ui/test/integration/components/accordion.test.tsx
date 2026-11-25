import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@bluechip/ui/components/accordion"
import { describe, expect, it } from "@effect/vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

describe("Accordion", () => {
  it("pressing a question opens its answer", async () => {
    await render(
      <Accordion>
        <AccordionItem value="withdraw">
          <AccordionTrigger>Can an agent withdraw my money?</AccordionTrigger>
          <AccordionContent>No. Moving cash out always needs you and Face ID.</AccordionContent>
        </AccordionItem>
      </Accordion>
    )
    await userEvent.click(page.getByRole("button", { name: "Can an agent withdraw my money?" }))
    await expect.element(page.getByText("No. Moving cash out always needs you and Face ID.")).toBeVisible()
  })
})
