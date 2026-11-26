// "An agent's chat": a conversation about one agent, so its pill shows, with the card its state calls for.
import { TEMPLATES } from "@bluechip/domain/policies/Templates"
import type { CastAgent } from "../../../cast.ts"
import type { CardKind } from "../../cards.ts"
import { draftAgentCard } from "../../cards/agentCards.ts"
import { agentOf } from "../../castRecords.ts"
import { getAgent } from "../../reads.ts"
import { say, shows, type ThreadContext, type Turn } from "../../rounds.ts"
import { cardTurn } from "./cardTurns.ts"

const ASK: Readonly<Record<CastAgent["state"], readonly [you: string, kind: CardKind, after: string]>> = {
  active: ["Buy $50 of its first stock", "tradeSent", "Sent within its rules."],
  doneForToday: ["Buy a little more today", "tradeBlocked", "Its daily budget is spent: it resets at midnight UTC."],
  asking: ["Go ahead with the big one", "tradeAsking", "That one waits for your Face ID."],
  paused: ["Resume it", "resumeAgent", "Confirm and it trades again."],
  draft: ["Is it ready to lock?", "draftAgentPlain", "Look it over, then lock it with Face ID."],
  locking: ["Is it live yet?", "draftAgentPlain", "Base takes a couple of seconds."],
  updating: ["Make it more careful", "policyUpdate", "Its change is on its way to Base."],
  removing: ["Remove it", "policyRemove", "It's being removed."],
  expired: ["Renew it", "policyRenew", "Approve and it runs another 90 days."],
  removed: ["Remove it", "policyRemove", "It's removed. Your stocks stay put."]
}

export const agentChat = (agent: CastAgent) => (context: ThreadContext): ReadonlyArray<Turn> => {
  const [you, kind, after] = ASK[agent.state]

  return [
    {
      you: "What has this agent done this week?",
      rounds: [[getAgent(context.mint, agent)], [
        say(
          `${agent.name} trades ${agent.stocks.map((symbol) => `[[${symbol}]]`).join(", ")} as a ` +
            `${agent.preset} ${TEMPLATES[agent.template].title.toLowerCase()}. ` +
            "This week it made 3 trades, all inside its rules."
        )
      ]]
    },
    agent.state === "draft" || agent.state === "locking" ?
      {
        you,
        rounds: [[
          shows(
            context.mint,
            "draftAgent",
            { name: agent.name },
            draftAgentCard(context.mint, agentOf(context.mint, agent))
          ),
          say(after)
        ]]
      } :
      cardTurn(context, you, [[kind, "pending"]], { focus: agent, after })
  ]
}
