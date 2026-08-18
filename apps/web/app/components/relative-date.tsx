import { useEffect, useState } from "react"

import {
  formatAbsoluteDate,
  formatCompactRelativeAge,
  formatRelativeAge,
  stableReferenceTime,
} from "~/domain/dates"
import { useLocale } from "~/lib/locale"

type RelativeDateProps = {
  readonly value: string
  readonly compact?: boolean
}

export function RelativeDate({ value, compact = false }: RelativeDateProps) {
  const { locale, copy } = useLocale()
  const [referenceTime, setReferenceTime] = useState(stableReferenceTime)
  const absoluteDate = formatAbsoluteDate(value, locale)

  useEffect(() => {
    setReferenceTime(Date.now())
  }, [])

  return (
    <time
      dateTime={value}
      title={absoluteDate}
      aria-label={copy.relativeDate.presented(absoluteDate)}
    >
      {compact
        ? formatCompactRelativeAge(value, referenceTime, locale)
        : formatRelativeAge(value, referenceTime, locale)}
    </time>
  )
}
