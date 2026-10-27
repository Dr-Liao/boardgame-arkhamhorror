import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

const investigatorCards = Object.values(ALL_CARDS)
  .filter(card => /^04\d{3}$/.test(card.code) && !card.encounterCode
    && (card.type === 'investigator' || card.signatureFor))
  .sort((left, right) => left.code.localeCompare(right.code))

// M1: five investigators plus their eleven signature / weakness cards are
// implemented. Signature assets, events and weakness triggers all live here so
// card-effects.js only spreads the tables; the engine still owns resolution.
export const TFA_INVESTIGATOR_ACCEPTANCE_PROFILE = Object.freeze({
  id: 'original-forgotten-age-investigators-2026-10',
  scope: '失落的时代五位调查员及 11 张专属卡逐人验收。',
})

const implementedCodes = new Set([
  '04001', '04002', '04003', '04004', '04005',
  '04006', '04007', '04008', '04009', '04010', '04011', '04012', '04013', '04014', '04015', '04016',
])
export const tfaInvestigatorCardVerified = code => implementedCodes.has(code)

export const INVESTIGATOR_CODES = Object.freeze(['04001', '04002', '04003', '04004', '04005'])

// Source: 参考资源/.../library/Arkham/Investigator/Cards/TheForgottenAge/*.hs

// Source: 参考资源/.../library/Arkham/Player/Cards/TheForgottenAge/*.hs
export const signatureEffects = {
  // 04010 走私货物已迁到能力层（5c-20），见 src/cards/card-abilities.js 的
  // MIGRATED_ESCAPE_ENTRIES_5C20（含条目级 playRestriction）。
  // 04014 已迁到能力层（6e-16：enemyWeakness / weakness 数据体）。
}

export const runtimeDependencyCodes = ['04009', '04014']

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tfaInvestigators',
  name: '失落的时代 · 调查员',
  contentVersion: '1.0.0',
  minRulesVersion: 'n4.2',
  status: 'playable',
  dependencies: ['core'],
  description: 'M1 五位调查员的能力、构筑、旧印、专属卡与专属弱点已逐人验收。',
  cardRanges: [{ from: '04001', to: '04016' }],
  cards: investigatorCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: 'player',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: implementedCodes.has(card.code),
    deckbuilding: !!card.signatureFor,
  })),
  encounterGroupIds: [],
  behaviorIds: [
    'leoAnderson', 'mitchBrown', 'boughtInBlood',
    'ursulaDowns', 'jakeWilliams', 'callOfTheUnknown',
    'finnEdwards', 'smuggledGoods', 'finnsTrusty38', 'caughtRedHanded',
    'fatherMateo', 'codexOfAges', 'serpentsOfYig',
    'calvinWright', 'untilTheEndOfTime', 'voiceOfTheMessenger',
  ],
}
