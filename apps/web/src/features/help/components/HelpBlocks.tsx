import type { HelpBlock } from "../model/articles.ts"

/** An article's paragraphs and lists, in its reading type. */
export function HelpBlocks({ blocks }: Readonly<{ blocks: ReadonlyArray<HelpBlock> }>) {
  return blocks.map((block) =>
    block._tag === "Paragraph" ?
      <p key={block.text}>{block.text}</p> :
      (
        <ul key={block.items.join("\n")} className="grid list-disc gap-1.5 pl-5 marker:text-g-400">
          {block.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )
  )
}
