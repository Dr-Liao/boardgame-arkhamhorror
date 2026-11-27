// 验收 08-a 分片 1：Edge of the Earth 08001–08042（eoep，46 张）逐卡验收证据。
//
// 缺口：08011b/08012b/08013b/08014b（Lily Chen 四张 Broken 演武面）没有标题含卡号的真实测试；
// 其余 42 张由既有 EOTE 逐卡测试提供含卡号标题的真实断言（本轮实跑核对，见报告 §4）。
// 08008 通过真实攻击行动验证可选的横置与伤害。
// 规程：docs/test/ACCEPTANCE-ORDER.md §3 五维。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fixture, asset, enemy, legalMoves, move, settle } from './core-fixture.mjs'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registeredEntry, registerCardAbilities } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { reactionWindow } from '../src/engine/engine.js'
import { initializeDisciplines } from '../src/engine/eote-disciplines.js'
import { canSelectInvestigator, getAvailability } from '../src/deck/availability.js'

import lily from '../src/cards/entries/08010.js'
import discipline11a from '../src/cards/entries/08011a.js'
import discipline11b from '../src/cards/entries/08011b.js'
import discipline12a from '../src/cards/entries/08012a.js'
import discipline12b from '../src/cards/entries/08012b.js'
import discipline13a from '../src/cards/entries/08013a.js'
import discipline13b from '../src/cards/entries/08013b.js'
import discipline14a from '../src/cards/entries/08014a.js'
import discipline14b from '../src/cards/entries/08014b.js'
import burden from '../src/cards/entries/08015.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ENTRY_LIST = [lily, discipline11a, discipline11b, discipline12a, discipline12b,
  discipline13a, discipline13b, discipline14a, discipline14b, burden]
if (!registeredEntry('08010')) registerCardAbilities(ENTRY_LIST)

const CODES = Object.freeze(["08001","08002","08003","08004","08005","08006","08007","08008","08009","08010","08011a","08011b","08012a","08012b","08013a","08013b","08014a","08014b","08015","08016","08017","08018","08019","08020","08021","08022","08023","08024","08025","08026","08027","08028","08029","08030","08031","08032","08033","08034","08035","08036","08037","08038","08039","08040","08041","08042"])

const SETS = Object.freeze([
  { unbrokenCode: '08011a', brokenCode: '08011b', burdenCode: '08015' },
  { unbrokenCode: '08012a', brokenCode: '08012b', burdenCode: '08015' },
  { unbrokenCode: '08013a', brokenCode: '08013b', burdenCode: '08015' },
  { unbrokenCode: '08014a', brokenCode: '08014b', burdenCode: '08015' },
])
const DISCIPLINE_PATTERN = /^0801[1-4][ab]$/
const invOf = state => state.investigators[0]

function transact(state, run, select = () => null) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'acceptance-08-a-1' }, execute)
  for (let guard = 0; state.pendingChoice; guard += 1) {
    assert.ok(guard < 120, `choice loop: ${JSON.stringify(state.pendingChoice.kind)}`)
    const choice = state.pendingChoice
    const optionId = select(choice, state)
      ?? ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0]?.id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, execute)
  }
}

function addDiscipline(state, code) {
  const card = asset(state, code, {}, 0)
  if (!state.campaign.eote?.disciplines?.sets?.length) initializeDisciplines(state, { sets: SETS })
  if (/b$/.test(code)) state.campaign.eote.disciplines.faces[`${code.slice(0, -1)}a`] = 'broken'
  return card
}

function roundEnds(state) {
  transact(state, draft => reactionWindow(draft, 'roundEnds', { when: 'roundEnds', round: draft.round }, []), choice => {
    const skip = choice.options.find(option => option.id === 'skip')
    const trigger = choice.options.find(option => option.id !== 'skip')
    return trigger?.id ?? skip?.id
  })
}

function lilyState(brokenCode) {
  const state = fixture('08010')
  state.abilityLimits = {}
  const inv = invOf(state)
  inv.assets = []
  inv.hand = []
  inv.threat = []
  inv.damage = 0
  inv.horror = 0
  inv.resources = 20
  inv.actionsLeft = 20
  inv.roundEvents = {}
  if (!state.campaign.eote?.disciplines?.sets?.length) initializeDisciplines(state, { sets: SETS })
  const card = addDiscipline(state, brokenCode)
  return { state, card }
}
const disciplineOf = (state, cardId) => invOf(state).assets.find(card => card.id === cardId)
const faceOf = state => state.campaign.eote.disciplines.faces

// ---------------------------------------------------------------------------
// 范围 / 接线 / 合规
// ---------------------------------------------------------------------------

test('08-a-1 范围：08001–08042 eoep 卡恰好 46 张（含 4 组双面演武）', () => {
  assert.equal(CODES.length, 46)
  assert.deepEqual([...CODES].sort(), CODES)
  for (const code of CODES) assert.equal(ALL_CARDS[code].pack, 'eoep', `${code} 不属于 eoep`)
})

test('08-a-1 接线：46 张均有条目文件；5 位调查员可选；玩家卡进入构筑池', () => {
  for (const code of CODES) {
    assert.equal(existsSync(path.join(ROOT, 'src/cards/entries', `${code}.js`)), true, `${code} 缺少条目`)
    assert.ok(registeredEntry(code), `${code} 未注册`)
  }
  for (const code of ['08001', '08004', '08007', '08010', '08016']) {
    assert.equal(canSelectInvestigator(code), true, `${code} 应可选`)
    assert.equal(getAvailability(code).availability, 'strict')
  }
  const playerCards = CODES.filter(code => ['asset', 'event', 'skill'].includes(ALL_CARDS[code].type)
    && !ALL_CARDS[code].subtype)
  assert.ok(playerCards.length >= 20)
  for (const code of playerCards) assert.equal(getAvailability(code).availability, 'strict', `${code} 可构筑`)
})

test('08008 可靠的长鞭：合法攻击成功时可横置，让实际伤害增加 1', () => {
  const state = fixture('08007')
  const whip = asset(state, '08008')
  const target = enemy(state, { fight: 0, health: 5 })
  const attack = legalMoves(state, 0).find(option => option.action === 'ability'
    && option.assetId === whip.id && option.targetId === target.id)
  assert.ok(attack, '长鞭攻击应出现在合法行动中')
  move(state, attack)
  settle(state, choice => choice.options.find(option => option.id === 'damage')?.id)
  assert.equal(invOf(state).assets.find(item => item.id === whip.id).exhausted, true)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2)
})

// ---------------------------------------------------------------------------
// 08011b–08014b 四张 Broken 演武面（真实轮末反应）
// ---------------------------------------------------------------------------

test('TIC·EOTE 08011b 演武·意志 Broken 面：本轮未受伤/恐惧时轮末翻回 Unbroken', () => {
  const { state, card } = lilyState('08011b')
  invOf(state).roundEvents = { damage: 0, horror: 0 }
  roundEnds(state)
  const after = disciplineOf(state, card.id)
  assert.equal(after.code, '08011a', '翻回 08011a')
  assert.equal(faceOf(state)['08011a'], 'unbroken', '战役层演武面同步')
  // 反例：本轮受过伤害则保持 Broken。
  const other = lilyState('08011b')
  invOf(other.state).roundEvents = { damage: 1, horror: 0 }
  roundEnds(other.state)
  assert.equal(disciplineOf(other.state, other.card.id).code, '08011b', '受伤后不翻回')
})

test('TIC·EOTE 08012b 演武·智识 Broken 面：本轮手牌从未达到 2 张时轮末翻回', () => {
  const { state, card } = lilyState('08012b')
  invOf(state).roundEvents = { handTwoPlus: false }
  roundEnds(state)
  assert.equal(disciplineOf(state, card.id).code, '08012a')
  assert.equal(faceOf(state)['08012a'], 'unbroken')
  const other = lilyState('08012b')
  invOf(other.state).roundEvents = { handTwoPlus: true }
  roundEnds(other.state)
  assert.equal(disciplineOf(other.state, other.card.id).code, '08012b', '手牌达到过 2 张则保持 Broken')
})

test('TIC·EOTE 08013b 演武·战斗 Broken 面：本轮未执行技能检定时轮末翻回', () => {
  const { state, card } = lilyState('08013b')
  invOf(state).roundEvents = { tests: 0 }
  roundEnds(state)
  assert.equal(disciplineOf(state, card.id).code, '08013a')
  assert.equal(faceOf(state)['08013a'], 'unbroken')
  const other = lilyState('08013b')
  invOf(other.state).roundEvents = { tests: 1 }
  roundEnds(other.state)
  assert.equal(disciplineOf(other.state, other.card.id).code, '08013b', '执行过检定则保持 Broken')
})

test('TIC·EOTE 08014b 演武·敏捷 Broken 面：本轮同地点未出现敌人时轮末翻回', () => {
  const { state, card } = lilyState('08014b')
  invOf(state).roundEvents = { enemyAtLocation: false }
  roundEnds(state)
  assert.equal(disciplineOf(state, card.id).code, '08014a')
  assert.equal(faceOf(state)['08014a'], 'unbroken')
  const other = lilyState('08014b')
  invOf(other.state).roundEvents = { enemyAtLocation: true }
  roundEnds(other.state)
  assert.equal(disciplineOf(other.state, other.card.id).code, '08014b', '出现敌人则保持 Broken')
})

test('08-a-1 双面演武接线：四组 a/b 由正面 linkedCardCode 指向背面，条目与引擎面登记一致', () => {
  for (const set of SETS) {
    const front = ALL_CARDS[set.unbrokenCode]
    const back = ALL_CARDS[set.brokenCode]
    assert.equal(front.linkedCardCode, set.brokenCode, `${set.unbrokenCode} 背面登记`)
    assert.equal(back.traits.includes('Broken'), true, `${set.brokenCode} 为 Broken 面`)
    assert.equal(front.permanent, true, '演武为永久卡')
    assert.equal(back.permanent, true, '背面同样为永久卡')
    assert.equal(registeredEntry(set.unbrokenCode).code, set.unbrokenCode)
    assert.equal(registeredEntry(set.brokenCode).code, set.brokenCode)
    assert.equal(ALL_CARDS[set.burdenCode].signatureFor[0], '08010')
  }
})
