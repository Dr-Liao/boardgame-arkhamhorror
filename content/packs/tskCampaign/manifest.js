// 绯红密钥 · 战役内容包（P7：311 条战役记录 playable）。
//
// 逐章行为由 10 个章节单元（content/campaigns/theScarletKeys/scenarios/**）与共享遭遇条目
// （src/cards/encounter-entries/theScarletKeys/**）交付；本清单只登记身份与开放状态。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { CARD_PARTITIONS, ENCOUNTER_GROUPS } from '../../campaigns/theScarletKeys/shared.js'

export const CAMPAIGN_CARD_CODES = Object.freeze([...CARD_PARTITIONS.tskCampaign])

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tskCampaign',
  name: '绯红密钥 · 战役内容',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  dependencies: ['core'],
  description: 'P7 311 条战役记录（10 章 + 26 个遭遇组）逐章实现并经 Node/指南/浏览器验收；战役自 P7 起可在大厅启动。',
  cardRanges: [{ from: '09501', to: '09770' }, { from: '09501a', to: '09770z' }],
  cards: CAMPAIGN_CARD_CODES.map(code => {
    const card = ALL_CARDS[code]
    const type = ['enemy', 'treachery'].includes(card.type) ? 'encounter' : 'other'
    return Object.freeze({
      code,
      name: card.nameZh || card.name,
      type,
      cataloged: true,
      imageAvailable: !!card.imagesrc,
      rulesImplemented: true,
      deckbuilding: false,
    })
  }),
  encounterGroupIds: Object.freeze([...ENCOUNTER_GROUPS]),
  behaviorIds: Object.freeze([...ENCOUNTER_GROUPS].map(group => `tskEncounterGroup${group}`)),
})
