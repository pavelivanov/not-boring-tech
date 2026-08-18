import { describe, expect, it } from "vitest"

import { digestChannels } from "./channels"

describe("digest channels", () => {
  it("builds public Telegram links for configured handles", () => {
    expect(
      digestChannels({
        VITE_DIGEST_CHANNEL_RU: "@findthatproject_ru",
        VITE_DIGEST_CHANNEL_EN: "@findthatproject_en",
      })
    ).toEqual([
      {
        locale: "RU",
        handle: "@findthatproject_ru",
        url: "https://t.me/findthatproject_ru",
      },
      {
        locale: "EN",
        handle: "@findthatproject_en",
        url: "https://t.me/findthatproject_en",
      },
    ])
  })

  it("drops unset and malformed handles instead of linking nowhere", () => {
    expect(
      digestChannels({
        VITE_DIGEST_CHANNEL_RU: "",
        VITE_DIGEST_CHANNEL_EN: "findthatproject_en",
      })
    ).toEqual([])
  })
})
