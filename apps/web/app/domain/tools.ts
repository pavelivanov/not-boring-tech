import type {
  CatalogCategory,
  CatalogListItem,
  TechnologyKind,
} from "@findthatproject/contracts"
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

const categoryLabels: Readonly<
  Record<Locale, Readonly<Record<CatalogCategory, string>>>
> = {
  en: {
    "AI development": "AI development",
    "AI productivity": "AI productivity",
    "Creative AI": "Creative AI",
    "Data systems": "Data systems",
    Design: "Design",
    "Developer tools": "Developer tools",
    Frontend: "Frontend",
    Infrastructure: "Infrastructure",
    "Learning resources": "Learning resources",
    Operations: "Operations",
    Security: "Security",
    Other: "Other",
  },
  ru: {
    "AI development": "Разработка с ИИ",
    "AI productivity": "ИИ для продуктивности",
    "Creative AI": "Творческий ИИ",
    "Data systems": "Системы данных",
    Design: "Дизайн",
    "Developer tools": "Инструменты разработчика",
    Frontend: "Фронтенд",
    Infrastructure: "Инфраструктура",
    "Learning resources": "Учебные материалы",
    Operations: "Операционные процессы",
    Security: "Безопасность",
    Other: "Другое",
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
  return kindLabels[locale][kind]
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
  return categoryLabels[locale][category]
}
