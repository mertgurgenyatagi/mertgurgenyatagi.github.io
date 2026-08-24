import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The friends lobby is backed by the Realtime Database, which under jsdom
// never resolves — so without this every assertion below was failing on an
// empty room rather than on anything it meant to check. See `fakeRoom`.
vi.mock('../lib/multiplayer', async () => await import('../test/fakeRoom'))

import { MultiLobby } from './MultiLobby'
import { resetFakeRooms, seatGuest } from '../test/fakeRoom'

function renderLobby(state?: { name: string; host: boolean }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/lobby/KX7QD', state }]}>
      <Routes>
        <Route path="/lobby/:code" element={<MultiLobby />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MultiLobby', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    resetFakeRooms()
  })

  it('asks for a name before it opens, then seats you in the room', async () => {
    const user = userEvent.setup()
    renderLobby()

    // A pasted invite link lands on the gate, not on the lobby.
    expect(screen.queryByRole('button', { name: /leave lobby/i })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/your name/i), 'Mert')
    await user.click(screen.getByRole('button', { name: /join lobby/i }))

    expect(screen.getByText('KX7QD')).toBeInTheDocument()
    expect(await screen.findByText('Mert')).toBeInTheDocument()
  })

  it('shows a guest the host’s settings without offering them', async () => {
    const user = userEvent.setup()
    renderLobby()

    await user.type(screen.getByLabelText(/your name/i), 'Mert')
    await user.click(screen.getByRole('button', { name: /join lobby/i }))

    // The chips are still on screen — they just aren't controls any more.
    expect(await screen.findByRole('button', { name: /waiting for the host/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Auction' })).not.toBeInTheDocument()
    expect(screen.getByText('Auction')).toBeInTheDocument()
  })

  it('fills seats as people join, and lets the host talk to the table', async () => {
    const user = userEvent.setup()
    renderLobby({ name: 'Mert', host: true })

    // Alone with no format: two separate reasons it can't start yet.
    expect(await screen.findByText('1 / 5 seats')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /kick off/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Free Pick' }))
    expect(screen.getByRole('button', { name: /kick off/i })).toBeDisabled()

    // A second browser joining the room, simulated directly against the fake.
    await seatGuest('KX7QD', { id: 'guest-uid', name: 'Priya', kind: 'human', mark: 'P' })
    expect(await screen.findByText('2 / 5 seats')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /kick off/i })).toBeEnabled()

    await user.type(screen.getByLabelText(/message the lobby/i), 'right, who’s in')
    await user.click(screen.getByRole('button', { name: /send/i }))
    expect(await screen.findByText('right, who’s in')).toBeInTheDocument()
  })
})
