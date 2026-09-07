import type {
  CatalogCategory,
  CatalogListItem,
  TechnologyKind,
} from "@findthatproject/contracts"
import {
  CATALOG_CATEGORY_LABELS,
  TECHNOLOGY_KIND_LABELS,
} from "@findthatproject/contracts"
import type { Locale } from "~/lib/locale"

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

export type LocalizedCatalogContent = {
  readonly name: string
  readonly parentName: string | null
  readonly description: string
}

export function localizeCatalogItem(
  item: CatalogListItem,
  locale: Locale
): LocalizedCatalogContent {
  if (locale === "ru") {
    return {
      name: item.nameRu,
      parentName: item.parentNameRu ?? item.parentName,
      description: item.descriptionRu ?? item.descriptionEn,
    }
  }

  return {
    name: item.name,
    parentName: item.parentName,
    description: item.descriptionEn,
  }
}

export function formatTechnologyKind(
  kind: TechnologyKind,
  locale: Locale = "en"
): string {
  return TECHNOLOGY_KIND_LABELS[locale][kind]
}

export function formatTechnologyKindPlural(
  kind: TechnologyKind,
  locale: Locale = "en"
): string {
  return pluralKindLabels[locale][kind]
}

export function formatCatalogCategory(
  category: CatalogCategory,
  locale: Locale = "en"
): string {
  return CATALOG_CATEGORY_LABELS[locale][category]
}
