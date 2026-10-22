/**
 * Component tests for the data table.
 *
 * The table has to show a loading state that resembles the real rows, and it
 * has to report the current sort to assistive technology.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DataTable, type DataTableColumn } from '@/components/data-display/data-table'

interface Row {
  id: string
  name: string
  email: string
}

const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Customer', primary: true, cell: (row) => row.name },
  { key: 'email', header: 'Email', cell: (row) => row.email },
]

const ROWS: Row[] = [{ id: '1', name: 'Amira Ben Salah', email: 'amira@atlas.tn' }]

describe('DataTable', () => {
  it('renders the rows and their values', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} rowKey={(row) => row.id} />)

    expect(screen.getByRole('columnheader', { name: /customer/i })).toBeInTheDocument()
    expect(screen.getAllByText('Amira Ben Salah').length).toBeGreaterThan(0)
    expect(screen.getAllByText('amira@atlas.tn').length).toBeGreaterThan(0)
  })

  it('shows a loading placeholder instead of the rows', () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => row.id}
        isLoading
        skeletonRows={3}
      />,
    )

    expect(screen.queryByText('Amira Ben Salah')).not.toBeInTheDocument()
    expect(document.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0)
  })

  it('renders the empty state when there is nothing to show', () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => row.id}
        emptyState={<p>No customers yet</p>}
      />,
    )

    expect(screen.getByText('No customers yet')).toBeInTheDocument()
  })

  it('announces the current sort direction', () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        sortKey="name"
        sortDirection="asc"
        sortableColumns={['name']}
        onSortChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('columnheader', { name: /customer/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )
  })

  it('reports a sort request for the chosen column', async () => {
    const user = userEvent.setup()
    const onSortChange = vi.fn()
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        sortableColumns={['name']}
        onSortChange={onSortChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: /customer/i }))
    expect(onSortChange).toHaveBeenCalledWith('name')
  })
})
