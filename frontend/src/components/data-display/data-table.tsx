/**
 * DataTable.
 *
 * A composable table: the caller supplies the columns and the row renderer,
 * while the table handles the semantic markup, the responsive card layout
 * for small screens and the accessible sort controls.
 */

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface DataTableColumn<T> {
  /** Stable key, also used as the mobile card label. */
  key: string
  header: ReactNode
  /** Cell content. */
  cell: (row: T) => ReactNode
  /** Extra classes for the cell. */
  className?: string
  /** Header classes. */
  headerClassName?: string
  /** Hide the column on small screens. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
  /** The column is the row's primary label. */
  primary?: boolean
  /** Right-align the content. */
  align?: 'left' | 'right'
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  /** Rendered when there are no rows. */
  emptyState?: ReactNode
  /** Currently sorted column key. */
  sortKey?: string
  sortDirection?: 'asc' | 'desc'
  onSortChange?: (key: string) => void
  /** Columns that can be sorted. */
  sortableColumns?: readonly string[]
  isLoading?: boolean
  /** How many placeholder rows to show while loading. */
  skeletonRows?: number
  className?: string
}

const HIDE_CLASSES = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
} as const

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyState,
  sortKey,
  sortDirection = 'desc',
  onSortChange,
  sortableColumns = [],
  isLoading = false,
  skeletonRows = 6,
  className,
}: DataTableProps<T>) {
  if (!isLoading && rows.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  // The skeleton mirrors the shape of the real rows, so the table does not
  // change height when the data arrives.
  const placeholderRows = isLoading ? Array.from({ length: skeletonRows }, (_, index) => index) : []

  return (
    <div
      className={cn(
        'overflow-hidden rounded-card border border-border bg-surface shadow-xs',
        className,
      )}
      aria-busy={isLoading || undefined}
    >
      {/* Desktop: a real table. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-surface-muted">
              {columns.map((column) => {
                const sortable = sortableColumns.includes(column.key)
                const active = sortKey === column.key
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      'px-4 py-2.5 text-2xs font-semibold uppercase tracking-wide text-ink-secondary',
                      column.headerClassName,
                      column.align === 'right' && 'text-right',
                      column.hideBelow && HIDE_CLASSES[column.hideBelow],
                    )}
                    aria-sort={
                      active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                  >
                    {sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(column.key)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30',
                          column.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {column.header}
                        {active ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="size-3" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="size-3" aria-hidden="true" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-40" aria-hidden="true" />
                        )}
                        <span className="sr-only">
                          {active
                            ? `sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'}, change sort`
                            : 'not sorted, sort this column'}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {placeholderRows.map((rowIndex) => (
              <tr key={`skeleton-${rowIndex}`} className="border-b border-border last:border-b-0">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 align-middle',
                      column.hideBelow && HIDE_CLASSES[column.hideBelow],
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn('skeleton block h-3.5', column.primary ? 'w-32' : 'w-20')}
                    />
                  </td>
                ))}
              </tr>
            ))}

            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-border last:border-b-0 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-brand-soft/40',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 align-middle text-sm text-ink-secondary',
                      column.className,
                      column.align === 'right' && 'text-right',
                      column.hideBelow && HIDE_CLASSES[column.hideBelow],
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per row. */}
      <ul className="divide-y divide-border md:hidden">
        {placeholderRows.map((rowIndex) => (
          <li key={`skeleton-${rowIndex}`} className="px-4 py-3.5">
            <span aria-hidden="true" className="skeleton block h-4 w-32" />
            <span aria-hidden="true" className="skeleton mt-2 block h-3 w-20" />
          </li>
        ))}

        {rows.map((row) => {
          const primary = columns.find((column) => column.primary) ?? columns[0]
          const rest = columns.filter((column) => column !== primary)
          return (
            <li
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('px-4 py-3.5', onRowClick && 'cursor-pointer active:bg-surface-sunken')}
            >
              {primary ? (
                <div className="mb-1.5 font-medium text-ink">{primary.cell(row)}</div>
              ) : null}
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {rest.map((column) => {
                  const content = column.cell(row)
                  if (content === null || content === undefined || content === '') return null
                  return (
                    <div key={column.key} className="min-w-0">
                      <dt className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
                        {typeof column.header === 'string' ? column.header : ''}
                      </dt>
                      <dd className="truncate text-sm text-ink-secondary">{content}</dd>
                    </div>
                  )
                })}
              </dl>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
