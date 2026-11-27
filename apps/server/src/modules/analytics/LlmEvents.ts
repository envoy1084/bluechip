/**
 * PostHog's LLM analytics events (`$ai_*`), as the server captures them for each model call, tool call, turn and
 * embedding. Names and properties are PostHog's own; the text of prompts and answers is sent only when
 * `LLM_ANALYTICS_CAPTURE_TEXT` is on.
 */

/** One model call. */
export interface AiGeneration {
  readonly _tag: "$ai_generation"
  readonly $ai_trace_id: string
  readonly $ai_span_id: string
  readonly $ai_parent_id?: string | undefined
  /** The conversation, for the assistant's calls. */
  readonly $ai_session_id?: string | undefined
  /** What the call was for: chat, title, memory or judgment. */
  readonly $ai_span_name: string
  readonly $ai_model: string
  readonly $ai_provider: "anthropic"
  readonly $ai_input_tokens: number
  readonly $ai_output_tokens: number
  readonly $ai_cache_read_input_tokens: number
  readonly $ai_cache_creation_input_tokens: number
  /** Seconds. */
  readonly $ai_latency?: number | undefined
  readonly $ai_stop_reason?: string | undefined
  readonly $ai_is_error: boolean
  readonly $ai_error?: string | undefined
  readonly $ai_http_status?: number | undefined
  /** The cost bluechip's budget counts (`costMicros`), so PostHog's and the budget's agree. */
  readonly $ai_total_cost_usd: number
  /** The tools the model called, by name. */
  readonly $ai_tools?: ReadonlyArray<string> | undefined
  readonly surface?: string | undefined
  readonly agent_id?: string | undefined
  readonly $ai_input?: ReadonlyArray<{ readonly role: string; readonly content: string }> | undefined
  readonly $ai_output_choices?: ReadonlyArray<{ readonly role: string; readonly content: string }> | undefined
}

/** One tool call the assistant made, under its round's generation. */
export interface AiSpan {
  readonly _tag: "$ai_span"
  readonly $ai_trace_id: string
  readonly $ai_span_id: string
  readonly $ai_parent_id: string
  readonly $ai_session_id: string
  readonly $ai_span_name: string
  readonly $ai_is_error: boolean
  readonly risk: string
}

/** One assistant turn: the trace its generations and tool calls belong to. */
export interface AiTrace {
  readonly _tag: "$ai_trace"
  readonly $ai_trace_id: string
  readonly $ai_session_id: string
  readonly $ai_span_name: string
  /** Seconds. */
  readonly $ai_latency: number
  readonly $ai_is_error: boolean
  readonly $ai_error?: string | undefined
  readonly rounds: number
}

/** One call to the embedder. */
export interface AiEmbedding {
  readonly _tag: "$ai_embedding"
  readonly $ai_trace_id: string
  readonly $ai_span_id: string
  readonly $ai_span_name: "recall"
  readonly $ai_model: string
  readonly $ai_provider: "voyage"
  readonly inputs: number
  /** Seconds. */
  readonly $ai_latency: number
  readonly $ai_is_error: boolean
}

/** Any LLM analytics event. */
export type AiEvent = AiGeneration | AiSpan | AiTrace | AiEmbedding
