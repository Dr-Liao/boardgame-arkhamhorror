// 批次 3：2026 核心盒 + 五个入门包（tom/car/and/mar/mig）的开放与构筑验收。
//
// 覆盖：
//   1) 10 位新调查员可在大厅选择；签名/专属卡依赖与基础弱点进入对应池子；
//   2) 2026 核心盒 54 张普通卡与 5 个入门包普通卡进入构筑池，且每个非别名卡号都有
//      已注册的行为条目（声明即接线）；
//   3) 自动构筑：入门包调查员带齐签名与固定基础弱点；2026 核心盒调查员的随机基础弱点
//      来自 core_2026 的 8 张基础弱点候选；
//   4) 跨包重印别名归并到已开放原版（构筑/runtime 都走 canonical）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import {
  ALL_BASIC_WEAKNESS_CODES, ALL_BUILDABLE_CODES, SELECTABLE_INVESTIGATOR_CODES,
  SIGNATURES_BY_INVESTIGATOR, getAvailability,
} from '../src/deck/availability.js'
import { buildDeck, deckBuilderData } from '../src/deck/deckbuilding.js'
import { basicWeaknessPool, drawOpeningHand } from '../src/engine/engine.js'
import { fixture } from './core-fixture.mjs'
import { registeredEntry } from '../src/engine/ability.js'
import { REPRINT_ALIASES } from '../src/cards/card-identity.js'
import { canonicalCode } from '../src/integration/arkhamdb.js'

const CORE2026_INVESTIGATORS = Object.freeze(['12001', '12004', '12007', '12010', '12013'])
const CORE2026_SIGNATURES = Object.freeze({
  '12001': ['12002', '12003'], '12004': ['12005', '12006'], '12007': ['12008', '12009'],
  '12010': ['12011', '12012'], '12013': ['12014', '12015'],
})
const STARTERS = Object.freeze({
  '60151': Object.freeze({ signatures: ['60152', '60153'], weakness: '60154' }),
  '60251': Object.freeze({ signatures: ['60252', '60253'], weakness: '60254' }),
  '60351': Object.freeze({ signatures: ['60352', '60353', '60354', '60355'], weakness: '60356' }),
  '60451': Object.freeze({ signatures: ['60452', '60453'], weakness: '60454' }),
  '60551': Object.freeze({ signatures: ['60552', '60553'], weakness: '60554' }),
})
const CORE2026_PLAYERS = Object.freeze([
  '12016', '12017', '12018', '12019', '12021', '12022', '12023', '12026', '12027', '12028',
  '12029', '12030', '12033', '12035', '12036', '12037', '12040', '12041', '12043', '12045',
  '12046', '12047', '12048', '12051', '12052', '12053', '12054', '12055', '12057', '12058',
  '12059', '12060', '12061', '12062', '12063', '12066', '12067', '12068', '12070', '12071',
  '12072', '12074', '12075', '12076', '12079', '12080', '12081', '12082', '12083', '12084',
  '12085', '12086', '12087', '12088',
])
const STARTER_PLAYERS = Object.freeze({
  '60151': ['60156', '60157', '60158', '60159', '60160', '60161', '60162', '60163', '60164', '60165',
    '60166', '60167', '60168', '60170', '60171', '60172', '60173', '60174', '60175', '60177',
    '60178', '60179', '60180', '60181', '60182'],
  '60251': ['60255', '60256', '60257', '60258', '60259', '60260', '60261', '60262', '60264', '60265',
    '60266', '60268', '60269', '60271', '60272', '60273', '60274', '60276', '60277', '60278',
    '60279', '60280', '60281', '60282'],
  '60351': ['60357', '60358', '60359', '60360', '60362', '60363', '60364', '60365', '60366', '60367',
    '60368', '60369', '60370', '60373', '60374', '60375', '60376', '60377', '60378', '60380',
    '60382', '60383'],
  '60451': ['60456', '60457', '60458', '60461', '60462', '60463', '60464', '60465', '60466', '60467',
    '60468', '60470', '60471', '60472', '60473', '60474', '60475', '60476', '60477', '60478',
    '60479', '60480', '60481', '60482', '60483'],
  '60551': ['60555', '60556', '60557', '60558', '60559', '60561', '60562', '60563', '60564', '60565',
    '60566', '60567', '60568', '60569', '60570', '60571', '60572', '60573', '60574', '60575',
    '60576', '60577', '60578', '60579', '60580', '60581', '60582'],
})

test('批次 3：10 位调查员可在大厅选择，签名依赖与基础弱点进入对应池', () => {
  const builder = deckBuilderData()
  for (const code of [...CORE2026_INVESTIGATORS, ...Object.keys(STARTERS)]) {
    assert.ok(SELECTABLE_INVESTIGATOR_CODES.includes(code), `${code} 未进入可选调查员池`)
    assert.ok(INVESTIGATORS[code], `${code} 缺少调查员数据`)
    assert.ok(builder.investigators.some(investigator => investigator.code === code), `${code} 未出现在构筑元数据`)
  }
  for (const [investigator, signatures] of Object.entries(CORE2026_SIGNATURES)) {
    assert.deepEqual(SIGNATURES_BY_INVESTIGATOR[investigator], signatures, `${investigator} 签名依赖`)
    for (const code of signatures) assert.equal(getAvailability(code).dependencyOnly, true, `${code} 应为构筑依赖`)
  }
  for (const [investigator, kit] of Object.entries(STARTERS)) {
    assert.deepEqual(SIGNATURES_BY_INVESTIGATOR[investigator], kit.signatures, `${investigator} 签名依赖`)
    assert.ok(ALL_BASIC_WEAKNESS_CODES.includes(kit.weakness), `${kit.weakness} 未进入基础弱点池`)
  }
  for (const code of ['12097', '12098', '12099', '12100', '12101', '12102', '12103', '12104']) {
    assert.ok(ALL_BASIC_WEAKNESS_CODES.includes(code), `${code} 未进入基础弱点池`)
  }
})

test('批次 3：普通玩家卡进入构筑池，且每个非别名卡号都有已注册条目', () => {
  const buildable = new Set(ALL_BUILDABLE_CODES)
  const aliases = new Set(Object.values(REPRINT_ALIASES).flat())
  const expected = [...CORE2026_PLAYERS, ...Object.values(STARTER_PLAYERS).flat()]
  for (const code of expected) {
    assert.ok(ALL_CARDS[code], `${code} 不在卡表`)
    assert.ok(buildable.has(code), `${code} 未进入构筑池`)
    assert.ok(!aliases.has(code), `${code} 是重印别名，不应进入构筑池`)
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 缺少已注册的行为条目`)
  }
})

test('批次 3：自动构筑带齐签名与基础弱点，2026 核心盒随机弱点来自 2026 池', () => {
  for (const [investigator, kit] of Object.entries(STARTERS)) {
    const pool = basicWeaknessPool(null, investigator)
    assert.ok(pool.includes(kit.weakness), `${investigator} 基础弱点池缺少固定弱点 ${kit.weakness}`)
    const built = buildDeck(INVESTIGATORS[investigator], { seed: 'batch3', basicWeaknessPool: pool })
    assert.deepEqual(built.deck.filter(code => kit.signatures.includes(code)).sort(), [...kit.signatures].sort(),
      `${investigator} 自动牌组缺少签名`)
    const weaknesses = built.deck.filter(code => ALL_CARDS[code]?.subtype === 'basicweakness')
    assert.equal(weaknesses.length, 1, `${investigator} 自动牌组应有 1 张基础弱点`)
    assert.ok(pool.includes(weaknesses[0]), `${investigator} 的基础弱点 ${weaknesses[0]} 不在候选池`)
  }
  for (const investigator of CORE2026_INVESTIGATORS) {
    const pool = basicWeaknessPool(null, investigator)
    assert.ok(Array.isArray(pool) && pool.length, `${investigator} 基础弱点池为空`)
    assert.ok(pool.every(code => ALL_CARDS[code]?.subtype === 'basicweakness'), `${investigator} 弱点池含非法卡`)
    assert.ok(pool.some(code => ALL_CARDS[code]?.pack === 'core_2026'), `${investigator} 弱点池未含 2026 核心盒弱点`)
    const built = buildDeck(INVESTIGATORS[investigator], { seed: 'batch3', basicWeaknessPool: pool })
    assert.equal(built.deck.filter(code => ALL_CARDS[code]?.subtype === 'basicweakness').length, 1,
      `${investigator} 自动牌组应有 1 张基础弱点`)
  }
})

test('批次 3：跨包重印别名归并到已开放原版', () => {
  const expected = {
    '12020': '01020', '12024': '04103', '12025': '01025', '12031': '05024', '12032': '02020',
    '12034': '01030', '12038': '01037', '12039': '01039', '12042': '05276', '12044': '04107',
    '12049': '09064', '12050': '07114', '12056': '05278', '12064': '04199', '12065': '01065',
    '12069': '02268', '12073': '08073', '12077': '05114', '12078': '01079', '12089': '01088',
    '12090': '01089', '12091': '01092', '12092': '01091', '12093': '01090', '12094': '01093',
    '12095': '02158', '12096': '02157', '12097': '01096', '12100': '03040', '12101': '01097',
    '60155': '12019', '60176': '02299', '60263': '02186', '60267': '01039', '60270': '01040',
    '60275': '02150', '60361': '60305', '60371': '03233', '60372': '03031', '60379': '08057',
    '60384': '08058', '60455': '01063', '60459': '12059', '60460': '12062', '60469': '03235',
    '60560': '01075',
  }
  for (const [alias, canonical] of Object.entries(expected)) {
    assert.equal(canonicalCode(alias), canonical, `${alias} 的 canonical 应为 ${canonical}`)
    assert.ok(REPRINT_ALIASES[canonical]?.includes(alias), `${alias} 未登记在 ${canonical} 的重印别名表`)
    assert.equal(getAvailability(alias).deckbuilding, false, `${alias} 是别名，不应直接可构筑`)
  }
})

test('批次 3：Starting 关键词在起手前把 1 张起始卡放入起始手牌', () => {
  const state = fixture('60351')
  const inv = state.investigators[0]
  inv.hand = []
  inv.deck = ['60380', ...Array(10).fill('01088')]
  drawOpeningHand(state, inv)
  assert.ok(inv.hand.includes('60380'), 'Starting 卡应进入起始手牌')
  assert.equal(inv.hand.length, 5, '起手仍为 5 张（Starting 占其中 1 张）')
  assert.equal(inv.deck.length, 6, '牌组只少抽了起手张数')
})
