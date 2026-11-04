// 07168 急涡水域（魔鬼礁石）：
//   [action] 在渔船上：渔船上的每位调查员撤退；每位撤退者把紫/黑/白钥匙放到当前场景；
//   渔船移出游戏；其他调查员被抛下。
// 读点：
//   · 地点 action 描述子（actionKind:'resign'）；渔船 = 剧情资产 07178 的载具实例
//     （middle-setup 注册到 state.scenarioFlags.mechanics.vehicles）；
//   · 新原语 api.removeStoryAsset / api.scenario.resignMany（P7）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { legalMoves, move, settle } from './core-fixture.mjs'
import { scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registeredEntry } from '../src/engine/ability.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { keysAt } from '../src/engine/scenario-keys.js'

const codeOf = entity => entity?.originalCode || entity?.code
const vesselIdOf = s => Object.keys(s.scenarioFlags.mechanics.vehicles || {})[0]

function transaction(s, execute) {
  resolveTransaction(s, 0, { action: 'testTic07168' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 80, 'choice loop')
    const choice = s.pendingChoice
    const id = ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}
function giveKey(s, color, seat) {
  const api = createMechanicsApi(s)
  const key = s.scenarioFlags.mechanics.keys[color]
  assert.equal(api.keys.transfer(color, key.holder, `investigator:${seat}`, { reveal: true }), true)
}
function resignAction(s) {
  return legalMoves(s).find(command => command.action === 'entityAbility'
    && s.locations.some(location => location.id === command.entityId) && command.actionKind === 'resign')
}

test('07168：注册为地点且撤退行动只在渔船上可用', () => {
  const entry = registeredEntry('07168')
  assert.ok(entry)
  assert.equal(entry.scope, 'location')
  assert.equal(entry.implemented, true)
  assert.equal(entry.abilities[0].actionKind, 'resign')
  assert.equal(entry.abilities[0].criteria({ state: { scenarioFlags: { mechanics: { vehicles: {} } } }, inv: { seat: 0 } }), false)
})

test('07168：全体乘客撤退 → 本关以 noResolution 失败并推进到下一关', () => {
  const s = chapterFixture('devilReef', 2)
  const vesselId = vesselIdOf(s)
  assert.ok(vesselId, '渔船载具已注册')
  giveKey(s, 'purple', 0)
  giveKey(s, 'black', 0)
  giveKey(s, 'white', 1)
  const command = resignAction(s)
  assert.ok(command, '渔船上的撤退行动应出现在合法列表')
  move(s, command)
  settle(s)
  assert.equal(s.campaign.scenarioResults.length, 1, '全员撤退后本关结算')
  assert.equal(s.campaign.scenarioResults[0].scenarioId, 'devilReef')
  assert.equal(s.campaign.scenarioResults[0].resolution, 'noResolution', '未达成结局 → noResolution')
  assert.equal(s.scenario.id, 'horrorInHighGear', '失败后按战役流程推进到下一关（调查员与载具状态重置）')
})

test('07168：有调查员不在渔船上时，只有乘客撤退，其他人被抛下（剧本继续）', () => {
  const s = chapterFixture('devilReef', 2)
  const vesselId = vesselIdOf(s)
  transaction(s, draft => scenarioRuntime(draft, []).mechanics.vehicles.leave(1, vesselId, { forced: true }))
  assert.equal(s.scenarioFlags.mechanics.vehicles[vesselId].passengers.includes(1), false)
  giveKey(s, 'purple', 0)
  giveKey(s, 'red', 1)
  const actId = s.acts[s.actIndex].id
  const command = resignAction(s)
  assert.ok(command)
  move(s, command)
  settle(s)
  assert.equal(s.investigators[0].resigned, true, '乘客撤退')
  assert.equal(s.investigators[1].resigned, false, '被抛下的调查员留下')
  assert.deepEqual(keysAt(s, `act:${actId}`), ['purple'], '撤退乘客的钥匙放到当前场景')
  assert.equal(s.scenarioFlags.mechanics.vehicles[vesselId], undefined, '渔船仍被移出游戏')
  assert.equal((s.storyAssets || []).some(asset => codeOf(asset) === '07178'), false, '渔船剧情资产移出游戏')
  assert.deepEqual(keysAt(s, `investigator:1`), ['red'], '非乘客的钥匙不受影响')
})
