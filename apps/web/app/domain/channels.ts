export type DigestChannel = {
  readonly locale: "RU" | "EN"
  readonly handle: string
  readonly url: string
}

const handlePattern = /^@[a-z][a-z0-9_]{4,31}$/i

function digestChannel(
  locale: DigestChannel["locale"],
  handle: unknown
): DigestChannel | null {
  if (typeof handle !== "string" || !handlePattern.test(handle.trim())) {
    return null
  }

  const normalized = handle.trim()
  return {
    locale,
    handle: normalized,
    url: `https://t.me/${normalized.slice(1)}`,
  }
}

// The digest bot publishes one Telegram channel per language. Both handles are
// deployment configuration, so the header only advertises the ones configured.
export function digestChannels(
  env: Record<string, unknown> = import.meta.env
): readonly DigestChannel[] {
  return [
    digestChannel("RU", env.VITE_DIGEST_CHANNEL_RU),
    digestChannel("EN", env.VITE_DIGEST_CHANNEL_EN),
  ].filter((channel): channel is DigestChannel => channel !== null)
}
