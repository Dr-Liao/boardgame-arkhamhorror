// w2 新卡测试：07099 机械故障 / 07259 尽腥尽力 / 07332 水生异怪 / 07338 潜水服
//
// 4 张都是合并后新增的 late A/B 单卡；读点由 Lead 分批落地（见
// artifacts/migration/tic/p7/workers/w2/primitive-requests/ 与 card-audit.md）。
//
// 事务约定：resolveTransaction 成功后会用草稿替换 state 内容，事务前拿到的引用会失效，
// 事务后一律按 id / 数组重新取实例（与 tests/tic-maelstrom-agendas.test.mjs 同写法）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy } from './core-fixture.mjs'
import { legalMoves, move, settle } from './core-fixture.mjs'
import { scenarioRuntime, turnBeginningWindow } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'

import e07099 from '../src/cards/encounter-entries/theInnsmouthConspiracy/_shared/malfunction/07099.js'
import e07259 from '../src/cards/encounter-entries/theInnsmouthConspiracy/aLightInTheFog/07259.js'
import e07332 from '../src/cards/encounter-entries/theInnsmouthConspiracy/intoTheMaelstrom/07332.js'
import e07338 from '../src/cards/encounter-entries/theInnsmouthConspiracy/intoTheMaelstrom/07338.js'

// 索引重建前先就地注册本批条目（正式测试里这一步由 encounter-entries/index.js 完成）。
for (const entry of [e07099, e07259, e07332, e07338]) {
  if (!registeredEntry(entry.code)) registerCardAbilities([entry])
}

function transaction(s, execute, select = () => null) {
  resolveTransaction(s, 0, { action: 'testW2NewCards' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 80, `choice loop ${s.pendingChoice.source}`)
    const choice = s.pendingChoice
    const id = select(choice, s)
      ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}
const byId = (s, id) => s.enemies.find(item => item.id === id)
const codeOf = entity => entity?.originalCode || entity?.code

// 用真实行动入口抽一张指定遭遇卡（helper 自带 discardSelf，付完费即离场）。
const drawHelper = {
  code: 'w2DrawEncounterHelper',
  abilities: [{ kind: 'action', label: '实际抽取遭遇卡', cost: { discardSelf: true },
    resolve: ({ inv, api }) => api.scenario.drawEncounter(inv.seat) }],
}
if (!registeredEntry(drawHelper.code)) registerCardAbilities([drawHelper])

// ---------------------------------------------------------------------------
// 注册形状
// ---------------------------------------------------------------------------
test('w2 新卡注册形状：4 张全部 implemented:true 且声明字段有读点', () => {
  const expected = [
    ['07099', 'treachery'], ['07259', 'treachery'],
    ['07332', 'enemy'], ['07338', 'storyAsset'],
  ]
  for (const [code, scope] of expected) {
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 未注册`)
    assert.equal(entry.scope, scope, `${code} scope`)
    assert.equal(entry.implemented, true, `${code} implemented`)
  }
  const malfunction = registeredEntry('07099').treacheryRule
  assert.equal(malfunction.attachToNearestVehicleStoryAsset, true)
  assert.equal(malfunction.suppressesHostActions, true)
  assert.equal(malfunction.attachmentAbilities.length, 1)
  assert.equal(registeredEntry('07332').enemyRule.hunterTreatsFloodedConnected, true)
  assert.equal(registeredEntry('07338').assetRule.ignoreAgendaForced, true)
  assert.equal(registeredEntry('07338').assetRule.redirectOneDamageToSelf, true)
  assert.equal(registeredEntry('07338').removeFromGameOnLeave, true)
  assert.deepEqual(registeredEntry('07259').treacheryRule.attackBonus,
    { damage: 1, horror: 1, discardOnAttack: true })
})

// ---------------------------------------------------------------------------
// 07332 水生异怪
// ---------------------------------------------------------------------------
function hunterFixture() {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.locations = ['a', 'b', 'c', 'd'].map((id, index, all) => ({ id, name: id, revealed: true, traits: [], clues: 0,
    connections: [all[index - 1], all[index + 1]].filter(Boolean) }))
  s.enemies = []
  for (const inv of s.investigators) { inv.engaged = []; inv.assets = []; inv.threat = []; inv.location = 'a' }
  s.currentSeat = 0
  s.phase = 'enemy'
  const abomination = enemy(s, { code: '07332', name: '水生异怪', location: 'd', hunter: true,
    exhausted: false, engagedSeat: null, health: 7, fight: 4, evade: 3 })
  return { s, id: abomination.id }
}

test('07332 通过猎手关键词移动后：enemy.skipAttackRound 记为当前轮（本阶段攻击步骤跳过）', () => {
  const { s, id } = hunterFixture()
  transaction(s, draft => { scenarioRuntime(draft, []).resolveHunterMove(byId(draft, id)) })
  const moved = byId(s, id)
  assert.equal(moved.location, 'c', '猎手向调查员移动一步')
  assert.equal(moved.skipAttackRound, s.round, '移动后本阶段不能攻击（skipAttackRound 记账）')
})

test('07332 非猎手来源的移动不触发「本阶段不能攻击」', () => {
  const { s, id } = hunterFixture()
  transaction(s, draft => { scenarioRuntime(draft, []).moveEnemy(byId(draft, id), 'c') })
  const moved = byId(s, id)
  assert.equal(moved.location, 'c')
  assert.notEqual(moved.skipAttackRound, s.round, '效果移动不触发猎手移动的不能攻击条款')
})

test('07332 移动时完全淹没地点视为相互连接：猎手可直接跨到另一完全淹没地点', () => {
  // a-b-c-d 直线；异怪在 a、调查员在 d。c 与 a 隔一个地点，规则生效时 a、c 视为相连，
  // 最短路线从 a→b→c→d 变成 a→c→d，猎手第一步从 b 变成 c。
  function floodFixture(flooded) {
    const s = chapterFixture('intoTheMaelstrom', 1)
    s.locations = ['a', 'b', 'c', 'd'].map((id, index, all) => ({ id, name: id, revealed: true, traits: [], clues: 0,
      connections: [all[index - 1], all[index + 1]].filter(Boolean) }))
    s.enemies = []
    for (const inv of s.investigators) { inv.engaged = []; inv.assets = []; inv.threat = []; inv.location = 'd' }
    s.currentSeat = 0
    s.phase = 'enemy'
    const abomination = enemy(s, { code: '07332', name: '水生异怪', location: 'a', hunter: true,
      exhausted: false, engagedSeat: null, health: 7, fight: 4, evade: 3 })
    if (flooded) {
      const api = createMechanicsApi(s)
      api.water.set('a', 2)
      api.water.set('c', 2)
    }
    return { s, id: abomination.id }
  }
  const flooded = floodFixture(true)
  transaction(flooded.s, draft => { scenarioRuntime(draft, []).resolveHunterMove(byId(draft, flooded.id)) })
  assert.equal(byId(flooded.s, flooded.id).location, 'c', '完全淹没的 a、c 视为相连 → 第一步到 c')
  const dry = floodFixture(false)
  transaction(dry.s, draft => { scenarioRuntime(draft, []).resolveHunterMove(byId(draft, dry.id)) })
  assert.equal(byId(dry.s, dry.id).location, 'b', '未淹没时不连接，仍走普通最短路')
})

// ---------------------------------------------------------------------------
// 07338 潜水服
// ---------------------------------------------------------------------------
test('07338 离场后进入 removedFromGame（removeFromGameOnLeave 读点）', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.investigators[0].assets.push({ id: 'w2DivingSuit', code: '07338', exhausted: false })
  transaction(s, draft => { scenarioRuntime(draft, []).discardAsset(0, 'w2DivingSuit') })
  assert.equal(s.investigators[0].assets.some(asset => asset.id === 'w2DivingSuit'), false, '支援已离场')
  assert.ok((s.removedFromGame || []).includes('07338'), '离场后被移出游戏')
})

test('07338 任意数量伤害将要放到控制者身上时转移 1 点到潜水服', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  s.investigators[0].assets.push({ id: 'w2DivingSuit', code: '07338', exhausted: false, damage: 0 })
  transaction(s, draft => { scenarioRuntime(draft, []).damage(0, 2) })
  const suit = s.investigators[0].assets.find(asset => asset.id === 'w2DivingSuit')
  assert.equal(s.investigators[0].damage, 1, '2 点伤害中 1 点被转移')
  assert.equal(suit.damage, 1, '潜水服上承接 1 点伤害')
})

test('07338 忽略当前密谋的强制能力：回合开始不再记录求取空气的风险', () => {
  const s = chapterFixture('intoTheMaelstrom', 1)
  const api = createMechanicsApi(s)
  const here = s.investigators[0].location
  api.water.set(here, 2)
  s.investigators[0].assets.push({ id: 'w2DivingSuit', code: '07338', exhausted: false })
  s.currentSeat = 0
  transaction(s, draft => turnBeginningWindow(draft, []))
  assert.equal(s.scenarioFlags.mechanics.air?.[0] ?? null, null, '控制潜水服时忽略求取空气的强制')

  const control = chapterFixture('intoTheMaelstrom', 1)
  const controlApi = createMechanicsApi(control)
  controlApi.water.set(control.investigators[0].location, 2)
  control.currentSeat = 0
  transaction(control, draft => turnBeginningWindow(draft, []))
  assert.equal(control.scenarioFlags.mechanics.air?.[0]?.damage, 5, '没有潜水服时记录 5 点空气风险')
})

// ---------------------------------------------------------------------------
// 07099 机械故障（devilReef：渔船 07178 是最近的 [[载具]] 剧情支援）
// ---------------------------------------------------------------------------
function revealMalfunction(s) {
  let resolved
  transaction(s, draft => {
    resolved = registeredEntry('07099').encounterResolve(draft, draft.investigators[0],
      { code: '07099' }, scenarioRuntime(draft, []))
  })
  return resolved
}

test('07099 显现：附属到最近的[[载具]]剧情支援，且宿主 [action] 能力被封锁', () => {
  const s = chapterFixture('devilReef', 1)
  const vessel = (s.storyAssets || []).find(host => codeOf(host) === '07178')
  assert.ok(vessel, '魔鬼礁 setup 应把渔船放进 state.storyAssets')
  s.currentSeat = 0
  const vesselActionBefore = legalMoves(s).filter(entry => entry.action === 'entityAbility' && entry.entityId === vessel.id)
  assert.ok(vesselActionBefore.length, '未附附属时渔船的 [action] 应可见')
  assert.equal(revealMalfunction(s), true, '有载具剧情支援时显现成功')
  const attachedVessel = s.storyAssets.find(host => codeOf(host) === '07178')
  assert.ok((attachedVessel.attachments || []).some(card => codeOf(card) === '07099'), '07099 附属到渔船')
  const vesselActionAfter = legalMoves(s).filter(entry => entry.action === 'entityAbility' && entry.entityId === attachedVessel.id)
  assert.equal(vesselActionAfter.length, 0, '宿主 [action] 能力不能触发')
})

test('07099 自身行动：智力(3) 检定成功弃掉机械故障', () => {
  const s = chapterFixture('devilReef', 1)
  assert.equal(revealMalfunction(s), true)
  s.chaosBag = ['+5']
  s.currentSeat = 0
  const command = legalMoves(s).find(entry => entry.action === 'entityAbility'
    && entry.entityType === 'encounterAttachment')
  assert.ok(command, `没有出现机械故障自身行动：${JSON.stringify(legalMoves(s).map(entry => entry.label))}`)
  move(s, { ...command, action: 'entityAbility' })
  settle(s)
  assert.ok((s.encounterDiscard || []).includes('07099'), '检定成功后机械故障进遭遇弃牌堆')
})

test('07099 没有[[载具]]剧情支援时显现不附属（不崩溃）', () => {
  const s = chapterFixture('devilReef', 1)
  s.storyAssets = (s.storyAssets || []).filter(host => codeOf(host) !== '07178')
  assert.equal(revealMalfunction(s), false)
})

// ---------------------------------------------------------------------------
// 07259 尽腥尽力（aLightInTheFog，宿主 07253 奥赛罗思·马什）
// ---------------------------------------------------------------------------
function spawnMarsh(s, location) {
  let id = null
  transaction(s, draft => {
    const marsh = scenarioRuntime(draft, []).spawn('07253', location)
    id = marsh?.id ?? null
  })
  assert.ok(id, '奥赛罗思·马什应成功生成')
  return id
}
function attachWorthHisSalt(s) {
  let resolved
  transaction(s, draft => {
    resolved = registeredEntry('07259').encounterResolve(draft, draft.investigators[0],
      { code: '07259' }, scenarioRuntime(draft, []))
  })
  return resolved
}

test('07259 显现：附属到奥赛罗思·马什（在场）', () => {
  const s = chapterFixture('aLightInTheFog', 1)
  const marshId = spawnMarsh(s, s.investigators[0].location)
  assert.equal(attachWorthHisSalt(s), true)
  const marsh = byId(s, marshId)
  assert.ok((marsh.attachments || []).some(card => codeOf(card) === '07259'), '07259 附属到马什')
})

test('07259 显现：马什在胜利区时也能附属', () => {
  const s = chapterFixture('aLightInTheFog', 1)
  s.enemies = []
  s.victoryDisplay.push({ id: 'enemy:testMarsh', code: '07253', originalCode: '07253', name: '奥赛罗思·马什' })
  assert.equal(attachWorthHisSalt(s), true)
  assert.ok((s.victoryDisplay[0].attachments || []).some(card => codeOf(card) === '07259'),
    '胜利区的马什也被附属')
})

test('07259 马什攻击时本次 +1 伤害 +1 恐惧，并弃掉本卡', () => {
  const s = chapterFixture('aLightInTheFog', 1)
  const marshId = spawnMarsh(s, s.investigators[0].location)
  assert.equal(attachWorthHisSalt(s), true)
  const marshBefore = byId(s, marshId)
  const damage = Number(marshBefore.damage || 0), horror = Number(marshBefore.horror || 0)
  s.currentSeat = 0
  transaction(s, draft => {
    const marsh = byId(draft, marshId)
    scenarioRuntime(draft, []).attack(marsh, draft.investigators[0])
  })
  assert.equal(s.investigators[0].damage, damage + 1, '本次攻击 +1 伤害')
  assert.equal(s.investigators[0].horror, horror + 1, '本次攻击 +1 恐惧')
  assert.equal((byId(s, marshId).attachments || []).some(card => codeOf(card) === '07259'), false,
    '攻击后弃掉尽腥尽力')
  assert.ok((s.encounterDiscard || []).includes('07259'))
})

test('07259 马什通过猎手关键词移动后未交战：再次结算猎手，且本阶段不能攻击（每轮一次）', () => {
  const s = chapterFixture('aLightInTheFog', 1)
  s.locations = ['a', 'b', 'c', 'd'].map((id, index, all) => ({ id, name: id, revealed: true, traits: [], clues: 0,
    connections: [all[index - 1], all[index + 1]].filter(Boolean) }))
  s.enemies = []
  for (const inv of s.investigators) { inv.engaged = []; inv.assets = []; inv.threat = []; inv.location = 'a' }
  s.currentSeat = 0
  s.phase = 'enemy'
  const marshId = spawnMarsh(s, 'd')
  assert.equal(attachWorthHisSalt(s), true)
  const marsh = byId(s, marshId)
  marsh.hunter = true
  marsh.exhausted = false
  marsh.engagedSeat = null
  transaction(s, draft => { scenarioRuntime(draft, []).resolveHunterMove(byId(draft, marshId)) })
  const moved = byId(s, marshId)
  assert.equal(moved.location, 'b', '第一次猎手移动（d→c）后强制再结算一次（c→b）')
  assert.equal(moved.skipAttackRound, s.round, '本轮不能攻击')
  transaction(s, draft => { scenarioRuntime(draft, []).resolveHunterMove(byId(draft, marshId)) })
  assert.equal(byId(s, marshId).location, 'a', '第二次触发受每轮一次限制，只再移动一步')
})
