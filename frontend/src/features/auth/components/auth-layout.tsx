/**
 * The authentication layout shared by the login and register pages.
 */

import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

import { LeadNestLogo } from '@/components/layout/logo'

const HIGHLIGHTS = [
  {
    title: 'One place for every relationship',
    body: 'Customers, pipeline, follow-ups and conversations stay connected.',
  },
  {
    title: 'A pipeline you can read at a glance',
    body: 'Know which deals are moving, which are stalled and which are won.',
  },
  {
    title: 'AI that drafts, never decides',
    body: 'Suggested emails and summaries, with you in control of every send.',
  },
]

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — hidden on small screens. */}
      <div className="sidebar-surface relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-brand-600/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-accent-teal/10 blur-3xl"
        />

        <div className="relative flex items-center gap-2.5">
          <LeadNestLogo />
          <span className="text-lg font-semibold tracking-tight text-white">
            Lead<span className="text-brand-300">Nest</span>
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-md space-y-7"
        >
          <div>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">
              The CRM that keeps small businesses in control.
            </h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-sidebar-text/80">
              LeadNest gives a small team the structure of a larger sales organisation without the
              overhead.
            </p>
          </div>
          <ul className="space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400"
                />
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-0.5 text-sm text-sidebar-text/70">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>

        <p className="relative text-xs text-sidebar-text/50">
          © {new Date().getFullYear()} LeadNest. Built for small teams.
        </p>
      </div>

      {/* Form panel. */}
      <div className="flex items-center justify-center bg-background px-5 py-10 sm:px-8">
        <div className="w-full max-w-[26rem]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LeadNestLogo />
            <span className="text-lg font-semibold tracking-tight text-ink">
              Lead<span className="text-brand-text">Nest</span>
            </span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
            <p className="mt-1.5 text-sm text-ink-secondary">{subtitle}</p>
          </motion.div>

          <div className="mt-7">{children}</div>

          <div className="mt-7 text-center text-sm text-ink-secondary">{footer}</div>
        </div>
      </div>
    </div>
  )
}

/** A link styled for the auth screens. */
export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="font-medium text-brand-text underline-offset-4 transition-colors hover:underline"
    >
      {children}
    </Link>
  )
}
