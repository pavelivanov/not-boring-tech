import type { Channel } from "@techdex/contracts"

export const isTemporaryCorpus = true

export const channels = [
  {
    id: "temporary-devtools",
    name: "Temporary · Dev Tools Digest",
    publicUrl: "https://t.me/techdex_demo_devtools",
  },
  {
    id: "temporary-ai",
    name: "Temporary · Applied AI Notes",
    publicUrl: "https://t.me/techdex_demo_ai",
  },
  {
    id: "temporary-data",
    name: "Temporary · Data Systems",
    publicUrl: "https://t.me/techdex_demo_data",
  },
  {
    id: "temporary-frontend",
    name: "Temporary · Frontend Fieldnotes",
    publicUrl: "https://t.me/techdex_demo_frontend",
  },
  {
    id: "temporary-infra",
    name: "Temporary · Small Infra",
    publicUrl: "https://t.me/techdex_demo_infra",
  },
] as const satisfies readonly Channel[]

export const channelsById: ReadonlyMap<string, Channel> = new Map(
  channels.map((channel) => [channel.id, channel])
)
