/**
 * The shared navigation list.
 *
 * The desktop sidebar and the mobile drawer render the same entries, so the
 * active route is highlighted in both and a new page only has to be added
 * once.
 */

import { NavLink } from 'react-router-dom'

import { visibleNavSections } from '@/components/layout/nav-config'
import { Tooltip } from '@/components/ui/overlays'
import { cn } from '@/lib/utils'

export function NavSections({
  isAdmin,
  collapsed = false,
  onNavigate,
  variant,
}: {
  isAdmin: boolean
  /** Renders the icons only, for the collapsed sidebar. */
  collapsed?: boolean
  /** Called after a link is followed, so the drawer can close itself. */
  onNavigate?: () => void
  /**
   * `sidebar` and `drawer` render on the dark sidebar surface. `plain` uses
   * the same markup on a light background.
   */
  variant: 'sidebar' | 'drawer' | 'plain'
}) {
  const sections = visibleNavSections(isAdmin)
  const onDark = variant !== 'plain'

  return (
    <>
      {sections.map((section) => (
        <div key={section.label} className="mb-5 last:mb-0">
          {!collapsed ? (
            <p
              className={cn(
                'mb-1.5 px-2 text-2xs font-semibold uppercase tracking-wider',
                onDark ? 'text-sidebar-text/60' : 'text-ink-muted',
              )}
            >
              {section.label}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const link = (
                <NavLink
                  to={item.to}
                  onClick={onNavigate}
                  data-nav-item
                  // When the sidebar is collapsed the label is not rendered, so
                  // the link carries it as its accessible name.
                  aria-label={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-control px-2.5 py-2 text-sm font-medium transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60',
                      collapsed && 'justify-center px-0',
                      onDark
                        ? 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
                        : 'text-ink-secondary hover:bg-surface-sunken hover:text-ink',
                      isActive &&
                        (onDark ? 'bg-sidebar-active text-white' : 'bg-brand-soft text-brand-soft-text'),
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={cn('size-4 shrink-0', isActive && onDark && 'text-white')}
                        aria-hidden="true"
                      />
                      {!collapsed ? (
                        <span className={cn('truncate', isActive && onDark && 'text-white')}>
                          {item.label}
                        </span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              )

              return (
                <li key={item.to}>
                  {collapsed ? (
                    <Tooltip label={item.label} side="right">
                      {link}
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </>
  )
}
