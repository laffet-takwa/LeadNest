/**
 * The authenticated application shell.
 *
 * It owns the layout chrome: sidebar, top bar and the routed content area.
 * Pages render inside <Outlet />, so every page inherits the same frame.
 */

import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { MobileNav, Topbar } from '@/components/layout/topbar'
import { Sidebar } from '@/components/layout/sidebar'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCompany } from '@/features/companies/hooks/use-company'

/** Titles shown in the top bar, keyed by the route pattern. */
const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/customers': 'Customers',
  '/pipeline': 'Sales pipeline',
  '/tasks': 'Tasks',
  '/activities': 'Activities',
  '/ai': 'AI assistant',
  '/team': 'Team',
  '/settings': 'Settings',
}

/** Resolves the page title from the current location. */
function titleFor(pathname: string): string {
  const known = PAGE_TITLES[pathname]
  if (known) return known
  if (pathname.startsWith('/customers/')) return 'Customer'
  if (pathname.startsWith('/deals/')) return 'Deal'
  return 'LeadNest'
}

export function AppShell() {
  const { user, isAdmin, logout } = useAuth()
  const { data: company } = useCompany()
  const location = useLocation()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // The sidebar collapses automatically on narrow screens so the content area
  // keeps a usable width.
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)')
    setCollapsed(!media.matches)
  }, [])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  const handleLogout = useCallback(() => {
    void logout().then(() => {
      void navigate('/login', { replace: true })
    })
  }, [logout, navigate])

  return (
    <div className="flex min-h-dvh bg-background">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Sidebar
        user={user}
        company={company}
        isAdmin={isAdmin}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        onLogout={handleLogout}
      />

      <MobileNav
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        user={user}
        company={company}
        isAdmin={isAdmin}
        onLogout={handleLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={user}
          company={company}
          title={titleFor(location.pathname)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onLogout={handleLogout}
        />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 focus-visible:outline-none">
          <div className="mx-auto w-full max-w-[var(--content-max-width)] px-4 py-6 md:px-6 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
