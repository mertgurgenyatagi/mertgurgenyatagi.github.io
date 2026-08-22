// GENERATED FILE — do not edit by hand.
// Every club with a crest in `public/clubs/`, mapped to the league it plays in.
//
// The pool CSV carries a `League` column, but it describes the competition the
// row was scraped from rather than the club's own division — Fenerbahçe players
// come back as "Serie A", Flamengo as "First Division" — so it cannot be used
// to scope a draft. The crest set can: those 69 clubs are exactly the top five
// leagues, and a club the app cannot draw is a club it should not offer.
//
// Keys are the club slug (`slugify(club)`), which is also the crest filename.

import type { LeagueId } from './lobbyOptions'

export const clubLeagues: Record<string, LeagueId> = {
  'ac-milan': 'serie-a',
  'alaves': 'la-liga',
  'arsenal': 'premier-league',
  'as-monaco': 'ligue-1',
  'as-roma': 'serie-a',
  'aston-villa': 'premier-league',
  'atalanta': 'serie-a',
  'athletic-bilbao': 'la-liga',
  'atletico-madrid': 'la-liga',
  'barcelona': 'la-liga',
  'bayer-leverkusen': 'bundesliga',
  'bayern-munich': 'bundesliga',
  'bologna': 'serie-a',
  'borussia-dortmund': 'bundesliga',
  'bournemouth': 'premier-league',
  'brentford': 'premier-league',
  'brighton': 'premier-league',
  'celta-vigo': 'la-liga',
  'chelsea': 'premier-league',
  'como': 'serie-a',
  'crystal-palace': 'premier-league',
  'eintracht-frankfurt': 'bundesliga',
  'everton': 'premier-league',
  'fiorentina': 'serie-a',
  'fulham': 'premier-league',
  'genoa': 'serie-a',
  'getafe': 'la-liga',
  'hull-city': 'premier-league',
  'inter': 'serie-a',
  'ipswich-town': 'premier-league',
  'juventus': 'serie-a',
  'lazio': 'serie-a',
  'leeds-united': 'premier-league',
  'lille': 'ligue-1',
  'liverpool': 'premier-league',
  'lyon': 'ligue-1',
  'manchester-city': 'premier-league',
  'manchester-united': 'premier-league',
  'marseille': 'ligue-1',
  'monza': 'serie-a',
  'napoli': 'serie-a',
  'newcastle-united': 'premier-league',
  'nottingham-forest': 'premier-league',
  'ogc-nice': 'ligue-1',
  'osasuna': 'la-liga',
  'paris-fc': 'ligue-1',
  'psg': 'ligue-1',
  'racing-santander': 'la-liga',
  'rayo-vallecano': 'la-liga',
  'rb-leipzig': 'bundesliga',
  'rc-lens': 'ligue-1',
  'real-betis': 'la-liga',
  'real-madrid': 'la-liga',
  'real-sociedad': 'la-liga',
  'rennes': 'ligue-1',
  'sassuolo': 'serie-a',
  'sc-freiburg': 'bundesliga',
  'schalke-04': 'bundesliga',
  'sevilla': 'la-liga',
  'strasbourg': 'ligue-1',
  'sunderland': 'premier-league',
  'torino': 'serie-a',
  'tottenham': 'premier-league',
  'tsg-hoffenheim': 'bundesliga',
  'udinese': 'serie-a',
  'valencia': 'la-liga',
  'venezia': 'serie-a',
  'vfb-stuttgart': 'bundesliga',
  'villarreal': 'la-liga',
}

/** A player is in scope when their club is one we can draw and name. */
export function leagueOfClub(clubSlug: string): LeagueId | null {
  return clubLeagues[clubSlug] ?? null
}
