import type { Page } from "@playwright/test"
import { readFile } from "node:fs/promises"
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
    await card.getByRole("link", { name: "See what bluechip remembers" }).click()
    await expect(page).toHaveURL(/\/memory$/)
    await expect(page.getByText("You never want Tesla.")).toBeVisible()
    await expect(page.getByText(/^You said it on /)).toBeVisible()
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
    await expect(page.getByText("Nothing remembered yet")).toBeVisible()
  })

  test("a guess kept with Remember is listed as confirmed", async ({ page, user: _user, replies }) => {
    await mentionKids(page, replies)
    const card = page.getByRole("region", { name: "Memory, fact" })
    await expect(card.getByText("Should I remember this?")).toBeVisible()

    await card.getByRole("button", { name: "Remember" }).click()

    await expect(card.getByText("Remembered")).toBeVisible()
    await page.goto("/memory")
    await expect(page.getByText("You have kids.")).toBeVisible()
    await expect(page.getByText(/^Inferred on .*, 60% sure$/)).toBeVisible()
    await expect(page.getByRole("region", { name: /^To confirm/ })).toBeHidden()
  })

  test("a guess left with Don't keep it is not kept", async ({ page, user: _user, replies }) => {
    await mentionKids(page, replies)
    const card = page.getByRole("region", { name: "Memory, fact" })

    await card.getByRole("button", { name: "Don't keep it" }).click()

    await expect(card.getByText("Not kept")).toBeVisible()
    await page.goto("/memory")
    await expect(page.getByText("Nothing remembered yet")).toBeVisible()
  })
})

test.describe("the memory page", () => {
  test("a guess waits there until you confirm it", async ({ page, user: _user, replies }) => {
    await mentionKids(page, replies)
    await page.goto("/memory")
    const toConfirm = page.getByRole("region", { name: /^To confirm/ })
    await expect(toConfirm.getByText("You have kids.")).toBeVisible()
    await expect(toConfirm.getByText("It doesn't use them until you confirm them.")).toBeVisible()

    await toConfirm.getByRole("button", { name: "Remember" }).click()

    await expect(toConfirm).toBeHidden()
    await expect(page.getByText("You have kids.")).toBeVisible()
  })

  test("a guess left with Not right is deleted", async ({ page, user: _user, replies }) => {
    await mentionKids(page, replies)
    await page.goto("/memory")

    await page.getByRole("button", { name: "Not right: You have kids." }).click()

    await expect(page.getByText("Nothing remembered yet")).toBeVisible()
  })

  test("a memory is deleted from its row, once you confirm", async ({ page, user: _user, replies }) => {
    await rememberTesla(page, replies)
    await page.goto("/memory")

    await page.getByRole("button", { name: "Delete: You never want Tesla." }).click()
    await page.getByRole("alertdialog", { name: "Delete this memory?" }).getByRole("button", { name: "Delete memory" })
      .click()

    await expect(page.getByText("Nothing remembered yet")).toBeVisible()
  })

  test("Delete everything asks first, then forgets every memory", async ({ page, user: _user, replies }) => {
    await rememberTesla(page, replies)
    await mentionKids(page, replies)
    await page.goto("/memory")
    await expect(page.getByText("You have kids.")).toBeVisible()

    await page.getByRole("button", { name: "Delete everything" }).click()
    const dialog = page.getByRole("alertdialog", { name: "Delete everything bluechip remembers?" })
    await dialog.getByRole("button", { name: "Delete everything" }).click()

    await expect(page.getByText("Nothing remembered yet")).toBeVisible()
  })

  test("a search lists the memories it recalls, and says when none matches", async ({ page, user: _user, replies }) => {
    await rememberTesla(page, replies)
    await mentionKids(page, replies)
    await page.goto("/memory")
    const search = page.getByRole("searchbox", { name: "Search memories" })

    await search.fill("Tesla")

    await expect(page.getByText("You never want Tesla.")).toBeVisible()
    await expect(page.getByText("You have kids.")).toBeHidden()
    await search.fill("Nintendo Switch prices")
    await expect(page.getByText("No memory matches “Nintendo Switch prices”.")).toBeVisible()
  })

  test("a memory an answer used says how many answers used it", async ({ page, user: _user, replies }) => {
    await rememberTesla(page, replies)
    await page.goto("/memory")
    await expect(page.getByText("Not used in an answer yet")).toBeVisible()

    await ask(page, replies, { to: unique("Should I buy some Tesla?"), rounds: [[{ text: "You said never." }]] })
    await page.goto("/memory")

    await expect(page.getByText("Used in 1 answer")).toBeVisible()
  })

  test("Export downloads every memory as JSON", async ({ page, user: _user, replies }) => {
    await rememberTesla(page, replies)
    await page.goto("/memory")

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export" }).click()
    ])
    const file = await download.path()
    const exported = JSON.parse(await readFile(file, "utf8")) as {
      readonly memories: ReadonlyArray<{ readonly text: string }>
    }

    expect(download.suggestedFilename()).toMatch(/^bluechip-memory-\d{4}-\d{2}-\d{2}\.json$/)
    expect(exported.memories.map((memory) => memory.text)).toEqual(["You never want Tesla."])
  })
})
