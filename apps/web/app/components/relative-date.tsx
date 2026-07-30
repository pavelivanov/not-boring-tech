import { useEffect, useState } from "react"

import {
  formatAbsoluteDate,
  formatRelativeAge,
  stableReferenceTime,
} from "~/domain/dates"

type RelativeDateProps = {
  readonly value: string
}

export function RelativeDate({ value }: RelativeDateProps) {
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
      {formatRelativeAge(value, referenceTime)}
    </time>
  )
}
