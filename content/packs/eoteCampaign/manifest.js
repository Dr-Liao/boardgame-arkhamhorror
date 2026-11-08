// 地球边缘 · 战役内容包（P7：266 条战役记录 playable）。
//
// 逐章行为由 8 个章节单元（content/campaigns/edgeOfTheEarth/scenarios/**）与共享遭遇条目
// （src/cards/encounter-entries/edgeOfTheEarth/**）交付；本清单只登记身份与开放状态。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { CARD_PARTITIONS, ENCOUNTER_GROUPS } from '../../campaigns/edgeOfTheEarth/shared.js'

export const CAMPAIGN_CARD_CODES = Object.freeze([...CARD_PARTITIONS.eoteCampaign])

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'eoteCampaign',
  name: '地球边缘 · 战役内容',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  dependencies: ['core'],
  description: 'P7 266 条战役记录（含 36 张关联面）逐章实现并由节点/浏览器验收；战役/八章自 P7 起可在大厅启动。',
  cardRanges: [{ from: '08501', to: '08738' }, { from: '08556b', to: '08738z' }],
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
  behaviorIds: Object.freeze([...ENCOUNTER_GROUPS].map(group => `eoteEncounterGroup${group}`)),
})
