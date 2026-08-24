import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SoloLobby } from './SoloLobby'

function renderLobby(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/solo" element={<SoloLobby />} />
        <Route path="/solo/:formatId" element={<SoloLobby />} />
        <Route path="/draft/:formatId" element={<p>draft screen for {'free-pick'}</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SoloLobby', () => {
  it('opens on the format the URL carried in', () => {
    renderLobby('/solo/spin-the-wheel')

    expect(screen.getByRole('button', { name: 'Spin the Wheel' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /kick off/i })).toBeEnabled()
  })

  it('picks no format at all when the URL carried none, and says why it cannot start', () => {
    renderLobby('/solo')

    for (const name of ['Auction', 'Deal or No Deal', 'Free Pick', 'Spin the Wheel']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
    }
    expect(screen.getByRole('button', { name: /kick off/i })).toBeDisabled()
    expect(screen.getByText(/pick a format to start/i)).toBeInTheDocument()
  })

  it('offers the constraint only for Free Pick', async () => {
    const user = userEvent.setup()
    renderLobby('/solo/auction')

    const constraint = screen.getByRole('button', { name: '1 per club' })
    expect(constraint.closest('[inert]')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Free Pick' }))
    expect(constraint.closest('[inert]')).toBeNull()
  })

  it('seats just you, with nothing to add or remove', () => {
    renderLobby('/solo/auction')

    expect(screen.getByText('1 / 5 seats')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add a bot/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('kicks off into the draft it was configured for', async () => {
    const user = userEvent.setup()
    renderLobby('/solo/free-pick')

    await user.click(screen.getByRole('button', { name: /kick off/i }))
    expect(screen.getByText(/draft screen for free-pick/i)).toBeInTheDocument()
  })
})
