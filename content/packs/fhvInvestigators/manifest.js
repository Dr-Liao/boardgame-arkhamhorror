// 铁杉谷盛宴 · 调查员包（P5 生产：playable）。
//
// 内容：5 位正式调查员（10001/10004/10009/10012/10015）+ 15 张专属/绑定依赖
// （签名卡/专属弱点/绑定面），恰好占满 10001–10018 与 10005b/10016a/10016b。
// 调查员由大厅选人开放、不可「构筑」；专属卡由调查员牌组强制带入、属依赖卡，全部 deckbuilding=false。
// 一般玩家卡（10109–10190 等）仍 catalog-only，见 P6；战役包仍 catalog-only，见 P7–P8。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import {
  BONDED_CODES, INVESTIGATOR_CODES, SIGNATURE_CODES, partitions,
} from '../../campaigns/theFeastOfHemlockVale/shared.js'

export const INVESTIGATOR_CARD_CODES = Object.freeze([...partitions.fhvInvestigators])
export const FHV_INVESTIGATOR_CODES = Object.freeze([...INVESTIGATOR_CODES])
export const FHV_SIGNATURE_CODES = Object.freeze([...SIGNATURE_CODES])
export const FHV_BONDED_CODES = Object.freeze([...BONDED_CODES])
const investigatorCodes = new Set(INVESTIGATOR_CODES)

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'fhvInvestigators',
  name: '铁杉谷盛宴 · 调查员',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  dependencies: ['core'],
  description: 'P5 验收的 5 位调查员与 15 张专属/绑定依赖；调查员由大厅选人开放，专属卡随调查员牌组强制带入（dependencyOnly），不进入一般构筑池。',
  cardRanges: [
    { from: '10001', to: '10018' },
    { from: '10005b', to: '10005b' },
    { from: '10016a', to: '10016b' },
  ],
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
      ...(investigatorCodes.has(code) ? { investigator: true } : { dependencyOnly: true }),
    }
  }),
  encounterGroupIds: [],
  behaviorIds: [
    'wilsonRichards', 'adHoc', 'hastyRepairs',
    'kateWinthrop', 'fluxStabilizer', 'fluxStabilizerActive', 'aethericCurrentFight', 'aethericCurrentEvade', 'failedExperiment',
    'alessandraZorzi', 'beguile', 'zamacona',
    'kohakuNarukami', 'bookOfLivingMyths', 'weepingYurei',
    'hankSamson', 'hankSamsonResoluteA', 'hankSamsonResoluteB', 'stouthearted', 'wheresPa',
  ],
  docs: ['docs/campaign/theFeastOfHemlockVale/investigators.md'],
}
