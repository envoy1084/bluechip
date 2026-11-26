// The assistant on home, driven the way a person does: type a message, read bluechip's turn. Replies are recorded
// before each message (`fixtures/replies.ts`) and matched word for word across the whole suite, so every message a test
// sends carries a tag of its own.
import { expect, type Locator, type Page } from "@playwright/test"
import { randomUUID } from "node:crypto"
import type { Replies, Reply } from "../fixtures/replies.ts"

/** A message no other test sends: `text` with a short tag of its own. */
export const unique = (text: string): string => `${text} (${randomUUID().slice(0, 8)})`

export const composer = (page: Page): Locator => page.getByRole("textbox", { name: "Message bluechip" })

/** bluechip's latest turn in the thread. */
export const lastTurn = (page: Page): Locator =>
  page.locator("[data-slot=\"chat-message\"][data-from=\"bluechip\"]").last()

/** Records `reply`, sends its message from the composer with Enter, and waits until bluechip's turn has ended. */
export const ask = async (page: Page, replies: Replies, reply: Reply): Promise<void> => {
  await replies.record(reply)
  await composer(page).fill(reply.to)
  await composer(page).press("Enter")
  await expect(page.getByText(reply.to, { exact: true })).toBeVisible()
  await expect(lastTurn(page)).toHaveAttribute("data-status", /^(done|error)$/)
}
