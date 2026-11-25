// 07-a 分片 8（《暗潮之下》itm 07301–07338）新增验收证据。
//
// 覆盖目标：
//   1. 07333/07334 达贡之子 / 海德拉之子：真实遭遇抽取的「更远生成点」与交战后强制选择的接线；
//   2. 07315 回到深海：目标成立时引擎自动推进——锁定卡面「你可以选择推进」缺少玩家选择（缺口记录）。
//
// 其余 38 张卡的标题级证据在既有 TIC 测试文件（tic-maelstrom-*、tic-parallel-acts、
// tic-slumbering-bosses、tic-scenarios-late/a1、tic-late-b-cards、tic-w2-new-cards、
// tic-scenario-intoTheMaelstrom、tic-player-*）中，本文件只补缺失与缺口。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import {
  checkAct, drawEncounter, engageEnemy, scenarioRuntime,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registeredEntry } from '../src/engine/ability.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'

const codeOf = entity => entity?.originalCode || entity?.code
const locationByCode = (state, code) => state.locations.find(location => codeOf(location) === code)

function transaction(state, execute, select = () => null) {
  resolveTransaction(state, 0, { action: 'testAcceptance07a8' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 100, `choice loop ${state.pendingChoice.source}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0].id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}

function placePrinted(state, code) {
  const existing = locationByCode(state, code)
  if (existing) return existing
  const definition = Object.entries(state.scenario.locations)
    .find(([, location]) => codeOf(location) === code)
  assert.ok(definition, `关卡没有 ${code} 的物理定义`)
  scenarioRuntime(state, []).place(definition[0])
  const placed = locationByCode(state, code)
  assert.ok(placed, `${code} 未能入场`)
  return placed
}

function connectChain(state, _unused, locations) {
  const map = createMechanicsApi(state).map
  for (let index = 0; index + 1 < locations.length; index += 1) map.connect(locations[index].id, locations[index + 1].id)
  return locations
}

function giveKeys(state, seat = 0, colors = ['blue', 'red', 'yellow', 'green']) {
  const api = createMechanicsApi(state)
  for (const color of colors) {
    const key = state.scenarioFlags.mechanics.keys?.[color]
    assert.ok(key, `没有初始化 ${color} 钥匙`)
    assert.equal(api.keys.transfer(color, key.holder, `investigator:${seat}`, { reveal: true }), true, `转移 ${color} 钥匙`)
  }
}

// --- 07333 / 07334：生成点 + 交战强制 ------------------------------------------------

function spawnFarthestTest(code, lairCode) {
  return () => {
    const state = chapterFixture('intoTheMaelstrom', 2)
    state.humanSeats = [0, 1]
    state.enemies = []
    for (const inv of state.investigators) { inv.assets = []; inv.engaged = [] }
    const gateway = locationByCode(state, '07320')
    const lair = placePrinted(state, lairCode)
    const middle = state.locations.find(location => ![gateway.id, lair.id].includes(location.id))
    assert.ok(middle, '存在第三个已入场地点作为中间连接点')
    for (const location of state.locations) location.connections = []
    connectChain(state, null, [gateway, middle, lair])
    state.investigators[0].location = lair.id
    state.investigators[1].location = gateway.id
    state.encounterDeck = [code]
    transaction(state, draft => drawEncounter(draft, draft.investigators[1], []))
    const brood = state.enemies.find(enemy => codeOf(enemy) === code)
    assert.ok(brood, `${code} 从遭遇牌库抽取后生成`)
    assert.equal(brood.location, lair.id, `生成在离抽牌者更远的${lairCode}（不是门扉）`)
    assert.equal(state.encounterDiscard.includes(code), false, '已生成的敌人不进遭遇弃牌堆')
    assert.equal(state.enemies.filter(enemy => codeOf(enemy) === code).length, 1, '只有一张物理实例')
  }
}

function forcedChoiceTest(code, lairCode, parentSleeping, parentAwake) {
  return () => {
    const setup = () => {
      const state = chapterFixture('intoTheMaelstrom', 1)
      state.humanSeats = [0]
      state.enemies = []
      for (const other of state.investigators) { other.assets = []; other.engaged = [] }
      const lair = placePrinted(state, lairCode)
      const elsewhere = state.locations.find(location => location.id !== lair.id)
      return { state, lair, elsewhere }
    }
    // 沉睡古神：不能攻击 → 只能放毁灭。
    {
      const { state, lair, elsewhere } = setup()
      state.investigators[0].location = elsewhere.id
      assert.ok(scenarioRuntime(state, []).spawn(parentSleeping, lair.id), '沉睡古神生成')
      assert.ok(scenarioRuntime(state, []).spawn(code, lair.id), `${code} 生成`)
      state.investigators[0].location = lair.id
      const doomBefore = state.enemies.find(enemy => codeOf(enemy) === parentSleeping).doom || 0
      transaction(state, draft => engageEnemy(draft, draft.enemies.find(enemy => codeOf(enemy) === code), 0, []))
      const sleepingAfter = state.enemies.find(enemy => codeOf(enemy) === parentSleeping)
      assert.equal((sleepingAfter.doom || 0), doomBefore + 1, '沉睡古神不能攻击 → 强制只能放 1 毁灭')
    }
    // 苏醒古神：给出「放毁灭 / 古神攻击」两选一，选攻击时调查员承受攻击。
    {
      const { state, lair, elsewhere } = setup()
      state.investigators[0].location = elsewhere.id
      assert.ok(scenarioRuntime(state, []).spawn(parentAwake, lair.id), '苏醒古神生成')
      assert.ok(scenarioRuntime(state, []).spawn(code, lair.id), `${code} 生成`)
      state.investigators[0].location = lair.id
      const damageBefore = state.investigators[0].damage + state.investigators[0].horror
      transaction(state, draft => engageEnemy(draft, draft.enemies.find(enemy => codeOf(enemy) === code), 0, []),
        () => 'attack')
      const invAfter = state.investigators[0]
      assert.ok(invAfter.damage + invAfter.horror > damageBefore, '选择「古神攻击」后调查员承受伤害/恐惧')
    }
  }
}

test('07333 达贡之子：真实遭遇抽取在「达贡巢穴 / 门扉」中选离抽牌者更远的生成点',
  spawnFarthestTest('07333', '07328'))
test('07334 海德拉之子：真实遭遇抽取在「海德拉巢穴 / 门扉」中选离抽牌者更远的生成点',
  spawnFarthestTest('07334', '07329'))
test('07333 达贡之子：交战强制在「达贡放毁灭」与「达贡攻击」间选择（沉睡时只能放毁灭）',
  forcedChoiceTest('07333', '07328', '07330a', '07330b'))
test('07334 海德拉之子：交战强制在「海德拉放毁灭」与「海德拉攻击」间选择（沉睡时只能放毁灭）',
  forcedChoiceTest('07334', '07329', '07331a', '07331b'))

// --- 07315：「你可以选择推进」的玩家选择缺失（缺口记录） ------------------------------

test('07315 回到深海：目标成立时 checkAct 自动推进，卡面「你可以选择推进」没有玩家选择（缺口）', () => {
  const state = chapterFixture('intoTheMaelstrom', 1)
  state.humanSeats = [0]
  state.enemies = []
  giveKeys(state, 0)
  assert.equal(registeredEntry('07315').actRule.objective(state, state.acts[state.actIndex]), true,
    '全员门扉 + 四色钥匙时目标成立')
  assert.equal(state.actIndex, 0)
  let asked = 0
  transaction(state, draft => checkAct(draft, []), () => { asked += 1; return null })
  assert.equal(asked, 0, '引擎没有为「是否推进」询问玩家（缺口证据）')
  assert.equal(state.actIndex, 1, '目标成立后直接自动推进到幕 2')
  assert.equal(codeOf(state.acts[state.actIndex]), '07316')
})
