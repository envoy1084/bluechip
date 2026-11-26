import * as Schema from "effect/Schema"

/**
 * A notifier couldn't deliver: the platform refused it or didn't answer. `retryable` when trying again later can
 * work (a timeout, a rate limit, a 5xx); otherwise the delivery fails at once.
 */
export class NotifierError extends Schema.TaggedError<NotifierError>()("NotifierError", {
  channel: Schema.String,
  reason: Schema.String,
  retryable: Schema.Boolean
}) {}
