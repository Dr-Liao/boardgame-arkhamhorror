// 食梦者 · 战役内容包（P8 / development：283 条战役记录已逐卡接线，P10 升 playable）。
//
// 归属规则（与 tools/scan-tde-scope.mjs 的 M0 账本一致）：
//   · 主卡号带 encounterCode → 战役包（地点/敌人/诡计/幕/议程/剧情/剧本参考卡）；
//   · 34 张关联面（a/b 尾缀）不重复登记进来——它们由 scope 账本按 encounterCode 归属；
//   · 8 章 + 12 个共享组 = 20 个遭遇组，组卡合计 283 条记录（249 主卡 + 34 面）。
//
// P8 起 `rulesImplemented` 不再手写卡号清单：与逐章审计同一事实源——单卡条目的 `implemented`
// 声明（src/cards/card-rules.js 的 implementedFor）+ 剧本参考卡由对应章节 definition/behavior 实现。
// 8 张剧本参考卡（06039/06063/06119/06168/06206/06247/06286/06333）没有单卡行为文件：
// 它们的实现就是章节 definition/behavior，这里按 shared.js 的章节参考卡号视为已实现。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { implementedFor } from '../../../src/cards/card-rules.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { ENCOUNTER_GROUP_IDS, chapters } from '../../campaigns/theDreamEaters/shared.js'

const mainCodes = Object.keys(ALL_CARDS).filter(code => /^06\d{3}$/.test(code)).sort()
const campaignCards = mainCodes
  .filter(code => ALL_CARDS[code].encounterCode)
  .map(code => ALL_CARDS[code])

export const CAMPAIGN_CARD_CODES = Object.freeze(campaignCards.map(card => card.code))
// 34 个关联面：卡池里带 encounterCode 的 a/b 面，按组跟随战役包（06015a/b 除外，归调查员包）。
export const CAMPAIGN_FACE_CODES = Object.freeze(Object.keys(ALL_CARDS)
  .filter(code => /^06\d{3}[a-z]$/.test(code) && ALL_CARDS[code].encounterCode)
  .sort())

const scenarioReferenceCodes = new Set(chapters.map(chapter => chapter.code))
// P8：一张战役卡算「已实现」= 有单卡条目（implemented:true）或它是本章剧本参考卡。
export const tdeCampaignCardVerified = code =>
  scenarioReferenceCodes.has(code) || implementedFor(code)

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tdeCampaign',
  name: '食梦者 · 战役内容',
  contentVersion: '0.2.0',
  minRulesVersion: 'n6.0',
  // P8：283 条战役记录全部有单卡条目或有脚本实现声明；8 章为 development（P10 升 playable）。
  status: 'development',
  dependencies: ['core'],
  description: '249 张战役主卡 + 34 个关联面，8 章 + 12 个共享遭遇组（共 283 条记录）。逐卡实现读单卡条目声明（P8）。',
  cardRanges: [{ from: '06039', to: '06354' }],
  cards: campaignCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: ['enemy', 'treachery'].includes(card.type) ? 'encounter' : 'other',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: tdeCampaignCardVerified(card.code),
    deckbuilding: false,
  })),
  encounterGroupIds: [...ENCOUNTER_GROUP_IDS],
  behaviorIds: [],
}
