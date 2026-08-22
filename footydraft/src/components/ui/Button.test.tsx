import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button Primitive', () => {
  it('renders accent variant correctly and handles click', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(
      <Button variant="accent" onClick={handleClick}>
        Kick off →
      </Button>,
    )

    const button = screen.getByRole('button', { name: /kick off/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('bg-accent')

    await user.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('handles disabled state without invoking click handler', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(
      <Button variant="accent" disabled onClick={handleClick}>
        Waiting for host
      </Button>,
    )

    const button = screen.getByRole('button', { name: /waiting for host/i })
    expect(button).toBeDisabled()

    await user.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('renders ghost and surface variants', () => {
    const { rerender } = render(<Button variant="ghost">Cancel</Button>)
    expect(screen.getByRole('button', { name: /cancel/i })).toHaveClass('bg-transparent')

    rerender(<Button variant="surface">Join</Button>)
    expect(screen.getByRole('button', { name: /join/i })).toHaveClass('bg-surface')
  })
})
