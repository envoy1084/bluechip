// "Every agent card": templates and an agent read, drafts (with automations, without, gone live), a change of rules
// with its diff, a renewal and a removal (and a removed draft), pausing and resuming in each state, and templates.
import { agentFor } from "../../cards.ts"
import { getAgent, listTemplates } from "../../reads.ts"
import { say, type ThreadContext, type Turn } from "../../rounds.ts"
import { cardTurn } from "./cardTurns.ts"

export const everyAgentCard = (context: ThreadContext): ReadonlyArray<Turn> => {
  const { mint } = context
  const agent = agentFor(mint, null)

  return [
    {
      you: "Which templates can I start from?",
      rounds: [[listTemplates(mint)], [
        say(
          "Four built in:\n\n- **Rebalancer**: keeps a target mix.\n- **Stock picker**: buys and sells a few stocks.\n" +
            "- **Weekly buyer**: buys on a schedule.\n- **Stop-loss guard**: only sells, to protect what you hold."
        )
      ]]
    },
    cardTurn(context, "Draft a weekly Apple buyer", [["draftAgent", "pending"]]),
    cardTurn(context, "And a chip picker, no automations", [["draftAgentPlain", "pending"]]),
    cardTurn(context, "The weekly one is locked now, right?", [["draftAgentLive", "applied"]], {
      after: "Yes, it's live and its weekly buy started with it."
    }),
    {
      you: `What can ${agent.name} do?`,
      rounds: [[getAgent(mint, agent)], [say(`Here's ${agent.name} in words: the card below changes it.`)]]
    },
    cardTurn(context, `Tighten ${agent.name}'s budget`, [["policyUpdate", "pending"]]),
    cardTurn(context, `Renew ${agent.name}`, [["policyRenew", "pending"]]),
    cardTurn(context, `Remove ${agent.name}`, [["policyRemove", "pending"]]),
    cardTurn(context, "Delete the Amazon draft", [["policyRemoveDraft", "applied"]], {
      after: "Done. It was never locked, so there was nothing to sign."
    }),
    cardTurn(context, `Pause ${agent.name}`, [["pauseAgent", "pending"], ["pauseAgent", "applied"], [
      "pauseAgent",
      "dismissed"
    ]]),
    cardTurn(context, `Resume ${agent.name}`, [["resumeAgent", "pending"], ["resumeAgent", "applied"]]),
    cardTurn(context, "Pause every agent", [["pauseAll", "pending"], ["pauseAll", "applied"], [
      "pauseAll",
      "dismissed"
    ]]),
    cardTurn(context, `Save ${agent.name}'s rules as a template`, [["saveTemplate", "pending"], [
      "saveTemplate",
      "applied"
    ], ["saveTemplate", "dismissed"]])
  ]
}
