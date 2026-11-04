// 印斯茅斯暗潮 · 战役内容包（P8 生产：playable）。
//
// 归属规则（与 audit/tic-scope.json 的 ticCampaign 分区一致）：
//   · 主卡号 07xxx 且带 `encounterCode` 的 252 条印刷记录 → 战役包
//     （8 张剧本参考卡 + 幕/议程/地点/敌人/诡计/剧情资产/场景卡）；
//   · 关联面（a/b 尾缀）不重复登记：它们由 scope 账本按 encounterCode 归属，
//     卡包 `cardRanges` 覆盖 07001–07338 与关联面 07001a–07338z。
//
// rulesImplemented：P7 逐卡账本 audit/tic-all-card-acceptance.json 的
// `recordsImplemented = 252`、`missing = 0`（234 verified + 17 书面简化 + 1 印刷无行为），
// 即每条印刷记录都有单卡条目或由本章 definition/behavior 承担（8 张剧本参考卡）。
// P8 不把「简化」标成未实现——简化原因逐条记在逐卡账本里。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import {
  CARD_PARTITIONS, ENCOUNTER_GROUP_IDS, SCENARIO_REFERENCE_CODES,
} from '../../campaigns/theInnsmouthConspiracy/shared.js'
import { ALL_CARDS } from '../../../src/cards/cards-data.js'

const referenceCodes = new Set(SCENARIO_REFERENCE_CODES)
export const CAMPAIGN_CARD_CODES = Object.freeze([...CARD_PARTITIONS.ticCampaign])

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'ticCampaign',
  name: '印斯茅斯暗潮 · 战役内容',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  dependencies: ['core'],
  description: '252 条战役印刷记录（8 张剧本参考卡 + 幕/议程/地点/敌人/诡计/剧情资产），18 个战役遭遇组；逐卡账本 missing=0，P8 开放生产。',
  cardRanges: [{ from: '07001', to: '07338' }, { from: '07001a', to: '07338z' }],
  cards: CAMPAIGN_CARD_CODES.map(code => {
    const card = ALL_CARDS[code]
    return {
      code,
      name: card.nameZh || card.name,
      type: ['enemy', 'treachery'].includes(card.type) ? 'encounter' : 'other',
      cataloged: true,
      imageAvailable: !!card.imagesrc,
      // P7 逐卡账本 recordsImplemented=252 / missing=0：每条印刷记录都有单卡条目，
      // 或由本章 definition/behavior 承担（8 张剧本参考卡），故全部视为已实现。
      rulesImplemented: true,
      deckbuilding: false,
    }
  }),
  encounterGroupIds: [...ENCOUNTER_GROUP_IDS],
  behaviorIds: [],
}
