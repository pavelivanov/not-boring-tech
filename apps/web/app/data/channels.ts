import type { Channel } from "@techdex/contracts"

export const isOwnerApprovedCorpus = true

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
  {
    id: "ai-newz",
    name: "эйай ньюз",
    publicUrl: "https://t.me/ai_newz",
  },
  {
    id: "denissexy",
    name: "Denis Sexy IT 🤖",
    publicUrl: "https://t.me/denissexy",
  },
] as const satisfies readonly Channel[]

export const channelsById: ReadonlyMap<string, Channel> = new Map(
  channels.map((channel) => [channel.id, channel])
)
