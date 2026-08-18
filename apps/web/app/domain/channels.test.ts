import { describe, expect, it } from "vitest"

import { digestChannels } from "./channels"

describe("digest channels", () => {
  it("returns the fixed public Telegram digest links", () => {
    expect(digestChannels()).toEqual([
      {
        locale: "RU",
        handle: "@findthatproject_weekly_digest_ru",
        url: "https://t.me/findthatproject_weekly_digest_ru",
      },
      {
        locale: "EN",
        handle: "@findthatproject_weekly_digest_en",
        url: "https://t.me/findthatproject_weekly_digest_en",
      },
    ])
  })
})
