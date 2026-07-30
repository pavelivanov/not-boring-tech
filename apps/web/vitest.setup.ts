import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => {
  cleanup()
})

class ResizeObserverStub implements ResizeObserver {
  readonly root = null
  readonly rootMargin = ""
  readonly thresholds = []

  disconnect() {}

  observe() {}

  takeRecords(): ResizeObserverEntry[] {
    return []
  }

  unobserve() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  value: ResizeObserverStub,
})

for (const method of [
  "hasPointerCapture",
  "releasePointerCapture",
  "setPointerCapture",
  "scrollIntoView",
] as const) {
  Object.defineProperty(HTMLElement.prototype, method, {
    configurable: true,
    value: () => false,
  })
}
