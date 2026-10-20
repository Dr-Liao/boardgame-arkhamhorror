import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

const playerTypes = new Set(['asset', 'event', 'skill', 'treachery', 'enemy'])

const playerCards = Object.values(ALL_CARDS)
  .filter(card => /^04\d{3}$/.test(card.code) && !card.encounterCode
    && !card.signatureFor && card.type !== 'investigator' && playerTypes.has(card.type))
  .sort((left, right) => left.code.localeCompare(right.code))

// M2：91 张失落的时代玩家卡已全部逐卡验收。新增卡必须先在这里登记并通过 test:tfa:player。
export const IMPLEMENTED_PLAYER_CODES = Object.freeze([
  // 支援
  '04025', '04026', '04107', '04203', '04235', '04268', '04273', '04275',
  // 事件
  '04103', '04111', '04233', '04234', '04269',
  // 技能
  '04155', '04157', '04198', '04309',
  // 剧本模式弱点链
  '04038', '04039', '04040', '04041', '04042',
  // 第二批：武器、事件与技能（通过验收的部分）
  '04018',
  '04024',
  '04027',
  '04029',
  '04105',
  '04112',
  '04149',
  '04152',
  '04156',
  '04194',
  '04195',
  '04196',
  '04201',
  '04204',
  '04229',
  '04232',
  '04266',
  '04267',
  '04276',
  '04304',
  '04305',
  // 第一批附属
  '04019', '04020', '04021', '04037', '04193', '04265', '04270', '04306',
  // ② 封印
  '04030', '04031', '04311',
  // ③ 检定改写与弃牌堆
  '04271', '04274', '04313',
  // 第四批（M2-B 收尾，覆盖其余全部玩家卡）
  '04017', '04022', '04023', '04035', '04106', '04108', '04109', '04151', '04154', '04158',
  '04159', '04160', '04197', '04230', '04231', '04236', '04307', '04308', '04310',
  '04028', '04032', '04033', '04034', '04104', '04110', '04199', '04200', '04202', '04272', '04312',
  '04036', '04150', '04153', '04192',
])

const implemented = new Set(IMPLEMENTED_PLAYER_CODES)
export const WEAKNESS_PLAYER_CODES = Object.freeze(['04038', '04039', '04040', '04041', '04042'])
const weaknessCodes = new Set(WEAKNESS_PLAYER_CODES)

export const TFA_PLAYER_ACCEPTANCE_PROFILE = Object.freeze({
  id: 'original-forgotten-age-player-2026-10',
  scope: '失落的时代玩家卡逐卡主要印刷效果验收（分波次推进，未实现卡保持 catalog-only）。',
})

export const tfaPlayerCardVerified = code => implemented.has(code)
export const tfaPlayerBuildable = code => implemented.has(code) && !weaknessCodes.has(code)

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'tfaPlayer',
  name: '失落的时代 · 玩家卡',
  contentVersion: '0.2.0',
  minRulesVersion: 'n4.2',
  status: 'development',
  dependencies: ['core'],
  description: `${IMPLEMENTED_PLAYER_CODES.length} 张玩家卡已全部完成逐卡主要印刷效果验收（含两张战役层永久卡；弱点只能作为依赖卡牌）。`,
  cardRanges: [{ from: '04001', to: '04347' }],
  basicWeaknessCodes: ['04038', '04040'],
  cards: playerCards.map(card => ({
    code: card.code,
    name: card.nameZh || card.name,
    type: 'player',
    cataloged: true,
    imageAvailable: !!card.imagesrc,
    rulesImplemented: implemented.has(card.code),
    deckbuilding: tfaPlayerBuildable(card.code),
    ...(weaknessCodes.has(card.code) ? { dependencyOnly: true } : {}),
  })),
  encounterGroupIds: [],
  behaviorIds: IMPLEMENTED_PLAYER_CODES.map(code => `tfaPlayerCard${code}`),
}
