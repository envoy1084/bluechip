import type { Card, ConfirmableCard } from "@bluechip/domain/assistant/Card"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { agentsReactivityKey, templatesReactivityKey } from "../../../lib/api/client.ts"
import { assistantReactivityKey, confirmCardAtom, dismissCardAtom } from "../atoms/assistant.ts"
import { cardProblem } from "../model/cardText.ts"

// Confirming a card changes agents, templates or memories; each list refetches.
const reactivityKeys = [assistantReactivityKey, agentsReactivityKey, templatesReactivityKey]

/** Confirming or dismissing a card that waits for you; `onCard` gets the card as it was left. */
export function useCardAnswer(card: ConfirmableCard, onCard: (card: Card) => void) {
  const confirm = useAtomSet(confirmCardAtom, { mode: "promise" })
  const dismiss = useAtomSet(dismissCardAtom, { mode: "promise" })
  const [busy, setBusy] = useState<"confirm" | "dismiss" | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const answer = async (choice: "confirm" | "dismiss") => {
    setBusy(choice)
    setProblem(null)
    try {
      onCard(await (choice === "confirm" ? confirm : dismiss)({ params: { id: card.id }, reactivityKeys }))
    } catch (error) {
      setProblem(cardProblem(error))
    } finally {
      setBusy(null)
    }
  }

  return { busy, problem, confirm: () => void answer("confirm"), dismiss: () => void answer("dismiss") }
}
