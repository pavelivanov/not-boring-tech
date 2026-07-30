export function siteUrl(path: string, origin?: string): string | undefined {
  if (!origin) {
    return undefined
  }

  return new URL(path, origin).toString()
}

export function canonicalMeta(
  path: string,
  origin = import.meta.env.VITE_PUBLIC_SITE_ORIGIN
): { tagName: "link"; rel: "canonical"; href: string }[] {
  const href = siteUrl(path, origin)

  return href ? [{ tagName: "link", rel: "canonical", href }] : []
}
