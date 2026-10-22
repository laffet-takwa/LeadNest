/**
 * Small shared utilities.
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merges conditional class names and resolves Tailwind conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Builds initials from a person's name.
 *
 * Falls back to a single letter when only one name part is available.
 */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]
  if (!first) return '?'
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  const last = parts[parts.length - 1] ?? first
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

/**
 * Derives a stable, pleasant colour index from a string.
 *
 * Used so a customer always gets the same avatar tint.
 */
export function colorIndex(seed: string, buckets = 6): number {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % buckets
}

/** Returns the current page for an offset and a page size. */
export function pageNumber(offset: number, limit: number): number {
  if (limit <= 0) return 1
  return Math.floor(offset / limit) + 1
}

/** Returns the number of pages for a total and a page size. */
export function pageCount(total: number, limit: number): number {
  if (limit <= 0) return 1
  return Math.max(1, Math.ceil(total / limit))
}
