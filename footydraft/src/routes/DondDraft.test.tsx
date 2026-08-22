import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Draft } from './Draft'

const CLUBS = ['Arsenal', 'Liverpool', 'Chelsea', 'Everton', 'Barcelona', 'Sevilla', 'Napoli', 'Torino']
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
 * You sit **first**, which in a strict round robin means round one opens on you
 * and nothing moves until you act. `timer: off` everywhere, since the auto-take
 * would otherwise land mid-assertion on a loaded machine.
 */
const DRAFTERS = [
  { id: 'you', name: 'You', kind: 'you' as const, mark: 'M' },
  { id: 'priya', name: 'Priya', kind: 'human' as const, mark: 'P' },
  { id: 'bot-1', name: 'Bot 1', kind: 'bot' as const, mark: '1' },
]

function renderDond() {
  return render(
    <MemoryRouter
      initialEntries={[
        { pathname: '/draft/deal-or-no-deal', state: { timer: 'off', drafters: DRAFTERS } },
      ]}
    >
      <Routes>
        <Route path="/draft/:formatId" element={<Draft />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('the Deal or No Deal draft screen', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(fixtureCsv(), { status: 200 })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deals two boxes a drafter for the round position and opens on you', async () => {
    renderDond()

    expect(await screen.findByText('This round fills')).toBeInTheDocument()
    // The section label, and the pane tab that stands in for it on one column.
    expect(screen.getAllByText('The boxes')).toHaveLength(2)

    // Three drafters, so six boxes, all still shut and all yours to choose from.
    const boxes = await screen.findAllByRole('button', { name: /^Open box \d$/ })
    expect(boxes).toHaveLength(6)
    expect(screen.getByText('6 still shut')).toBeInTheDocument()
    expect(await screen.findByText(/choose a box/i)).toBeInTheDocument()
  })

  it('opens a box, reveals what is in it, and sticks it in your eleven', async () => {
    const user = userEvent.setup()
    renderDond()

    const boxes = await screen.findAllByRole('button', { name: /^Open box \d$/ })
    await user.click(boxes[0])

    expect(screen.getByText('5 still shut')).toBeInTheDocument()

    // The reveal holds, then the decision docks on it. Both options are drawn.
    const stick = await screen.findByRole('button', { name: /^Stick with/ }, { timeout: 6000 })
    expect(screen.getByRole('button', { name: /hear the offer/i })).toBeInTheDocument()

    await user.click(stick)

    expect(await screen.findByText(/you stuck with/i)).toBeInTheDocument()

    // The round moves on to the seat behind you rather than reversing back.
    await waitFor(() => expect(screen.getByText(/priya is/i)).toBeInTheDocument(), {
      timeout: 8000,
    })
  })
})
