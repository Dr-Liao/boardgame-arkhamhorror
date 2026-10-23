// 万象无终 · 战役内容包（M0：237 张主卡，catalog-only；P6 起 4 张序章故事调查员已实现）。
//
// 归属规则（与 M0 账本一致）：
//   · 主卡号带 encounterCode → 战役包（地点/敌人/诡计/幕/议程/剧情/剧本参考卡）；
//   · 34 张关联面（a/b/c 尾缀）不重复登记——它们是卡池里已收录的背面记录，
//     由 tools/scan-tcu-scope.mjs 按 encounterCode 归属，避免卡包与卡池两份账。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { ENCOUNTER_GROUP_IDS, STORY_INVESTIGATOR_CODES } from '../../campaigns/theCircleUndone/shared.js'

const mainCodes = Object.keys(ALL_CARDS).filter(code => /^05\d{3}$/.test(code)).sort()
const campaignCards = mainCodes
  .filter(code => ALL_CARDS[code].encounterCode)
  .map(code => ALL_CARDS[code])

export const CAMPAIGN_CARD_CODES = Object.freeze(campaignCards.map(card => card.code))

// P6（M1）：序章 4 位故事调查员属于战役包，但他们的卡面能力已随调查员批次实现。
const implementedCodes = new Set(STORY_INVESTIGATOR_CODES)

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tcuCampaign',
  name: '万象无终 · 战役内容',
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
  status: 'catalog-only',
  dependencies: ['core'],
  description: '237 张战役卡按原卡号登记（9 章 + 12 个共享遭遇组，共 21 组）。逐张卡面实现与章节规则见 P8；本节只锁定范围。',
  cardRanges: [{ from: '05043', to: '05346' }],
  cards: campaignCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: ['enemy', 'treachery'].includes(card.type) ? 'encounter' : 'other',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: implementedCodes.has(card.code),
    deckbuilding: false,
  })),
  encounterGroupIds: [...ENCOUNTER_GROUP_IDS],
  behaviorIds: [],
}
