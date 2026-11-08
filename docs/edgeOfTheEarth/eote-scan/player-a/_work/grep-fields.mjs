import fs from 'node:fs'
import path from 'node:path'
const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const files = []
;(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(js|mjs)$/.test(e.name)) files.push(p)
  }
})(MOD + '/src')
const idx = files
  .filter(p => !/entries|cards-data|encounter-entries/.test(p))
  .map(p => ({ p: p.replace(MOD + '/', 'src/'), t: fs.readFileSync(p, 'utf8') }))
const terms = [
  'composure', 'freeTriggers', 'playCondition', 'playCostModifier', 'deckConstruction',
  'exceptional', 'deckLimit', 'permanent', 'discardWhenEmpty', 'assetRule', 'exileAfterPlay',
  'quickEvent', 'fromHand', 'requireTestTrait', 'resourcesAtLeast', 'redirectOneDamageToSelf',
  'entersPlay', 'leavesPlay', 'setup', 'passive',
]
for (const term of terms) {
  const hits = []
  for (const f of idx) {
    f.t.split('\n').forEach((line, i) => {
      if (line.includes(term)) hits.push(`${f.p}:${i + 1}: ${line.trim().slice(0, 160)}`)
    })
  }
  console.log('###', term, '=>', hits.length)
  hits.slice(0, 7).forEach(h => console.log('   ', h))
}
