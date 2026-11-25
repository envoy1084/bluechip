/** The viewer's own time zone: activity is read as "when did I do this", not in market time. */
export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
