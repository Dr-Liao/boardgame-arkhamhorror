import { ALL_CARDS } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/cards/cards-data.js'
const neg = Object.entries(ALL_CARDS).filter(([code, c]) => c.type === 'enemy' && (c.fight < 0 || c.evade < 0 || c.health < 0))
console.log('negative-stat enemies:', neg.length)
for (const [code, c] of neg.slice(0, 40)) console.log(code, c.name, 'fight', c.fight, 'evade', c.evade, 'health', c.health, 'hpi', c.healthPerInvestigator, '|', (c.text || '').split('\n').slice(0,2).join(' / '))
