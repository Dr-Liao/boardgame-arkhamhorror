import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

const catalog = Object.values(ALL_CARDS).filter(card => card.pack === 'tdcc')
const encounterTypes = new Set(['enemy', 'treachery'])
const encounterGroupIds = [...new Set(catalog.map(card =>
  card.encounterCode.replace(/_([a-z0-9])/g, (_, character) => character.toUpperCase())))].sort()

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tdcCampaign',
  name: '沉没之城 · 战役内容',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  // P7 内容批次：卡表全量目录 + 15 组共享遭遇 + 10 章专属组；战役层 handler 已接线。
  // 逐卡 `rulesImplemented` 仍为 false（本批次只做数据型条目；行为实现按逐章确认后再收紧）。
  status: 'development',
  dependencies: ['core', 'notz'],
  cardRanges: [{ from: '11501', to: '11766' }, { from: '11501a', to: '11766z' }],
  cards: catalog.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: encounterTypes.has(card.type) ? 'encounter' : 'other',
    cataloged: true,
    imageAvailable: Boolean(card.imagesrc),
    rulesImplemented: false,
    deckbuilding: false,
  })),
  encounterGroupIds,
  // 战役层效果处理器（与 content/campaigns/theDrownedCity/manifest.js#interludeHandlerId 同源）：
  //   tdcPrologue  —— 战役准备/开局初始化（序幕 campaignStart）
  //   tdcInterludes —— Interlude I–IV / Finale 的战役层结算（claimTask/returnToArkham 等）
  //   tdcEpilogue  —— EpilogueStep 的结局分支摘要
  behaviorIds: ['tdcPrologue', 'tdcInterludes', 'tdcEpilogue'],
}
