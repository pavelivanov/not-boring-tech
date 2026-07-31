import type { Channel } from "@techdex/contracts"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import { useState } from "react"

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
  readonly channels: readonly Channel[]
  readonly tags: readonly string[]
  readonly onChange: (filters: SearchFilters, replace?: boolean) => void
}

const allCategoriesValue = "__all_categories__"
const allChannelsValue = "__all_channels__"

function channelHandle(channel: Channel): string {
  return `@${new URL(channel.publicUrl).pathname.replace(/^\//u, "")}`
}

export function SearchControls({
  filters,
  categories,
  channels,
  tags,
  onChange,
}: SearchControlsProps) {
  const [tagPickerOpen, setTagPickerOpen] = useState(false)

  function toggleTag(tag: string) {
    const nextTags = filters.tags.includes(tag)
      ? filters.tags.filter((selectedTag) => selectedTag !== tag)
      : [...filters.tags, tag]

    onChange({ ...filters, tags: nextTags })
  }

  return (
    <FieldGroup className="gap-4">
      <FieldGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="category-filter">Category</FieldLabel>
          <Select
            value={filters.category ?? allCategoriesValue}
            onValueChange={(value) =>
              onChange(
                value === allCategoriesValue
                  ? {
                      query: filters.query,
                      ...(filters.channelId
                        ? { channelId: filters.channelId }
                        : {}),
                      tags: filters.tags,
                    }
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
          <FieldLabel htmlFor="channel-filter">Source channel</FieldLabel>
          <Select
            value={filters.channelId ?? allChannelsValue}
            onValueChange={(value) =>
              onChange(
                value === allChannelsValue
                  ? {
                      query: filters.query,
                      ...(filters.category
                        ? { category: filters.category }
                        : {}),
                      tags: filters.tags,
                    }
                  : { ...filters, channelId: value }
              )
            }
          >
            <SelectTrigger id="channel-filter" className="w-full">
              <SelectValue placeholder="Any source channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={allChannelsValue}>
                  Any source channel
                </SelectItem>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channelHandle(channel)} · {channel.name}
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
