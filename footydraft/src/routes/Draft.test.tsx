import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Draft } from './Draft'

/**
 * A pool small enough to reason about and wide enough to fill a 4-2-3-1 four
 * times over, drawn only from clubs that have a crest — the same rule the real
 * loader applies.
 */
const CLUBS = [
  'Arsenal',
  'Liverpool',
  'Chelsea',
  'Everton',
  'Barcelona',
  'Sevilla',
  'Napoli',
  'Torino',
]
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

/**
 * You sit **first**, so the draft opens on your turn and nothing moves until you
 * pick — the opponents are on real timers and the clock is on a real interval,
 * and a test that races either of them fails on a loaded machine rather than on
 * a defect. `timer` is passed per test: off wherever an auto-pick could land
 * mid-assertion.
 */
const DRAFTERS = [
  { id: 'you', name: 'You', kind: 'you' as const, mark: 'M' },
  { id: 'priya', name: 'Priya', kind: 'human' as const, mark: 'P' },
  { id: 'bot-1', name: 'Bot 1', kind: 'bot' as const, mark: '1' },
  { id: 'bot-2', name: 'Bot 2', kind: 'bot' as const, mark: '2' },
]

function renderDraft(timer: string) {
  return render(
    <MemoryRouter
      initialEntries={[
        { pathname: '/draft/free-pick', state: { timer, drafters: DRAFTERS } },
      ]}
    >
      <Routes>
        <Route path="/draft/:formatId" element={<Draft />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Draft', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(fixtureCsv(), { status: 200 })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('draws the rail, the table and a board you can pick from', async () => {
    renderDraft('15')

    expect(await screen.findByText('Round')).toBeInTheDocument()
    expect(screen.getByText('Used')).toBeInTheDocument()

    // Every drafter's board is open to everyone, all the way through.
    expect(screen.getByRole('tab', { name: 'You' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Priya' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Bot 1' })).toBeInTheDocument()

    // A–Z, not by ability: the strongest player in the fixture is not first.
    const rows = await screen.findAllByRole('button', { name: /Player \d/ })
    expect(rows[0]).toHaveTextContent('AMF Player 1')
  })

  // The timer is the Auction's and only the Auction's: a snake draft's turn
  // ends when somebody picks, so this screen runs no clock whatever the lobby
  // was set to — including a lobby that predates the change and still hands a
  // length over in its router state.
  it('runs no countdown, even when a timer arrives in the config', async () => {
    renderDraft('15')
    await screen.findByText(/your pick/i)
    expect(screen.queryByText(/^\d{2}$/)).not.toBeInTheDocument()
  })

  it('runs no countdown when the timer is off', async () => {
    renderDraft('off')
    await screen.findByText(/your pick/i)
    expect(screen.queryByText(/^\d{2}$/)).not.toBeInTheDocument()
  })

  it('reports the turn, drafts the selection, and hands the clock on', async () => {
    const user = userEvent.setup()
    renderDraft('off')

    expect(await screen.findByText(/your pick/i)).toBeInTheDocument()

    const target = await screen.findByRole('button', { name: /GK Player 1/ })
    await user.click(target)

    // The draft action is docked in two places at once — the desktop portrait
    // panel and the mobile footer — swapped by a CSS breakpoint the test
    // environment does not apply, so both are present in the DOM at once.
    const draftButtons = screen.getAllByRole('button', { name: /draft .* →/i })
    expect(draftButtons.length).toBeGreaterThan(0)
    for (const button of draftButtons) expect(button).toBeEnabled()
    await user.click(draftButtons[0])

    // The narrator reports what happened, the footballer leaves the board, and
    // the turn moves on to the seat behind you.
    expect(await screen.findByText(/you took gk player 1/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /GK Player 1/ })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/priya is picking/i)).toBeInTheDocument(), {
      timeout: 6000,
    })
  })
})
