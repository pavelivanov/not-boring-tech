import type { TechnologyKind } from "@findthatproject/contracts"

const kindLabels: Readonly<Record<TechnologyKind, string>> = {
  TOOL: "Tool",
  PROJECT: "Project",
  LIBRARY: "Library",
  SERVICE: "Service",
  PRODUCT: "Product",
  FEATURE: "Feature",
  PLUGIN: "Plugin",
  SKILL: "Skill",
  GUIDE: "Guide",
  CHEAT_SHEET: "Cheat sheet",
  PODCAST: "Podcast",
  OTHER_TECH: "Technology",
}

const irregularPlurals: Partial<Readonly<Record<TechnologyKind, string>>> = {
  LIBRARY: "libraries",
  OTHER_TECH: "technologies",
}

export function formatTechnologyKind(kind: TechnologyKind): string {
  return kindLabels[kind]
}

export function formatTechnologyKindPlural(kind: TechnologyKind): string {
  return (
    irregularPlurals[kind] ?? `${kindLabels[kind].toLocaleLowerCase("en")}s`
  )
}
