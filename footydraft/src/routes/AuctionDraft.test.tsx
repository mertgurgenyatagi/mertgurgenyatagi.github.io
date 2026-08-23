import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Draft } from './Draft'

const CLUBS = ['Arsenal', 'Liverpool', 'Chelsea', 'Everton', 'Barcelona', 'Sevilla']
const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'AMF', 'LW', 'RW', 'ST']

function fixtureCsv() {
  const header =
    'Name,Nation,Age,Club,Position,Current Ability,League,Derived Price (EURm),Opening Bid (EURm)'
  const rows: string[] = []
  for (const position of POSITIONS) {
    CLUBS.forEach((club, index) => {
      rows.push(
        `${position} Player ${index + 1},England,26,${club},${position},${150 - index},Premier Division,${40 + index},30`,
      )
    })
  }
  return [header, ...rows].join('\n')
}

/** Two seats and one bot, so the simulated side of the room is small. */
const DRAFTERS = [
  { id: 'you', name: 'You', kind: 'you' as const, mark: 'M' },
  { id: 'bot-1', name: 'Bot 1', kind: 'bot' as const, mark: '1' },
]

function renderAuction() {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/draft/auction', state: { timer: '15', drafters: DRAFTERS } }]}
    >
      <Routes>
        <Route path="/draft/:formatId" element={<Draft />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AuctionDraft', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(fixtureCsv(), { status: 200 })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens a lot with a holder headline rather than a turn', async () => {
    renderAuction()

    // The centre stack, top to bottom: the count, then the bids and the steps.
    expect(await screen.findByText(/^Lot \d+ \/ 30$/)).toBeInTheDocument()

    // Nothing on this screen says whose turn it is, because nothing is.
    expect(screen.queryByText(/your turn/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/is picking/i)).not.toBeInTheDocument()

    // Before anyone has taken it the headline says so, and the three steps
    // mask down to one bid at the opening price.
    expect(screen.getByText('Opening')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Open the bidding/ })).toHaveLength(1)

    // Passing is a real move again (2026-08-23): a lot closes early once
    // everybody but the holder has stood down, which needs a way to say so.
    expect(screen.getByRole('button', { name: /^Pass$/ })).toBeEnabled()
  })

  it('holds bidding shut for the first seconds of a lot, then takes yours', async () => {
    const user = userEvent.setup()
    renderAuction()

    // The lockout: nobody may raise for the first three seconds of a countdown.
    const opening = await screen.findByRole('button', { name: /Open the bidding/ })
    expect(opening).toBeDisabled()
    expect(screen.getByText(/Bidding opens in/)).toBeInTheDocument()

    await waitFor(() => expect(opening).toBeEnabled(), { timeout: 5000 })
    await user.click(opening)

    // You hold it, so the headline names you and the three real steps come out.
    await waitFor(() => expect(screen.getByText('Highest bidder:')).toBeInTheDocument())
    expect(screen.getByText('+5')).toBeInTheDocument()
    expect(screen.getByText('+25')).toBeInTheDocument()

    // Nobody bids against themselves — and the lockout has just restarted on
    // the bid that was placed, which disables them for a second reason. The
    // step's own label is the bare figure; its accessible name spells the
    // action out, since `+5` read aloud is not one.
    expect(screen.getByRole('button', { name: /Raise by 5/ })).toBeDisabled()

    // Holding the lot is the one state with no way out of it.
    expect(screen.getByRole('button', { name: /^Pass$/ })).toBeDisabled()
  })

  it('keeps every drafter on screen', async () => {
    renderAuction()

    await screen.findByText(/^Lot \d+ \/ 30$/)
    expect(screen.getByRole('tab', { name: 'You' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Bot 1' })).toBeInTheDocument()
  })
})
