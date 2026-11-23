import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind-merge must know the custom text scale, or `text-body` and `text-ink` would be merged as one group.
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{
        text: [
          "display-1",
          "display-2",
          "display-3",
          "title-1",
          "title-2",
          "title-3",
          "body-lg",
          "body",
          "body-sm",
          "label",
          "label-sm",
          "caption",
          "caption-sm"
        ]
      }],
      shadow: [{ shadow: ["hair", "e1", "e2", "e3", "e4"] }]
    }
  }
})

/** Joins class names and resolves Tailwind conflicts (the last class wins). */
export const cn = (...inputs: Array<ClassValue>): string => merge(clsx(inputs))
