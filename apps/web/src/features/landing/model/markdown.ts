import { appPageUrl, canonicalUrl, markdownPath, type Site, SITE_DESCRIPTION } from "../../../lib/seo/site.ts"

/** `/index.md`: the landing for agents, what bluechip is and how it works in words, then its questions and the ways in. */
export const landingMarkdown = (site: Site, questions: ReadonlyArray<readonly [string, string]>): string =>
  [
    "# bluechip",
    "",
    SITE_DESCRIPTION,
    "",
    "## How it works",
    "",
    "1. Sign up with Face ID: your device makes a passkey, and bluechip sets up a smart account on Base that only your " +
    "passkeys control. No password, no seed phrase, no email.",
    "2. Add cash: send USDC on Base to your account's address.",
    "3. Hire an agent: pick what it may trade and its limits (stocks, trade size, trades a day, the most in one stock, " +
    "a cash reserve), then lock them onchain with Face ID.",
    "4. Let it trade: Base checks every trade it sends against its limits and against Chainlink's price, and a trade " +
    "over its largest trade waits for your approval.",
    "",
    "## What else it does",
    "",
    "- Automations: when something happens (a schedule, a price, your portfolio, the news), check what you asked, then " +
    "trade through an agent or ask you first.",
    "- The assistant: ask about your money, trade or set up an agent in plain words, in the app or in Telegram. " +
    "Nothing changes until you confirm it.",
    "- Recovery: a recovery key can replace lost passkeys after a 48-hour wait enforced onchain, which you can cancel.",
    "- Paper money: the same app on Base Sepolia with test USDC, at paper.bluechip.markets.",
    "",
    "## Questions",
    "",
    ...questions.flatMap(([question, answer]) => [`### ${question}`, "", answer, ""]),
    "## Links",
    "",
    `- [Get started](${appPageUrl("/welcome", site)}): create an account with a passkey`,
    `- [Help](${canonicalUrl(markdownPath("/help"), site)}): how every part of bluechip works`,
    `- [Terms of use](${canonicalUrl(markdownPath("/legal/terms"), site)})`,
    `- [Risk disclosure](${canonicalUrl(markdownPath("/legal/risk"), site)})`,
    `- [Privacy policy](${canonicalUrl(markdownPath("/legal/privacy"), site)})`,
    ""
  ].join("\n")
