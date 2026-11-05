// 07168 急涡水域：渔船撤退。
//
// 印刷：「[action]如果你在渔船上：撤退。渔船上的每位调查员撤退。将渔船从游戏中移除。
//        每位撤退的调查员将其每个紫色、黑色或白色钥匙放在当前场景上。其他每位调查员被抛下。」
//
// 读点：
//   · 「你在渔船上」= _shared.js 的 vehicleAssetOf（vehicleOf → 载具的物理卡，不读 mechanicState）；
//   · 船上的人 = vehiclePassengers 快照，逐个 api.resign（撤退后果沿用既有入口）；
//   · 钥匙 = keys.transfer(color, 'investigator:<seat>', 'act:<当前幕 id>')，只搬紫/黑/白；
//     「当前场景」= 当前幕，content resolutions.js 的 recoveredKeys 只统计 act:<当前幕>/调查员持有
//     （审计 H6：修复前放 'reference'，幕间 III 奖励与《雾中之光》条件链全部丢失）；
//   · 移除渔船 = api.scenario.removeStoryAsset（离场不进弃牌堆，并触发 storyAssetLeftPlay 清理）
//     + vehicles.remove 注销载具。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { legalMoves } from '../src/engine/engine.js'
import { move, settle } from './core-fixture.mjs'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'

const boatOf = s => (s.storyAssets || []).find(asset => asset.code === '07178')
const resignAction = s => legalMoves(s).find(command => command.action === 'entityAbility'
  && command.entityId === s.investigators[0].location && /渔船/.test(command.label))

test('07168 急涡水域：只有在渔船上才出现撤退行动', () => {
  const aboard = chapterFixture('devilReef', 1)
  assert.ok(resignAction(aboard), '在渔船上：行动可用')

  const onFoot = chapterFixture('devilReef', 1)
  createMechanicsApi(onFoot).vehicles.leave(0, boatOf(onFoot).id, { forced: true })
  assert.equal(resignAction(onFoot), undefined, '不在渔船上：行动不出现')
})

test('07168 急涡水域：船上的人撤退、渔船移出游戏、紫黑白钥匙放到当前场景', () => {
  const s = chapterFixture('devilReef', 2)
  const api = createMechanicsApi(s)
  const boat = boatOf(s)
  // 第二位调查员留在岸上，用来验证「其他每位调查员被抛下」。第一位移到船上并持三色钥匙 + 一把红钥匙。
  api.vehicles.leave(1, boat.id, { forced: true })
  for (const color of ['purple', 'black', 'white', 'red']) api.keys.transfer(color, 'setAside', 'investigator:0')

  move(s, resignAction(s))
  settle(s)

  assert.equal(s.investigators[0].resigned, true, '船上的人撤退')
  assert.equal(s.investigators[1].resigned, false, '其他人被抛下，继续游戏')
  assert.equal(s.scenario.id, 'devilReef', '还有调查员在场：局面不结算')
  assert.deepEqual((s.storyAssets || []).map(asset => asset.code), [], '渔船已移出游戏')
  assert.equal(s.scenarioFlags.mechanics.vehicles[boat.id], undefined, '载具从登记表注销')

  const keys = s.scenarioFlags.mechanics.keys
  const currentAct = `act:${s.acts[s.actIndex].id}`
  for (const color of ['purple', 'black', 'white']) {
    assert.equal(keys[color].holder, currentAct, `${color} 钥匙放在当前幕上（审计 H6）`)
  }
  assert.notEqual(keys.red.holder, currentAct, '其他颜色的钥匙不放到场景上')
  assert.equal(keys.red.holder, `location:${s.investigators[0].location}`, '撤退清理把其余钥匙留在原地')
  assert.equal(api.vehicles.of(0), null, '撤退的人不再属于任何载具')
})
