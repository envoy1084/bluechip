import { LegalPage } from "../components/LegalPage.tsx"
import { PRIVACY } from "../model/documents.ts"

export function PrivacyScreen() {
  return (
    <LegalPage
      legal={PRIVACY}
      intro="What bluechip keeps about you, why, and who else sees it. bluechip never asks for your email or phone number, shows no ads and never sells your data."
      sections={[
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
          "Our server and the app send traces, logs and metrics to Axiom so we can keep bluechip working and fix it: each request, trade and background job, with your user id and the ids of the agents, trades, automations and chats involved. They never hold your messages, memories, passkeys, keys or full addresses. This telemetry is part of running the service, so the analytics switch doesn't turn it off. Axiom keeps it for 30 days."
        ],
        [
          "Only where it counts",
          "Product analytics and telemetry run only on paper money and on bluechip. Both go through bluechip's own server first, so the app talks only to bluechip. A browser that asks sites not to track it sends no analytics from the app."
        ],
        [
          "Who else sees it",
          "Some work is done by services on our behalf. Anthropic runs the assistant's models and its web search, and sees what you send in chat, what the assistant reads to answer you, and the news stories automations ask about. Voyage turns the text of memories, conversations and help articles into search vectors. Alchemy sends your account's operations to Base and pays their gas, so it sees your address and each operation. Our Base node provider sees the addresses bluechip reads. Alpaca provides market prices and news, and gets nothing about you. PostHog (in the US) and Axiom handle analytics and telemetry as above. Your browser's push service (from Apple, Google or Mozilla) delivers push notifications, Telegram delivers messages if you link it, and our hosting provider runs our servers and database."
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
          "Turn off Product analytics in Settings and bluechip sends no analytics about you, from the app or from our server. You can see what we keep in the app, download your audit log, export your memories, delete chats and memories, unlink Telegram, turn push off and sign out any device."
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
          "When this policy changes, the date above changes and we tell you in the app if the change matters to you. Questions or requests about your data go to [contact email]."
        ]
      ]}
    />
  )
}
