import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppShell } from './AppShell'

describe('AppShell', () => {
  it('renders children with ambient background container', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell>
          <div data-testid="test-content">Welcome to Footydraft</div>
        </AppShell>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('test-content')).toBeInTheDocument()
    expect(screen.getByText('Welcome to Footydraft')).toBeInTheDocument()
  })
})
