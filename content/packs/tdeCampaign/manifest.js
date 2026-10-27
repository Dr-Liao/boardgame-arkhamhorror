// 食梦者 · 战役内容包（M0 / catalog-only）。
//
// 归属规则（与 tools/scan-tde-scope.mjs 的 M0 账本一致）：
//   · 主卡号带 encounterCode → 战役包（地点/敌人/诡计/幕/议程/剧情/剧本参考卡）；
//   · 34 张关联面（a/b 尾缀）不重复登记进来——它们由 scope 账本按 encounterCode 归属；
//   · 8 章 + 12 个共享组 = 20 个遭遇组，组卡合计 283 条记录（249 主卡 + 34 面）。
//
// M0 只做目录与来源基线：8 章内容（definition/layout/behavior）与逐卡行为属 P8，
// `rulesImplemented` 在 P8 改为读逐卡账本，本文件不手写「已实现」清单。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { ENCOUNTER_GROUP_IDS } from '../../campaigns/theDreamEaters/shared.js'

const encounterTypes = new Set(['enemy', 'treachery'])
const mainCodes = Object.keys(ALL_CARDS).filter(code => /^06\d{3}$/.test(code)).sort()
const campaignCards = mainCodes
  .filter(code => ALL_CARDS[code].encounterCode)
  .map(code => ALL_CARDS[code])

export const CAMPAIGN_CARD_CODES = Object.freeze(campaignCards.map(card => card.code))
// 34 个关联面：卡池里带 encounterCode 的 a/b 面，按组跟随战役包（06015a/b 除外，归调查员包）。
export const CAMPAIGN_FACE_CODES = Object.freeze(Object.keys(ALL_CARDS)
  .filter(code => /^06\d{3}[a-z]$/.test(code) && ALL_CARDS[code].encounterCode)
  .sort())

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tdeCampaign',
  name: '食梦者 · 战役内容',
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
  status: 'catalog-only',
  dependencies: ['core'],
  description: 'M0 目录基线：249 张战役主卡 + 34 个关联面，8 章 + 12 个共享遭遇组尚未实现。',
  cardRanges: [{ from: '06039', to: '06354' }],
  cards: campaignCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: encounterTypes.has(card.type) ? 'encounter' : 'other',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: false,
    deckbuilding: false,
  })),
  encounterGroupIds: [...ENCOUNTER_GROUP_IDS],
  behaviorIds: [],
}
