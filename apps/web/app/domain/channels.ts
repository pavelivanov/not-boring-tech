export type DigestChannel = {
  readonly locale: "RU" | "EN"
  readonly handle: string
  readonly url: string
}

// These are fixed, public owner-managed channels, so the website should link
// them without relying on optional build-time deployment configuration.
export function digestChannels(): readonly DigestChannel[] {
  return [
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
  ]
}
