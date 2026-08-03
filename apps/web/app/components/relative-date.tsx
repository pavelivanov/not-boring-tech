import { useEffect, useState } from "react"

import {
  formatAbsoluteDate,
  formatCompactRelativeAge,
  formatRelativeAge,
  stableReferenceTime,
} from "~/domain/dates"

type RelativeDateProps = {
  readonly value: string
  readonly compact?: boolean
}

export function RelativeDate({ value, compact = false }: RelativeDateProps) {
  const [referenceTime, setReferenceTime] = useState(stableReferenceTime)
  const absoluteDate = formatAbsoluteDate(value)

  useEffect(() => {
    setReferenceTime(Date.now())
  }, [])

  return (
    <time
      dateTime={value}
      title={absoluteDate}
      aria-label={`Presented ${absoluteDate}`}
    >
      {compact
        ? formatCompactRelativeAge(value, referenceTime)
        : formatRelativeAge(value, referenceTime)}
    </time>
  )
}
