// 万象无终 · 调查员包（M1：6 位正式调查员 + 13 张专属卡）。
//
// P6 起本包状态为 verified：6 位调查员可选、可构筑、能力与旧印逐人验收；
// 13 张专属卡作为依赖可用（不计入构筑张数）。序章 4 位故事调查员属于战役包
// （05046–05049 带 encounterCode），不在这里，也永远不进入选人列表。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

const mainCodes = Object.keys(ALL_CARDS).filter(code => /^05\d{3}$/.test(code)).sort()
const investigatorCards = mainCodes
  .filter(code => !ALL_CARDS[code].encounterCode
    && (ALL_CARDS[code].type === 'investigator' || ALL_CARDS[code].signatureFor))
  .map(code => ALL_CARDS[code])

export const INVESTIGATOR_CARD_CODES = Object.freeze(investigatorCards.map(card => card.code))

// 六位正式调查员（进入选人列表与构筑）。
export const TCU_INVESTIGATOR_CODES = Object.freeze(['05001', '05002', '05003', '05004', '05005', '05006'])
// 13 张专属卡：7 张专属非弱点 + 6 张专属弱点（只作依赖，不进构筑池）。
export const TCU_SIGNATURE_CODES = Object.freeze([
  '05007', '05008', '05009', '05010', '05011', '05012', '05013',
  '05014', '05015', '05016', '05017', '05018', '05019',
])
const implementedCodes = new Set([...TCU_INVESTIGATOR_CODES, ...TCU_SIGNATURE_CODES])

export const TCU_INVESTIGATOR_ACCEPTANCE_PROFILE = Object.freeze({
  id: 'original-circle-undone-investigators-2026-10',
  scope: '万象无终六位正式调查员及 13 张专属卡逐人验收。',
})

export const tcuInvestigatorCardVerified = code => implementedCodes.has(code)

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tcuInvestigators',
  name: '万象无终 · 调查员',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'verified',
  dependencies: ['core'],
  description: 'M1 六位调查员的能力、构筑、旧印、专属卡与专属弱点已逐人验收；玩家卡与剧本仍未开放。',
  cardRanges: [{ from: '05001', to: '05019' }],
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
    'carolynFern', 'joeDiamond', 'prestonFairmont', 'dianaStanley', 'ritaYoung', 'marieLambeau',
    'hypnoticTherapy', 'rationalThought', 'detectivesColt1911s', 'unsolvedCase', 'familyInheritance',
    'lodgeDebts', 'twilightBlade', 'darkInsight', 'terribleSecret', 'imDoneRunnin', 'hoods',
    'mystifyingSong', 'baronSamedi',
  ],
}
