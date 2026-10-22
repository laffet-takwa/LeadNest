/**
 * CustomerAvatar.
 *
 * The identity chip used wherever a customer is referred to by name: the
 * customer list, the deal card and the customer detail header.
 */

import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export interface CustomerAvatarProps {
  /** The customer's full name. */
  name: string
  /** The customer's company, shown under the name. */
  company?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Show the name and company next to the avatar. */
  withDetails?: boolean
  className?: string
}

export function CustomerAvatar({
  name,
  company,
  size = 'sm',
  withDetails = false,
  className,
}: CustomerAvatarProps) {
  if (!withDetails) {
    return <Avatar name={name} size={size} className={className} />
  }

  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <Avatar name={name} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink">{name}</span>
        {company ? <span className="block truncate text-xs text-ink-muted">{company}</span> : null}
      </span>
    </span>
  )
}
