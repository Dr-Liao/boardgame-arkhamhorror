import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { dunwichCardVerified } from '../../../src/cards/dunwich-acceptance.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION, id: 'dunwichCampaign', name: '敦威治遗产 · 战役内容',
  contentVersion: '1.0.0', minRulesVersion: 'n4.2', status: 'playable', dependencies: ['core'],
  description: '八关布置、结算、地点、敌人、遭遇与混乱标记规则已接入，可从大厅启动完整战役。',
  cardRanges: [{ from: '02040', to: '02350' }],
  // 第 115 轮：战役包收录「有遭遇组归属」的 02xxx 卡；剧情资产 02040 本身已带 encounterCode，
  // 不需要再按卡号特判。
  cards: Object.values(ALL_CARDS).filter(card => /^02\d{3}$/.test(card.code) && card.encounterCode).map(card => ({
    code: card.code, type: ['enemy', 'treachery'].includes(card.type) ? 'encounter' : card.type === 'asset' ? 'player' : 'other',
    cataloged: true, imageAvailable: !!card.imagesrc, rulesImplemented: dunwichCardVerified(card.code), deckbuilding: false,
  })),
  encounterGroupIds: ['extracurricularActivity', 'theHouseAlwaysWins', 'sorcery', 'theBeyond', 'bishopsThralls',
    'whippoorwills', 'badLuck', 'naomisCrew', 'hideousAbominations', 'dunwich', 'beastThralls',
    'theMiskatonicMuseum', 'theEssexCountyExpress', 'bloodOnTheAltar', 'undimensionedAndUnseen', 'whereDoomAwaits', 'lostInTimeAndSpace'],
  behaviorIds: [],
  basicWeaknessCodes: ['02037', '02038', '02039'],
}
