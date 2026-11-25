// The assistant's recorded model on the suite's server: each test records what the model answers to the messages it
// is about to send (`POST /e2e/replies`, see `apps/server/test/stack/main.ts`). Replies are matched by the message,
// word for word, so tests use messages of their own.
import type { APIRequestContext } from "@playwright/test"
import { urls } from "../stack/Stack.ts"

/** One thing the model does in a round (`RecordedModel`'s `Step`). */
export type Step =
  | { readonly text: string; readonly partial?: boolean }
  | { readonly hang: true }
  | { readonly call: string; readonly params: object }
  | {
    readonly search: string
    readonly results: ReadonlyArray<{ readonly url: string; readonly title: string; readonly citedText?: string }>
  }

/** The model's answer to one message (`RecordedModel`'s `Reply`). */
export interface Reply {
  readonly to: string
  readonly rounds: ReadonlyArray<ReadonlyArray<Step>>
  readonly conversationFails?: boolean
  readonly notes?: {
    readonly title: string | null
    readonly memories: ReadonlyArray<{
      readonly kind: string
      readonly text: string
      readonly source: "said" | "inferred"
      readonly confidence: number
      readonly replaces: string | null
    }>
  }
  readonly usage?: { readonly input: number; readonly output: number }
}

export class Replies {
  readonly #request: APIRequestContext

  constructor(request: APIRequestContext) {
    this.#request = request
  }

  async record(...replies: ReadonlyArray<Reply>) {
    const response = await this.#request.post(`${urls.server}/e2e/replies`, { data: replies })
    if (response.status() !== 204) throw new Error(`e2e: recording replies answered ${response.status()}`)
  }
}
