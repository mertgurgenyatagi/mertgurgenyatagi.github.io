import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { MultiLobby } from './MultiLobby'

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
  })

  it('asks for a name before it opens, then seats you in the room', async () => {
    const user = userEvent.setup()
    renderLobby()

    // A pasted invite link lands on the gate, not on the lobby.
    expect(screen.queryByRole('button', { name: /leave lobby/i })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/your name/i), 'Mert')
    await user.click(screen.getByRole('button', { name: /join lobby/i }))

    expect(screen.getByText('KX7QD')).toBeInTheDocument()
    expect(screen.getByText('Mert')).toBeInTheDocument()
  })

  it('shows a guest the host’s settings without offering them', async () => {
    const user = userEvent.setup()
    renderLobby()

    await user.type(screen.getByLabelText(/your name/i), 'Mert')
    await user.click(screen.getByRole('button', { name: /join lobby/i }))

    // The chips are still on screen — they just aren't controls any more.
    expect(screen.queryByRole('button', { name: 'Auction' })).not.toBeInTheDocument()
    expect(screen.getByText('Auction')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /waiting for the host/i })).toBeDisabled()
  })

  it('lets the host fill the table and talk to it', async () => {
    const user = userEvent.setup()
    renderLobby({ name: 'Mert', host: true })

    // Alone with no format: two separate reasons it can't start yet.
    expect(screen.getByText('1 / 5 seats')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /kick off/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Free Pick' }))
    expect(screen.getByRole('button', { name: /kick off/i })).toBeDisabled()

    const [addBot] = screen.getAllByRole('button', { name: /add a bot/i })
    await user.click(addBot)
    expect(screen.getByText('2 / 5 seats')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /kick off/i })).toBeEnabled()

    await user.type(screen.getByLabelText(/message the lobby/i), 'right, who’s in')
    await user.click(screen.getByRole('button', { name: /send/i }))
    expect(screen.getByText('right, who’s in')).toBeInTheDocument()
  })
})
