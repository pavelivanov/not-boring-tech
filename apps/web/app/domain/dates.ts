const absoluteDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
})

const relativeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
})

const duration = {
  day: 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
} as const

export const stableReferenceTime = Date.parse("2026-07-30T12:00:00.000Z")

export function formatAbsoluteDate(value: string): string {
  return absoluteDateFormatter.format(new Date(value))
}

export function formatRelativeAge(
  value: string,
  referenceTime = stableReferenceTime
): string {
  const elapsed = Math.max(0, referenceTime - Date.parse(value))

  if (elapsed < duration.day) {
    return "today"
  }

  if (elapsed < duration.month) {
    return relativeFormatter.format(-Math.floor(elapsed / duration.day), "day")
  }

  if (elapsed < duration.year) {
    return relativeFormatter.format(
      -Math.floor(elapsed / duration.month),
      "month"
    )
  }

  return relativeFormatter.format(-Math.floor(elapsed / duration.year), "year")
}
