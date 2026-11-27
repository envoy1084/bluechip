/**
 * The events the web app sends to analytics: what a person looked at and opened, which only the browser knows.
 * Anything the server also learns (a sign-up, a trade, an approval) is the server's event instead, so ad blockers
 * never drop it. Web events never carry exact amounts.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { Side } from "./Properties.ts"

/**
 * Every web event, by name (`_tag`). `$pageview` and `$exception` are PostHog's own, sent by its library.
 *
 * @stability unstable
 * @category catalog
 * @since 0.0.0
 */
export const WEB_EVENTS = [
  // Landing and auth
  Schema.TaggedStruct("landing_cta_clicked", {
    cta: Schema.Literals(["open_app", "get_started", "how_it_works"]),
    section: Schema.String
  }),
  Schema.TaggedStruct("signup_started", {}),
  Schema.TaggedStruct("passkey_prompt_failed", {
    step: Schema.Literals(["create", "get"]),
    reason: Schema.Literals(["cancelled", "not_allowed", "timeout", "unsupported"])
  }),
  Schema.TaggedStruct("signed_out", { scope: Schema.Literals(["this", "others"]) }),

  // Onboarding and funding
  Schema.TaggedStruct("welcome_step_viewed", { step: Schema.String }),
  Schema.TaggedStruct("welcome_completed", { skipped_steps: Schema.Array(Schema.String) }),
  Schema.TaggedStruct("add_cash_opened", { entry: Schema.Literals(["home", "buy_box", "settings", "welcome"]) }),
  Schema.TaggedStruct("deposit_address_copied", {}),
  Schema.TaggedStruct("faucet_requested", { usd: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)) }),

  // Market and trading
  Schema.TaggedStruct("stock_viewed", {
    symbol: Schema.String,
    from: Schema.Literals(["home", "list", "search", "agent"])
  }),
  Schema.TaggedStruct("trade_review_opened", { symbol: Schema.String, side: Side, entry: Schema.String }),

  // Agents, approvals, automations
  Schema.TaggedStruct("agent_flow_started", { template: Schema.String, entry: Schema.String }),
  Schema.TaggedStruct("agent_step_completed", { step: Schema.String, template: Schema.String }),
  Schema.TaggedStruct("approval_opened", {
    entry: Schema.Literals(["bell", "push", "telegram_link", "agent_page"])
  }),
  Schema.TaggedStruct("automation_editor_opened", { entry: Schema.String, starter: Schema.NullOr(Schema.String) }),

  // Assistant and notifications
  Schema.TaggedStruct("assistant_opened", { entry: Schema.Literals(["sidebar", "agent_page", "home_ask"]) }),
  Schema.TaggedStruct("notification_opened", {
    kind: Schema.String,
    from: Schema.Literals(["bell", "push_click", "telegram_link"])
  }),

  // Settings, errors, help
  Schema.TaggedStruct("settings_changed", {
    setting: Schema.Literals(["time_zone", "quiet_hours", "notification_rule", "analytics_opt_out"])
  }),
  Schema.TaggedStruct("api_error", { endpoint_group: Schema.String, error: Schema.String }),
  Schema.TaggedStruct("help_article_viewed", { slug: Schema.String })
] as const

/**
 * An event the web app sends.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const WebEvent = Schema.Union(WEB_EVENTS)

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type WebEvent = typeof WebEvent.Type
