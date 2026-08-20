import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export const localeStorageKey = "findthatproject:locale:v1"

export const supportedLocales = ["ru", "en"] as const

export type Locale = (typeof supportedLocales)[number]

function isLocale(value: unknown): value is Locale {
  return value === "ru" || value === "en"
}

function englishCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function russianNoun(
  count: number,
  one: string,
  few: string,
  many: string
): string {
  const mod100 = Math.abs(count) % 100
  const mod10 = mod100 % 10

  if (mod100 > 10 && mod100 < 20) return many
  if (mod10 === 1) return one
  if (mod10 > 1 && mod10 < 5) return few
  return many
}

const englishCopy = {
  common: {
    skipToContent: "Skip to content",
    returnToIndex: "Return to index",
    opensNewTab: "opens in a new tab",
    retry: "Retry",
    retrying: "Retrying…",
  },
  locale: {
    label: "Language",
    ru: "Русский",
    en: "English",
  },
  rootError: {
    unexpected: "An unexpected error occurred.",
    notFound: "The requested page could not be found.",
    interrupted: "Something interrupted the index.",
  },
  home: {
    tagline: "Hand-indexed tools, projects & podcasts",
    homeLabel: "FindThatProject home",
    weeklyDigest: "Weekly digest",
    digestLabel: (locale: string) =>
      `${locale} weekly digest on Telegram (opens in a new tab)`,
    siteLinks: "Site links",
    about: "About",
    indexFilters: "Index filters",
    type: "Type",
    all: "All",
    sort: "Sort",
    traction: "Traction",
    newest: "Newest",
    pageTitle: "FindThatProject technology ledger",
    upToDate: "You are up to date.",
    upToDateSince: (date: string) =>
      `You are up to date — nothing new since ${date}.`,
    firstVisit: (count: number) =>
      `${englishCount(count, "entry", "entries")} indexed so far — all new on your first visit`,
    sinceLastVisit: (count: number, date: string) =>
      `${englishCount(count, "entry", "entries")} indexed since your last visit on ${date}`,
    newInKind: (count: number, date: string, inView: number, kind: string) =>
      `${count} new since ${date} · ${inView} in ${kind}`,
    updatingEntries: "Updating entries…",
    showing: (shown: number, total: number) => `Showing ${shown} of ${total}`,
    searchScope: "Search",
    markAllSeen: "Mark all seen",
    resetReadState: "Reset read state",
    showingNewOnly: "Showing new only",
    showOnlyNew: "Show only new",
    newestFirst: "Newest first",
    sortedByTraction: "Sorted by traction",
    noParsedTitle: "No parsed entries yet",
    noParsedBody:
      "The index will populate after the configured public channels complete a parser run.",
    noNewQueryTitle: (query: string) => `Nothing new matches “${query}”`,
    oneOldQueryMatch:
      "One entry in the index matches, indexed before your last visit.",
    oldQueryMatches: (count: number) =>
      `${count} entries in the index match, all indexed before your last visit.`,
    searchWholeIndex: "Search the whole index",
    noQueryTitle: (query: string) => `No entry matches “${query}”`,
    nothingUnderKind: (kind: string) =>
      `Nothing under ${kind}. Widening the type filter may help.`,
    queryHint: "Try a shorter word, or the name of the tool it is built on.",
    clearSearchAndFilter: "Clear search and filter",
    clearSearch: "Clear search",
    nothingNewUnder: (kind: string) => `Nothing new under ${kind}`,
    otherTypesNew: "Other types picked up entries since your last visit.",
    allNewEntries: "All new entries",
    readEverything: "You have read everything new.",
    readEverythingBody:
      "A few entries land every day. The banner up top will be holding them next time you drop in.",
    backToIndex: "Back to the index",
    nothingIndexedUnder: (kind: string) => `Nothing indexed under ${kind} yet`,
    trackedButEmpty: "This type is tracked but still empty.",
    showAllTypes: "Show all types",
    noCombination: "No entries match this combination",
    noCombinationBody:
      "Try a shorter search, another type, or clear the current filters.",
    clearFilters: "Clear filters",
    loadFailureTitle: "More entries could not be loaded",
    loadFailureBody:
      "The entries already shown are still available. Retry when the API is reachable.",
    loadingMore: "Loading more…",
    loadMore: "Load more entries",
    footer:
      "Every new entry is announced on @findthatproject. Miss the posts and the banner up top has them waiting.",
    indexedCount: (total: number, types: number) =>
      `${total} indexed · ${types} types`,
    loadingCatalog: "Loading catalog",
    apiUnavailable: "The catalog API is unavailable",
    apiUnavailableBody:
      "FindThatProject will not substitute sample entries. Retry the live catalog request.",
    requestId: "Request ID",
  },
  search: {
    trigger: "Search",
    title: "Search the index",
    label: "Search index",
    placeholder: "Search the index",
    noLoadedMatch: "No loaded entry matches that.",
    submit: (query: string) => `Search the whole index for “${query}”`,
    suggestionsFootnote:
      "Newest entries since your last visit. Type to filter, press Enter to search the whole index.",
    filterFootnote:
      "Type to filter what is loaded, press Enter to search the whole index.",
  },
  toolCard: {
    externalProject: (name: string) => `${name} project (opens in a new tab)`,
    read: (name: string) => `Read ${name}`,
    newSinceVisit: "New since your last visit",
    sourceCount: (count: number) => englishCount(count, "source", "sources"),
    provenance: (name: string) => `View ${name} provenance`,
    stars: (count: string) => `${count} GitHub stars`,
  },
  relativeDate: {
    presented: (date: string) => `Presented ${date}`,
  },
  detail: {
    unknownSubject: (slug: string) => `Unknown subject / ${slug}`,
    missingSlug: "missing-slug",
    notInIndex: "This subject is not in the index.",
    backToFiltered: "Back to filtered results",
    backToIndex: "Back to index",
    featureOf: "Feature of",
    openWebsite: "Open website",
    firstPresented: "First presented",
    sourceStats: (channels: number, mentions: number) =>
      `${englishCount(channels, "channel", "channels")} · ${englishCount(
        mentions,
        "mention",
        "mentions"
      )}`,
    stars: (count: string) => `${count} GitHub stars`,
    provenance: "Provenance",
    everyPresentation: "Every presentation",
    newestSourceFirst: "Newest source first",
    confidence: (percent: number) => `${percent}% confidence`,
    openTelegram: "Open Telegram source",
    loadingItem: "Loading catalog item",
    loadFailure: "The subject could not be loaded",
    loadFailureBody: "Retry the live catalog request.",
    requestId: "Request ID",
  },
  about: {
    back: "Back to index",
    eyebrow: "About the index",
    title: "The stream already did the curation.",
    intro:
      "FindThatProject turns a bounded set of trusted public Telegram channels into a filterable index. It is designed for finding a useful subject again—not for manufacturing another discovery feed.",
    sections: [
      {
        title: "Corpus boundary",
        body: "Only posts from the public handles configured for the parser belong in the index. Private chats, user-selected channels, ads, job posts, and copied full post bodies are outside the boundary.",
      },
      {
        title: "Attribution",
        body: "Each presentation keeps its original channel, publication date, and direct public post link. Tool descriptions are short localized summaries rather than reproductions of channel text.",
      },
      {
        title: "Read-only by design",
        body: "Visitors can filter the index and follow sources, but cannot create, edit, or delete records. Updates are handled by controlled collection and maintenance tooling outside the public website.",
      },
      {
        title: "Corrections and removals",
        body: "Contact the owner who shared this index to request a correction or removal. A public handling destination will be listed here when it is monitored; no unmonitored form is presented as a working support channel.",
      },
    ],
  },
  notFound: {
    signal: "404 / no signal",
    title: "That page never made it into the index.",
    body: "The address may be wrong, or the record may have been removed.",
  },
}

type LocaleCopy = typeof englishCopy

const russianCopy: LocaleCopy = {
  common: {
    skipToContent: "Перейти к содержимому",
    returnToIndex: "Вернуться в каталог",
    opensNewTab: "откроется в новой вкладке",
    retry: "Повторить",
    retrying: "Повторяем…",
  },
  locale: {
    label: "Язык",
    ru: "Русский",
    en: "English",
  },
  rootError: {
    unexpected: "Произошла непредвиденная ошибка.",
    notFound: "Запрошенная страница не найдена.",
    interrupted: "Что-то прервало работу каталога.",
  },
  home: {
    tagline: "Инструменты, проекты и подкасты — вручную",
    homeLabel: "Главная FindThatProject",
    weeklyDigest: "Еженедельный дайджест",
    digestLabel: (locale: string) =>
      `${locale}-дайджест в Telegram (откроется в новой вкладке)`,
    siteLinks: "Ссылки сайта",
    about: "О проекте",
    indexFilters: "Фильтры каталога",
    type: "Тип",
    all: "Все",
    sort: "Сортировка",
    traction: "Популярные",
    newest: "Новые",
    pageTitle: "Каталог технологий FindThatProject",
    upToDate: "Вы всё просмотрели.",
    upToDateSince: (date: string) =>
      `Вы всё просмотрели — с ${date} ничего нового.`,
    firstVisit: (count: number) =>
      `${count} ${russianNoun(count, "запись", "записи", "записей")} в каталоге — при первом посещении всё новое`,
    sinceLastVisit: (count: number, date: string) =>
      `Новых записей с ${date}: ${count}`,
    newInKind: (count: number, date: string, inView: number, kind: string) =>
      `Новых с ${date}: ${count} · в разделе «${kind}»: ${inView}`,
    updatingEntries: "Обновляем записи…",
    showing: (shown: number, total: number) => `Показано ${shown} из ${total}`,
    searchScope: "Поиск",
    markAllSeen: "Отметить всё прочитанным",
    resetReadState: "Сбросить прочитанное",
    showingNewOnly: "Показаны только новые",
    showOnlyNew: "Только новые",
    newestFirst: "Сначала новые",
    sortedByTraction: "По популярности",
    noParsedTitle: "Пока нет обработанных записей",
    noParsedBody:
      "Каталог заполнится после обработки настроенных публичных каналов.",
    noNewQueryTitle: (query: string) =>
      `Среди новых записей ничего не найдено по запросу «${query}»`,
    oneOldQueryMatch:
      "В каталоге есть одна запись, но она добавлена до вашего прошлого визита.",
    oldQueryMatches: (count: number) =>
      `В каталоге есть ${count} ${russianNoun(
        count,
        "запись",
        "записи",
        "записей"
      )}, добавленных до вашего прошлого визита.`,
    searchWholeIndex: "Искать по всему каталогу",
    noQueryTitle: (query: string) => `По запросу «${query}» ничего не найдено`,
    nothingUnderKind: (kind: string) =>
      `В разделе «${kind}» ничего нет. Попробуйте убрать фильтр по типу.`,
    queryHint:
      "Попробуйте более короткое слово или название базового инструмента.",
    clearSearchAndFilter: "Сбросить поиск и фильтр",
    clearSearch: "Очистить поиск",
    nothingNewUnder: (kind: string) => `В разделе «${kind}» нет ничего нового`,
    otherTypesNew:
      "После вашего прошлого визита появились записи других типов.",
    allNewEntries: "Все новые записи",
    readEverything: "Вы прочитали всё новое.",
    readEverythingBody:
      "Каждый день появляется несколько записей. При следующем визите они будут ждать в верхнем блоке.",
    backToIndex: "Вернуться в каталог",
    nothingIndexedUnder: (kind: string) =>
      `В разделе «${kind}» пока ничего нет`,
    trackedButEmpty: "Этот тип отслеживается, но пока пуст.",
    showAllTypes: "Показать все типы",
    noCombination: "Для такой комбинации ничего не найдено",
    noCombinationBody:
      "Попробуйте сократить запрос, выбрать другой тип или сбросить фильтры.",
    clearFilters: "Сбросить фильтры",
    loadFailureTitle: "Не удалось загрузить другие записи",
    loadFailureBody:
      "Уже показанные записи доступны. Повторите попытку, когда API снова будет на связи.",
    loadingMore: "Загружаем ещё…",
    loadMore: "Загрузить ещё",
    footer:
      "Каждая новая запись появляется в @findthatproject. Если пропустили посты — они будут ждать в верхнем блоке.",
    indexedCount: (total: number, types: number) =>
      `${total} в каталоге · ${types} ${russianNoun(
        types,
        "тип",
        "типа",
        "типов"
      )}`,
    loadingCatalog: "Загрузка каталога",
    apiUnavailable: "API каталога недоступен",
    apiUnavailableBody:
      "FindThatProject не подменяет данные примерами. Повторите запрос к каталогу.",
    requestId: "ID запроса",
  },
  search: {
    trigger: "Поиск",
    title: "Поиск по каталогу",
    label: "Поиск по каталогу",
    placeholder: "Найти в каталоге",
    noLoadedMatch: "Среди загруженных записей ничего не найдено.",
    submit: (query: string) => `Искать «${query}» по всему каталогу`,
    suggestionsFootnote:
      "Новые записи с прошлого визита. Введите текст для фильтра или нажмите Enter для поиска по всему каталогу.",
    filterFootnote:
      "Введите текст для фильтра загруженных записей или нажмите Enter для поиска по всему каталогу.",
  },
  toolCard: {
    externalProject: (name: string) =>
      `${name} — сайт проекта (откроется в новой вкладке)`,
    read: (name: string) => `Читать о ${name}`,
    newSinceVisit: "Новое с прошлого визита",
    sourceCount: (count: number) =>
      `${count} ${russianNoun(count, "источник", "источника", "источников")}`,
    provenance: (name: string) => `Источники ${name}`,
    stars: (count: string) => `${count} звёзд на GitHub`,
  },
  relativeDate: {
    presented: (date: string) => `Опубликовано ${date}`,
  },
  detail: {
    unknownSubject: (slug: string) => `Неизвестная запись / ${slug}`,
    missingSlug: "нет-адреса",
    notInIndex: "Этой записи нет в каталоге.",
    backToFiltered: "Назад к результатам поиска",
    backToIndex: "Назад в каталог",
    featureOf: "Часть проекта",
    openWebsite: "Открыть сайт",
    firstPresented: "Впервые опубликовано",
    sourceStats: (channels: number, mentions: number) =>
      `${channels} ${russianNoun(
        channels,
        "канал",
        "канала",
        "каналов"
      )} · ${mentions} ${russianNoun(
        mentions,
        "упоминание",
        "упоминания",
        "упоминаний"
      )}`,
    stars: (count: string) => `${count} звёзд на GitHub`,
    provenance: "Источники",
    everyPresentation: "Все публикации",
    newestSourceFirst: "Сначала новые источники",
    confidence: (percent: number) => `уверенность ${percent}%`,
    openTelegram: "Открыть источник в Telegram",
    loadingItem: "Загрузка записи каталога",
    loadFailure: "Не удалось загрузить запись",
    loadFailureBody: "Повторите запрос к каталогу.",
    requestId: "ID запроса",
  },
  about: {
    back: "Назад в каталог",
    eyebrow: "О каталоге",
    title: "Поток уже сделал отбор.",
    intro:
      "FindThatProject превращает ограниченный набор проверенных публичных Telegram-каналов в каталог с фильтрами. Он помогает снова найти полезную тему, а не создаёт ещё одну ленту рекомендаций.",
    sections: [
      {
        title: "Границы каталога",
        body: "В каталог попадают только посты из публичных каналов, настроенных для парсера. Личные чаты, выбранные пользователями каналы, реклама, вакансии и полные копии постов остаются за его пределами.",
      },
      {
        title: "Атрибуция",
        body: "У каждой публикации сохраняются исходный канал, дата и прямая публичная ссылка на пост. Описания инструментов — это краткие локализованные резюме, а не копии текста каналов.",
      },
      {
        title: "Только для чтения",
        body: "Посетители могут фильтровать каталог и переходить к источникам, но не могут создавать, изменять или удалять записи. Обновления выполняются отдельными инструментами сбора и обслуживания.",
      },
      {
        title: "Исправления и удаление",
        body: "Чтобы исправить или удалить запись, свяжитесь с владельцем, который поделился этим каталогом. Публичный канал для обращений появится здесь, когда за ним будут следить; неработающей формы поддержки не будет.",
      },
    ],
  },
  notFound: {
    signal: "404 / нет сигнала",
    title: "Эта страница не попала в каталог.",
    body: "Возможно, адрес неверен или запись была удалена.",
  },
}

export const localeCopy: Readonly<Record<Locale, LocaleCopy>> = {
  en: englishCopy,
  ru: russianCopy,
}

type LocaleContextValue = {
  readonly locale: Locale
  readonly copy: LocaleCopy
  readonly setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { readonly children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>("en")
  const [storageRestored, setStorageRestored] = useState(false)

  useEffect(() => {
    try {
      const storedLocale = window.localStorage.getItem(localeStorageKey)
      if (isLocale(storedLocale)) updateLocale(storedLocale)
    } catch {
      // Locale switching still works for the active session without storage.
    }
    setStorageRestored(true)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale

    if (!storageRestored) return

    try {
      window.localStorage.setItem(localeStorageKey, locale)
    } catch {
      // Locale switching still works for the active session without storage.
    }
  }, [locale, storageRestored])

  const setLocale = useCallback((nextLocale: Locale) => {
    updateLocale(nextLocale)
  }, [])

  const value = useMemo(
    () => ({ locale, copy: localeCopy[locale], setLocale }),
    [locale, setLocale]
  )

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  )
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext)

  if (!value) {
    throw new Error("useLocale must be used inside LocaleProvider")
  }

  return value
}
