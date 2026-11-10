// TSK P2 原语验收 A：状态容器、读档校验、JSON 往返、引擎接线与观察投影。
//
// 覆盖 P1 原语目录的容器/集成层：
//   · tsk-state 的两个可选容器（campaign.tsk / scenarioFlags.mechanics.tsk）读点不初始化；
//   · validateTskState 读档校验（save-migration 已接线；旧存档字节不变）；
//   · 隐藏信息投影：未翻面的隐匿迷你卡不泄露真身/诱饵身份；
//   · api-mechanics 的 ctx.api.tsk.* 命名空间真实可调用；
//   · 战役流程图新增 `map` 节点类型（注册期校验 + 执行器停在节点）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { validateTskState, tskStateSummary } from '../src/engine/tsk-primitives.js'
import { tskCampaignState, tskScenarioState, TSK_STATE_VERSION } from '../src/engine/tsk-state.js'
import { validateMechanicState } from '../src/engine/mechanic-state.js'
import { windows } from '../src/engine/windows.js'
import { validateCampaignGraph, walkCampaign } from '../src/campaign/campaign-flow.js'
import { migrateState } from '../src/engine/save-migration.js'
import { viewState } from '../src/integration/observation.js'
import { placeMiniCard, concealedProjection } from '../src/engine/tsk-concealed.js'
import { fixture } from './core-fixture.mjs'

const plain = () => ({
  round: 2,
  investigators: [
    { seat: 0, name: '甲', location: 'locA', assets: [], threat: [], hand: [], deck: [], discard: [], damage: 0 },
    { seat: 1, name: '乙', location: 'locA', assets: [], threat: [], hand: [], deck: [], discard: [], damage: 0 },
  ],
  locations: [
    { id: 'locA', name: '甲地', connections: ['locB'], traits: ['Wilderness'] },
    { id: 'locB', name: '乙地', connections: ['locA'] },
  ],
  enemies: [],
  campaign: { records: {} },
  scenarioFlags: {},
})
const roundTrip = value => JSON.parse(JSON.stringify(value))

test('P2 容器：读点不初始化；旧存档 JSON 逐字节不变', () => {
  const state = plain()
  const before = JSON.stringify(state)
  assert.equal(tskCampaignState(state), null)
  assert.equal(tskScenarioState(state), null)
  assert.deepEqual(tskStateSummary(state), { scenario: [], campaign: [] })
  assert.equal(JSON.stringify(state), before, '只读容器读点不得写出字段')
  validateTskState(state)
  validateMechanicState({ scenarioFlags: {} })
  assert.equal(JSON.stringify(state), before)
})

test('P2 容器：创建形状/版本/未知字段校验（存在才校验）', () => {
  const state = plain()
  tskCampaignState(state, true)
  tskScenarioState(state, true)
  assert.equal(state.campaign.tsk.version, TSK_STATE_VERSION)
  assert.equal(state.scenarioFlags.mechanics.tsk.version, TSK_STATE_VERSION)
  assert.deepEqual(tskStateSummary(state), { scenario: [], campaign: [] })
  // 合法空容器通过校验，JSON 往返后仍通过。
  validateTskState(state)
  validateTskState(roundTrip(state))
  // 未知字段/错误版本被拒绝。
  state.campaign.tsk.nope = 1
  assert.throws(() => validateTskState(state), /未知字段 nope/)
  delete state.campaign.tsk.nope
  state.campaign.tsk.version = 99
  assert.throws(() => validateTskState(state), /不支持的 TSK 战役扩展版本/)
})

test('P2 引擎接线：ctx.api.tsk.* 可调用；窗口与流程节点已注册', () => {
  const state = plain()
  state.campaign.id = 'theScarletKeys'
  const api = createMechanicsApi(state, { choice: () => 'skip' })
  assert.ok(api.tsk, 'ctx.api.mechanics.tsk 命名空间缺失')
  for (const group of ['state', 'concealed', 'hollow', 'keys', 'map', 'customizable', 'coterie', 'patrol', 'investigator']) {
    assert.ok(api.tsk[group], `ctx.api.tsk.${group} 缺失`)
  }
  assert.deepEqual(api.tsk.state.summary(), { scenario: [], campaign: [] })
  // 隐匿迷你卡经 api 放置/投影；未翻面时投影不含身份字段。
  const placed = api.tsk.concealed.place({ kind: 'CoterieAgentA', decoy: false, locationId: 'locA' })
  assert.ok(placed.id)
  const projected = api.tsk.concealed.projection()
  assert.equal(projected.length, 1)
  assert.equal(projected[0].visible, false)
  assert.equal('kind' in projected[0], false, '未翻面迷你卡不得泄露 kind')
  assert.equal('decoy' in projected[0], false)
  // 窗口注册：三个 P2 新窗口在注册表里。
  const ids = new Set(windows().map(window => window.id))
  for (const id of ['tskExposed', 'tskCrossSeatAction', 'damageHealed']) assert.ok(ids.has(id), `窗口 ${id} 未注册`)
})

test('P2 存档往返：容器随 JSON 保存/恢复并通过校验', () => {
  const state = plain()
  const api = createMechanicsApi(state, { choice: () => 'skip' })
  api.tsk.concealed.setInShadows('locA', true)
  api.tsk.hollow.hollow({ code: '09064', scope: 'team' })
  api.tsk.keys.initialize([{ id: 'k1', stableFace: 'f1a', unstableFace: 'f1b' }])
  api.tsk.coterie.initialize({ members: { unresolved: ['09752'], ally: ['09753'], defeated: [] } })
  api.tsk.map.initialize({ graph: { nodes: [{ id: 'locA', connections: ['locB'] }, { id: 'locB', connections: ['locA'] }] }, start: 'locA', unlocked: ['locB'] })
  api.tsk.investigator.grantAction({ fromSeat: 0, targetSeat: 1 })
  const restored = roundTrip(state)
  validateTskState(restored)
  assert.deepEqual(restored.campaign.tsk.keys.keys.k1.bearer, { type: 'none' })
  assert.equal(restored.scenarioFlags.mechanics.tsk.concealed.shadows.locA, true)
  assert.equal(restored.campaign.tsk.map.current, 'locA')
})

test('P2 隐藏信息投影：observation 只下发位置与数量，翻面后才给身份', () => {
  const state = fixture('01001')
  const locationId = state.investigators[0].location
  const card = placeMiniCard(state, { kind: 'SecretKind', decoy: true, locationId })
  const hidden = viewState(state, 0)
  assert.ok(Array.isArray(hidden.concealedMiniCards))
  assert.equal(hidden.concealedMiniCards.length, 1)
  assert.equal(hidden.concealedMiniCards[0].visible, false)
  assert.equal('kind' in hidden.concealedMiniCards[0], false)
  // 合法获知（known=true）后才下发身份。
  createMechanicsApi(state, { choice: () => 'skip' }).tsk.concealed
  state.scenarioFlags.mechanics.tsk.concealed.miniCards[0].known = true
  const revealed = viewState(state, 0)
  assert.equal(revealed.concealedMiniCards[0].kind, 'SecretKind')
  assert.equal(revealed.concealedMiniCards[0].decoy, true)
  assert.deepEqual(concealedProjection(state, { revealAll: true })[0].id, card.id)
})

test('P2 读档迁移：健康存档往返不产生改动；旧存档（无 TSK 容器）保持原样', () => {
  const state = fixture('01001')
  const restored = roundTrip(state)
  const result = migrateState(restored)
  assert.equal(result.state, restored)
  assert.deepEqual(result.changes, [])
  const legacy = plain()
  const before = JSON.stringify(legacy)
  validateTskState(legacy)
  assert.equal(JSON.stringify(legacy), before)
})

test('P2 战役流程：map 节点注册期校验与执行器停下', () => {
  const manifest = {
    scenarioIds: ['s1', 's2'],
    flow: {
      start: 'embark',
      nodes: {
        embark: { type: 'map', next: 's1' },
        s1: { type: 'scenario', scenarioId: 's1', next: 's2' },
        s2: { type: 'scenario', scenarioId: 's2', next: 'end' },
        end: { type: 'end' },
      },
    },
  }
  assert.ok(validateCampaignGraph(manifest))
  // map 节点缺出口 / 带 options 都在注册期拒绝。
  const broken = structuredClone(manifest)
  delete broken.flow.nodes.embark.next
  assert.throws(() => validateCampaignGraph(broken), /世界地图节点缺少出口/)
  const withOptions = structuredClone(manifest)
  withOptions.flow.nodes.embark.options = [{ id: 'x', next: 's1' }]
  assert.throws(() => validateCampaignGraph(withOptions), /世界地图节点不能声明选项/)
  // 执行器在 map 节点停下（交给战役行为驱动走图）。
  const campaign = { records: {}, recordSchema: {} }
  const stopped = walkCampaign(campaign, manifest, () => null)
  assert.equal(stopped.id, 'embark')
  assert.equal(stopped.type, 'map')
})
