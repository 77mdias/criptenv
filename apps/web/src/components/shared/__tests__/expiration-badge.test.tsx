/**
 * Tests for ExpirationBadge component M3.5.7
 * 
 * TDD RED Phase: Tests that describe expected behavior.
 */

import { render, screen } from '@testing-library/react'
import { ExpirationBadge } from '../expiration-badge'

describe('ExpirationBadge', () => {
  it('renders nothing when no expiration data', () => {
    const { container } = render(<ExpirationBadge />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when daysUntilExpiration is null', () => {
    const { container } = render(<ExpirationBadge daysUntilExpiration={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders green badge for secrets with >30 days', () => {
    render(<ExpirationBadge daysUntilExpiration={45} />)
    const badge = screen.getByText(/45 dias/i)
    expect(badge).toBeInTheDocument()
    // Should have green styling (text-green-600 from outline variant)
    expect(badge).toHaveClass('text-green-600')
  })

  it('renders yellow badge for secrets with 7-30 days', () => {
    render(<ExpirationBadge daysUntilExpiration={14} />)
    const badge = screen.getByText(/14 dias/i)
    expect(badge).toBeInTheDocument()
    // Should have yellow styling (bg-yellow-400)
    expect(badge).toHaveClass('bg-yellow-400')
  })

  it('renders amber badge for secrets with <7 days', () => {
    render(<ExpirationBadge daysUntilExpiration={3} />)
    const badge = screen.getByText(/3 dias/i)
    expect(badge).toBeInTheDocument()
    // Should have amber styling (bg-amber-500)
    expect(badge).toHaveClass('bg-amber-500')
  })

  it('renders expired badge for secrets past expiration', () => {
    render(<ExpirationBadge daysUntilExpiration={-5} isExpired={true} />)
    expect(screen.getByText(/expirado/i)).toBeInTheDocument()
  })

  it('renders expired badge when isExpired flag is set', () => {
    render(<ExpirationBadge isExpired={true} />)
    expect(screen.getByText(/expirado/i)).toBeInTheDocument()
  })

  it('shows expired badge for negative days even without isExpired', () => {
    render(<ExpirationBadge daysUntilExpiration={-1} />)
    expect(screen.getByText(/expirado/i)).toBeInTheDocument()
  })

  it('has accessible aria-label via title attribute', () => {
    render(<ExpirationBadge daysUntilExpiration={14} expiresAt="2026-06-01" />)
    const badge = screen.getByText(/14 dias/i)
    expect(badge).toHaveAttribute('title', 'Expires: 2026-06-01')
  })

  it('renders clock icon for non-expired badges', () => {
    render(<ExpirationBadge daysUntilExpiration={45} />)
    // Clock icon should be present
    expect(screen.getByLabelText(/clock/i, { hidden: true })).toBeInTheDocument()
  })

  it('renders alert icon for critical badges (<7 days)', () => {
    render(<ExpirationBadge daysUntilExpiration={3} />)
    // Alert icon should be present
    expect(screen.getByLabelText(/alert/i, { hidden: true })).toBeInTheDocument()
  })

  it('renders XCircle icon for expired badges', () => {
    render(<ExpirationBadge isExpired={true} />)
    // XCircle icon should be present
    expect(screen.getByLabelText(/xcircle/i, { hidden: true })).toBeInTheDocument()
  })

  it('accepts custom className for styling overrides', () => {
    render(<ExpirationBadge daysUntilExpiration={45} className="custom-class" />)
    const badge = screen.getByText(/45 dias/i)
    expect(badge).toHaveClass('custom-class')
  })

  it('shows correct text for edge cases (30, 7, 1 days)', () => {
    const { rerender } = render(<ExpirationBadge daysUntilExpiration={30} />)
    expect(screen.getByText(/30 dias/i)).toBeInTheDocument()

    rerender(<ExpirationBadge daysUntilExpiration={7} />)
    expect(screen.getByText(/7 dias/i)).toBeInTheDocument()

    rerender(<ExpirationBadge daysUntilExpiration={1} />)
    expect(screen.getByText(/1 dias/i)).toBeInTheDocument()
  })
})
