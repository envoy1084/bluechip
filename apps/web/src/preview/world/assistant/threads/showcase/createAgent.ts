// "Make my first agent from chat": a draft from your words, its limits edited in chat (a new draft with a smaller
// budget and an automation left out), checked, locked with Face ID, then live with its kept automations started.
import type { Card } from "@bluechip/domain/assistant/Card"
import type { AutomationId } from "@bluechip/domain/Ids"
import type { CastAgent } from "../../../cast.ts"
import { draftAgentCard } from "../../cards/agentCards.ts"
import { draftedAgent, specOf } from "../../castRecords.ts"
import { checkSpec, listTemplates } from "../../reads.ts"
import { say, shows, type ThreadContext, type Turn } from "../../rounds.ts"

export const createAgentInChat = ({ mint }: ThreadContext): ReadonlyArray<Turn> => {
  const first: Pick<CastAgent, "name" | "template" | "preset" | "stocks" | "targets"> = {
    name: "Weekly starter",
    template: "weeklyBuyer",
    preset: "balanced",
    stocks: ["AAPL", "NVDA"],
    targets: []
  }
  const edited = { ...first, preset: "conservative" } as const
  const draft = draftedAgent(mint, first)
  const smaller = draftedAgent(mint, edited)
  const trimmed = draftAgentCard(mint, smaller)
  const leftOut: Card = trimmed._tag !== "DraftAgent" ? trimmed : {
    ...trimmed,
    automations: (trimmed.automations ?? []).map((one, index) => index === 1 ? { ...one, kept: false } : one)
  }
  const locking = draftAgentCard(mint, draftedAgent(mint, edited, "locking"))
  const started = draftAgentCard(mint, draftedAgent(mint, edited, "active"), {
    started: [mint.id("automation") as AutomationId]
  })
  const live: Card = started._tag !== "DraftAgent" ? started : {
    ...started,
    automations: (started.automations ?? []).map((one, index) => index === 1 ? { ...one, kept: false } : one)
  }

  return [
    {
      you: "Make me an agent that buys Apple and Nvidia every week",
      rounds: [
        [listTemplates(mint), checkSpec(mint, specOf(first))],
        [
          say("A **Weekly buyer** fits. Here's the draft: nothing runs until you lock it."),
          shows(mint, "draftAgent", { name: first.name }, draftAgentCard(mint, draft))
        ]
      ]
    },
    {
      you: "Make its daily budget smaller, and skip the Nvidia buy",
      rounds: [
        [checkSpec(mint, specOf(edited))],
        [
          say(
            "Done: a **$100** daily budget and **$50** largest trade, and the Nvidia buy is left out. You can switch " +
              "it back on before you lock it."
          ),
          shows(mint, "draftAgent", { name: edited.name, draft: { preset: "conservative" } }, leftOut)
        ]
      ]
    },
    {
      you: "Locked it with Face ID",
      rounds: [[say("It's going onchain now. Base takes a couple of seconds."), shows(mint, "draftAgent", {}, locking)]]
    },
    {
      you: "Is it live?",
      rounds: [[
        say("Yes. Its Apple buy started with it, every Monday at 10:00 New York time."),
        shows(mint, "draftAgent", {}, live)
      ]]
    }
  ]
}
