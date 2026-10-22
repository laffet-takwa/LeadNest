/**
 * Component tests for the confirmation dialog.
 *
 * A destructive action must not be triggered twice, and the dialog has to
 * report that the request is running.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from '@/components/ui/dialog'

describe('ConfirmDialog', () => {
  it('confirms the action', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete this customer?"
        description="The customer and their records are removed."
        confirmLabel="Delete customer"
        destructive
        onConfirm={onConfirm}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Delete customer' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('keeps the dialog open and blocks a second submission while the request runs', async () => {
    const user = userEvent.setup()
    let release: (() => void) | undefined
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )

    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete this customer?"
        description="The customer and their records are removed."
        confirmLabel="Delete customer"
        destructive
        onConfirm={onConfirm}
      />,
    )

    const confirm = screen.getByRole('button', { name: 'Delete customer' })
    await user.click(confirm)

    await waitFor(() => {
      expect(confirm).toBeDisabled()
    })
    expect(confirm).toHaveAttribute('aria-busy', 'true')

    // A second click while the request is running must not fire again.
    await user.click(confirm, { pointerEventsCheck: 0 })
    expect(onConfirm).toHaveBeenCalledTimes(1)

    release?.()
  })

  it('can be dismissed with the cancel button', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete this customer?"
        description="The customer and their records are removed."
        confirmLabel="Delete customer"
        onConfirm={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
