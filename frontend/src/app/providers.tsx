/**
 * Application providers.
 *
 * The provider order matters: the query client and the router are
 * independent, and the authentication provider must be above the router so
 * the route guard can read the session.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'

import { ErrorBoundary } from '@/components/feedback/error-boundary'
import { LiveRegionProvider } from '@/components/feedback/live-region'
import { TooltipProvider } from '@/components/ui/overlays'
import { AuthProvider } from '@/features/auth/hooks/use-auth'
import { ThemeProvider } from '@/app/theme-provider'
import { useTheme } from '@/app/theme-context'
import { router } from '@/app/router'

/** Creates the query client with sensible defaults for a CRM. */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The data is tenant-scoped and changes often, so a short stale time
        // keeps the views fresh without hammering the API.
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // A 401 will not succeed on a retry: the session has to be renewed
          // first, which the API client handles.
          const status = (error as { status?: number } | undefined)?.status
          if (status === 401 || status === 403 || status === 404) return false
          return failureCount < 2
        },
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export function AppProviders() {
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={200} skipDelayDuration={300}>
            <LiveRegionProvider>
              <ErrorBoundary>
                <RouterProvider router={router} />
              </ErrorBoundary>
              <ThemedToaster />
            </LiveRegionProvider>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

/** Keeps the toast surface in step with the active theme. */
function ThemedToaster() {
  const { resolved } = useTheme()
  return (
    <Toaster
      theme={resolved}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'rounded-card border border-border bg-surface text-sm text-ink shadow-popover',
          description: 'text-ink-secondary',
          actionButton: 'bg-brand-600 text-white',
        },
      }}
    />
  )
}
