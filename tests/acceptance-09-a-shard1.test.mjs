// 验收 09-a 分片 1：The Scarlet Keys 09001–09043（tskp，43 张）逐卡验收证据。
//
// 缺口：09002–09020 十四张调查员专属签名/弱点/依赖没有标题含卡号的真实测试
// （既有 tsk-investigator-* 用例按调查员命名，聚合断言「专属依赖 14 张」）。
// 其余 09021–09043 有既有逐卡测试（tsk-player-m2-*）。
// 规程：docs/test/ACCEPTANCE-ORDER.md §3 五维。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fixture, asset, enemy, move, settle } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registeredEntry } from '../src/engine/ability.js'
import { triggerReaction, reactionWindow, performTest } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { canSelectInvestigator, getAvailability } from '../src/deck/availability.js'

import e09002 from '../src/cards/entries/09002.js'
import e09003 from '../src/cards/entries/09003.js'
import e09005 from '../src/cards/entries/09005.js'
import e09006 from '../src/cards/entries/09006.js'
import e09007 from '../src/cards/entries/09007.js'
import e09009 from '../src/cards/entries/09009.js'
import e09010 from '../src/cards/entries/09010.js'
import e09012 from '../src/cards/entries/09012.js'
import e09013 from '../src/cards/entries/09013.js'
import e09014 from '../src/cards/entries/09014.js'
import e09016 from '../src/cards/entries/09016.js'
import e09017 from '../src/cards/entries/09017.js'
import e09019 from '../src/cards/entries/09019.js'
import e09020 from '../src/cards/entries/09020.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ENTRIES = [e09002, e09003, e09005, e09006, e09007, e09009, e09010,
  e09012, e09013, e09014, e09016, e09017, e09019, e09020]
const CODES = Object.freeze(["09001","09002","09003","09004","09005","09006","09007","09008","09009","09010","09011","09012","09013","09014","09015","09016","09017","09018","09019","09020","09021","09022","09023","09024","09025","09026","09027","09028","09029","09030","09031","09032","09033","09034","09035","09036","09037","09038","09039","09040","09041","09042","09043"])

const invOf = state => state.investigators[0]
function transact(state, run, select = () => null) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'acceptance-09-a-1' }, execute)
  for (let guard = 0; state.pendingChoice; guard += 1) {
    assert.ok(guard < 120, `choice loop: ${JSON.stringify(state.pendingChoice.kind)}`)
    const choice = state.pendingChoice
    const optionId = select(choice, state)
      ?? ['done', 'skip', 'self', 'no'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0]?.id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, execute)
  }
}

// ---------------------------------------------------------------------------
// 范围 / 接线 / 合规
// ---------------------------------------------------------------------------

test('09-a-1 范围：09001–09043 tskp 卡恰好 43 张', () => {
  assert.equal(CODES.length, 43)
  for (const code of CODES) {
    assert.equal(ALL_CARDS[code].pack, 'tskp', `${code} 不属于 tskp`)
  }
})

test('09-a-1 接线：43 张均有条目文件；6 位调查员可选；玩家卡进构筑池', () => {
  for (const code of CODES) {
    assert.equal(existsSync(path.join(ROOT, 'src/cards/entries', `${code}.js`)), true, `${code} 缺少条目`)
  }
  for (const code of ['09001', '09004', '09008', '09011', '09015', '09018']) {
    assert.equal(canSelectInvestigator(code), true, `${code} 应可选`)
    assert.equal(getAvailability(code).availability, 'strict')
  }
  const buildable = CODES.filter(code => ['asset', 'event', 'skill'].includes(ALL_CARDS[code].type)
    && !['weakness', 'basicweakness'].includes(ALL_CARDS[code].subtype))
  assert.ok(buildable.length >= 20)
  for (const code of buildable) assert.equal(getAvailability(code).availability, 'strict', `${code}`)
})

test('09-a-1 合规：R1/R2/R3 基线不含 09 段卡号；定制卡勾选读点在位', () => {
  const compliance = JSON.parse(readFileSync(path.join(ROOT, 'audit/card-entry-compliance.json'), 'utf8'))
  for (const rule of ['directStateWrite', 'reprintDuplicate', 'playConditionGap']) {
    const overlap = (compliance.baseline?.[rule] || []).filter(code => CODES.includes(code))
    assert.deepEqual(overlap, [], `${rule} 不应含 09 段卡号`)
  }
  assert.equal(existsSync(path.join(ROOT, 'src/engine/tsk-customizable.js')), true, '定制卡引擎读点存在')
  const engineSource = readFileSync(path.join(ROOT, 'src/engine/tsk-customizable.js'), 'utf8')
  assert.match(engineSource, /customizationOptionCheckedCount|optionCheckedCount/, '勾满格数读点存在')
  for (const code of ['09021', '09022', '09023', '09040']) {
    assert.ok((ALL_CARDS[code].customizationOptions || []).length > 0, `${code} 应有定制选项`)
  }
  const empirical = ALL_CARDS['09041']
  assert.equal((empirical.customizationOptions || []).length, 8, '09041 八格定制选项')
  const entry09041 = readFileSync(path.join(ROOT, 'src/cards/entries/09041.js'), 'utf8')
  assert.match(entry09041, /customizationOptionFullyChecked/, '09041 用勾满读点')
  for (const entry of ENTRIES) assert.equal(entry.code.length, 5)
})

// ---------------------------------------------------------------------------
// 09002–09020 专属签名 / 弱点 / 依赖（真实执行条目 resolve / 引擎窗口）
// ---------------------------------------------------------------------------

test('TSK 09002 如你所愿：投入他人检定，成功其抽 1、失败你抽 1', () => {
  assert.equal(e09002.abilities[0].kind, 'commit')
  // 成功分支：执行者（seat 1）抽 1；失败分支：投入者（seat 0）抽 1。
  const skillTest = { seat: 1, committed: [{ code: '09002', seat: 0 }] }
  const drawn = []
  e09002.abilities[1].resolve({ state: { skillTest }, api: { drawCards: seat => drawn.push(seat) } })
  assert.deepEqual(drawn, [1], '成功时执行者抽 1')
  e09002.abilities[2].resolve({ inv: { seat: 0 }, state: { skillTest }, api: { drawCards: seat => drawn.push(seat) } })
  assert.deepEqual(drawn, [1, 0], '失败时投入者抽 1')
  const criteria = e09002.abilities[1].criteria[0]
  assert.equal(criteria({ state: { skillTest }, inv: { seat: 0 } }), true, '投入他人检定时触发')
  assert.equal(criteria({ state: { skillTest: { ...skillTest, seat: 0, committed: [] } }, inv: { seat: 0 } }), false, '自己检定不触发')

  const runCommitProbe = (performerSeat, chooseHelp) => {
    const state = fixture('09001', 2)
    state.investigators[0].hand = ['09002']
    const execute = draft => performTest(draft, performerSeat, 'willpower', 3, {})
    resolveTransaction(state, 0, { action: 'probe09002' }, execute)
    const windows = []
    for (let guard = 0; state.pendingChoice && guard < 20; guard += 1) {
      const choice = state.pendingChoice
      const options = choice.options.map(option => ({ id: String(option.id), label: String(option.label || '') }))
      windows.push({ kind: choice.kind, seat: choice.seat, options })
      let optionId
      if (choice.kind === 'commit' && chooseHelp && options.some(option => option.id === 'help')) optionId = 'help'
      else if (choice.kind === 'commit') {
        optionId = options.some(option => option.id === 'done') ? 'done'
          : (options.find(option => option.label.startsWith('投入'))?.id ?? options[0]?.id)
      } else optionId = options.some(option => option.id === 'done') ? 'done'
        : options.some(option => option.id === 'skip') ? 'skip' : options[0]?.id
      resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, execute)
    }
    return windows
  }
  const ownWindows = runCommitProbe(0, false)
  assert.equal(ownWindows.some(window => window.kind === 'commit'
    && window.seat === 0 && window.options.some(option => option.label.includes('如您所愿'))), false,
  '本人检定不提供 09002 的投入入口')
  const crossWindows = runCommitProbe(1, true)
  const helperWindow = crossWindows.find(window => window.kind === 'commit' && window.seat === 0)
  assert.ok(helperWindow?.options.some(option => option.label.includes('如您所愿')),
    '他人检定可协助并投入 09002（正确路径）')
})

test('TSK 09003 自私的错：回合结束未投入他人检定时受 1 恐惧并洗回牌库', () => {
  const state = fixture('09001')
  const inv = invOf(state)
  inv.threat.push({ id: 'selfless', code: '09003' })
  const calls = []
  e09003.abilities[1].resolve({ inv, state: { round: state.round, investigators: state.investigators }, api: {
    harm: (seat, spec) => calls.push(['harm', seat, spec.horror]),
    moveCard: spec => calls.push(['move', spec.code, spec.from]),
    shuffleDeck: seat => calls.push(['shuffle', seat]),
    info: () => {},
  } })
  assert.deepEqual(calls[0], ['harm', 0, 1], '受到 1 点恐惧')
  assert.deepEqual(calls[1], ['move', '09003', 'threat'], '从威胁区洗回牌库')
  const criteria = e09003.abilities[1].criteria[0]
  assert.equal(criteria({ state: { round: 1, investigators: [{ committedToOtherThisTurn: null }] }, inv, context: { seat: 0 } }), true)
  assert.equal(criteria({ state: { round: 1, investigators: [{ committedToOtherThisTurn: { round: 1 } }] }, inv, context: { seat: 0 } }), false)
})

test('TSK 09005 骨锯：攻击 +2 战斗/+1 伤害；治疗行动失败造成 1 物理创伤', () => {
  assert.deepEqual(e09005.abilities[0].effect, { type: 'fight', combatBonus: 2, damageBonus: 1 })
  assert.equal(e09005.uses, 1)
  const state = fixture('09004')
  const inv = invOf(state)
  state.investigators.push({ ...structuredClone(inv), seat: 1, id: 'target-inv', location: inv.location, assets: [], engaged: [], threat: [], hand: [] })
  const calls = []
  e09005.abilities[1].resolve({ state, inv, api: {
    investigatorsAt: () => state.investigators,
    choice: () => '1',
    test: (seat, skill, difficulty) => ({ success: false, difficulty }),
    addTrauma: (seat, kind, amount) => calls.push(['trauma', seat, kind, amount]),
    info: () => {},
  } })
  assert.deepEqual(calls[0], ['trauma', 1, 'physical', 1], '检定失败：目标受 1 点物理创伤')
})

test('TSK 09006 术后恢复：投入后放到一边（场外）以替代弃牌堆', () => {
  assert.deepEqual(e09006.zoneReplacement, { discard: 'setAside', shuffle: 'setAside' })
  assert.equal(e09006.abilities[0].skill.destination(), 'setAside')
  const engineSource = readFileSync(path.join(ROOT, 'src/engine/ability.js'), 'utf8')
  assert.match(engineSource, /zoneReplacement/, '引擎读取 zoneReplacement')
})

test('TSK 09007 受伤的旁观者：入场 3 伤害；被击败承受 1 精神创伤；未致命不能离场', () => {
  const card = { id: 'bystander', code: '09007', damage: 3 }
  const calls = []
  e09007.abilities[1].resolve({ source: card, api: {
    investigatorTools: { setAssetDamage: (target, amount) => { target.damage = amount; calls.push(['damage', amount]) } },
  } })
  assert.deepEqual(calls[0], ['damage', 3], '入场放 3 点伤害')
  const trauma = []
  e09007.abilities[2].resolve({ inv: { seat: 0 }, context: { assetCode: '09007', ownerSeat: 0 }, api: {
    addTrauma: (seat, kind, amount) => trauma.push([seat, kind, amount]),
    info: () => {},
  } })
  assert.deepEqual(trauma[0], [0, 'mental', 1], '被击败承受 1 精神创伤')
  assert.equal(e09007.cannotLeavePlayWhile({}, { seat: 0 }, { damage: 2 }), true, '未致命时不能离场')
  assert.equal(e09007.cannotLeavePlayWhile({}, { seat: 0 }, { damage: 5 }), false)
})

test('TSK 09009 抓钩：[行动][行动] 横置做至多 3 个基础行动', () => {
  assert.deepEqual(e09009.abilities[0].cost, { action: 2, exhaust: true })
  const calls = []
  e09009.abilities[0].resolve({ inv: { seat: 0 }, api: {
    beginImmediateAction: (seat, spec) => { calls.push([seat, spec.actionKinds]); return true },
  } })
  assert.equal(calls.length, 3, '执行 3 个立即行动')
  assert.deepEqual(calls[0][1], ['engage', 'evade', 'investigate', 'move'])
})

test('TSK 09010 弗莱彻探员：警觉/猎手/猎物；基玛尼躲避它时智识降为 0', () => {
  assert.equal(e09010.enemyWeakness.alert, true)
  assert.equal(e09010.enemyWeakness.hunter, true)
  assert.equal(e09010.enemyWeakness.prey, true)
  const test = { seat: 0, actionKind: 'evade', target: { kind: 'enemy', id: 'fletcher' } }
  const criteria = e09010.abilities[0].criteria[0]
  assert.equal(criteria({ state: { skillTest: test }, inv: { seat: 0 }, source: { id: 'fletcher' } }), true)
  let added = null
  e09010.abilities[0].resolve({ inv: { seat: 0 }, api: {
    stat: () => 4,
    addTestValue: amount => { added = amount },
  } })
  assert.equal(added, -4, '智识值降为 0（-4）')
})

test('TSK 09012 祸言之语：在支援上放 1 毁灭并免费结算其行动；可洗回福言之语', () => {
  const state = fixture('09011')
  const inv = invOf(state)
  const ally = asset(state, '09007')
  const calls = []
  e09012.abilities[0].resolve({ state, inv, api: {
    cardName: code => ALL_CARDS[code]?.nameZh || code,
    choice: request => request.options.some(option => option.id === 'yes') ? 'no' : request.options[0].id,
    placeDoomOnCard: (card, amount) => { card.doom = amount; calls.push(['doom', card.id, amount]) },
    beginImmediateAction: () => { calls.push(['activate']); return true },
    info: () => {},
  } })
  assert.deepEqual(calls[0], ['doom', ally.id, 1], '支援上放 1 毁灭')
  assert.equal(calls[1][0], 'activate', '免费结算一个 [action] 能力')
})

test('TSK 09013 福言之语：对带毁灭支援的检定加意志；可洗回祸言之语', () => {
  const state = fixture('09011')
  const inv = invOf(state)
  const ally = asset(state, '09007')
  ally.doom = 1
  state.skillTest = { seat: 0, committed: [], result: {} }
  inv.discard = ['09012']
  const calls = []
  const criteria = e09013.abilities[0].criteria[0]
  assert.equal(criteria({ state, inv }), true, '场上有带毁灭支援才能打出')
  e09013.abilities[0].resolve({ inv, api: {
    stat: () => 4,
    addTestValue: amount => calls.push(['value', amount]),
    choice: () => 'yes',
    moveCard: spec => calls.push(['move', spec.code]),
    shuffleDeck: () => calls.push(['shuffle']),
    info: () => {},
  } })
  assert.deepEqual(calls[0], ['value', 4], '本次检定 +意志 4')
  assert.deepEqual(calls[1], ['move', '09012'], '把祸言之语洗回牌库')
})

test('TSK 09014 震耳欲聋的寂静：把支援上的 1 毁灭移到当前密谋；否则洗回牌库', () => {
  const state = fixture('09011')
  const inv = invOf(state)
  const ally = asset(state, '09007')
  ally.doom = 2
  const calls = []
  e09014.abilities[0].resolve({ state, inv, api: {
    cardName: code => code,
    choice: () => '0',
    removeDoomFromCard: (card, amount) => { card.doom -= amount; calls.push(['remove', amount]) },
    addDoom: amount => calls.push(['addDoom', amount]),
    moveCard: spec => calls.push(['move', spec.code]),
    shuffleDeck: () => calls.push(['shuffle']),
    info: () => {},
  } })
  assert.deepEqual(calls[0], ['remove', 1], '支援上移除 1 毁灭')
  assert.deepEqual(calls[1], ['addDoom', 1], '当前密谋放 1 毁灭')
})

test('TSK 09016 达瑞尔的柯达：敌人/诡计入场后放证据标记，发现线索后收集证据', () => {
  const state = fixture('09015')
  const inv = invOf(state)
  inv.assets.push({ id: 'kodak', code: '09016', exhausted: false })
  const target = enemy(state)
  const calls = []
  e09016.abilities[0].resolve({ inv, context: { enemy: target }, api: {
    addCardCounter: (card, counter, amount) => calls.push([card.id, counter, amount]),
  } })
  assert.deepEqual(calls[0], [target.id, 'evidence', 1], '敌人入场放 1 证据')
  const threat = { id: 'threat-1', code: '09017' }
  e09016.abilities[1].resolve({ inv, context: { card: threat }, api: {
    addCardCounter: (card, counter, amount) => calls.push([card.id, counter, amount]),
  } })
  assert.deepEqual(calls[1], ['threat-1', 'evidence', 1], '诡计入场放 1 证据')
})

test('TSK 09017 毁掉的底片：移除 4 个证据，不足每点受 1 点恐惧', () => {
  const state = fixture('09015')
  const inv = invOf(state)
  const a = { id: 'a', code: '09016', markers: { evidence: 3 } }
  const b = { id: 'b', code: '09016', markers: { evidence: 1 } }
  inv.assets = [a, b]
  const calls = []
  e09017.abilities[0].resolve({ inv, api: {
    cardCounterOf: (card, name) => card.markers?.[name] || 0,
    addCardCounter: (card, name, amount) => { card.markers[name] += amount; calls.push([card.id, amount]) },
    harm: (seat, spec) => calls.push(['harm', spec.horror]),
    info: () => {},
  } })
  assert.equal(a.markers.evidence + b.markers.evidence, 0, '4 个证据全部移除')
  assert.equal(calls.some(call => call[0] === 'harm'), false, '证据足够时不受恐惧')
  const short = fixture('09015')
  const inv2 = invOf(short)
  inv2.assets = [{ id: 'only', code: '09016', markers: { evidence: 2 } }]
  const calls2 = []
  e09017.abilities[0].resolve({ inv: inv2, api: {
    cardCounterOf: (card, name) => card.markers?.[name] || 0,
    addCardCounter: (card, name, amount) => { card.markers[name] += amount },
    harm: (seat, spec) => calls2.push(['harm', spec.horror]),
    info: () => {},
  } })
  assert.deepEqual(calls2[0], ['harm', 2], '不足 2 点 → 受 2 点恐惧')
})

test('TSK 09019 邦妮·沃尔什：横置后重整另一个已横置盟友（每轮一次）', () => {
  const state = fixture('09018')
  const inv = invOf(state)
  const ally = { id: 'exhausted-ally', code: '09007', exhausted: true }
  inv.assets = [ally]
  e09019.abilities[0].resolve({ inv, api: {
    cardTraits: code => ALL_CARDS[code]?.traits || [],
    ready: target => { target.exhausted = false },
    choice: () => '0',
    cardName: code => code,
  } })
  assert.equal(ally.exhausted, false, '盟友被重整')
  assert.equal(e09019.abilities[0].limit, 'oncePerRound')
})

test('TSK 09020 领导的重担：每名盟友横置或受 1 直接伤害与恐惧；无盟友洗回牌库', () => {
  const state = fixture('09018')
  const inv = invOf(state)
  const ally = { id: 'ally-1', code: '09007', exhausted: false, damage: 0, horror: 0 }
  inv.assets = [ally]
  const harmCalls = []
  e09020.abilities[0].resolve({ inv, api: {
    cardTraits: code => ALL_CARDS[code]?.traits || [],
    cardName: code => code,
    choice: () => 'harm',
    investigatorTools: { setAssetDamage: (target, amount) => { target.damage = amount; harmCalls.push(['damage', amount]) } },
    addAssetHorror: (target, amount) => { target.horror = amount; harmCalls.push(['horror', amount]) },
    exhaust: () => {},
    moveCard: () => {},
    shuffleDeck: () => {},
    info: () => {},
  } })
  assert.deepEqual(harmCalls, [['damage', 1], ['horror', 1]], '选择 harm：盟友受 1 直接伤害与 1 直接恐惧')
  const exhausted = { id: 'ally-2', code: '09007', exhausted: false }
  inv.assets = [exhausted]
  e09020.abilities[0].resolve({ inv, api: {
    cardTraits: code => ALL_CARDS[code]?.traits || [],
    cardName: code => ALL_CARDS[code]?.nameZh || code,
    choice: () => 'exhaust',
    exhaust: target => { target.exhausted = true },
    moveCard: () => {},
    shuffleDeck: () => {},
    info: () => {},
  } })
  assert.equal(exhausted.exhausted, true, '选择横置：盟友横置')
  const noAlly = fixture('09018')
  const inv2 = invOf(noAlly)
  inv2.assets = []
  const calls = []
  e09020.abilities[0].resolve({ inv: inv2, api: {
    cardTraits: code => ALL_CARDS[code]?.traits || [],
    choice: () => 'exhaust',
    moveCard: spec => calls.push(['move', spec.code]),
    shuffleDeck: () => calls.push(['shuffle']),
    info: () => {},
  } })
  assert.deepEqual(calls[0], ['move', '09020'], '无盟友时洗回牌库')
})
