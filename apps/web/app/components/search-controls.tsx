import type {
  CatalogCategory,
  CatalogChannel,
  TechnologyKind,
} from "@techdex/contracts"
import { SearchIcon, XIcon } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

import { Button } from "~/components/ui/button"
import { FieldLegend, FieldSet } from "~/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group"
import { Separator } from "~/components/ui/separator"
import type { SearchFilters } from "~/domain/search"
import { formatTechnologyKind } from "~/domain/tools"

export type KindFilterOption = {
  readonly value: TechnologyKind
  readonly count: number
}

export type TagFilterOption = {
  readonly value: string
  readonly count: number
}

export type CategoryFilterOption = {
  readonly value: CatalogCategory
  readonly count: number
}

type IndexSearchProps = {
  readonly filters: SearchFilters
  readonly enableShortcut?: boolean
  readonly onChange: (filters: SearchFilters, replace?: boolean) => void
}

type SearchControlsProps = {
  readonly filters: SearchFilters
  readonly resultCount: number
  readonly totalCount: number
  readonly channels: readonly CatalogChannel[]
  readonly categoryOptions: readonly CategoryFilterOption[]
  readonly kindOptions: readonly KindFilterOption[]
  readonly tagOptions: readonly TagFilterOption[]
  readonly onChange: (filters: SearchFilters, replace?: boolean) => void
  readonly onDone: () => void
}

function paddedCount(count: number): string {
  return String(count).padStart(2, "0")
}

export function IndexSearch({
  filters,
  enableShortcut = false,
  onChange,
}: IndexSearchProps) {
  const [searchQuery, setSearchQuery] = useState(filters.query)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchInputId = useId()

  useEffect(() => {
    if (!enableShortcut) return

    function focusSearch(event: KeyboardEvent) {
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      event.preventDefault()
      searchInputRef.current?.focus()
    }

    window.addEventListener("keydown", focusSearch)
    return () => window.removeEventListener("keydown", focusSearch)
  }, [enableShortcut])

  useEffect(() => {
    setSearchQuery(filters.query)
  }, [filters.query])

  useEffect(() => {
    if (searchQuery === filters.query) return

    const timeout = window.setTimeout(() => {
      onChange({ ...filters, query: searchQuery }, true)
    }, 200)

    return () => window.clearTimeout(timeout)
  }, [filters, onChange, searchQuery])

  return (
    <div className="index-search">
      <label htmlFor={searchInputId} className="sr-only">
        Search index
      </label>
      <InputGroup className="index-search-group">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          id={searchInputId}
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          placeholder="Search the index"
          aria-keyshortcuts={enableShortcut ? "/" : undefined}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        {enableShortcut ? (
          <InputGroupAddon align="inline-end">
            <kbd>/</kbd>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </div>
  )
}

export function SearchControls({
  filters,
  resultCount,
  totalCount,
  channels,
  categoryOptions,
  kindOptions,
  tagOptions,
  onChange,
  onDone,
}: SearchControlsProps) {
  const [tagQuery, setTagQuery] = useState("")
  const [showAllTags, setShowAllTags] = useState(false)
  const tagInputId = useId()
  const hasFilters = Boolean(
    filters.query ||
    filters.kind ||
    filters.category ||
    filters.channel ||
    filters.tags.length
  )
  const normalizedTagQuery = tagQuery.trim().toLocaleLowerCase("en")
  const matchingTags = normalizedTagQuery
    ? tagOptions.filter((option) =>
        option.value.toLocaleLowerCase("en").includes(normalizedTagQuery)
      )
    : tagOptions
  const visibleTags =
    showAllTags || normalizedTagQuery ? matchingTags : matchingTags.slice(0, 12)
  const hiddenTagCount = matchingTags.length - visibleTags.length

  function changeKind(kind?: TechnologyKind) {
    const { kind: _currentKind, ...remainingFilters } = filters
    onChange(
      kind && kind !== filters.kind
        ? { ...remainingFilters, kind }
        : remainingFilters
    )
  }

  function toggleTag(tag: string) {
    const nextTags = filters.tags.includes(tag)
      ? filters.tags.filter((selectedTag) => selectedTag !== tag)
      : [...filters.tags, tag]
    onChange({ ...filters, tags: nextTags })
  }

  function changeCategory(category?: CatalogCategory) {
    const { category: _category, ...remainingFilters } = filters
    onChange(category ? { ...remainingFilters, category } : remainingFilters)
  }

  function changeChannel(channel?: string) {
    const { channel: _channel, ...remainingFilters } = filters
    onChange(channel ? { ...remainingFilters, channel } : remainingFilters)
  }

  function clearAll() {
    onChange({ query: "", tags: [], sort: filters.sort })
  }

  return (
    <div className="filter-popover-panel">
      <div className="filter-popover-header">
        <h2>Filters</h2>
        <div className="filter-popover-actions">
          <Button
            variant="link"
            size="sm"
            disabled={!hasFilters}
            onClick={clearAll}
          >
            Reset
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close filters"
            onClick={onDone}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Separator />

      <div className="filter-popover-scroll">
        <FieldSet className="filter-section">
          <FieldLegend>Type — one</FieldLegend>
          <div className="facet-filter-list">
            {kindOptions.map((option) => {
              const active = filters.kind === option.value
              const label = formatTechnologyKind(option.value)

              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={active ? "secondary" : "outline"}
                  size="pill"
                  className="facet-filter-button"
                  data-active={active || undefined}
                  aria-pressed={active}
                  onClick={() => changeKind(option.value)}
                >
                  {label}
                  <span>{paddedCount(option.count)}</span>
                </Button>
              )
            })}
          </div>
        </FieldSet>

        {categoryOptions.length > 0 ? (
          <FieldSet className="filter-section">
            <FieldLegend>Categories — one</FieldLegend>
            <div className="facet-filter-list">
              {categoryOptions.map((option) => {
                const active = filters.category === option.value

                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={active ? "secondary" : "outline"}
                    size="pill"
                    className="facet-filter-button"
                    data-active={active || undefined}
                    aria-pressed={active}
                    onClick={() =>
                      changeCategory(active ? undefined : option.value)
                    }
                  >
                    {option.value}
                    <span>{paddedCount(option.count)}</span>
                  </Button>
                )
              })}
            </div>
          </FieldSet>
        ) : null}

        {channels.length > 0 ? (
          <FieldSet className="filter-section">
            <FieldLegend>Sources — one</FieldLegend>
            <div className="facet-filter-list">
              {channels.map((channel) => {
                const active = filters.channel === channel.handle

                return (
                  <Button
                    key={channel.handle}
                    type="button"
                    variant={active ? "secondary" : "outline"}
                    size="pill"
                    className="facet-filter-button"
                    data-active={active || undefined}
                    aria-pressed={active}
                    onClick={() =>
                      changeChannel(active ? undefined : channel.handle)
                    }
                  >
                    {channel.title ?? channel.handle}
                    <span>{paddedCount(channel.itemCount)}</span>
                  </Button>
                )
              })}
            </div>
          </FieldSet>
        ) : null}

        <FieldSet className="filter-section">
          <div className="tag-filter-heading">
            <FieldLegend>Tags — any</FieldLegend>
            <span>{paddedCount(tagOptions.length)}</span>
          </div>
          <label htmlFor={tagInputId} className="sr-only">
            Filter tags
          </label>
          <InputGroup className="tag-search-group">
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              id={tagInputId}
              type="search"
              value={tagQuery}
              placeholder="Filter tags"
              onChange={(event) => setTagQuery(event.target.value)}
            />
          </InputGroup>
          <div className="facet-filter-list">
            {visibleTags.map((option) => {
              const active = filters.tags.includes(option.value)

              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={active ? "secondary" : "outline"}
                  size="pill"
                  className="facet-filter-button"
                  data-active={active || undefined}
                  aria-pressed={active}
                  onClick={() => toggleTag(option.value)}
                >
                  {option.value}
                  <span>{paddedCount(option.count)}</span>
                </Button>
              )
            })}
          </div>
          {!normalizedTagQuery && tagOptions.length > 12 ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="more-tags-button"
              onClick={() => setShowAllTags((current) => !current)}
            >
              {showAllTags ? "Show fewer" : `${hiddenTagCount} more tags`}
            </Button>
          ) : null}
          {normalizedTagQuery && matchingTags.length === 0 ? (
            <p className="no-tags-message">No tags found</p>
          ) : null}
        </FieldSet>
      </div>

      <Separator />

      <div className="filter-popover-footer">
        <span>
          {resultCount} of {totalCount} entries
        </span>
        <Button variant="ink" size="pill" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  )
}
