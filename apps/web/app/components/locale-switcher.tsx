import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { type Locale, supportedLocales, useLocale } from "~/lib/locale"

const localeLabels: Readonly<Record<Locale, string>> = {
  ru: "RU",
  en: "EN",
}

export function LocaleSwitcher() {
  const { locale, copy, setLocale } = useLocale()

  return (
    <ToggleGroup
      type="single"
      value={locale}
      variant="ink"
      size="sm"
      spacing={1}
      aria-label={copy.locale.label}
      className="index-locale-switcher"
      onValueChange={(value) => {
        if (value === "ru" || value === "en") setLocale(value)
      }}
    >
      {supportedLocales.map((value) => (
        <ToggleGroupItem
          key={value}
          value={value}
          aria-label={copy.locale[value]}
        >
          {localeLabels[value]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
