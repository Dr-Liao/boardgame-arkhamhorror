// P7 第六章《雾中之光》两张议程（07232 海湾浓雾 / 07235 猎鹰岬的恐怖）与两个新读点：
//   · agendaRule.doomToNextAgenda ← advanceAgenda（清毁灭前记录、换新议程后放回）；
//   · api.scenario.advanceActDirectly ←「把场景直接推进到 2a（不结算 1b）」；
//   · 07236b/07232b 共用 _shared.js#bringMarshAndLighthouseBasement（本文件顺带回归 07236b）。
//
// 事务约定：resolveTransaction 用草稿整体替换 state，move()/事务之后按 id 重新取对象。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registeredEntry } from '../src/engine/ability.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { entityModifierTotal } from '../src/engine/modifiers.js'
import { keysAt } from '../src/engine/scenario-keys.js'
import { floodLevel } from '../src/engine/flood.js'

function transaction(s, execute, select = () => null) {
  const run = draft => {
    try { return execute(draft) } catch (error) { if (error.constructor?.name !== 'ScenarioEnded') throw error }
  }
  resolveTransaction(s, 0, { action: 'ticLightInTheFogAgendas' }, run)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 80, 'choice loop')
    const choice = s.pendingChoice
    const id = select(choice, s) ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, run)
  }
}
const codeOf = entity => entity?.originalCode || entity?.code
const locationByCode = (s, code) => s.locations.find(location => codeOf(location) === code)
const positionOf = (s, code) => createMechanicsApi(s).map.position(locationByCode(s, code)?.id)

test('07232/07235 注册为 agenda，且 07232 声明 doomToNextAgenda、07235 声明马什生命修正', () => {
  const a = registeredEntry('07232')
  const b = registeredEntry('07235')
  assert.ok(a && b)
  assert.equal(a.scope, 'agenda')
  assert.equal(b.scope, 'agenda')
  assert.equal(a.agendaRule.doomToNextAgenda, true)
  assert.equal(typeof a.agendaRule.onReveal, 'function')
  assert.equal(typeof b.agendaRule.onReveal, 'function')
  assert.equal(b.modifiers.length, 1)
  assert.equal(b.modifiers[0].target, 'enemyHealth')
})

test('07235 正面：奥赛罗思·马什得到 +2/调查员 生命值（其它敌人不受影响）', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  const here = s.investigators[0].location
  const marsh = scenarioRuntime(s, []).spawn('07253', here)
  const other = scenarioRuntime(s, []).spawn('07078', here)
  s.agendaIndex = 3
  const marshNow = s.enemies.find(enemy => enemy.id === marsh.id)
  const otherNow = s.enemies.find(enemy => enemy.id === other.id)
  assert.equal(entityModifierTotal(s, marshNow, 'enemyHealth'), 4, '2 位调查员 → +4 生命')
  assert.equal(entityModifierTotal(s, otherNow, 'enemyHealth'), 0, '只加在马什身上')
})

test('07232 背面：毁灭转移到下个密谋；马什与队长交战；全员失线索；地下室入场；场景直接推进 2a', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  s.agendaIndex = 0
  s.doom = 3
  s.investigators[0].clues = 2
  s.investigators[1].clues = 1
  const leadSeat = Number(s.campaign.leadSeat) || 0
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.agendaIndex, 1, '推进到下个密谋')
  assert.equal(codeOf(s.agendas[s.agendaIndex]), '07233')
  assert.equal(s.doom, 3, '原密谋上的 3 个毁灭移动到新密谋')
  assert.equal(s.actIndex, 1, '场景直接推进到 2a')
  assert.equal(codeOf(s.acts[s.actIndex]), '07237')
  const marsh = s.enemies.find(enemy => codeOf(enemy) === '07253')
  assert.ok(marsh, '马什从 setAside 生成')
  assert.equal(marsh.engagedSeat, leadSeat, '与调查员队长交战')
  assert.equal(marsh.location, s.investigators[leadSeat].location, '生成在队长所在地点')
  assert.equal(keysAt(s, `enemy:${marsh.id}`).includes('blue'), true, '蓝钥匙在马什上')
  assert.equal(s.encounterDeck.filter(code => code === '07259').length, 2, '尽腥尽力洗回遭遇牌库')
  assert.deepEqual(positionOf(s, '07244'), { x: 2, y: -1, isolated: false }, '灯塔地下室放在梯井正下方')
  for (const inv of s.investigators) assert.equal(inv.clues, 0, '每位调查员失去所有线索')
})

test('advanceActDirectly：不结算当前幕背面（不生成马什/不放地下室），只换到下一张幕', () => {
  const s = chapterFixture('aLightInTheFog', 1)
  transaction(s, draft => scenarioRuntime(draft, []).advanceActDirectly())
  assert.equal(s.actIndex, 1, '当前幕换到 07237')
  assert.equal(codeOf(s.acts[s.actIndex]), '07237')
  assert.equal(s.enemies.some(enemy => codeOf(enemy) === '07253'), false, '没有结算 07236b 的生成')
  assert.ok(!locationByCode(s, '07244'), '没有结算 07236b 的布置')
})

test('07235 背面：可提升地点不足 4 张 → 结局3', () => {
  const s = chapterFixture('aLightInTheFog', 1)
  s.agendaIndex = 3
  const water = createMechanicsApi(s).water
  for (const location of s.locations) water.set(location.id, codeOf(location) === '07239' ? 1 : 2)
  let ended = false
  const run = draft => {
    try { scenarioRuntime(draft, []).advanceAgenda() } catch (error) {
      if (error.constructor?.name === 'ScenarioEnded') ended = true
      else throw error
    }
  }
  resolveTransaction(s, 0, { action: 'ticLightInTheFogAgendas' }, run)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 80, 'choice loop')
    const choice = s.pendingChoice
    const id = ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, run)
  }
  assert.equal(ended, true, '进入结局（ScenarioEnded）')
  assert.equal(s.campaign.scenarioResults.at(-1).scenarioId, 'aLightInTheFog')
  assert.equal(s.campaign.scenarioResults.at(-1).resolution, 'resolution3', '结局3')
})

test('07235 背面：足够 4 张时提升最底下 4 处并翻回正面继续（不推进议程）', () => {
  const s = chapterFixture('aLightInTheFog', 1)
  s.agendaIndex = 3
  assert.equal(s.locations.filter(location => createMechanicsApi(s).water.canChange(location.id, 1)).length, 4,
    '开场 4 个地点能涨水（地面 4 处；灯光室本身不可淹没）')
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.agendaIndex, 3, '翻回正面继续，不离开当前密谋')
  const floodedCount = s.locations.filter(location => floodLevel(s, location.id) > 0).length
  assert.equal(floodedCount, 4, '最底下 4 处涨水')
})
