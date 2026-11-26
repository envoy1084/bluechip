// "What is bluechip?": questions answered from the help center, with links to the articles, and a memory saved.
import type { CardId } from "@bluechip/domain/Ids"
import { searchHelp } from "../reads.ts"
import { say, shows, type ThreadContext, type Turn } from "../rounds.ts"

export const welcome = ({ mint, memories }: ThreadContext): ReadonlyArray<Turn> => {
  const learned = memories.find((memory) => memory.text.startsWith("You're new") || memory.text.startsWith("You first"))

  return [
    {
      you: "What is bluechip?",
      rounds: [
        [searchHelp(mint, "what is bluechip", [
          [
            "agents",
            "How agents work",
            "What an agent is",
            "An agent is a key that trades for you inside rules you set."
          ],
          ["trading", "Buying and selling", "Tokenized stocks", "Stocks on Base are tokens backed one for one."]
        ])],
        [
          say(
            "bluechip is a way to own real US stocks as tokens on Base, and to let **agents** trade them for you " +
              "inside rules you lock in yourself.\n\n" +
              "A few things that make it different:\n\n" +
              "- **You hold everything.** Your stocks and cash sit in your own account, and nobody else can move them.\n" +
              "- **Agents can't break their rules.** An agent is a key with policies attached onchain, like a daily " +
              "budget or a cap per stock. If a trade breaks one, Base refuses it.\n" +
              "- **Anything bigger asks you first.** Trades over an agent's largest trade wait for your Face ID.\n\n" +
              "You can read more in [How agents work](/help/agents) and [Buying and selling](/help/trading)."
          )
        ]
      ]
    },
    {
      you: "Who pays for gas when an agent trades?",
      rounds: [
        [searchHelp(mint, "who pays gas", [
          ["gas", "Gas", "Who pays", "Your account pays gas in ETH. bluechip shows it before you sign."]
        ])],
        [
          say(
            "Your account does, in a little ETH on Base. A trade usually costs **under one cent**.\n\n" +
              "Each agent also has a daily gas budget, so a busy day can't run it up. When gas costs more than that " +
              "budget allows, the trade waits instead of overpaying. More in [Gas](/help/gas#who-pays)."
          )
        ]
      ]
    },
    ...(learned === undefined ? [] : [{
      you: "I'm completely new to investing, so keep things simple for me.",
      rounds: [[
        say("Will do. I'll keep the jargon out and explain anything that matters."),
        shows(mint, "remember", { kind: learned.kind, text: learned.text }, {
          _tag: "Memory",
          id: mint.id("card") as CardId,
          action: "saved",
          memory: learned,
          status: "applied"
        })
      ]]
    }])
  ]
}
