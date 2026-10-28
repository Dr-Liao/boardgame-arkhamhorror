import { game } from '../tests/campaign-n4-fixture.mjs'

const state = game('01001', 4)
for (const inv of state.investigators) {
  const record = state.campaign.investigators[inv.seat]
  const live = [...inv.hand, ...inv.deck].sort()
  const saved = record.deck
  const a = live.join(','), b = [...saved].sort().join(',')
  console.log('seat', inv.seat, inv.code, inv.name, 'hand', inv.hand.length, 'deck', inv.deck.length, 'record', saved.length, 'equal', a === b, 'assets', inv.assets.length, 'threat', inv.threat.length)
  if (a !== b) {
    const count = list => list.reduce((m, c) => (m[c] = (m[c] || 0) + 1, m), {})
    const lc = count(live), sc = count(saved)
    for (const code of new Set([...Object.keys(lc), ...Object.keys(sc)])) if (lc[code] !== sc[code]) console.log('  diff', code, 'live', lc[code] || 0, 'record', sc[code] || 0)
  }
}
