// 万象无终 · 战役内容包（M0：237 张主卡；P6 起 4 张序章故事调查员已实现，P8 起逐卡读点；P10 开放）。
//
// 归属规则（与 M0 账本一致）：
//   · 主卡号带 encounterCode → 战役包（地点/敌人/诡计/幕/议程/剧情/剧本参考卡）；
//   · 34 张关联面（a/b/c 尾缀）不重复登记——它们是卡池里已收录的背面记录，
//     由 tools/scan-tcu-scope.mjs 按 encounterCode 归属，避免卡包与卡池两份账。
// P8 起 `rulesImplemented` 不再手写卡号清单：与逐章审计同一事实源——单卡条目的
// `implemented` 声明（src/cards/card-rules.js 的 implementedFor）；序章 4 位故事调查员
// 的卡面能力在 P6 随调查员批次实现（技能/旧印条目在 entries/），这里保留显式兜底。
// P10：三组确认与逐卡账本落账后，包状态从 development 升 playable。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { implementedFor } from '../../../src/cards/card-rules.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { ENCOUNTER_GROUP_IDS, STORY_INVESTIGATOR_CODES, chapters } from '../../campaigns/theCircleUndone/shared.js'

const mainCodes = Object.keys(ALL_CARDS).filter(code => /^05\d{3}$/.test(code)).sort()
const campaignCards = mainCodes
  .filter(code => ALL_CARDS[code].encounterCode)
  .map(code => ALL_CARDS[code])

export const CAMPAIGN_CARD_CODES = Object.freeze(campaignCards.map(card => card.code))

const implementedCodes = new Set(STORY_INVESTIGATOR_CODES)
// 9 张剧本参考卡（05043/05050/…/05325）没有「单卡行为文件」：它们的实现就是对应章节的
// definition/behavior（P8 已接线并逐章验收）。这里按 shared.js 的章节参考卡号视为已实现。
const scenarioReferenceCodes = new Set(chapters.map(chapter => chapter.code))
export const tcuCampaignCardVerified = code =>
  implementedCodes.has(code) || scenarioReferenceCodes.has(code) || implementedFor(code)

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tcuCampaign',
  name: '万象无终 · 战役内容',
  contentVersion: '0.3.0',
  minRulesVersion: 'n6.0',
  // P8：237 张战役卡全部有单卡实现声明（9 张剧本参考卡由对应章节实现），包状态升到 development；
  // P10：三组确认 + 逐卡账本 + 大厅实机路径落账后升 playable。
  status: 'playable',
  dependencies: ['core'],
  description: '237 张战役卡按原卡号登记（9 章 + 12 个共享遭遇组，共 21 组）。逐卡实现读单卡条目的 implemented 声明（P8）。',
  cardRanges: [{ from: '05043', to: '05346' }],
  cards: campaignCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: ['enemy', 'treachery'].includes(card.type) ? 'encounter' : 'other',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: tcuCampaignCardVerified(card.code),
    deckbuilding: false,
  })),
  encounterGroupIds: [...ENCOUNTER_GROUP_IDS],
  behaviorIds: [],
}
