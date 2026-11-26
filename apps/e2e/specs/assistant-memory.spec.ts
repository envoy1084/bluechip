import type { Page } from "@playwright/test"
import type { Replies } from "../fixtures/replies.ts"
import { expect, test } from "../fixtures/test.ts"
import { apiHeaders } from "../fixtures/users.ts"
import { ask, unique } from "../utils/assistant.ts"

/** A message after which bluechip infers that you have kids, a guess it asks you to confirm. */
const mentionKids = (page: Page, replies: Replies) =>
  ask(page, replies, {
    to: unique("My kids love Nintendo games"),
    rounds: [[{ text: "Nintendo isn't on bluechip yet." }]],
    notes: {
      title: null,
      memories: [{ kind: "fact", text: "You have kids.", source: "inferred", confidence: 0.6, replaces: null }]
    }
  })

const rememberTesla = (page: Page, replies: Replies) =>
  ask(page, replies, {
    to: unique("Remember that I never want Tesla"),
    rounds: [
      [{ call: "remember", params: { kind: "constraint", text: "You never want Tesla.", agentId: null } }],
      [{ text: "Noted." }]
    ]
  })

test.describe("memory cards", () => {
  test("what you ask bluechip to remember is saved, and the memory page lists it", async ({ page, user: _user, replies }) => {
    await rememberTesla(page, replies)

    const card = page.getByRole("region", { name: "Memory, rule" })
    await expect(card.getByText("Remembered")).toBeVisible()
    await expect(card.getByText("You never want Tesla.")).toBeVisible()
    await card.getByRole("button", { name: "See what bluechip remembers" }).click()
    await expect(page).toHaveURL(/\/memory$/)
    await expect(page.getByText("You never want Tesla.")).toBeVisible()
    await expect(page.getByText(/^You said it, on /)).toBeVisible()
  })

  test("a memory bluechip is asked to forget is gone from the memory page", async ({ page, user: _user, replies }) => {
    await rememberTesla(page, replies)
    const memories = await (await page.request.get("/api/assistant/memories", { headers: apiHeaders }))
      .json() as ReadonlyArray<{ readonly id: string }>

    await ask(page, replies, {
      to: unique("Forget the Tesla thing"),
      rounds: [[{ call: "forget", params: { memoryId: memories[0]!.id } }], [{ text: "Forgotten." }]]
    })

    const card = page.getByRole("region", { name: "Memory, rule" }).last()
    await expect(card.getByText("Forgotten")).toBeVisible()
    await page.goto("/memory")
    await expect(page.getByText("Nothing yet. Tell the assistant what matters to you")).toBeVisible()
  })

  test("a guess kept with Remember is listed as confirmed", async ({ page, user: _user, replies }) => {
    await mentionKids(page, replies)
    const card = page.getByRole("region", { name: "Memory, fact" })
    await expect(card.getByText("Should I remember this?")).toBeVisible()

    await card.getByRole("button", { name: "Remember" }).click()

    await expect(card.getByText("Remembered")).toBeVisible()
    await page.goto("/memory")
    await expect(page.getByText("You have kids.")).toBeVisible()
    await expect(page.getByText(/^Inferred, 60% sure, on /)).toBeVisible()
    await expect(page.getByText("Not confirmed")).toBeHidden()
  })

  test("a guess left with Don't keep it is not kept", async ({ page, user: _user, replies }) => {
    await mentionKids(page, replies)
    const card = page.getByRole("region", { name: "Memory, fact" })

    await card.getByRole("button", { name: "Don't keep it" }).click()

    await expect(card.getByText("Not kept")).toBeVisible()
    await page.goto("/memory")
    await expect(page.getByText("Nothing yet. Tell the assistant what matters to you")).toBeVisible()
  })
})

test.describe("the memory page", () => {
  test("a guess waits there until you confirm it", async ({ page, user: _user, replies }) => {
    await mentionKids(page, replies)
    await page.goto("/memory")
    await expect(page.getByText("Not confirmed")).toBeVisible()
    await expect(page.getByText("bluechip doesn't use it until you confirm it.")).toBeVisible()

    await page.getByRole("button", { name: "Remember" }).click()

    await expect(page.getByText("Not confirmed")).toBeHidden()
    await expect(page.getByText("You have kids.")).toBeVisible()
  })

  test("a memory is deleted from its row", async ({ page, user: _user, replies }) => {
    await rememberTesla(page, replies)
    await page.goto("/memory")

    await page.getByRole("button", { name: "Delete: You never want Tesla." }).click()

    await expect(page.getByText("Nothing yet. Tell the assistant what matters to you")).toBeVisible()
  })

  test("Delete everything asks first, then forgets every memory", async ({ page, user: _user, replies }) => {
    await rememberTesla(page, replies)
    await mentionKids(page, replies)
    await page.goto("/memory")
    await expect(page.getByText("You have kids.")).toBeVisible()

    await page.getByRole("button", { name: "Delete everything" }).click()
    const dialog = page.getByRole("alertdialog", { name: "Delete everything bluechip remembers?" })
    await dialog.getByRole("button", { name: "Delete everything" }).click()

    await expect(page.getByText("Nothing yet. Tell the assistant what matters to you")).toBeVisible()
  })
})
