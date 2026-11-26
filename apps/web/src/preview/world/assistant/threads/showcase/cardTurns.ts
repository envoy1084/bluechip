// A showcase turn made of catalog cards: what you asked, then each card as the round that shows it.
import type { CardStatus } from "@bluechip/domain/assistant/Card"
import type { CastAgent } from "../../../cast.ts"
import { type CardKind, makeCard, roundOf } from "../../cards.ts"
import { say, type ThreadContext, type Turn } from "../../rounds.ts"

export const cardTurn = (
  context: ThreadContext,
  you: string,
  cards: ReadonlyArray<readonly [kind: CardKind, status: CardStatus]>,
  options: { readonly focus?: CastAgent | null; readonly after?: string } = {}
): Turn => ({
  you,
  rounds: [
    ...cards.map(([kind, status]) => {
      const made = makeCard(context.mint, kind, status, options.focus ?? null)
      context.keep(made.memories)
      return roundOf(context.mint, made)
    }),
    ...(options.after === undefined ? [] : [[say(options.after)]])
  ]
})
