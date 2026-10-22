/**
 * Component tests for the shared activity timeline.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ActivityTimeline, type TimelineEntry } from '@/components/data-display/activity-timeline'

const ENTRIES: TimelineEntry[] = [
  {
    id: '1',
    type: 'call',
    subject: 'Introductory call',
    description: 'Walked through the pricing options.',
    occurred_at: '2026-03-10T09:30:00Z',
    customer_name: 'Atlas Consulting',
    customer_id: 'customer-1',
    user_name: 'Amira',
  },
  {
    id: '2',
    type: 'email',
    subject: 'Proposal sent',
    occurred_at: '2026-03-11T14:00:00Z',
    customer_name: 'Atlas Consulting',
    customer_id: 'customer-1',
  },
]

describe('ActivityTimeline', () => {
  it('renders every entry with its type and subject', () => {
    render(<ActivityTimeline entries={ENTRIES} />)

    expect(screen.getByText('Introductory call')).toBeInTheDocument()
    expect(screen.getByText('Proposal sent')).toBeInTheDocument()
    expect(screen.getByText('Walked through the pricing options.')).toBeInTheDocument()
  })

  it('shows the customer only when asked for it', () => {
    const { rerender } = render(<ActivityTimeline entries={ENTRIES} />)
    expect(screen.queryByText('Atlas Consulting')).not.toBeInTheDocument()

    rerender(<ActivityTimeline entries={ENTRIES} showCustomer />)
    expect(screen.getAllByText('Atlas Consulting').length).toBeGreaterThan(0)
  })

  it('records the author when the entry carries one', () => {
    render(<ActivityTimeline entries={ENTRIES} />)
    expect(screen.getByText('by Amira')).toBeInTheDocument()
  })

  it('renders nothing when there are no entries', () => {
    const { container } = render(<ActivityTimeline entries={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
