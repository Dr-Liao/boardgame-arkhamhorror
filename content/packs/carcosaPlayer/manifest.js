import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { carcosaPlayerCardVerified } from '../../../src/cards/carcosa-player-acceptance.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { effects } from './effects.js'
export { effects }

// Phase 2：这些卡的行为已经搬到能力层描述子（src/cards/card-abilities.js），
// 本包的 effects 表里不再有它们。清单是显式的而不是从 card-abilities 反向 import——
// 后者会形成 pack → card-effects → pack 的循环，模块初始化顺序会炸。
// 新增迁移时在这里登记（与 dunwichPlayer 的 abilityLayerCodes 同一约定）。
export const abilityLayerCodes = Object.freeze([
  '03020',
  '03021',
  '03022',
  '03023',
  '03024',
  '03026',
  '03027',
  '03028',
  '03029',
  '03031',
  '03032',
  '03033',
  '03034',
  '03035',
  '03038',
  '03039',
  '03040',
  '03041',
  '03107',
  '03108',
  '03109',
  '03110',
  '03111',
  '03112',
  '03113',
  '03115',
  '03116',
  '03117',
  '03118',
  '03119',
  '03147',
  '03148',
  '03150',
  '03151',
  '03152',
  '03153',
  '03154',
  '03155',
  '03158',
  '03190',
  '03191',
  '03192',
  '03193',
  '03194',
  '03195',
  '03196',
  '03197',
  '03198',
  '03199',
  '03228',
  '03229',
  '03230',
  '03231',
  '03232',
  '03233',
  '03234',
  '03235',
  '03236',
  '03237',
  '03238',
  '03239',
  '03263',
  '03265',
  '03266',
  '03267',
  '03268',
  '03269',
  '03271',
  '03272',
  '03273',
  '03305',
  '03307',
  '03309',
  '03312',
  '03313',
  '03314',
  '03315',
])

const playerTypes = new Set(['asset', 'event', 'skill', 'treachery', 'enemy'])
const basicWeaknessCodes = ['03040', '03041', '03042']
const playerCards = Object.values(ALL_CARDS)
  .filter(card => /^03\d{3}$/.test(card.code) && !card.encounterCode && !card.signatureFor
    && card.type !== 'investigator' && playerTypes.has(card.type))
  .sort((left, right) => left.code.localeCompare(right.code))

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'carcosaPlayer',
  name: '卡尔克萨之路 · 玩家卡',
  contentVersion: '1.0.0',
  minRulesVersion: 'n4.2',
  status: 'verified',
  dependencies: ['core'],
  description: 'C2 卡尔克萨玩家卡与基础弱点已完成逐卡主要印刷效果验收。',
  cardRanges: [{ from: '03001', to: '03342' }],
  cards: playerCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: 'player',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    // 行为可以在旧 DSL（EFFECTS）或能力层（card-abilities.js 描述子）里，
    // Phase 2 起两者都算"规则已实现"——否则迁移一张卡会连带关掉它的构筑许可。
    rulesImplemented: carcosaPlayerCardVerified(card.code)
      && (!!effects[card.code] || abilityLayerCodes.includes(card.code)),
    deckbuilding: !basicWeaknessCodes.includes(card.code),
  })),
  encounterGroupIds: [],
  behaviorIds: [],
  basicWeaknessCodes,
  abilityLayerCodes,
}
