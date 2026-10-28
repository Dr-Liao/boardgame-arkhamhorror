import { game } from '../tests/campaign-n4-fixture.mjs'

const state = game('01001', 4)
const inv = state.investigators[3]
const record = state.campaign.investigators[3]
console.log('code', inv.code, 'hand', inv.hand.length, 'deck', inv.deck.length, 'record', record.deck.length)
for (const key of ['beneath', 'discard', 'assets', 'threat']) console.log(key, JSON.stringify((inv[key] || []).map ? inv[key].map(x => x.code || x) : inv[key]))
const count = list => list.reduce((m, c) => (m[c] = (m[c] || 0) + 1, m), {})
const lc = count([...inv.hand, ...inv.deck]), sc = count(record.deck)
const missing = Object.keys(sc).filter(code => (sc[code] || 0) > (lc[code] || 0))
console.log('missing from hand+deck:', missing.map(code => [code, sc[code] - (lc[code] || 0)]))
const all = count([...inv.hand, ...inv.deck, ...(inv.beneath || []), ...(inv.discard || [])])
console.log('hand+deck+beneath+discard equals record?', Object.keys(sc).every(code => (all[code] || 0) === sc[code]))
