import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Home } from './Home'

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/solo/:formatId" element={<p>lobby route</p>} />
        <Route path="/lobby/:code" element={<p>friends lobby</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Home', () => {
  it('shows the wall and opens the lobby on the format that was picked', async () => {
    const user = userEvent.setup()
    renderHome()

    expect(screen.getByRole('heading', { name: '#footydraft' })).toBeInTheDocument()
    expect(screen.getByText(/play with friends/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /auction/i }))
    expect(screen.getByText('lobby route')).toBeInTheDocument()
  })

  it('mints a code for a new lobby, then asks for a name before opening it', async () => {
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: /create a lobby/i }))
    expect(screen.getByText('New lobby')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/alex/i), 'Mert')
    await user.click(screen.getByRole('button', { name: /open lobby/i }))
    expect(screen.getByText('friends lobby')).toBeInTheDocument()
  })

  it('takes a typed code to the same gate', async () => {
    const user = userEvent.setup()
    renderHome()

    // Joining is gated on a code long enough to be one.
    const join = screen.getByRole('button', { name: 'Join lobby' })
    expect(join).toBeDisabled()
    await user.type(screen.getByLabelText(/room code/i), 'fd-24')
    expect(join).toBeEnabled()

    await user.click(join)
    expect(screen.getByText('Joining')).toBeInTheDocument()
    expect(screen.getByText('FD24')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/alex/i), 'Mert')
    await user.click(screen.getByRole('button', { name: /join lobby →/i }))
    expect(screen.getByText('friends lobby')).toBeInTheDocument()
  })
})
