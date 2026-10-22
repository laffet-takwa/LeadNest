/**
 * Router.
 *
 * Routes are lazy-loaded so the initial bundle stays small. The protected
 * routes live under a single guard that waits for the session to be restored
 * before deciding what to render.
 */

import { lazy, Suspense } from 'react'
import { createBrowserRouter, Link, Navigate, useLocation } from 'react-router-dom'

import { AppShell } from '@/app/app-shell'
import { RouteFallback } from '@/components/feedback/route-fallback'
import { useAuth } from '@/features/auth/hooks/use-auth'

// The auth pages pull in the form and validation libraries, so they are
// loaded on demand rather than with the application shell.
const LoginPage = lazy(() =>
  import('@/features/auth/pages/login-page').then((m) => ({ default: m.LoginPage })),
)
const RegisterPage = lazy(() =>
  import('@/features/auth/pages/register-page').then((m) => ({ default: m.RegisterPage })),
)

const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/dashboard-page').then((m) => ({ default: m.DashboardPage })),
)
const CustomersPage = lazy(() =>
  import('@/features/customers/pages/customers-page').then((m) => ({ default: m.CustomersPage })),
)
const CustomerDetailPage = lazy(() =>
  import('@/features/customers/pages/customer-detail-page').then((m) => ({
    default: m.CustomerDetailPage,
  })),
)
const PipelinePage = lazy(() =>
  import('@/features/deals/pages/pipeline-page').then((m) => ({ default: m.PipelinePage })),
)
const DealDetailPage = lazy(() =>
  import('@/features/deals/pages/deal-detail-page').then((m) => ({ default: m.DealDetailPage })),
)
const TasksPage = lazy(() =>
  import('@/features/tasks/pages/tasks-page').then((m) => ({ default: m.TasksPage })),
)
const ActivitiesPage = lazy(() =>
  import('@/features/activities/pages/activities-page').then((m) => ({
    default: m.ActivitiesPage,
  })),
)
const AIPage = lazy(() => import('@/features/ai/pages/ai-page').then((m) => ({ default: m.AIPage })))
const TeamPage = lazy(() =>
  import('@/features/users/pages/team-page').then((m) => ({ default: m.TeamPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/companies/pages/settings-page').then((m) => ({ default: m.SettingsPage })),
)
const NotFoundPage = lazy(() =>
  import('@/features/errors/pages/not-found-page').then((m) => ({ default: m.NotFoundPage })),
)

/** Blocks a route until the session is known, then redirects if signed out. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <RouteFallback />
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

/**
 * Restricts a route to administrators.
 *
 * The backend enforces the same rule, so this is a convenience rather than
 * the security boundary: it keeps a non-administrator from reaching a page
 * that would only show an error.
 */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { status, isAdmin } = useAuth()

  if (status === 'loading') {
    return <RouteFallback />
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace />
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-card border border-border bg-surface p-6 text-center shadow-xs">
        <h1 className="text-lg font-semibold text-ink">This area is for administrators</h1>
        <p className="mt-1.5 text-sm text-ink-secondary">
          Your account does not have permission to manage the team. Ask an administrator if you
          need access.
        </p>
        <Link
          to="/dashboard"
          className="mt-4 inline-flex h-9 items-center rounded-control bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
        >
          Back to the dashboard
        </Link>
      </div>
    )
  }
  return <>{children}</>
}

/** Keeps a signed-in user away from the auth screens. */
function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  if (status === 'loading') return <RouteFallback />
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <RedirectIfAuthenticated>
        <Suspense fallback={<RouteFallback />}>
          <LoginPage />
        </Suspense>
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: '/register',
    element: (
      <RedirectIfAuthenticated>
        <Suspense fallback={<RouteFallback />}>
          <RegisterPage />
        </Suspense>
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <DashboardPage />
          </Suspense>
        ),
      },
      {
        path: 'customers',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <CustomersPage />
          </Suspense>
        ),
      },
      {
        path: 'customers/:id',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <CustomerDetailPage />
          </Suspense>
        ),
      },
      {
        path: 'pipeline',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <PipelinePage />
          </Suspense>
        ),
      },
      {
        path: 'deals/:id',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <DealDetailPage />
          </Suspense>
        ),
      },
      {
        path: 'tasks',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <TasksPage />
          </Suspense>
        ),
      },
      {
        path: 'activities',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <ActivitiesPage />
          </Suspense>
        ),
      },
      {
        path: 'ai',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <AIPage />
          </Suspense>
        ),
      },
      {
        path: 'team',
        element: (
          <RequireAdmin>
            <Suspense fallback={<RouteFallback />}>
              <TeamPage />
            </Suspense>
          </RequireAdmin>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <SettingsPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <NotFoundPage />
      </Suspense>
    ),
  },
])

export { router }
