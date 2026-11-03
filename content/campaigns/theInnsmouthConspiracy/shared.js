// Catalog identities only. Rules/chapters are promoted independently after acceptance.
import { ALL_CARDS } from '../../../src/cards/cards-data.js'

export const CAMPAIGN_ID = 'theInnsmouthConspiracy'
export const chapters = Object.freeze([
  ['thePitOfDespair', '07041', '绝望深坑', 'The Pit of Despair'],
  ['theVanishingOfElinaHarper', '07056', '艾莲娜·哈珀失踪案', 'The Vanishing of Elina Harper'],
  ['inTooDeep', '07123', '深陷危局', 'In Too Deep'],
  ['devilReef', '07163', '魔鬼礁石', 'Devil Reef'],
  ['horrorInHighGear', '07198', '全速恐惧', 'Horror in High Gear'],
  ['aLightInTheFog', '07231', '雾中之光', 'A Light in the Fog'],
  ['theLairOfDagon', '07274', '达贡巢穴', 'The Lair of Dagon'],
  ['intoTheMaelstrom', '07311', '暗潮之下', 'Into the Maelstrom'],
].map(([id, code, name, nameEn]) => Object.freeze({ id, code, name, nameEn,
  encounterCode: ALL_CARDS[code].encounterCode, packCode: ALL_CARDS[code].pack })))
export const INVESTIGATOR_CODES = Object.freeze(['07001', '07002', '07003', '07004', '07005'])
export const CYCLE_CODES = Object.freeze(Object.keys(ALL_CARDS).filter(code => /^07\d{3}[a-z]?$/.test(code)).sort())
const investigators = new Set(INVESTIGATOR_CODES.flatMap(code => [code, ...(ALL_CARDS[code].deckRequirements?.signatureCards || [])]))
export const CARD_PARTITIONS = Object.freeze({
  ticCampaign: Object.freeze(CYCLE_CODES.filter(code => ALL_CARDS[code].encounterCode)),
  ticInvestigators: Object.freeze(CYCLE_CODES.filter(code => !ALL_CARDS[code].encounterCode && investigators.has(code))),
  ticPlayer: Object.freeze(CYCLE_CODES.filter(code => !ALL_CARDS[code].encounterCode && !investigators.has(code))),
})
export const ENCOUNTER_GROUPS = Object.freeze([...new Set(CARD_PARTITIONS.ticCampaign.map(code => ALL_CARDS[code].encounterCode))].sort())
const symbols = ['skull', 'skull', 'cultist', 'cultist', 'tablet', 'tablet', 'elderthing', 'elderthing', 'autofail', 'eldersign']
export const CHAOS_BAGS = Object.freeze({
  easy: Object.freeze(['+1', '+1', '0', '0', '0', '-1', '-1', '-2', '-2', ...symbols]),
  standard: Object.freeze(['+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4', ...symbols]),
  hard: Object.freeze(['0', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5', ...symbols]),
  expert: Object.freeze(['0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-6', '-8', ...symbols]),
})

export function catalogPack(id, name) {
  const codes = CARD_PARTITIONS[id]
  if (!codes) throw new RangeError(`未知目录包 ${id}`)
  return Object.freeze({ schemaVersion: 1, id, name, contentVersion: '0.1.0', minRulesVersion: 'n6.0',
    status: 'catalog-only', dependencies: ['core'],
    cardRanges: [{ from: '07001', to: '07338' }, { from: '07001a', to: '07338z' }],
    cards: codes.map(code => ({ code, name: ALL_CARDS[code].nameZh || ALL_CARDS[code].name,
      type: id === 'ticCampaign' ? ['enemy', 'treachery'].includes(ALL_CARDS[code].type) ? 'encounter' : 'other' : 'player',
      cataloged: true, imageAvailable: !!ALL_CARDS[code].imagesrc, rulesImplemented: false, deckbuilding: false })),
    encounterGroupIds: id === 'ticCampaign' ? ENCOUNTER_GROUPS.map(group => group.replace(/_([a-z])/g, (_, c) => c.toUpperCase())) : [],
    behaviorIds: [],
  })
}
