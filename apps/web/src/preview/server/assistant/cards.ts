// Answering the assistant's cards in the preview, as bluechip's `Cards` does: confirming applies a pending card (or
// fails as the panel says: answered already, or no longer valid), dismissing leaves it, a drafted agent's automations
// are kept or left out and then started, and a memory confirmed from the memory page answers its cards too.
import { Agent } from "@bluechip/domain/agents/Agent"
import { type Card, isPending } from "@bluechip/domain/assistant/Card"
import { Memory } from "@bluechip/domain/assistant/Memory"
import { AutomationProblem } from "@bluechip/domain/automations/Automation"
import { Conflict, InvalidAutomation, InvalidSpec, NotFound } from "@bluechip/domain/Errors"
import type { AutomationId } from "@bluechip/domain/Ids"
import { PolicyProblem } from "@bluechip/domain/policies/AgentSpec"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import type { PreviewStore } from "../../store.ts"
import { type AssistantSlice, findCard, saveCard } from "../../world/assistant.ts"
import { castAutomationDraft } from "../../world/assistant/cards.ts"
import { savedTemplateOf } from "../../world/assistant/cards/agentCards.ts"
import { draftOf } from "../../world/assistant/cards/automationCards.ts"
import { agentOf, automationOf } from "../../world/assistant/castRecords.ts"
import { makeMint, type Mint } from "../../world/assistant/mint.ts"

/** Applies a pending card: what it says happens, and the card says so. */
const apply = (mint: Mint, slice: AssistantSlice, card: Card): Card => {
  const { agents, automations } = mint.cast

  switch (card._tag) {
    case "AgentControl": {
      const touched = card.action === "pauseAll" ?
        agents.filter((agent) => agent.state !== "draft" && agent.state !== "removed") :
        agents.filter((agent) => agent.id === card.agentId)
      return {
        ...card,
        status: "applied",
        agents: touched.map((agent) => new Agent({ ...agentOf(mint, agent), paused: card.action !== "resume" }))
      }
    }
    case "SaveTemplate":
      return { ...card, status: "applied", template: savedTemplateOf(mint, card.name, card.basedOn, card.spec) }
    case "Automation":
      return {
        ...card,
        status: "applied",
        automation: automationOf(mint, card.draft, {
          createdFrom: null,
          ...(card.automationId === null ? {} : { id: card.automationId })
        })
      }
    case "AutomationControl": {
      const saved = automations.find((automation) => automation.id === card.automationId)
      const draft = saved === undefined ? draftOf("weeklyBuy", null) : castAutomationDraft(mint, saved).draft
      return {
        ...card,
        status: "applied",
        automation: automationOf(mint, draft, {
          createdFrom: null,
          status: card.action === "pause" ? "paused" : "active",
          id: card.automationId,
          name: card.automationName
        })
      }
    }
    case "Memory": {
      const memory = new Memory({ ...card.memory, confirmedAt: mint.at(0) })
      slice.memories = slice.memories.map((kept) => kept.id === memory.id ? memory : kept)
      return { ...card, status: "applied", memory }
    }
    default:
      return card
  }
}

/** The card answers, over `preview`'s world. */
export const cardAnswers = (preview: PreviewStore) => {
  const slice = () => preview.world.assistant
  const mint = () => makeMint(preview.cast, new Date(), slice().counters, "run")

  const find = Effect.fnUntraced(function*(id: string) {
    const card = findCard(slice(), id)
    if (card === undefined) return yield* new NotFound({ resource: "card", id })
    return card
  })

  const pending = Effect.fnUntraced(function*(id: string) {
    const card = yield* find(id)
    if (!isPending(card)) return yield* new Conflict({ reason: "cardClosed" })
    return card
  })

  const confirm = Effect.fnUntraced(function*(id: string) {
    const card = yield* pending(id)

    if (slice().confirms === "conflict") return yield* new Conflict({ reason: "cardClosed" })
    if (slice().confirms === "invalid" && card._tag === "Automation") {
      return yield* new InvalidAutomation({
        problems: [
          new AutomationProblem({
            part: "action",
            index: null,
            field: "amount",
            message: "It would buy more than the agent's largest trade allows. Lower the amount or raise the limit."
          })
        ]
      })
    }
    if (slice().confirms === "invalid" && card._tag === "SaveTemplate") {
      return yield* new InvalidSpec({
        problems: [
          new PolicyProblem({
            policy: "tradeSize",
            field: "maxPerTrade",
            message: "The largest trade is bigger than the daily budget."
          })
        ]
      })
    }

    let applied: Card = card
    preview.update(() => {
      applied = saveCard(slice(), apply(mint(), slice(), card))
    })
    return applied
  })

  const dismiss = Effect.fnUntraced(function*(id: string) {
    const card = yield* pending(id)

    let dismissed: Card = card
    preview.update(() => {
      // A guess you turn down isn't kept.
      if (card._tag === "Memory") slice().memories = slice().memories.filter((memory) => memory.id !== card.memory.id)
      dismissed = saveCard(slice(), { ...card, status: "dismissed" })
    })
    return dismissed
  })

  const draftAgent = Effect.fnUntraced(function*(id: string) {
    const card = yield* find(id)
    if (card._tag !== "DraftAgent") return yield* new NotFound({ resource: "card", id })
    return card
  })

  const keepAutomation = Effect.fnUntraced(function*(id: string, requestId: string, kept: boolean) {
    const card = yield* draftAgent(id)
    const list = card.automations ?? []
    if (!list.some((automation) => automation.requestId === requestId)) {
      return yield* new NotFound({ resource: "automation", id: requestId })
    }
    if (card.agent.status !== "draft") return yield* new Conflict({ reason: "cardClosed" })

    const next: Card = {
      ...card,
      automations: list.map((automation) => automation.requestId === requestId ? { ...automation, kept } : automation)
    }
    preview.update(() => saveCard(slice(), next))
    return next
  })

  // The app starts them once the agent is live, which the agents' part of the preview decides: the card follows it.
  const startAutomations = Effect.fnUntraced(function*(id: string) {
    const card = yield* draftAgent(id)

    const made = mint()
    const next: Card = {
      ...card,
      agent: new Agent({ ...card.agent, status: "active", lockedUntil: DateTime.add(made.at(0), { days: 90 }) }),
      automations: (card.automations ?? []).map((automation) =>
        automation.kept && automation.automationId === null ?
          { ...automation, automationId: made.id("automation") as AutomationId } :
          automation
      )
    }
    preview.update(() => saveCard(slice(), next))
    return next
  })

  const confirmMemory = Effect.fnUntraced(function*(memoryId: string) {
    const found = slice().memories.find((memory) => memory.id === memoryId)
    if (found === undefined) return yield* new NotFound({ resource: "memory", id: memoryId })
    if (found.confirmedAt !== null) return found

    const memory = new Memory({ ...found, confirmedAt: mint().at(0) })
    preview.update(() => {
      slice().memories = slice().memories.map((kept) => kept.id === memory.id ? memory : kept)
      for (const thread of slice().threads) {
        for (const message of thread.messages) {
          for (const part of message.parts) {
            if (part.type === "card" && part.card._tag === "Memory" && part.card.memory.id === memory.id) {
              if (isPending(part.card)) saveCard(slice(), { ...part.card, status: "applied", memory })
            }
          }
        }
      }
    })
    return memory
  })

  return { confirm, dismiss, keepAutomation, startAutomations, confirmMemory }
}
