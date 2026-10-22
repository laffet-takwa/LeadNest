/**
 * Component test for the login form.
 *
 * The form must validate before it calls the API, and it must show the
 * server's rejection in an accessible way.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type * as ReactRouterDOM from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LoginPage } from '@/features/auth/pages/login-page'
import { ApiError } from '@/lib/api/client'

const mockLogin = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({
    status: 'anonymous',
    user: null,
    isAdmin: false,
    login: mockLogin,
    register: vi.fn(),
    logout: vi.fn(),
    sessionExpired: false,
    setSessionExpired: vi.fn(),
  }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof ReactRouterDOM>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockLogin.mockReset()
    mockNavigate.mockReset()
  })

  it('renders the form with labelled fields', () => {
    renderLogin()
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('rejects an invalid email before calling the API', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/^email/i), 'not-an-email')
    await user.type(screen.getByLabelText(/^password/i), 'ValidPass123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument()
    })
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('requires a password', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/^email/i), 'amira@atlas.tn')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    })
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('submits valid credentials and navigates to the dashboard', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValue(undefined)
    renderLogin()

    await user.type(screen.getByLabelText(/^email/i), 'amira@atlas.tn')
    await user.type(screen.getByLabelText(/^password/i), 'ValidPass123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'amira@atlas.tn',
        password: 'ValidPass123',
      })
    })
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
  })

  it('shows an accessible message when the credentials are rejected', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValue(
      new ApiError(401, 'UNAUTHORIZED', 'invalid credentials or inactive account'),
    )
    renderLogin()

    await user.type(screen.getByLabelText(/^email/i), 'amira@atlas.tn')
    await user.type(screen.getByLabelText(/^password/i), 'ValidPass123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/not recognised/i)
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    renderLogin()

    const password = screen.getByLabelText(/^password/i)
    expect(password).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: /show password/i }))
    expect(password).toHaveAttribute('type', 'text')
  })
})
