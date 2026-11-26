// Time zones in words: a zone by its city, and the few a time is usually set in.

/** A zone as people say it, by its city: "Kolkata", "New York", "UTC". */
export const zoneLabel = (zone: string): string =>
  zone === "UTC" || zone === "Etc/UTC" ? "UTC" : zone.split("/").at(-1)!.replaceAll("_", " ")

/** The time zones a time can be in: the market's, yours (when it's another), and UTC. */
export const timeZones = (local: string): ReadonlyArray<{ readonly zone: string; readonly label: string }> => [
  { zone: "America/New_York", label: "New York (market time)" },
  ...(local === "America/New_York" || local === "UTC" || local === "Etc/UTC" ?
    [] :
    [{ zone: local, label: `${zoneLabel(local)} (your time)` }]),
  { zone: "UTC", label: "UTC" }
]
