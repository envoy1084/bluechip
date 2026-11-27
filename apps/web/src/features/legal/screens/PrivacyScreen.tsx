import { LegalPage } from "../components/LegalPage.tsx"
import { PRIVACY } from "../model/documents.ts"

export function PrivacyScreen() {
  return (
    <LegalPage
      legal={PRIVACY}
      intro="What bluechip keeps about you, why, and who else sees it. bluechip never asks for your name, email or phone number, and never sells your data."
      sections={[
        [
          "Your account",
          "When you sign up we keep your passkey's public key and a label for the device it was made on, your smart account's address on Base, where you said you live (outside the US or not) and your time zone. We never see your Face ID, fingerprint or the private part of your passkey: they stay on your device."
        ],
        [
          "Signing in",
          "Each signed-in browser gets a session, kept with a description of the device from its browser (such as Safari on Mac) so you can see and sign out devices in Settings. Important account events, like a new passkey or a recovery request, are kept in your audit log."
        ],
        [
          "Your money and trades",
          "Your balances, trades, transfers and their costs are public on Base by nature. bluechip keeps a copy to show your portfolio and performance, along with your agents, their limits and journals, your automations and the approvals you answered."
        ],
        [
          "Chat and memory",
          "Your conversations with the assistant are kept so you can read them again. It remembers what you tell it to, and notes preferences and goals from what you say; you can see, export and delete every memory, and delete any chat."
        ],
        [
          "Notifications and Telegram",
          "If you turn on notifications we keep your browser's push subscription and your channel settings. If you link Telegram we keep your Telegram user and chat id and name, so the bot can reach you. Unlink it at any time."
        ],
        [
          "Who else sees it",
          "Some work is done by services on our behalf: Anthropic runs the assistant's model and sees what you send in chat, Voyage turns text into search vectors for memory and help, Alpaca provides market data and news, your browser's push service delivers notifications, and Telegram delivers messages if you link it. Your trades themselves happen on Base, a public network."
        ],
        [
          "How long we keep it",
          "We keep your data while your account exists. Deleting a memory or a chat removes it from the assistant at once. What is on Base stays there, as on any public chain."
        ],
        [
          "Your choices",
          "You can see what we keep in the app, export your memories, delete chats and memories, unlink Telegram and turn notifications off. To close your account and have us delete what we hold, contact us."
        ]
      ]}
    />
  )
}
