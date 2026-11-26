// "When things go wrong": every way a turn ends early (the model unavailable, stopped by you, the connection
// dropped, too many steps, the day's budget), a failed tool the answer recovers from, and a turn that worked after.
import { type CardKind, makeCard, roundOf, STOPPED } from "../../cards.ts"
import { listAgents } from "../../reads.ts"
import { failed, fails, type Round, say, type ThreadContext, type Turn } from "../../rounds.ts"

export const errorsAndLimits = ({ mint }: ThreadContext): ReadonlyArray<Turn> => {
  const stop = (kind: CardKind): Round => roundOf(mint, makeCard(mint, kind, "applied", null))

  return [
    {
      you: "Compare my agents this month",
      rounds: [[listAgents(mint)], [...stop("errorUnavailable"), failed(STOPPED.unavailable)]]
    },
    { you: "Walk me through every trade this week", rounds: [stop("errorCancelled")] },
    { you: "Just the summary", rounds: [stop("errorInterrupted")] },
    {
      you: "Check every agent, automation and price, then fix everything",
      rounds: [[listAgents(mint)], stop("errorRounds")]
    },
    { you: "One more: how is Amazon doing?", rounds: [stop("errorBudget")] },
    {
      you: "What's Tesla at?",
      rounds: [[fails(mint, "getQuote", { symbol: "TSLA" }, "Prices are paused.")], [
        say(
          "Prices are paused while the market is closed, so I can't quote [[TSLA]] right now. Its last price was $341.90."
        )
      ]]
    },
    { you: "Thanks, that worked", rounds: [[say("Glad it did.")]] }
  ]
}
