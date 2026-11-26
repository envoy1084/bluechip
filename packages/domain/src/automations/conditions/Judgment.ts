/**
 * The `judgment` condition: a typed question a model answers about the story that fired a `news` automation, with
 * the least confidence its answer needs. The model answers yes or no, how sure it is and why; it holds no tools, and
 * the story is untrusted text. Every answer is logged.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import * as Condition from "../Condition.ts"
import { Field } from "../Entry.ts"
import { formatBps } from "../Format.ts"

/**
 * The questions bluechip asks.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const JudgmentPreset = Schema.Literals(["materiallyNegative", "materiallyPositive", "earningsRelated"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type JudgmentPreset = typeof JudgmentPreset.Type

/**
 * Each question as the model is asked it, and as the automation's sentence says it.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const QUESTIONS: Readonly<Record<JudgmentPreset, { readonly question: string; readonly phrase: string }>> = {
  materiallyNegative: {
    question: "Is this story materially bad news for the company it is about: likely to move its share price down " +
      "meaningfully (results, guidance, legal or regulatory action, a failed product, a leader leaving)?",
    phrase: "if the news looks materially bad"
  },
  materiallyPositive: {
    question: "Is this story materially good news for the company it is about: likely to move its share price up " +
      "meaningfully (results, guidance, a large contract, an approval)?",
    phrase: "if the news looks materially good"
  },
  earningsRelated: {
    question: "Is this story about the company's earnings, results or guidance?",
    phrase: "if the news is about earnings"
  }
}

/**
 * The question, and the least confidence a yes needs (basis points: 7,000 is 0.7).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const JudgmentConfig = Schema.Struct({ preset: JudgmentPreset, minConfidenceBps: Schema.Int })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type JudgmentConfig = typeof JudgmentConfig.Type

/**
 * A model's answer to a judgment: yes or no, how sure (0 to 1), and why in a sentence.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const JudgmentAnswer = Schema.Struct({
  verdict: Schema.Boolean.annotate({ description: "Your answer to the question: true for yes." }),
  confidence: Schema.Number.annotate({ description: "How sure you are, from 0 to 1." }),
  reason: Schema.String.annotate({ description: "Why, in one sentence about the story." })
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type JudgmentAnswer = typeof JudgmentAnswer.Type

/**
 * @stability unstable
 * @category conditions
 * @since 0.0.0
 */
export const judgment = Condition.make({
  type: "judgment",
  title: "Judgment",
  summary: "A model reads the story that fired it and answers a question, such as whether it is materially bad.",
  aliases: ["if it's bad news", "material news", "sentiment", "if it matters"],
  examples: ["If there's material bad news on my chip stocks, ask me whether to sell"],
  config: JudgmentConfig,
  fields: {
    preset: new Field({ label: "Question", unit: "choice" }),
    minConfidenceBps: new Field({ label: "At least this sure", unit: "bps", min: 5000, max: 9500, step: 500 })
  },
  defaults: { preset: "materiallyNegative", minConfidenceBps: 7000 },
  check: (_, context) =>
    context.trigger === "news" ? [] : [{ field: null, message: "A judgment reads the story that fired it: use news." }],
  describe: (config) => QUESTIONS[config.preset].phrase,
  evaluate: null
})

/**
 * Whether an answer passes the judgment: a yes at least as sure as it needs.
 *
 * @stability unstable
 * @category evaluating
 * @since 0.0.0
 */
export const judged = (config: JudgmentConfig, answer: JudgmentAnswer): Condition.Result => {
  const sure = Math.round(answer.confidence * 10_000) >= config.minConfidenceBps
  const confidence = formatBps(Math.round(answer.confidence * 10_000))
  if (!answer.verdict) return { pass: false, reason: `The model said no (${confidence} sure): ${answer.reason}` }
  if (!sure) {
    return {
      pass: false,
      reason: `The model said yes, but only ${confidence} sure (it needs ${formatBps(config.minConfidenceBps)}).`
    }
  }
  return { pass: true, reason: `The model said yes (${confidence} sure): ${answer.reason}` }
}
