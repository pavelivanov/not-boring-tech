import type {
  CatalogCategory,
  CatalogChannel,
  TechnologyKind,
} from "@techdex/contracts"
import { SearchIcon, XIcon } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { Link } from "react-router"

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

type SearchControlsProps = {
  readonly filters: SearchFilters
  readonly resultCount: number
  readonly totalCount: number
  readonly channelCount: number
  readonly channels: readonly CatalogChannel[]
  readonly categoryOptions: readonly CategoryFilterOption[]
  readonly kindOptions: readonly KindFilterOption[]
  readonly tagOptions: readonly TagFilterOption[]
  readonly enableShortcut?: boolean
  readonly onChange: (filters: SearchFilters, replace?: boolean) => void
}

function paddedCount(count: number): string {
  return String(count).padStart(2, "0")
}

export function SearchControls({
  filters,
  resultCount,
  totalCount,
  channelCount,
  channels,
  categoryOptions,
  kindOptions,
  tagOptions,
  enableShortcut = false,
  onChange,
}: SearchControlsProps) {
  const [searchQuery, setSearchQuery] = useState(filters.query)
  const [tagQuery, setTagQuery] = useState("")
  const [showAllTags, setShowAllTags] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchInputId = useId()
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
    showAllTags || normalizedTagQuery ? matchingTags : matchingTags.slice(0, 8)
  const hiddenTagCount = matchingTags.length - visibleTags.length
  const activeChannel = filters.channel
    ? channels.find((channel) => channel.handle === filters.channel)
    : undefined

  useEffect(() => {
    if (!enableShortcut) {
      return
    }

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

  function removeCategory() {
    const { category: _category, ...remainingFilters } = filters
    onChange(remainingFilters)
  }

  function changeCategory(category?: CatalogCategory) {
    const { category: _category, ...remainingFilters } = filters
    onChange(category ? { ...remainingFilters, category } : remainingFilters)
  }

  function changeChannel(channel?: string) {
    const { channel: _channel, ...remainingFilters } = filters
    onChange(channel ? { ...remainingFilters, channel } : remainingFilters)
  }

  function removeChannel() {
    const { channel: _channel, ...remainingFilters } = filters
    onChange(remainingFilters)
  }

  function clearAll() {
    onChange({ query: "", tags: [], sort: filters.sort })
  }

  return (
    <div className="filter-panel-content">
      <div className="filter-brand-row">
        <Link to="/" className="filter-brand" aria-label="TechDex home">
          TechDex<span>/</span>
        </Link>
        <Link to="/about" className="filter-about-link">
          About
        </Link>
      </div>

      <label htmlFor={searchInputId} className="sr-only">
        Search index
      </label>
      <InputGroup className="filter-search-group">
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
          onChange={(event) => {
            setSearchQuery(event.target.value)
          }}
        />
        {enableShortcut ? (
          <InputGroupAddon align="inline-end">
            <kbd>/</kbd>
          </InputGroupAddon>
        ) : null}
      </InputGroup>

      <div className="filter-result-row">
        <span>
          {resultCount} of {totalCount} showing
        </span>
        {hasFilters ? (
          <Button variant="ghost" size="xs" onClick={clearAll}>
            Clear all
          </Button>
        ) : null}
      </div>

      {filters.kind ||
      filters.category ||
      filters.channel ||
      filters.tags.length ? (
        <div className="active-filter-chips" aria-label="Active filters">
          {filters.kind ? (
            <Button
              variant="ghost"
              size="xs"
              aria-label={`Remove type filter ${formatTechnologyKind(filters.kind)}`}
              onClick={() => changeKind()}
            >
              {formatTechnologyKind(filters.kind)}
              <XIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          ) : null}
          {filters.category ? (
            <Button
              variant="ghost"
              size="xs"
              aria-label={`Remove category filter ${filters.category}`}
              onClick={removeCategory}
            >
              {filters.category}
              <XIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          ) : null}
          {activeChannel ? (
            <Button
              variant="ghost"
              size="xs"
              aria-label={`Remove source filter ${activeChannel.title ?? activeChannel.handle}`}
              onClick={removeChannel}
            >
              {activeChannel.handle}
              <XIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          ) : null}
          {filters.tags.map((tag) => (
            <Button
              key={tag}
              variant="ghost"
              size="xs"
              aria-label={`Remove tag filter ${tag}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
              <XIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          ))}
        </div>
      ) : null}

      <FieldSet className="filter-section">
        <FieldLegend>Type — pick one</FieldLegend>
        <div className="kind-filter-grid">
          {kindOptions.map((option) => {
            const active = filters.kind === option.value
            const label = formatTechnologyKind(option.value)

            return (
              <Button
                key={option.value}
                type="button"
                variant="outline"
                className="kind-filter-button"
                data-active={active || undefined}
                aria-pressed={active}
                onClick={() => changeKind(option.value)}
              >
                <span className="kind-filter-mark" aria-hidden="true">
                  <span />
                </span>
                <span className="kind-filter-label">{label}</span>
                <span className="kind-filter-count">
                  {paddedCount(option.count)}
                </span>
              </Button>
            )
          })}
          <Button
            type="button"
            variant="outline"
            className="all-types-button"
            onClick={() => changeKind()}
          >
            All types
          </Button>
        </div>
      </FieldSet>

      {categoryOptions.length > 0 ? (
        <FieldSet className="filter-section tag-filter-section">
          <FieldLegend>Categories — pick one</FieldLegend>
          <div className="tag-filter-list">
            {categoryOptions.map((option) => {
              const active = filters.category === option.value

              return (
                <Button
                  key={option.value}
                  type="button"
                  variant="outline"
                  size="xs"
                  className="tag-filter-button"
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
        <FieldSet className="filter-section tag-filter-section">
          <FieldLegend>Sources — pick one</FieldLegend>
          <div className="tag-filter-list">
            {channels.map((channel) => {
              const active = filters.channel === channel.handle

              return (
                <Button
                  key={channel.handle}
                  type="button"
                  variant="outline"
                  size="xs"
                  className="tag-filter-button"
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

      <FieldSet className="filter-section tag-filter-section">
        <div className="tag-filter-heading">
          <FieldLegend>Tags</FieldLegend>
          <span>{paddedCount(tagOptions.length)}</span>
        </div>
        <label htmlFor={tagInputId} className="sr-only">
          Filter tags
        </label>
        <InputGroup className="filter-search-group tag-search-group">
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
        <div className="tag-filter-list">
          {visibleTags.map((option) => {
            const active = filters.tags.includes(option.value)

            return (
              <Button
                key={option.value}
                type="button"
                variant="outline"
                size="xs"
                className="tag-filter-button"
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
        {!normalizedTagQuery && tagOptions.length > 8 ? (
          <Button
            type="button"
            variant="ghost"
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

      <Separator className="filter-panel-separator" />
      <div className="filter-panel-footer">
        <span>
          Subjects {paddedCount(totalCount)} · Channels{" "}
          {paddedCount(channelCount)}
        </span>
        <span>Provisional</span>
      </div>
    </div>
  )
}
