/* GurgoBudget — sample data.
 *
 * Temporary stand-in for Firestore. Internally consistent with the figures the
 * dashboard Exhibuild specimens were drawn against:
 *   Surplus 40.400 · Max 1.303 · Daily 1.203 · Strict 894 · Minimum 794
 *   ahead 3.473 · avg month 1.052 · avg 90d 1.147 · month-end 6.580
 *
 * Base items are stored as values-over-time (`history`, plus an optional
 * `until`) so any month — past, present or future — is computed from whatever
 * was true during that specific month, per the spec's deletion rule.
 */

export const SEED = {
  buffer: 100,

  baseIncome: [
    { id: 'bi1', name: 'Salary', history: [{ from: '2026-01', amount: 84000 }] }
  ],

  baseSpend: [
    { id: 'bs1', name: 'Rent',      history: [{ from: '2026-01', amount: 26000 }, { from: '2026-07', amount: 28000 }] },
    { id: 'bs2', name: 'Utilities', history: [{ from: '2026-01', amount: 4200 }] },
    { id: 'bs3', name: 'Transit',   history: [{ from: '2026-01', amount: 2600 }] },
    { id: 'bs4', name: 'Insurance', history: [{ from: '2026-01', amount: 3200 }] },
    { id: 'bs5', name: 'Gym',       history: [{ from: '2026-01', amount: 1800 }] },
    { id: 'bs6', name: 'Phone',     history: [{ from: '2026-01', amount: 1400 }] }
  ],

  months: {
    '2026-05': {
      logs: { 29: 850, 30: 0, 31: 4740 }
    },

    '2026-06': {
      logs: {
        1: 955, 2: 1330, 3: 2115, 4: 1445, 5: 1720, 6: 1125, 7: 1000, 8: 1185,
        9: 810, 10: 1305, 11: 1770, 12: 895, 13: 1765, 14: 0, 15: 1825, 16: 440,
        17: 1870, 18: 1100, 19: 1055, 20: 560, 21: 0, 22: 1160, 23: 860, 24: 375,
        25: 470, 26: 2910, 27: 635, 28: 645, 29: 2110, 30: 755
      }
    },

    '2026-07': {
      logs: {
        1: 2860, 2: 1955, 3: 980, 4: 2255, 5: 1250, 6: 590, 7: 385, 8: 955,
        9: 420, 10: 640, 11: 1170, 12: 1270, 13: 0, 14: 790, 15: 0, 16: 430,
        17: 4820, 18: 1160, 19: 330, 20: 0, 21: 690, 22: 1005, 23: 1045,
        24: 1845, 25: 1470, 26: 350, 27: 755, 28: 520, 29: 2185, 30: 0, 31: 3690
      }
    },

    '2026-08': {
      flexIncome: [
        { id: 'fi1', name: 'Freelance', amount: 6500 }
      ],
      flexSpend: [
        { id: 'fs1', name: 'Dentist',  amount: 5400 },
        { id: 'fs2', name: 'Gift',     amount: 2600 },
        { id: 'fs3', name: 'Car wash', amount: 900 }
      ],
      wishlist: [
        { id: 'w1', name: 'Guitar',     amount: 9500, purchased: false },
        { id: 'w2', name: 'Headphones', amount: 3200, purchased: true }
      ],
      logs: {
        1: 1240, 2: 480, 3: 0, 4: 2150, 5: 860, 6: 1310, 7: 2940, 8: 375,
        9: 0, 10: 1480, 11: 790, 12: 1960, 13: 1130, 14: 0, 15: 640, 16: 1720,
        17: 985, 18: 420, 19: 2380, 20: 0, 21: 1290, 22: 846, 23: 1200
      }
    }
  },

  /* Six-way projection choice, per month — absent means Daily, which is how
   * "resets to Daily at the start of every new month" falls out for free. */
  projection: {}
};
