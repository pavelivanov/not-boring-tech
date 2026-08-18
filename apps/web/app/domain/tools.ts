import type { TechnologyKind } from "@findthatproject/contracts"
import type { Locale } from "~/lib/locale"

const kindLabels: Readonly<
  Record<Locale, Readonly<Record<TechnologyKind, string>>>
> = {
  en: {
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
  },
  ru: {
    TOOL: "Инструмент",
    PROJECT: "Проект",
    LIBRARY: "Библиотека",
    SERVICE: "Сервис",
    PRODUCT: "Продукт",
    FEATURE: "Функция",
    PLUGIN: "Плагин",
    SKILL: "Навык",
    GUIDE: "Руководство",
    CHEAT_SHEET: "Шпаргалка",
    PODCAST: "Подкаст",
    OTHER_TECH: "Технология",
  },
}

const pluralKindLabels: Readonly<
  Record<Locale, Readonly<Record<TechnologyKind, string>>>
> = {
  en: {
    TOOL: "tools",
    PROJECT: "projects",
    LIBRARY: "libraries",
    SERVICE: "services",
    PRODUCT: "products",
    FEATURE: "features",
    PLUGIN: "plugins",
    SKILL: "skills",
    GUIDE: "guides",
    CHEAT_SHEET: "cheat sheets",
    PODCAST: "podcasts",
    OTHER_TECH: "technologies",
  },
  ru: {
    TOOL: "Инструменты",
    PROJECT: "Проекты",
    LIBRARY: "Библиотеки",
    SERVICE: "Сервисы",
    PRODUCT: "Продукты",
    FEATURE: "Функции",
    PLUGIN: "Плагины",
    SKILL: "Навыки",
    GUIDE: "Руководства",
    CHEAT_SHEET: "Шпаргалки",
    PODCAST: "Подкасты",
    OTHER_TECH: "Технологии",
  },
}

export function formatTechnologyKind(
  kind: TechnologyKind,
  locale: Locale = "en"
): string {
  return kindLabels[locale][kind]
}

export function formatTechnologyKindPlural(
  kind: TechnologyKind,
  locale: Locale = "en"
): string {
  return pluralKindLabels[locale][kind]
}
