import { describe, expect, it } from "vitest"

import {
  formatAbsoluteDate,
  formatRelativeAge,
  stableReferenceTime,
} from "./dates"

describe("date presentation", () => {
  it("formats absolute publication dates in English UTC", () => {
    expect(formatAbsoluteDate("2026-01-14T23:45:00.000Z")).toBe("Jan 14, 2026")
  })

  it("formats recent publication ages from the stable reference time", () => {
    expect(
      formatRelativeAge("2026-07-30T08:00:00.000Z", stableReferenceTime)
    ).toBe("today")
    expect(
      formatRelativeAge("2026-07-29T08:00:00.000Z", stableReferenceTime)
    ).toBe("yesterday")
  })

  it("uses month and year units for older publications", () => {
    expect(
      formatRelativeAge("2026-05-30T12:00:00.000Z", stableReferenceTime)
    ).toBe("2 months ago")
    expect(
      formatRelativeAge("2025-06-01T12:00:00.000Z", stableReferenceTime)
    ).toBe("last year")
  })

  it("clamps future timestamps to today", () => {
    expect(
      formatRelativeAge("2026-08-01T12:00:00.000Z", stableReferenceTime)
    ).toBe("today")
  })
})
