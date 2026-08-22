/**
 * The other people in a friends lobby.
 *
 * There is no server yet, so the lobby simulates them: they arrive on a
 * stagger after you land, they take seats, and they talk. The screen behaves
 * exactly as it will once Firebase is behind it — same states, same
 * transitions, same copy — which is the point.
 */
export interface Person {
  id: string
  name: string
}

/** First names only, same as a real room where everyone types their own. */
export const people: Person[] = [
  { id: 'p1', name: 'Sam' },
  { id: 'p2', name: 'Priya' },
  { id: 'p3', name: 'Marco' },
  { id: 'p4', name: 'Jonas' },
]

/** Milliseconds after the lobby opens. Staggered so seats fill one at a time. */
export const arrivalDelays = [2600, 7800, 15400]

/** What each arrival says, a beat after they sit down. Short, like a real room. */
export const arrivalLines = [
  'ready when you are',
  'give me a minute',
  'who else is coming?',
  'go on then',
]

/** The delay between somebody joining and them saying anything. */
export const CHATTER_DELAY = 2200
