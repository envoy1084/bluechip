// What a browser's user agent says about the device, in words a person recognizes.

const systems: ReadonlyArray<readonly [RegExp, string]> = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/CrOS/, "Chromebook"],
  [/Macintosh|Mac OS X/, "Mac"],
  [/Windows/, "Windows"],
  [/Linux/, "Linux"]
]

// Edge and Chrome say Safari too, and Edge says Chrome: the first match wins.
const browsers: ReadonlyArray<readonly [RegExp, string]> = [
  [/Edg\//, "Edge"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"]
]

const find = (list: ReadonlyArray<readonly [RegExp, string]>, userAgent: string | undefined) =>
  list.find(([pattern]) => pattern.test(userAgent ?? ""))?.[1]

/** The kind of device: "iPhone", "Mac", "Windows"; `undefined` when the user agent doesn't say. */
export const systemOf = (userAgent: string | undefined): string | undefined => find(systems, userAgent)

/** A browser on a device: "Chrome on Mac", "Safari on iPhone", or "A browser" when the user agent says nothing. */
export const deviceOf = (userAgent: string | undefined): string => {
  const browser = find(browsers, userAgent)
  const system = systemOf(userAgent)
  if (browser !== undefined && system !== undefined) return `${browser} on ${system}`
  return browser ?? system ?? "A browser"
}

/** The class of device, for analytics: a phone, a tablet, a computer, or `unknown` when the user agent says nothing. */
export const deviceClassOf = (userAgent: string | undefined): "mobile" | "tablet" | "desktop" | "unknown" => {
  if (userAgent === undefined || userAgent === "") return "unknown"
  if (/iPad|Tablet/.test(userAgent)) return "tablet"
  return /Mobi|iPhone|Android/.test(userAgent) ? "mobile" : "desktop"
}
