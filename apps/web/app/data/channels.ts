import type { Channel } from "@techdex/contracts"

export const isTemporaryCorpus = true

export const channels = [
  {
    id: "notboring-tech",
    name: "Not Boring Tech",
    publicUrl: "https://t.me/notboring_tech",
  },
  {
    id: "ctodaily",
    name: "запуск завтра",
    publicUrl: "https://t.me/ctodaily",
  },
] as const satisfies readonly Channel[]

export const channelsById: ReadonlyMap<string, Channel> = new Map(
  channels.map((channel) => [channel.id, channel])
)
