/**
 * The desktop sidebar.
 *
 * The sidebar can be collapsed to icons only. The collapsed state keeps the
 * same DOM so there is no layout jump, and every icon-only entry gets a
 * tooltip with its label.
 */

import { ChevronsLeft, LogOut, PanelLeft } from 'lucide-react'

import { LeadNestLogo, LeadNestWordmark } from '@/components/layout/logo'
import { NavSections } from '@/components/layout/nav-sections'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from '@/components/ui/overlays'
import { cn } from '@/lib/utils'
import type { Company, User } from '@/types/api'

export function Sidebar({
  user,
  company,
  isAdmin,
  collapsed,
  onToggleCollapsed,
  onLogout,
  onNavigate,
}: {
  user: User | null
  company: Company | undefined
  isAdmin: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  onLogout: () => void
  onNavigate?: () => void
}) {
  return (
    <aside
      className={cn(
        'sidebar-surface hidden shrink-0 flex-col border-r border-sidebar-border transition-[width] duration-200 ease-in-out-soft md:flex',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
      )}
      aria-label="Main navigation"
    >
      <div
        className={cn(
          'flex h-topbar shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}
      >
        {collapsed ? (
          <Tooltip label="LeadNest" side="right">
            <span>
              <LeadNestLogo />
            </span>
          </Tooltip>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <LeadNestLogo />
              <LeadNestWordmark />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleCollapsed}
              className="text-sidebar-text hover:bg-sidebar-hover hover:text-white"
              aria-label="Collapse sidebar"
            >
              <PanelLeft className="size-4" aria-hidden="true" />
            </Button>
          </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        <NavSections
          isAdmin={isAdmin}
          collapsed={collapsed}
          onNavigate={onNavigate}
          variant="sidebar"
        />
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Tooltip label={user?.full_name ?? 'Account'} side="right">
              <button
                type="button"
                onClick={onLogout}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60"
                aria-label="Sign out"
              >
                <Avatar name={user?.full_name ?? '?'} size="sm" />
              </button>
            </Tooltip>
            <Tooltip label="Expand sidebar" side="right">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggleCollapsed}
                className="text-sidebar-text hover:bg-sidebar-hover hover:text-white"
                aria-label="Expand sidebar"
              >
                <ChevronsLeft className="size-4" aria-hidden="true" />
              </Button>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Avatar name={user?.full_name ?? '?'} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {user?.full_name ?? 'Signed in'}
              </p>
              <p className="truncate text-2xs text-sidebar-text/70">
                {company?.name ?? user?.email}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-sidebar-text hover:bg-sidebar-hover hover:text-white"
                  aria-label="Account menu"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="right">
                <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onLogout}>
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </aside>
  )
}
