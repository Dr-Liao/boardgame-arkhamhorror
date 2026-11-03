// P7 暗潮之下（intoTheMaelstrom）议程 07313/07314：
//   · 07313 天体阵列：推进（翻背面）时把沉睡的海德拉/达贡翻至苏醒面；
//   · 07314 洪水：正面在每个阶段开始时把沉睡的古神翻至苏醒面；推进时直接进入结局 8。
//
// 事务约定同 tic-maelstrom-bosses：事务后按 id 重新取实例；剧本结束的 ScenarioEnded 必须在
// execute 内部捕获，事务才会提交（与 tests/tic-chapter-resolutions.test.mjs 同一写法）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { advanceAgenda, phaseBeginningWindow, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registeredEntry } from '../src/engine/ability.js'

function transaction(s, execute, select = () => null) {
  resolveTransaction(s, 0, { action: 'testTicMaelstromAgenda' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 80, 'choice loop')
    const choice = s.pendingChoice
    const id = select(choice, s) ?? ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}
const faceOf = enemy => enemy?.originalCode || enemy?.code
const spawn = (s, code) => scenarioRuntime(s, []).spawn(code, s.investigators[0].location)
const bossIn = (s, id) => s.enemies.find(item => item.id === id)

function maelstromFixture(count = 1) {
  const s = chapterFixture('intoTheMaelstrom', count)
  s.enemies = []
  return s
}

test('07313 天体阵列：推进到背面时把在场的沉睡达贡/海德拉翻至苏醒面', () => {
  const s = maelstromFixture()
  const dagon = spawn(s, '07330a')
  const hydra = spawn(s, '07331a')
  s.agendaIndex = 1
  transaction(s, draft => advanceAgenda(draft, []))
  assert.equal(faceOf(bossIn(s, dagon.id)), '07330b', '达贡翻至苏醒狂怒面')
  assert.equal(faceOf(bossIn(s, hydra.id)), '07331b', '海德拉翻至苏醒狂怒面')
  assert.equal(s.enemies.length, 2, '物理换面不产生第二个敌人')
  assert.equal(s.agendaIndex, 2, '推进后进入 07314')
})

test('07313 天体阵列：已苏醒的面不重复翻，未在场的不报错', () => {
  const s = maelstromFixture()
  const dagon = spawn(s, '07330b')
  s.agendaIndex = 1
  transaction(s, draft => advanceAgenda(draft, []))
  assert.equal(faceOf(bossIn(s, dagon.id)), '07330b')
  assert.equal(s.enemies.length, 1)
})

test('07314 洪水：每个阶段开始时把沉睡的古神翻至苏醒面', () => {
  const s = maelstromFixture()
  const dagon = spawn(s, '07330a')
  const hydra = spawn(s, '07331a')
  s.agendaIndex = 2
  s.phase = 'investigation'
  transaction(s, draft => phaseBeginningWindow(draft, []))
  assert.equal(faceOf(bossIn(s, dagon.id)), '07330b')
  assert.equal(faceOf(bossIn(s, hydra.id)), '07331b')
  // 幂等：第二次进入阶段开始不换面、不报错。
  transaction(s, draft => phaseBeginningWindow(draft, []))
  assert.equal(faceOf(bossIn(s, dagon.id)), '07330b')
  assert.equal(s.enemies.length, 2)
})

test('07314 洪水：推进到背面（→R8）结算结局 8', () => {
  const s = maelstromFixture()
  spawn(s, '07330a')
  s.agendaIndex = 2
  transaction(s, draft => {
    try { advanceAgenda(draft, []) } catch (error) {
      if (error.constructor.name !== 'ScenarioEnded') throw error
    }
  })
  const result = s.campaign.scenarioResults.at(-1)
  assert.ok(result, '剧本结局已记录')
  assert.equal(result.resolution, 'resolution8')
  assert.equal(s.campaign.failed, true, 'R8 是洪水灭世结局')
})

test('07313/07314 条目注册：议程规则带 onReveal，07314 另有 phaseBegan', () => {
  assert.equal(typeof registeredEntry('07313').agendaRule.onReveal, 'function')
  assert.equal(typeof registeredEntry('07314').agendaRule.onReveal, 'function')
  assert.equal(typeof registeredEntry('07314').agendaRule.phaseBegan, 'function')
  assert.equal(registeredEntry('07313').implemented, true)
  assert.equal(registeredEntry('07314').implemented, true)
})

test('advanceAgendaTo：跳过当前密谋背面、保留场上毁灭、直接换到目标议程正面', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.enemies = []
  s.agendaIndex = 0
  s.doom = 3
  let jumped = false
  transaction(s, draft => { jumped = scenarioRuntime(draft, []).advanceAgendaTo(1) })
  assert.equal(jumped, true)
  assert.equal(s.agendaIndex, 1, '议程指针直接到目标')
  assert.equal(s.agendas[s.agendaIndex].originalCode, '07313')
  assert.equal(Number(s.doom) || 0, 3, '跳过背面不清场上的毁灭')
  // 正常推进仍按既有语义清毁灭并推进。
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.agendaIndex, 2)
  assert.equal(Number(s.doom) || 0, 0, '正常推进照旧清毁灭')
})
