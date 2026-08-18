import type { Locale } from "~/lib/locale"

const localeTags: Readonly<Record<Locale, string>> = {
  en: "en",
  ru: "ru-RU",
}

const absoluteDateFormatters: Readonly<Record<Locale, Intl.DateTimeFormat>> = {
  en: new Intl.DateTimeFormat(localeTags.en, {
    dateStyle: "medium",
    timeZone: "UTC",
  }),
  ru: new Intl.DateTimeFormat(localeTags.ru, {
    dateStyle: "medium",
    timeZone: "UTC",
  }),
}

const relativeFormatters: Readonly<Record<Locale, Intl.RelativeTimeFormat>> = {
  en: new Intl.RelativeTimeFormat(localeTags.en, { numeric: "auto" }),
  ru: new Intl.RelativeTimeFormat(localeTags.ru, { numeric: "auto" }),
}

const duration = {
  day: 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
} as const

export const stableReferenceTime = Date.parse("2026-07-30T12:00:00.000Z")

export function formatAbsoluteDate(
  value: string,
  locale: Locale = "en"
): string {
  return absoluteDateFormatters[locale].format(new Date(value))
}

export function formatRelativeAge(
  value: string,
  referenceTime = stableReferenceTime,
  locale: Locale = "en"
): string {
  const elapsed = Math.max(0, referenceTime - Date.parse(value))

  if (elapsed < duration.day) {
    return relativeFormatters[locale].format(0, "day")
  }

  if (elapsed < duration.month) {
    return relativeFormatters[locale].format(
      -Math.floor(elapsed / duration.day),
      "day"
    )
  }

  if (elapsed < duration.year) {
    return relativeFormatters[locale].format(
      -Math.floor(elapsed / duration.month),
      "month"
    )
  }

  return relativeFormatters[locale].format(
    -Math.floor(elapsed / duration.year),
    "year"
  )
}

export function formatCompactRelativeAge(
  value: string,
  referenceTime = stableReferenceTime,
  locale: Locale = "en"
): string {
  const elapsed = Math.max(0, referenceTime - Date.parse(value))

  if (elapsed < duration.day) {
    return locale === "ru" ? "сегодня" : "today"
  }

  if (elapsed < duration.month) {
    return `${Math.floor(elapsed / duration.day)} ${locale === "ru" ? "д" : "d"}`
  }

  if (elapsed < duration.year) {
    return `${Math.floor(elapsed / duration.month)} ${locale === "ru" ? "мес" : "mo"}`
  }

  return `${Math.floor(elapsed / duration.year)} ${locale === "ru" ? "г" : "yr"}`
}

const ledgerDateFormatters: Readonly<Record<Locale, Intl.DateTimeFormat>> = {
  en: new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }),
  ru: new Intl.DateTimeFormat(localeTags.ru, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }),
}

export function formatLedgerDate(value: string, locale: Locale = "en"): string {
  const formatted = ledgerDateFormatters[locale]
    .format(new Date(value))
    .toLocaleUpperCase(localeTags[locale])

  return locale === "ru" ? formatted.replace(/\sГ\.$/u, "") : formatted
}

const visitDateFormatters: Readonly<Record<Locale, Intl.DateTimeFormat>> = {
  en: new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
  }),
  ru: new Intl.DateTimeFormat(localeTags.ru, {
    day: "numeric",
    month: "long",
  }),
}

export function formatVisitDate(value: string, locale: Locale = "en"): string {
  return visitDateFormatters[locale].format(new Date(value))
}
