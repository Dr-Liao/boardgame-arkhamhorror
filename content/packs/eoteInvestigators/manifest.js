// 地球边缘 · 调查员包（P5 生产：playable）。
//
// 内容：5 位正式调查员（08001/08004/08007/08010/08016）+ 9 张专属卡（含专属弱点/事件/支援）
// + 8 张双面永久演武（08011a/b–08014a/b，陈丽丽能力在开局/升级时获得）。
// 归属规则与 audit/eote-scope.json 的 eoteInvestigators 分区一致。
//
// 旗标口径（P5 验收与 src/deck/availability.js 同源）：
//   · 调查员由大厅选人开放，不可「构筑」；专属卡由调查员牌组强制带入、属依赖卡，
//     因此本包全部卡 deckbuilding=false，非调查员卡 dependencyOnly=true。
//   · rulesImplemented=true：P5 逐人验收 + audit/eote-investigators.json 全 verified。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import {
  CARD_PARTITIONS, INVESTIGATOR_CODES, DISCIPLINE_CODES,
} from '../../campaigns/edgeOfTheEarth/shared.js'

export const INVESTIGATOR_CARD_CODES = Object.freeze([...CARD_PARTITIONS.eoteInvestigators])
// 专属依赖（含专属弱点/主卡 + 4 组双面演武）：由调查员牌组或能力强制带入，不可作一般构筑卡购买/替换。
export const SIGNATURE_CARD_CODES = Object.freeze([
  ...INVESTIGATOR_CODES.flatMap(code => ALL_CARDS[code].deckRequirements?.signatureCards || []),
  ...DISCIPLINE_CODES,
])
const signatureCodes = new Set(SIGNATURE_CARD_CODES)
const investigatorCodes = new Set(INVESTIGATOR_CODES)

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'eoteInvestigators',
  name: '地球边缘 · 调查员',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  dependencies: ['core'],
  description: 'P5 验收的 5 位正式调查员与 17 张专属依赖（9 张专属卡 + 8 张双面演武）；调查员由大厅选人开放，专属卡随调查员强制带入（dependencyOnly），不进入一般构筑池。',
  cardRanges: [{ from: '08001', to: '08018' }, { from: '08011a', to: '08014b' }],
  cards: INVESTIGATOR_CARD_CODES.map(code => {
    const card = ALL_CARDS[code]
    return {
      code,
      name: card.nameZh || card.name,
      type: 'player',
      cataloged: true,
      imageAvailable: !!card.imagesrc,
      rulesImplemented: true,
      deckbuilding: false,
      ...(signatureCodes.has(code) && !investigatorCodes.has(code) ? { dependencyOnly: true } : {}),
      ...(investigatorCodes.has(code) ? { investigator: true } : {}),
    }
  }),
  encounterGroupIds: [],
  behaviorIds: [
    'danielaReyes', 'mechanicsWrench', 'mobGoons',
    'normanWithers', 'livreDEibon', 'theHarbinger',
    'montereyJack', 'trustyBullwhip', 'buriedSecrets',
    'lilyChen', 'disciplineWillpower', 'disciplineIntellect', 'disciplineCombat', 'disciplineAgility', 'burdenOfDestiny',
    'bobJenkins', 'shrewdDealings', 'greed',
  ],
}
