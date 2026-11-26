// "What you remember about me": guesses to confirm (waiting, kept, turned down), memories saved and forgotten, and
// the memory read back and searched.
import { listMemories, searchMemory } from "../../reads.ts"
import { say, type ThreadContext, type Turn } from "../../rounds.ts"
import { cardTurn } from "./cardTurns.ts"

export const memoryAndPreferences = (context: ThreadContext): ReadonlyArray<Turn> => {
  const { mint, memories } = context

  return [
    cardTurn(context, "I usually buy on Monday mornings, and I keep each stock small", [["memoryConfirm", "pending"]], {
      after: "I think I picked up a preference there. Should I keep it?"
    }),
    cardTurn(context, "Yes, keep that", [["memoryConfirm", "applied"]]),
    cardTurn(context, "Not that one though", [["memoryConfirm", "dismissed"]]),
    cardTurn(context, "Remember that I never want to own Tesla", [["memorySaved", "applied"]]),
    cardTurn(context, "Forget that I only buy on Mondays", [["memoryForgotten", "applied"]]),
    {
      you: "What do you remember about me?",
      rounds: [[listMemories(mint, memories)], [
        say(
          `${memories.length === 0 ? "Nothing yet" : `${memories.length} things`}. You can see, search and delete ` +
            "every one on the [memory page](/memory)."
        )
      ]]
    },
    {
      you: "Did I ever say anything about cash?",
      rounds: [[searchMemory(mint, "cash", memories.filter((memory) => /cash/i.test(memory.text)))], [
        say("Yes: you keep a cash reserve, and you said so more than once.")
      ]]
    }
  ]
}
