// "Research and news on my stocks": web searches with their research cards and citations, answers with ticker chips.
import type { CardId } from "@bluechip/domain/Ids"
import { makeCard, roundOf } from "../../cards.ts"
import { own, say, searched, type ThreadContext, type Turn } from "../../rounds.ts"

const NVIDIA = [
  {
    url: "https://www.reuters.com/technology/nvidia-results-data-centre",
    title: "Nvidia beats forecasts as data centre sales climb",
    citedText: "Data centre revenue rose 56% from a year earlier."
  },
  {
    url: "https://www.bloomberg.com/news/nvidia-export-rules",
    title: "New export rules cloud Nvidia's China outlook",
    citedText: "Sales to China fell to about 5% of revenue."
  },
  {
    url: "https://www.cnbc.com/nvidia-blackwell-ramp",
    title: "Blackwell ramp is ahead of plan, CFO says",
    citedText: null
  }
]

export const researchAndNews = ({ mint }: ThreadContext): ReadonlyArray<Turn> => [
  {
    you: "How is Microsoft doing?",
    rounds: [[
      ...roundOf(mint, makeCard(mint, "research", "applied", null)),
      say("[[MSFT]] had a strong quarter, led by Azure. The sources are on the card.")
    ]]
  },
  {
    you: "Any news on Nvidia this week?",
    rounds: [[
      searched(mint, "Nvidia news this week", NVIDIA),
      say(
        "Mostly good for [[NVDA]]:\n\n" +
          `- **Results beat forecasts**, with data centre sales up 56% ([Reuters](${NVIDIA[0]!.url})).\n` +
          `- **China is the worry**: new export rules ([Bloomberg](${NVIDIA[1]!.url})).\n` +
          `- **Blackwell is ahead of plan** ([CNBC](${NVIDIA[2]!.url})).\n\n` +
          "Chip peers like [[INTC]] moved less. These are other people's views, not advice."
      ),
      own({ _tag: "Research", id: mint.id("card") as CardId, query: "Nvidia news this week", citations: NVIDIA })
    ]]
  },
  {
    you: "Compare Apple and Alphabet quickly",
    rounds: [[
      say(
        "| | [[AAPL]] | [[GOOGL]] |\n| --- | ---: | ---: |\n| Price | $232.18 | $246.75 |\n" +
          "| This week | +1.2% | +3.4% |\n| You hold | 38 shares | 25 shares |\n\n" +
          "Alphabet had the better week on cloud and search ads."
      )
    ]]
  }
]
