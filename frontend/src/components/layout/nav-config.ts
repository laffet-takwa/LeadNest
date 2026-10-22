/**
 * Navigation sections.
 *
 * The sidebar and the mobile drawer render from the same list, so a page and
 * its icon stay in one place and a new route is a single entry.
 */

import {
  Bot,
  Building2,
  CalendarCheck,
  LayoutDashboard,
  ListTodo,
  Settings,
  Users,
  UsersRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Only administrators see this entry. */
  adminOnly?: boolean
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/customers', label: 'Customers', icon: UsersRound },
      { to: '/pipeline', label: 'Sales pipeline', icon: Building2 },
      { to: '/tasks', label: 'Tasks', icon: ListTodo },
      { to: '/activities', label: 'Activities', icon: CalendarCheck },
    ],
  },
  {
    label: 'Intelligence',
    items: [{ to: '/ai', label: 'AI assistant', icon: Bot }],
  },
  {
    label: 'Administration',
    items: [
      { to: '/team', label: 'Team', icon: Users, adminOnly: true },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

/** The sections a user of the given role can see. */
export function visibleNavSections(isAdmin: boolean): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((section) => section.items.length > 0)
}
