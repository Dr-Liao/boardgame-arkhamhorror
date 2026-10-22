// 卡牌保真度 P1/P2 回归：机制读点（地点进入/离开限制、窗口通道）与双实现收敛。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset, enemy, move, settle } from './core-fixture.mjs'
import { investigatorEntryError, movementError, getStat, legalMoves } from '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { nonPlayerEntryFor } from '../src/cards/encounter-abilities.js'
import { encounterRules } from '../content/campaigns/theDunwichLegacy/encounter-rules.js'
import { laterBehavior } from '../content/campaigns/theDunwichLegacy/later-behaviors.js'

function lockedLocation(state, code, revealed = false) {
  const here = state.locations.find(location => location.id === state.investigators[0].location)
  const location = { id: `locked-${code}`, name: '上锁的地点', originalCode: code, code,
    revealed, clues: 0, maxClues: 0, shroud: 2, connections: [here.id] }
  state.locations.push(location)
  here.connections.push(location.id)
  return location
}

// ---------------------------------------------------------------------------
// P1：地点的未揭示面「门锁住了，你不能移动进入」。
// ---------------------------------------------------------------------------
for (const code of ['02052', '02054', '02055', '02057']) {
  test(`${code}：未揭示时不能移动进入，揭示后解除`, () => {
    const state = fixture()
    const location = lockedLocation(state, code, false)
    assert.match(investigatorEntryError(state, location.id), /锁住了/)
    location.revealed = true
    assert.equal(investigatorEntryError(state, location.id), null)
  })
}

test('02052：移动列表里不出现上锁宿舍的移动，揭示后出现', () => {
  const state = fixture()
  const location = lockedLocation(state, '02052', false)
  const moves = legalMoves(state, 0)
  assert.equal(moves.some(item => item.action === 'move' && item.locationId === location.id), false)
  location.revealed = true
  assert.ok(legalMoves(state, 0).some(item => item.action === 'move' && item.locationId === location.id))
})

for (const code of ['03172', '03176', '03177']) {
  test(`${code}：幕 1 不能进入未揭示地点，幕 2 起忽略未揭示面文字`, () => {
    const state = fixture()
    state.scenario = { ...state.scenario, id: 'theUnspeakableOath' }
    const location = lockedLocation(state, code, false)
    state.actIndex = 0
    assert.match(investigatorEntryError(state, location.id), /锁住了/)
    state.actIndex = 1
    assert.equal(investigatorEntryError(state, location.id), null)
    state.actIndex = 0
    location.revealed = true
    assert.equal(investigatorEntryError(state, location.id), null)
  })
}

test('03256 堵塞通道：本轮不能离开，下一轮解除', () => {
  const state = fixture()
  const here = state.locations.find(location => location.id === state.investigators[0].location)
  here.cannotLeaveRound = state.round
  assert.match(movementError(state, state.investigators[0]), /不能离开/)
  state.round += 1
  assert.equal(movementError(state, state.investigators[0]), null)
})

// ---------------------------------------------------------------------------
// P2：双实现收敛（每条规则只剩一个结算点）。
// ---------------------------------------------------------------------------
test('02040 亨利·阿米蒂奇：旧 cardDrawn 钩子不再重复询问', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.assets = [asset(state, '02040')]
  let asked = 0
  encounterRules.cardDrawn(state, inv, '01088', { choose: () => { asked++; return 'trigger' } })
  assert.equal(asked, 0, '旧钩子不再询问；行为只在 entries/02040.js 的 cardDrawn 描述子里')
  const reaction = registeredEntry('02040').abilities.find(ability => ability.kind === 'reaction')
  assert.deepEqual(reaction.trigger, ['cardDrawn'])
})

test('02061 / 02080：印刷 +1 只计一次（条目 modifiers 是唯一来源）', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  const baseIntellect = getStat(state, inv, 'intellect')
  const baseCombat = getStat(state, inv, 'combat')
  asset(state, '02061')
  asset(state, '02080')
  assert.equal(getStat(state, inv, 'intellect'), baseIntellect + 1)
  assert.equal(getStat(state, inv, 'combat'), baseCombat + 1)
  // 旧剧本钩子不再叠加第二次（空过滤得到 -0，归一为 0）。
  assert.equal(Math.abs(encounterRules.statModifier(state, inv)), 0)
})

test('02140 死灵之书：获得 2 资源的行动只在条目上出现一次', () => {
  const state = fixture()
  const inv = state.investigators[0]
  asset(state, '02140')
  const museum = laterBehavior('theMiskatonicMuseum')
  assert.equal(museum.actions(state, inv).some(action => action.rule === 'necronomiconResource'), false,
    '剧本 actions() 不再提供第二份死灵之书能力')
  const action = registeredEntry('02140').abilities.find(ability => ability.kind === 'action')
  assert.ok(action, '条目仍有 [action]：获得 2 资源')
  assert.equal(getStat(state, inv, 'intellect'), getStat(state, inv, 'intellect'))
})

test('03067b 石丸春子：非攻击伤害后抽遭遇牌，攻击伤害不触发', () => {
  const script = nonPlayerEntryFor('03067b').enemyScript
  const drawn = []
  const api = { drawEncounter: seat => drawn.push(seat) }
  script.onDamaged({ skillTest: null }, { id: 'e1' }, api, 0)
  assert.deepEqual(drawn, [0], '非攻击效果造成伤害后抽 1 张遭遇牌')
  drawn.length = 0
  script.onDamaged({ skillTest: { source: { enemyId: 'e1' } } }, { id: 'e1' }, api, 0)
  assert.deepEqual(drawn, [], '攻击造成的伤害不触发')
})

test('01522 / 01523 / 05025：快速事件走「手牌反应」通道，且各自声明正确窗口', () => {
  for (const [code, trigger] of [['01522', 'defeatEnemy'], ['01523', 'enemyAttack'], ['05025', 'clueDiscovered']]) {
    const reaction = registeredEntry(code).abilities.find(ability => ability.kind === 'reaction')
    assert.ok(reaction, `${code} 必须有 reaction 描述子`)
    assert.equal(reaction.fromHand, true)
    assert.deepEqual(reaction.trigger, [trigger])
  }
})
