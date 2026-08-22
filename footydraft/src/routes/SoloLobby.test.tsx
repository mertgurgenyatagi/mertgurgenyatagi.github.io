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

  it('seats two to five, added and removed by hand', async () => {
    const user = userEvent.setup()
    renderLobby('/solo/auction')

    expect(screen.getByText('4 / 5 seats')).toBeInTheDocument()

    // Both renderings are in the DOM under jsdom — the media query that hides
    // one of them isn't applied. The compact strip comes first.
    const [compactAdd] = screen.getAllByRole('button', { name: /add a bot/i })
    await user.click(compactAdd)
    expect(screen.getByText('5 / 5 seats')).toBeInTheDocument()
    // The table is full, so the empty seat row goes with it.
    expect(screen.getAllByRole('button', { name: /add a bot/i })).toHaveLength(1)
    expect(compactAdd).toBeDisabled()

    const removes = screen.getAllByRole('button', { name: 'Remove' })
    expect(removes).toHaveLength(4)
    for (const button of removes) await user.click(button)

    // Never below two at the table, and the last bot can't be removed.
    expect(screen.getByText('2 / 5 seats')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()
  })

  it('withdraws options the table is too big for, and re-offers them when a seat is freed', async () => {
    const user = userEvent.setup()
    // Opens at four seats. No single league is deep enough to run Deal or No
    // Deal for four drafters, so narrowing to one isn't on offer yet.
    renderLobby('/solo/deal-or-no-deal')

    expect(screen.getByRole('button', { name: /^One league/ })).toBeDisabled()

    // Free two seats and it comes back — at two, a single league can seat it.
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0])

    expect(screen.getByText('2 / 5 seats')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'One league' })).toBeEnabled()
  })

  it('names the setting that does not fit, and will not kick off while it stands', async () => {
    const user = userEvent.setup()
    renderLobby('/solo/free-pick')

    // Top 5 leagues seats four under any constraint, so this starts playable.
    expect(screen.getByRole('button', { name: /kick off/i })).toBeEnabled()

    // One league, though, only seats four under the looser constraints — and
    // the one already selected isn't one of them.
    await user.click(screen.getByRole('button', { name: 'One league' }))

    expect(screen.getByText(/1 per club doesn.t support four at the table/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /kick off/i })).toBeDisabled()

    // Switching to a constraint that does fit clears it.
    await user.click(screen.getByRole('button', { name: '3 per club' }))
    expect(screen.getByRole('button', { name: /kick off/i })).toBeEnabled()
  })

  it('kicks off into the draft it was configured for', async () => {
    const user = userEvent.setup()
    renderLobby('/solo/free-pick')

    await user.click(screen.getByRole('button', { name: /kick off/i }))
    expect(screen.getByText(/draft screen for free-pick/i)).toBeInTheDocument()
  })
})
