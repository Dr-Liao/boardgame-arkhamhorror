// 绯红密钥 · 调查员包（P5 生产：playable）。
//
// 内容：6 位正式调查员（09001/09004/09008/09011/09015/09018）+ 14 张专属依赖卡
// （签名卡/专属弱点），恰好占满 09001–09020。调查员由大厅选人开放，不可「构筑」；
// 专属卡由调查员牌组强制带入、属依赖卡，全部 deckbuilding=false。
// 一般玩家卡（09021–09128）仍 catalog-only，见 P6；战役包仍 catalog-only，见 P7–P8。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CARD_PARTITIONS, INVESTIGATOR_CODES, SIGNATURE_CODES } from '../../campaigns/theScarletKeys/shared.js'

export const INVESTIGATOR_CARD_CODES = Object.freeze([...CARD_PARTITIONS.tskInvestigators])
export const SIGNATURE_CARD_CODES = Object.freeze([...SIGNATURE_CODES])
const signatureCodes = new Set(SIGNATURE_CARD_CODES)
const investigatorCodes = new Set(INVESTIGATOR_CODES)

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tskInvestigators',
  name: '绯红密钥 · 调查员',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  dependencies: ['core'],
  description: 'P5 验收的 6 位调查员与 14 张专属依赖；调查员由大厅选人开放，专属卡随调查员强制带入（dependencyOnly），不进入一般构筑池。',
  cardRanges: [{ from: '09001', to: '09020' }],
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
    'carsonSinclair', 'asYouWish', 'selflessToAFault',
    'vincentLee', 'bonesaw', 'onTheMend', 'woundedBystander',
    'kymaniJones', 'grapplingHook', 'agentFletcher',
    'aminaZidane', 'wordOfWoe', 'wordOfWeal', 'deafeningSilence',
    'darrellSimmons', 'darrellsKodak', 'ruinedFilm',
    'charlieKane', 'bonnieWalsh', 'burdenOfLeadership',
  ],
}
