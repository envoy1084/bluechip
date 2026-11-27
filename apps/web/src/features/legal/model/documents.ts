/** A legal page: its title, where it lives, what search results say about it and the day it last changed. */
export interface LegalDocument {
  readonly title: string
  readonly path: "/legal/terms" | "/legal/privacy" | "/legal/risk"
  readonly description: string
  /** `2026-11-25`: the page's "Last updated" and the sitemap's `lastmod`. */
  readonly updated: string
  /** What the page says under its title. */
  readonly intro: string
  /** Its headed sections, each one paragraph. */
  readonly sections: ReadonlyArray<readonly [heading: string, body: string]>
}

export const TERMS: LegalDocument = {
  title: "Terms of use",
  path: "/legal/terms",
  description:
    "The terms of bluechip's early access: what bluechip is, paper and real money, who can use it, agents, fees, and what you agree to.",
  updated: "2026-11-27",
  intro:
    "These are preview terms for bluechip's early access. Reviewed terms will replace them before bluechip opens to everyone, and we will tell you when they do. By creating an account you agree to them and to the risk disclosure.",
  sections: [
    [
      "What bluechip is",
      "bluechip is software. It sets up a smart account on Base that only your passkeys control, lets you buy and sell tokenized US stocks with it, and lets you make agents and automations that trade for you inside rules you lock onchain. bluechip never holds your money, and it is not a broker, an exchange, a bank or an investment adviser."
    ],
    [
      "Paper money",
      "Paper money (paper.bluechip.markets) runs on Base Sepolia, a test network, with test USDC and test stocks. They have no value, can't be exchanged for anything or moved to Base, and are given out up to $10,000 a day per account. Paper money may be reset, changed or stopped at any time, and its accounts, balances and history with it."
    ],
    [
      "Real money",
      "bluechip (bluechip.markets) runs on Base with real USDC and Coinbase's tokenized stocks. Everything you do there moves real money, and trades on Base can't be undone."
    ],
    [
      "Who can use it",
      "You must be at least 18, not a US citizen or resident, and allowed to hold tokenized stocks where you live. You confirm this when you sign up. If it isn't true, you may not use bluechip, and we may close your access."
    ],
    [
      "Your account and passkeys",
      "Your account is a smart account on Base, and any one of its passkeys can sign for it. You are responsible for your passkeys and the devices that hold them: anyone who can use one can act as you. A recovery key can replace your passkeys 48 hours after it asks, unless you cancel. Tell us if you think a passkey was compromised."
    ],
    [
      "Tokenized stocks",
      "The stocks on bluechip are tokens issued by Coinbase that track US shares. Coinbase sets their terms, not bluechip, and bluechip is not affiliated with Coinbase. Trades are swaps in Aerodrome's pools on Base, priced against Chainlink's feed for each stock."
    ],
    [
      "Your trades",
      "You sign each of your own trades with your passkey. The quote shows the least you get; a trade that would fill for less fails, and nothing is traded. bluechip refuses a trade more than 1% worse than Chainlink's price (0.5% while prices are paused), or when Chainlink's price is too old."
    ],
    [
      "Agents",
      "You choose what each agent may do and lock its rules with Face ID; Base checks every trade it sends against them. Inside them an agent trades without asking you; a trade over its largest trade waits for your approval. A lock lasts 90 days. Pausing an agent stops bluechip sending its trades. You are responsible for the rules you set and for the trades agents make within them."
    ],
    [
      "Approvals and automations",
      "An automation runs when its trigger fires and its checks pass, and trades through one of your agents, within its rules, or asks for your Face ID for each trade. Trades on news ask you first unless you let them go ahead. An approval you don't answer expires after 6 hours, and nothing is sent."
    ],
    [
      "The assistant",
      "The assistant uses AI models and can be wrong. It can answer questions, search the web, and propose trades, agents and automations, but nothing changes until you confirm it, and anything outside an agent's rules needs your Face ID. Each account has a daily budget for it."
    ],
    [
      "No advice",
      "bluechip, its assistant, its agents and its automations give information, not investment, tax or legal advice. You make your own decisions, and you are responsible for any taxes on your trades."
    ],
    [
      "Fees",
      "bluechip charges no fee of its own today. Each trade pays the pool's fee and any slippage, shown with the trade and in your activity. bluechip pays the network's gas for your account today; if that changes, gas is paid in ETH from your account. We will tell you before bluechip charges anything."
    ],
    [
      "Market hours",
      "Prices follow the US stock market: they move from Sunday evening to Friday evening, New York time, and pause on weekends and market holidays. While they are paused, trades are held to a tighter price check, and agents set not to trade on paused prices wait."
    ],
    [
      "Using bluechip fairly",
      "Don't use bluechip to break the law, to attack it or other people's accounts, or to take more test money than paper money gives each account. We may limit or close access that does."
    ],
    [
      "Availability and changes",
      "Early access may change, pause or stop, and bluechip, Base or the services it uses can be unavailable. Your money stays in your account whatever happens to bluechip, but while bluechip is down you may not be able to trade or withdraw through it."
    ],
    [
      "Responsibility",
      "bluechip is provided as it is. As far as the law allows, we are not responsible for losses from market prices, from trades you or your agents make within your rules, from contracts or networks bluechip uses, or from services outside our control."
    ],
    [
      "Ending",
      "You can stop using bluechip at any time, and withdraw your cash first. We may suspend or close access that breaks these terms. Questions about these terms go to vedant@envoy1084.xyz."
    ]
  ]
}

export const PRIVACY: LegalDocument = {
  title: "Privacy policy",
  path: "/legal/privacy",
  description:
    "What bluechip keeps about you, why, and who else sees it. bluechip never asks for your name, email or phone number.",
  updated: "2026-11-27",
  intro:
    "What bluechip keeps about you, why, and who else sees it. bluechip never asks for your email or phone number, shows no ads and never sells your data.",
  sections: [
    [
      "Paper money and real money",
      "bluechip runs in two places: paper money at paper.bluechip.markets, with test dollars on Base Sepolia, and bluechip at bluechip.markets, with real USDC on Base. This policy covers both. Each keeps its own accounts and data, and nothing moves between them."
    ],
    [
      "Your account",
      "When you sign up we keep your passkey's public key, a label for where it lives (such as iCloud Keychain on Mac) and whether it syncs to your other devices, your smart account's address, your answer to whether you are a US citizen or resident, and your time zone. A name is optional and only used to greet you. We never see your Face ID, your fingerprint or the private part of your passkey: they stay on your device."
    ],
    [
      "Signing in",
      "Each signed-in browser gets a session: a cookie whose token we keep only as a hash, with a description of the device from its browser (such as Chrome on Mac) and when it was last used, so you can see and sign out devices in Settings. Sessions end after 30 days. Account events, like a new passkey, a new device, a recovery request or an agent's change, go in your audit log."
    ],
    [
      "Your money, trades and agents",
      "We keep a copy of your balances, trades, deposits and withdrawals and their costs, to show your portfolio and performance, and we compare your balances on Base with that copy every few minutes. We also keep your agents and their rules, their journals and usage, your automations and their runs, including a model's answers to their questions, and the approvals you answered."
    ],
    [
      "What is public on Base",
      "Your account lives on Base (Base Sepolia for paper money), a public network. Your address, its balances and every trade, transfer and change to its passkeys or agents can be seen by anyone who knows the address, for good. That is how public blockchains work, and it is not something bluechip can hide or delete."
    ],
    [
      "The assistant and memory",
      "Your conversations with the assistant, in the app and in Telegram, are kept so you can read them again, with their cards, titles and summaries. It remembers what you ask it to, and notes preferences, goals and facts from what you say; you can see, export and delete every memory, and delete any chat. We count what each day's assistant use costs, for your daily budget."
    ],
    [
      "Notifications and Telegram",
      "If you turn on push on a device we keep its push subscription and a description of the device. We keep your choices of what reaches you where, and your quiet hours. If you link Telegram we keep your Telegram user id, chat id and name, so the bot can reach you and know it is you. Unlink it at any time."
    ],
    [
      "Product analytics",
      "To see where bluechip is hard to use, we send PostHog events about what you do: pages you open (with ids taken out of their links), key steps such as signing up, adding cash, making an agent or trading (with their dollar amounts), and facts about your account such as when you joined and how many agents you have. They carry your bluechip user id, never your name, address, balances or anything you write. PostHog works out your country from your IP address and then drops the address; it isn't stored."
    ],
    [
      "Session replays and errors",
      "Some sessions are recorded as replays, so we can see why something went wrong: a share of all sessions, and any session with an error. Replays never record what you type or what the app sends and receives. On bluechip they hide every piece of text on the screen, so your balances, holdings and chats don't appear; on paper money they hide what you type. PostHog also records errors in the app, how fast pages load and where people click."
    ],
    [
      "The assistant's usage",
      "For each answer the assistant gives, PostHog gets which model ran, how many tokens it used, what it cost and how long it took, and which tools it called. It never gets the text of your messages or the assistant's answers."
    ],
    [
      "Running bluechip",
      "Our server and the app send traces, logs and metrics to Axiom so we can keep bluechip working and fix it: each request, trade and background job, with your user id and the ids of the agents, trades, automations and chats involved. They never hold your messages, memories, passkeys, keys or full addresses. This telemetry is part of running the service. Axiom keeps it for 30 days."
    ],
    [
      "Only where it counts",
      "Product analytics and telemetry run only on paper money and on bluechip. Both go through bluechip's own server first, so the app talks only to bluechip. A browser that asks sites not to track it sends no analytics from the app."
    ],
    [
      "Who else sees it",
      "Some work is done by services on our behalf. Anthropic runs the assistant's models and its web search, and sees what you send in chat, what the assistant reads to answer you, and the news stories automations ask about. Voyage turns the text of memories, conversations and help articles into search vectors. Alchemy sends your account's operations to Base and pays their gas, so it sees your address and each operation. Our Base node provider sees the addresses bluechip reads. Alpaca provides market prices and news, and gets nothing about you. PostHog (in the US) and Axiom handle analytics and telemetry as above. Your browser's push service (from Apple, Google or Mozilla) delivers push notifications, Telegram delivers messages if you link it, and Contabo hosts our servers and database."
    ],
    [
      "Cookies and storage",
      "bluechip sets one cookie of its own: your session, which keeps you signed in. With product analytics on, PostHog keeps an anonymous id in your browser to tie a visit's events together. The app also stores your analytics choice and whether this tab's telemetry is sampled. There are no advertising cookies."
    ],
    [
      "How long we keep it",
      "We keep your account's data while your account exists. Deleting a memory or a chat removes it from the assistant at once, and the assistant's guesses you never confirm are dropped after 30 days. Replays are deleted after 30 days, and telemetry after 30 days. What is on Base stays there, as on any public chain."
    ],
    [
      "Your choices",
      "You can see what we keep in the app, download your audit log, export your memories, delete chats and memories, unlink Telegram, turn push off and sign out any device."
    ],
    [
      "Closing your account",
      "To close your account and have us delete what we hold about you, write to us. Your smart account on Base and the money in it stay yours, controlled by your passkeys; only what is public on Base remains."
    ],
    [
      "Children",
      "bluechip is for adults. It isn't meant for anyone under 18, and we don't knowingly keep data about children."
    ],
    [
      "Changes and contact",
      "When this policy changes, the date above changes and we tell you in the app if the change matters to you. Questions or requests about your data go to vedant@envoy1084.xyz."
    ]
  ]
}

export const RISK: LegalDocument = {
  title: "Risk disclosure",
  path: "/legal/risk",
  description:
    "The risks of investing in tokenized US stocks onchain with software agents. Read this before you add cash.",
  updated: "2026-11-27",
  intro:
    "Investing can lose money, and doing it onchain with software agents adds risks of its own. Read this before you add cash.",
  sections: [
    [
      "You can lose money",
      "Stock prices go down as well as up. You can lose some or all of what you put in. Nothing on bluechip is a promise of returns, and nothing bluechip, its assistant or its agents say is investment advice."
    ],
    [
      "Paper money isn't the real thing",
      "On paper money the dollars and stocks are test tokens with no value, its prices come from bluechip's own feeds and its trades from bluechip's test exchange. How an agent does there says little about how it would do with real money."
    ],
    [
      "A tokenized stock is not the share",
      "Coinbase's tokenized stocks are tokens issued by Coinbase that track a company's share, with splits and dividends followed through a multiplier. You don't own the share itself, its terms are Coinbase's, and what you hold depends on Coinbase keeping its promises and its tokens working."
    ],
    [
      "Your cash is USDC",
      "Your cash is USDC, a token issued by Circle that aims to be worth one dollar. It can lose that value, and Circle can freeze it."
    ],
    [
      "Prices and market hours",
      "Reference prices come from Chainlink and move from Sunday evening to Friday evening, New York time. On weekends and holidays they hold the last price while the pools keep trading, so the price you trade at can differ from the reference. A feed can also be late or wrong. On paper money, bluechip writes the prices itself from Alpaca's market data."
    ],
    [
      "Trading onchain",
      "Trades are swaps in Aerodrome pools on Base. Each pays the pool's fee, and a large trade or a thin pool moves the price against you (slippage). bluechip refuses trades too far from the reference price, but can't remove this risk, and a trade can fail and need trying again."
    ],
    [
      "Agents act on their own",
      "An agent trades without asking you, inside the rules you lock with Face ID. Rules cap what it can do; they don't make its trades good ones. An agent can lose money while staying inside every rule, and rules you set wrongly let it trade in ways you didn't mean."
    ],
    [
      "Automations and judgments",
      "An automation acts on triggers you set, and can fire on a sudden price move, an old price or a misleading story. A judgment is an AI model's reading of a news story, and it can be wrong. Trades on news ask you first unless you let them go ahead."
    ],
    [
      "The assistant can be wrong",
      "The assistant uses AI models. It can misunderstand you, get facts wrong or find wrong information on the web. Read every trade, agent and automation it proposes before you confirm it."
    ],
    [
      "Smart contracts can fail",
      "Your account is a Kernel smart account. Agents' rules are enforced by Namera v2 and by bluechip's own policy contracts, which have had internal reviews but no external audit yet. Trades also rely on Aerodrome's, Chainlink's, Coinbase's and Circle's contracts. A bug in any of them could lose funds."
    ],
    [
      "Bundlers and gas",
      "Your account's operations reach Base through Alchemy's bundler, and bluechip pays their gas today through Alchemy. If either stops working, trades wait or fail, and gas may have to be paid in ETH from your account."
    ],
    [
      "Outages",
      "bluechip, Base or a service it relies on (Alchemy, Alpaca, Anthropic) can be slow or down. Then trades, automations and approvals can wait or fail, and prices on the screen can be out of date. Your money stays in your account, but you may not be able to trade or withdraw through bluechip until it's back."
    ],
    [
      "Your passkey is your key",
      "Only your passkeys can move money out of your account. If you lose every one and have no recovery key, you lose access to your account and what's in it. A recovery takes 48 hours, and anyone holding your recovery key can take over your account after 48 hours unless you cancel, so keep it safe and read what bluechip tells you."
    ],
    [
      "Who can use bluechip",
      "Tokenized US stocks are not offered to US citizens or residents, so bluechip is not available to them. bluechip is not affiliated with Coinbase, Base or any token named BLUECHIP."
    ]
  ]
}

export const LEGAL_DOCUMENTS: ReadonlyArray<LegalDocument> = [TERMS, PRIVACY, RISK]

/** "25 November 2026", as the page says it (the day itself, in no time zone). */
export const updatedText = (legal: LegalDocument): string =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${legal.updated}T00:00:00Z`))

/** The page's Markdown twin, for agents: the same title, date, intro and sections. */
export const legalMarkdown = (legal: LegalDocument): string =>
  [
    `# ${legal.title}`,
    "",
    `Last updated ${updatedText(legal)}.`,
    "",
    legal.intro,
    "",
    ...legal.sections.flatMap(([heading, body]) => [`## ${heading}`, "", body, ""])
  ].join("\n")
