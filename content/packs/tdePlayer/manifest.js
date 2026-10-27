// 食梦者 · 玩家卡包（M0 / catalog-only：87 张 = 83 张普通玩家卡 + 4 张基础弱点）。
//
// 归属规则（与调查员包互补，scope 账本会核对三包无重叠、无遗漏）：
//   · 06 段主卡里既不是「带 encounterCode 的战役卡」，也不是「调查员或其专属卡」的其余 87 张；
//   · 含 4 张基础弱点（06035–06038）与 4 张 bonded 弱点（06019/06025/06283/06331）；
//     基础弱点只作依赖，不进入构筑池。
//
// M2（P7）才逐卡实现与分片；本文件在 M0 只声明归属与目录状态。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

const mainCodes = Object.keys(ALL_CARDS).filter(code => /^06\d{3}$/.test(code)).sort()
const playerCards = mainCodes
  .filter(code => !ALL_CARDS[code].encounterCode
    && !(ALL_CARDS[code].type === 'investigator' || ALL_CARDS[code].signatureFor))
  .map(code => ALL_CARDS[code])

export const PLAYER_CARD_CODES = Object.freeze(playerCards.map(card => card.code))
export const TDE_PLAYER_BASIC_WEAKNESS_CODES = Object.freeze(playerCards
  .filter(card => card.subtype === 'basicweakness')
  .map(card => card.code))

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tdePlayer',
  name: '食梦者 · 玩家卡',
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
  status: 'catalog-only',
  dependencies: ['core'],
  description: 'M0 目录基线：87 张玩家卡（含 4 张基础弱点）；逐卡行为与 4 个分片属 M2（P7）。',
  cardRanges: [{ from: '06018', to: '06332' }],
  basicWeaknessCodes: [...TDE_PLAYER_BASIC_WEAKNESS_CODES],
  cards: playerCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: 'player',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: false,
    deckbuilding: false,
    ...(card.subtype === 'basicweakness' ? { dependencyOnly: true } : {}),
  })),
  encounterGroupIds: [],
  behaviorIds: [],
}
