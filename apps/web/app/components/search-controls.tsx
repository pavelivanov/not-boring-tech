import { CheckIcon, ChevronsUpDownIcon, SearchIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "~/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command"
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "~/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import type { SearchFilters } from "~/domain/search"

type SearchControlsProps = {
  readonly filters: SearchFilters
  readonly categories: readonly string[]
  readonly tags: readonly string[]
  readonly onChange: (filters: SearchFilters, replace?: boolean) => void
}

const allCategoriesValue = "__all_categories__"

export function SearchControls({
  filters,
  categories,
  tags,
  onChange,
}: SearchControlsProps) {
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [queryDraft, setQueryDraft] = useState(filters.query)

  useEffect(() => {
    setQueryDraft(filters.query)
  }, [filters.query])

  function updateQuery(query: string) {
    setQueryDraft(query)
    onChange({ ...filters, query }, true)
  }

  function toggleTag(tag: string) {
    const nextTags = filters.tags.includes(tag)
      ? filters.tags.filter((selectedTag) => selectedTag !== tag)
      : [...filters.tags, tag]

    onChange({ ...filters, tags: nextTags })
  }

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor="tool-search" className="sr-only">
          Search tools
        </FieldLabel>
        <InputGroup className="h-14 rounded-xl bg-background shadow-sm">
          <InputGroupInput
            id="tool-search"
            value={queryDraft}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="What was that tool for…"
            autoComplete="off"
            className="text-base md:text-base"
          />
          <InputGroupAddon align="inline-start">
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          {filters.query ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-sm"
                aria-label="Clear search"
                onClick={() => updateQuery("")}
              >
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      </Field>

      <FieldGroup className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="category-filter">Category</FieldLabel>
          <Select
            value={filters.category ?? allCategoriesValue}
            onValueChange={(value) =>
              onChange(
                value === allCategoriesValue
                  ? { query: filters.query, tags: filters.tags }
                  : { ...filters, category: value }
              )
            }
          >
            <SelectTrigger id="category-filter" className="w-full">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={allCategoriesValue}>
                  All categories
                </SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel id="tag-filter-label">Tags</FieldLabel>
          <Popover open={tagPickerOpen} onOpenChange={setTagPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-labelledby="tag-filter-label"
                aria-expanded={tagPickerOpen}
                className="w-full justify-between"
              >
                {filters.tags.length
                  ? `${filters.tags.length} ${
                      filters.tags.length === 1 ? "tag" : "tags"
                    } selected`
                  : "Any tag"}
                <ChevronsUpDownIcon data-icon="inline-end" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-(--radix-popover-trigger-width) p-0"
            >
              <Command>
                <CommandInput placeholder="Find a tag…" />
                <CommandList>
                  <CommandEmpty>No tag found.</CommandEmpty>
                  <CommandGroup heading="Available tags">
                    {tags.map((tag) => {
                      const selected = filters.tags.includes(tag)

                      return (
                        <CommandItem
                          key={tag}
                          value={tag}
                          data-checked={selected}
                          onSelect={() => toggleTag(tag)}
                        >
                          <CheckIcon
                            aria-hidden="true"
                            className={selected ? "opacity-100" : "opacity-0"}
                          />
                          {tag}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </Field>
      </FieldGroup>
    </FieldGroup>
  )
}
