/**
 * Component tests for the combobox.
 *
 * The field follows the ARIA combobox pattern, so the list is operated from
 * the search field with the arrow keys and the selection is confirmed with
 * Enter.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Combobox } from '@/components/ui/combobox'

const OPTIONS = [
  { value: 'a', label: 'Amira Ben Salah', description: 'Atlas Consulting' },
  { value: 'b', label: 'Sami Trabelsi', description: 'Nomad Studio' },
  { value: 'c', label: 'Rania Gharbi', description: 'Blue Sea Ltd' },
]

describe('Combobox', () => {
  it('shows the selected label and reports the chosen value', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Combobox label="Customer" value="" onValueChange={onValueChange} options={OPTIONS} />,
    )

    const trigger = screen.getByRole('button', { name: 'Customer' })
    expect(trigger).toHaveTextContent('Select…')

    await user.click(trigger)
    await user.click(await screen.findByRole('option', { name: /Sami Trabelsi/ }))

    expect(onValueChange).toHaveBeenCalledWith('b')
  })

  it('filters the options as the search is typed', async () => {
    const user = userEvent.setup()
    render(<Combobox label="Customer" value="" onValueChange={vi.fn()} options={OPTIONS} />)

    await user.click(screen.getByRole('button', { name: 'Customer' }))
    const search = await screen.findByRole('combobox')
    await user.type(search, 'rania')

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Rania Gharbi/ })).toBeInTheDocument()
    })
    expect(screen.queryByRole('option', { name: /Amira Ben Salah/ })).not.toBeInTheDocument()
  })

  it('reports a message when nothing matches', async () => {
    const user = userEvent.setup()
    render(<Combobox label="Customer" value="" onValueChange={vi.fn()} options={OPTIONS} />)

    await user.click(screen.getByRole('button', { name: 'Customer' }))
    const search = await screen.findByRole('combobox')
    await user.type(search, 'zzzz')

    expect(await screen.findByText('No matches')).toBeInTheDocument()
  })

  it('moves the active option with the arrow keys and confirms with Enter', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Combobox label="Customer" value="" onValueChange={onValueChange} options={OPTIONS} />,
    )

    await user.click(screen.getByRole('button', { name: 'Customer' }))
    const search = await screen.findByRole('combobox')
    expect(search).toHaveFocus()

    // The first option is active when the list opens, so one press moves to
    // the second one.
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(onValueChange).toHaveBeenCalledWith('b')
    // Closing the list returns the focus to the trigger.
    expect(screen.getByRole('button', { name: 'Customer' })).toHaveFocus()
  })

  it('confirms the first option when nothing is typed', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Combobox label="Customer" value="" onValueChange={onValueChange} options={OPTIONS} />,
    )

    await user.click(screen.getByRole('button', { name: 'Customer' }))
    await screen.findByRole('combobox')
    await user.keyboard('{Enter}')

    expect(onValueChange).toHaveBeenCalledWith('a')
  })
})
