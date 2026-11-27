// 验收 10-a 分片 1：The Feast of Hemlock Vale 10001–10033（fhvp，35 张）逐卡验收证据。
//
// 缺口：10002 / 10003 / 10005b / 10006 / 10007 没有标题含卡号的真实测试；
// 10016a/10016b 用真实伤害分配和反应窗口验证每次放置只结算一次。
// 规程：docs/test/ACCEPTANCE-ORDER.md §3 五维。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fixture, asset, enemy } from './core-fixture.mjs'
import { applyHarm } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { canSelectInvestigator, getAvailability } from '../src/deck/availability.js'

import e10002 from '../src/cards/entries/10002.js'
import e10003 from '../src/cards/entries/10003.js'
import e10005b from '../src/cards/entries/10005b.js'
import e10006 from '../src/cards/entries/10006.js'
import e10007 from '../src/cards/entries/10007.js'
import e10016a from '../src/cards/entries/10016a.js'
import e10016b from '../src/cards/entries/10016b.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
if (!registeredEntry('10016a')) registerCardAbilities([e10016a, e10016b])

const CODES = Object.freeze(["10001","10002","10003","10004","10005","10005b","10006","10007","10008","10009","10010","10011","10012","10013","10014","10015","10016a","10016b","10017","10018","10019","10020","10021","10022","10023","10024","10025","10026","10027","10028","10029","10030","10031","10032","10033"])

const callRecorder = () => {
  const calls = []
  const record = (name, payload) => (...args) => { calls.push([name, ...args]); return payload }
  return { calls, record }
}

// ---------------------------------------------------------------------------
// 范围 / 接线 / 合规
// ---------------------------------------------------------------------------

test('10-a-1 范围：10001–10033 fhvp 卡恰好 35 张', () => {
  assert.equal(CODES.length, 35)
  for (const code of CODES) {
    assert.equal(ALL_CARDS[code].pack, 'fhvp', `${code} 不属于 fhvp`)
  }
})

test('10-a-1 接线：35 张均有条目；5 位调查员可选；汉克三面与磁通量稳定器双面关系登记', () => {
  for (const code of CODES) {
    assert.equal(existsSync(path.join(ROOT, 'src/cards/entries', `${code}.js`)), true, `${code} 缺少条目`)
  }
  for (const code of ['10001', '10004', '10009', '10012', '10015']) {
    assert.equal(canSelectInvestigator(code), true, `${code} 应可选`)
    assert.equal(getAvailability(code).availability, 'strict')
  }
  assert.match(String(ALL_CARDS['10016a'].bondedTo), /Hank Samson/, '10016a 绑定汉克')
  assert.match(String(ALL_CARDS['10016b'].bondedTo), /Hank Samson/, '10016b 绑定汉克')
  assert.equal(ALL_CARDS['10005'].linkedCardCode, '10005b', '磁通量稳定器两面登记')
  assert.equal(ALL_CARDS['10005'].signatureFor[0], '10004', '稳定器为凯特签名卡')
  for (const code of ['10006', '10007']) {
    assert.equal(ALL_CARDS[code].pack, 'fhvp')
    assert.equal(registeredEntry(code)?.code, code, `${code} 条目存在`)
  }
})

test('10-a-1 合规：R1/R2/R3 基线不含 10 段卡号；FHV 规则/原语证据在位', () => {
  const compliance = JSON.parse(readFileSync(path.join(ROOT, 'audit/card-entry-compliance.json'), 'utf8'))
  for (const rule of ['directStateWrite', 'reprintDuplicate', 'playConditionGap']) {
    const overlap = (compliance.baseline?.[rule] || []).filter(code => CODES.includes(code))
    assert.deepEqual(overlap, [], `${rule} 不应含 10 段卡号`)
  }
  for (const relative of [
    'tests/fhv-rules.test.mjs',
    'tests/fhv-player-primitives.test.mjs',
    'docs/campaign/theFeastOfHemlockVale/full-scan.md',
    'docs/campaign/theFeastOfHemlockVale/fix-plan.md',
  ]) assert.equal(existsSync(path.join(ROOT, relative)), true, `${relative} 存在`)
})

// ---------------------------------------------------------------------------
// 缺口卡：10002 / 10003 / 10005b / 10006 / 10007
// ---------------------------------------------------------------------------

test('FHV 10002 Ad Hoc：附属到受控工具/武器；横置弃手牌工具以忽略费用结算其行动', () => {
  assert.equal(e10002.keepOnPlay, true)
  const condition = e10002.playCondition[0]
  assert.equal(condition.when({ inv: { assets: [] } }), false, '没有工具/武器时不能打出')
  assert.equal(condition.when({ inv: { assets: [{ id: 'wrench', code: '10020' }] } }), true, '有工具时可打出')
  const { calls, record } = callRecorder()
  const host = { id: 'wrench', code: '10020' }
  e10002.abilities[0].resolve({ inv: { seat: 0, name: '测试', assets: [host] }, api: {
    choice: request => request.options[0].id,
    cardName: code => ALL_CARDS[code]?.nameZh || code,
    attachPlayerCardToAsset: record('attach'),
    info: () => {},
  } })
  assert.equal(calls[0][0], 'attach')
  assert.equal(calls[0][1], '10002', '附属卡为 10002')
  assert.equal(calls[0][2].id, 'wrench', '附属到工具支援')
  // 反应：横置并弃掉手牌中的工具/武器，忽略费用结算一个 [action] 能力。
  assert.equal(e10002.abilities[1].trigger, 'assetActionResolved')
  const criteria = e10002.abilities[1].criteria[0]
  assert.equal(criteria({ inv: { seat: 0, hand: ['10021'], assets: [] }, source: { exhausted: false, hostAssetId: 'wrench' },
    context: { seat: 0, assetId: 'wrench' }, helpers: { cardType: () => 'asset' } }), true)
})

test('FHV 10003 Hasty Repairs：本人支援行动期间四项基础技能值降为 0', () => {
  assert.equal(e10003.abilities[0].weakness.type, 'threat')
  const inv = { willpower: 4, intellect: 3, combat: 2, agility: 5, assets: [{ id: 'wrench', code: '10020' }] }
  const skillModifier = target => e10003.modifiers.find(modifier => modifier.target === target)
  assert.equal(skillModifier('skill:willpower').amount({ inv }), -4)
  assert.equal(skillModifier('skill:agility').amount({ inv }), -5)
  const inOwnAbility = skillModifier('skill:combat').condition.when({ state: { skillTest: { assetSourceId: 'wrench' } }, inv })
  assert.equal(inOwnAbility, true, '本人支援行动期间生效')
  assert.equal(skillModifier('skill:combat').condition.when({ state: { skillTest: { assetSourceId: 'other' } }, inv }), false, '他人支援行动期间不生效')
})

test('FHV 10005b Flux Stabilizer（开启面）：放置线索到受控支援后下一检定 +2（每窗口一次）', () => {
  assert.deepEqual(e10005b.abilities[0].limit, { scope: 'perWindow', owner: 'instance' })
  assert.equal(e10005b.abilities[0].trigger, 'assetCluesPlaced')
  const { calls, record } = callRecorder()
  const source = { id: 'flux-b', code: '10005b' }
  e10005b.abilities[0].resolve({ inv: { seat: 0 }, source, api: {
    addEffect: record('effect'),
    info: () => {},
  } })
  assert.equal(calls[0][0], 'effect')
  assert.equal(calls[0][1].sourceCode, '10005b')
  assert.deepEqual(calls[0][1].modifiers, [{ target: 'skill:*', amount: 2 }], '下一检定 +2')
})

test('FHV 10006 Aetheric Current（尤格斯星）：攻击搬运支援线索；成功后横置移动非精英敌人并翻回稳定器', () => {
  assert.equal(e10006.playCondition[0].when({ inv: { assets: [{ id: 'flux-b', code: '10005b' }] } }), true)
  assert.equal(e10006.playCondition[0].when({ inv: { assets: [{ id: 'flux', code: '10005' }] } }), false)
  const state = fixture('10004')
  const inv = state.investigators[0]
  inv.assets = [{ id: 'flux-b', code: '10005b' }, { id: 'wrench', code: '10020', clues: 2 }]
  const target = enemy(state, { id: 'e1', health: 4, elite: false, location: inv.location })
  state.locations.push({ id: 'other-side', name: '另一侧', revealed: true, connections: [inv.location], clues: 0, shroud: 1 })
  const { calls, record } = callRecorder()
  e10006.abilities[0].resolve({ state, inv, api: {
    transferControlledClues: (seat, assetId, to, amount) => { calls.push(['transfer', assetId, amount]); return amount },
    choice: request => (request.kind === 'skill' ? 'intellect' : request.options[0].id),
    fight: (seat, enemyId, options) => { calls.push(['fight', enemyId, options.skill]); return { success: true } },
    exhaustEnemy: enemy => calls.push(['exhaust', enemy.id]),
    moveEnemy: (enemy, destination) => calls.push(['move', enemy.id, destination]),
    locName: id => id,
    drawCards: seat => calls.push(['draw', seat]),
    flipAsset: (card, code) => calls.push(['flip', card.id, code]),
    info: () => {},
  } })
  assert.deepEqual(calls[0], ['transfer', 'wrench', 2], '支援上的线索搬回调查员')
  assert.deepEqual(calls[1], ['fight', 'e1', 'intellect'], '可用智识代替战斗')
  assert.deepEqual(calls[2], ['exhaust', 'e1'], '非精英敌人横置')
  assert.ok(calls.some(call => call[0] === 'move'))
  assert.ok(calls.some(call => call[0] === 'draw'))
  assert.ok(calls.some(call => call[0] === 'flip' && call[2] === '10005'), '翻回稳定器关闭面')
})

test('FHV 10007 Aetheric Current（幽嘶）：躲避搬运支援线索；成功后非精英敌人洗回遭遇牌库并翻回稳定器', () => {
  const state = fixture('10004')
  const inv = state.investigators[0]
  inv.assets = [{ id: 'flux-b', code: '10005b' }, { id: 'wrench', code: '10020', clues: 1 }]
  const target = enemy(state, { id: 'e2', health: 3, elite: false, location: inv.location, engagedSeat: 0 })
  const { calls } = callRecorder()
  e10007.abilities[0].resolve({ state, inv, api: {
    transferControlledClues: (seat, assetId, to, amount) => { calls.push(['transfer', assetId, amount]); return amount },
    choice: request => (request.kind === 'skill' ? 'agility' : request.options[0].id),
    evade: (seat, options) => { calls.push(['evade', options.enemyId, options.skill]); return { success: true } },
    removeEnemy: enemy => calls.push(['remove', enemy.id]),
    shuffleIntoEncounterDeck: code => calls.push(['shuffle', code]),
    drawCards: seat => calls.push(['draw', seat]),
    flipAsset: (card, code) => calls.push(['flip', card.id, code]),
    info: () => {},
  } })
  assert.deepEqual(calls[0], ['transfer', 'wrench', 1])
  assert.deepEqual(calls[1], ['evade', 'e2', 'agility'])
  assert.ok(calls.some(call => call[0] === 'remove' && call[1] === 'e2'), '敌人移出场上')
  assert.ok(calls.some(call => call[0] === 'shuffle' && call[1] === 'ghoulMinion'), '按敌人卡号洗回遭遇牌库')
  assert.ok(calls.some(call => call[0] === 'flip' && call[2] === '10005'))
})

// ---------------------------------------------------------------------------
// 10016a/10016b：同一放置窗口只结算一次
// ---------------------------------------------------------------------------

function reactionRepeatProbe(code, harm) {
  const state = fixture('10015')
  const inv = state.investigators[0]
  inv.code = code
  inv.hand = []
  inv.resources = 5
  inv.deck = Array(30).fill('01088')
  const execute = draft => applyHarm(draft, draft.investigators[0], harm.damage || 0, harm.horror || 0, [], false, null, true)
  resolveTransaction(state, 0, { action: 'probe10016' }, execute)
  let offers = 0
  for (let guard = 0; state.pendingChoice && guard < 60; guard += 1) {
    const choice = state.pendingChoice
    if (choice.kind === 'reaction') {
      const trigger = choice.options.find(option => option.id !== 'skip')
      if (trigger) {
        offers += 1
        resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: trigger.id }, execute)
        continue
      }
    }
    const optionId = choice.options.some(option => option.id === 'done') ? 'done'
      : choice.options.some(option => option.id === 'skip') ? 'skip' : choice.options[0]?.id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, execute)
  }
  assert.equal(state.pendingChoice, null)
  return { offers, inv: state.investigators[0] }
}

test('FHV 10016a 汉克坚毅面：恐惧放置后在同一窗口只抽 1 张', () => {
  const { offers, inv } = reactionRepeatProbe('10016a', { horror: 1 })
  assert.equal(offers, 1)
  assert.equal(inv.horror, 1)
  assert.equal(inv.hand.length, 1)
})

test('FHV 10016b 汉克坚毅面：放置 2 点伤害后在同一窗口只获得 2 资源', () => {
  const { offers, inv } = reactionRepeatProbe('10016b', { damage: 2 })
  assert.equal(offers, 1)
  assert.equal(inv.damage, 2)
  assert.equal(inv.resources, 7)
})
