// "Quick questions": one-line exchanges, so short bubbles and answers can be reviewed.
import { getQuote } from "../../reads.ts"
import { say, type ThreadContext, type Turn } from "../../rounds.ts"

export const quickQuestions = ({ mint }: ThreadContext): ReadonlyArray<Turn> => [
  { you: "hi", rounds: [[say("Hi! What can I help with?")]] },
  { you: "apple price?", rounds: [[getQuote(mint, "AAPL", 50)], [say("[[AAPL]] is at **$232.18**.")]] },
  { you: "is the market open", rounds: [[say("Not right now. It opens at 9:30 New York time.")]] },
  { you: "ok", rounds: [[say("Anything else?")]] },
  { you: "no thanks", rounds: [[say("Talk soon.")]] }
]
