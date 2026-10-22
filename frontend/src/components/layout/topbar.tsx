/**
 * The top navigation bar.
 *
 * It carries the page title, a global customer search and the account menu.
 * There is deliberately no notification control: the backend has no
 * notifications, and a bell icon would imply a feature that does not exist.
 */

import { LogOut, Menu, Settings, User as UserIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { GlobalSearch } from '@/components/layout/global-search'
import { LeadNestLogo, LeadNestWordmark } from '@/components/layout/logo'
import { NavSections } from '@/components/layout/nav-sections'
import { ThemeMenuItems } from '@/components/layout/theme-menu'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerBody, DrawerContent, DrawerFooter } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/overlays'
import type { Company, User } from '@/types/api'

export function Topbar({
  user,
  company,
  title,
  onOpenMobileNav,
  onLogout,
  actions,
}: {
  user: User | null
  company: Company | undefined
  title: string
  onOpenMobileNav: () => void
  onLogout: () => void
  actions?: React.ReactNode
}) {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-30 flex h-topbar shrink-0 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur-md md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <Menu className="size-5" aria-hidden="true" />
      </Button>

      <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-ink md:text-lg">
        {title}
      </h1>

      <GlobalSearch className="hidden w-64 lg:block" />

      {actions}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            aria-label="Account menu"
          >
            <Avatar name={user?.full_name ?? '?'} size="sm" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="normal-case">
            <span className="block text-sm font-medium text-ink">{user?.full_name}</span>
            <span className="block truncate text-2xs font-normal text-ink-muted">
              {user?.email}
            </span>
            {company ? (
              <span className="mt-1 block truncate text-2xs font-normal text-ink-muted">
                {company.name}
              </span>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void navigate('/settings')}>
            <Settings className="size-4" aria-hidden="true" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void navigate('/settings?tab=profile')}>
            <UserIcon className="size-4" aria-hidden="true" />
            Profile
          </DropdownMenuItem>
          <ThemeMenuItems />
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={onLogout}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

/** The mobile navigation drawer. */
export function MobileNav({
  open,
  onOpenChange,
  user,
  company,
  isAdmin,
  onLogout,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  company: Company | undefined
  isAdmin: boolean
  onLogout: () => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        side="left"
        title="Navigation"
        className="border-r border-sidebar-border bg-navy text-sidebar-text"
        closeButtonClassName="text-sidebar-text hover:bg-sidebar-hover hover:text-white focus-visible:ring-brand-400/60"
        header={
          <span className="flex items-center gap-2.5">
            <LeadNestLogo />
            <LeadNestWordmark />
          </span>
        }
      >
        <DrawerBody className="px-3 py-4">
          <GlobalSearch className="mb-4" onNavigate={() => onOpenChange(false)} />
          <nav aria-label="Main navigation">
            <NavSections
              isAdmin={isAdmin}
              onNavigate={() => onOpenChange(false)}
              variant="drawer"
            />
          </nav>
        </DrawerBody>
        <DrawerFooter className="border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <Avatar name={user?.full_name ?? '?'} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.full_name}</p>
              <p className="truncate text-2xs text-sidebar-text/70">
                {company?.name ?? user?.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                onOpenChange(false)
                onLogout()
              }}
              className="text-sidebar-text hover:bg-sidebar-hover hover:text-white"
              aria-label="Sign out"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
