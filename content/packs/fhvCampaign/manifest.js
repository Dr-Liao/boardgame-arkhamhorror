// 铁杉谷盛宴 · 战役内容包（P7：301 条战役记录 playable）。
//
// 逐章行为由 12 个场景单元（content/campaigns/theFeastOfHemlockVale/scenarios/**）与共享遭遇条目
// （src/cards/encounter-entries/theFeastOfHemlockVale/**）交付；本清单只登记身份与开放状态。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { partitions, encounterGroups, encounterGroupId } from '../../campaigns/theFeastOfHemlockVale/shared.js'

export const CAMPAIGN_CARD_CODES = Object.freeze([...partitions.fhvCampaign])
export const CAMPAIGN_ENCOUNTER_GROUP_IDS = Object.freeze(Object.keys(encounterGroups).map(encounterGroupId).sort())

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'fhvCampaign',
  name: '铁杉谷盛宴 · 战役内容',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  dependencies: ['core'],
  description: 'P7 301 条战役记录（4 序曲 + 8 章 + 26 个遭遇组）逐章实现并经 Node/指南/浏览器验收；战役自 P7 起可在大厅启动。',
  cardRanges: [{ from: '10501', to: '10743' }, { from: '10501a', to: '10743z' }],
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
  encounterGroupIds: CAMPAIGN_ENCOUNTER_GROUP_IDS,
  behaviorIds: CAMPAIGN_ENCOUNTER_GROUP_IDS.map(group => `fhvEncounterGroup${group}`),
})
