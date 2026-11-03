import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CYCLE_CODES } from './shared.js'
const definitions = [
  ['bless', '祝福', 'ticBless', '\\[bless\\]', ['chaos.pool', 'chaos.resolution']],
  ['curse', '诅咒', 'ticCurse', '\\[curse\\]', ['chaos.pool', 'chaos.resolution']],
  ['seal', '封印', 'ticSeal', '\\bSeal(?:ed)?\\b|release.*token', ['chaos.seal']],
  ['vehicle', '载具', 'ticVehicles', '\\bVehicle\\b', ['scenario.vehicle']],
  ['road', '道路 X', 'ticRoad', '\\bRoad\\s+\\d', ['location.graph']],
  ['researched', '研究完成', 'ticResearched', '\\bResearched\\b', ['core.researched']],
  ['covenant', '契约', 'ticCovenant', 'Limit 1 \\[\\[Covenant\\]\\] per deck', ['deck.traitLimit']],
  ['exceptional', '卓越', 'upgrade', '\\bExceptional\\b', ['core.deck']],
  ['permanent', '永久', 'permanent', '\\bPermanent\\b', ['core.deck']],
  ['fast', '快速', 'fast', '\\bFast\\.', ['core.effects']],
  ['hunter', '猎手', 'hunter', '\\bHunter\\b', ['core.enemy']],
  ['aloof', '冷漠', 'aloof', '\\bAloof\\b', ['core.enemy']],
  ['massive', '庞大', 'massive', '\\bMassive\\b', ['core.enemy']],
  ['retaliate', '报复', 'retaliate', '\\bRetaliate\\b', ['core.enemy']],
  ['surge', '涌动', 'surge', '\\bSurge\\b', ['core.encounter']],
  ['peril', '险境', 'peril', '\\bPeril\\b', ['core.encounter']],
  ['victory', '胜利点', 'victory', '\\bVictory\\b', ['core.effects']],
  ['revelation', '显现', 'revelation', '\\bRevelation\\b', ['core.encounter']],
]
export const TIC_KEYWORDS = Object.freeze(definitions.map(([id, zh, ruleId, pattern, primitives]) => ({
  id, zh, ruleId, pattern, primitives, kind: ['bless', 'curse'].includes(id) ? 'token' : id === 'covenant' ? 'restriction' : 'keyword',
  cardCodes: CYCLE_CODES.filter(code => new RegExp(pattern, 'i').test([ALL_CARDS[code].text, ALL_CARDS[code].backText].join('\n'))),
})).filter(keyword => keyword.cardCodes.length))
