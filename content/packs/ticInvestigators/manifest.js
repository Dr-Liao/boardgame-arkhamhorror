// 印斯茅斯暗潮 · 调查员包（P8 生产：playable）。
//
// 内容：5 位正式调查员（07001–07005）+ 11 张专属主卡（守护天使、专属弱点/事件/支援）。
// 归属规则与 audit/tic-investigators.json、audit/tic-scope.json 的 ticInvestigators 分区一致。
//
// 旗标口径（P5 验收与 src/deck/availability.js 同源）：
//   · 调查员由大厅选人开放，不可「构筑」；专属卡由调查员牌组强制带入，属依赖卡；
//     因此本包全部卡 deckbuilding=false，11 张专属卡 dependencyOnly=true。
//   · rulesImplemented=true：P5 逐人验收 + audit/tic-investigators.json 全 verified。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import {
  CARD_PARTITIONS, INVESTIGATOR_CODES,
} from '../../campaigns/theInnsmouthConspiracy/shared.js'

export const INVESTIGATOR_CARD_CODES = Object.freeze([...CARD_PARTITIONS.ticInvestigators])
// 专属卡（含专属弱点）：由调查员卡强制带入，不能作为普通构筑卡购买/替换。
export const SIGNATURE_CARD_CODES = Object.freeze(INVESTIGATOR_CODES.flatMap(code =>
  ALL_CARDS[code].deckRequirements?.signatureCards || []))
const signatureCodes = new Set(SIGNATURE_CARD_CODES)

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'ticInvestigators',
  name: '印斯茅斯暗潮 · 调查员',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  dependencies: ['core'],
  description: 'P5 验收的 5 位正式调查员与 11 张专属依赖卡；调查员由大厅选人开放，专属卡随调查员强制带入（dependencyOnly），不进入构筑池。',
  cardRanges: [{ from: '07001', to: '07016' }],
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
      ...(signatureCodes.has(code) ? { dependencyOnly: true } : {}),
    }
  }),
  encounterGroupIds: [],
  behaviorIds: [
    'sisterMary', 'amandaSharpe', 'trishScarborough', 'dexterDrake', 'silasMarsh',
    'guardianAngel', 'crisisOfFaith', 'obscureStudies', 'whispersFromTheDeep', 'inTheShadows', 'shadowAgents',
    'showmanship', 'occultScraps', 'seaChangeHarpoon', 'silassNet', 'sirenCall',
  ],
}
