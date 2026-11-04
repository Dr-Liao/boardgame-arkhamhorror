// TIC 第六章「雾中灯塔 aLightInTheFog」逐章验收测试（八章 12 项验收中行为项的机械证据）。
//
// 口径：tools/audit-tic-scenarios.mjs#chapterTestFor —— 本文件是本章唯一验收测试文件
// （tests/tic-scenario-aLightInTheFog.test.mjs），引用 chapterFixture('aLightInTheFog')，
// 实跑通过，且通过用例标题分别命中 setupAndZones / actsAndAgendas / locationsAndConnections /
// encounterBehaviors / chaosEffects / resolutionsAndRecords / saveReplay 的断言关键词。
//
// 夹具与事务写法复用 tic-scenarios-light-in-the-fog / tic-light-in-the-fog-agendas /
// tic-capture / tic-alight-cards。
// 运行：node --test tests/tic-scenario-aLightInTheFog.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { legalMoves, move, settle } from './core-fixture.mjs'
import {
  capturedAtLocation, capturedSeats, drawEncounter, isCaptured, reactionWindow, revealLocation,
  scenarioRuntime,
} from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { registeredEntry } from '../src/engine/ability.js'
import { keysAt } from '../src/engine/scenario-keys.js'
import { floodLevel } from '../src/engine/flood.js'
import { entityModifierTotal } from '../src/engine/modifiers.js'
import { validateMechanicState } from '../src/engine/mechanic-state.js'
import { resolveTransaction } from '../src/engine/resolution.js'

const json = value => JSON.parse(JSON.stringify(value))
const codeOf = entity => entity?.originalCode || entity?.code
const locationOf = (s, code) => s.locations.find(location => codeOf(location) === code) || null
// 位置查询：target 可以是地点实例 id、地点对象，或印刷卡号。
const positionOf = (s, target) => {
  const id = typeof target === 'string' && s.locations.some(location => location.id === target)
    ? target
    : locationOf(s, typeof target === 'string' ? target : codeOf(target))?.id
  return createMechanicsApi(s).map.position(id)
}

function transaction(state, execute, select = () => null) {
  const run = draft => {
    try { return execute(draft) } catch (error) { if (error.constructor?.name !== 'ScenarioEnded') throw error }
  }
  resolveTransaction(state, 0, { action: 'ticALightInTheFogAcceptance' }, run)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 120, `choice loop ${state.pendingChoice.source}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(candidate => choice.options.some(option => option.id === candidate))
      ?? choice.options[0]?.id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, run)
  }
}
const placeAt = (s, code, x, y) => {
  if (locationOf(s, code)) return locationOf(s, code)
  transaction(s, draft => {
    const definition = Object.entries(draft.scenario.locations)
      .find(([, item]) => codeOf(item) === code)
    assert.ok(definition, `章节没有 ${code} 的物理定义`)
    scenarioRuntime(draft, []).mechanics.map.place(definition[0], x, y)
  })
  const placed = locationOf(s, code)
  assert.ok(placed, `${code} 应已入场`)
  return placed
}
const draw = (s, code) => {
  s.encounterDeck = [code]
  transaction(s, draft => drawEncounter(draft, draft.investigators[0], []))
}
const entityAction = (s, entityId, abilityIndex = null) => legalMoves(s).find(command =>
  command.action === 'entityAbility' && command.entityId === entityId
  && (abilityIndex == null || command.abilityIndex === abilityIndex))

test('aLightInTheFog 开局布置与区域守恒：初始行/灯光室、7 色钥匙、07252 剧情卡、4 张密谋阈值与遭遇牌库', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  const mech = s.scenarioFlags.mechanics
  assert.equal(s.agendaIndex, 0)
  assert.equal(s.actIndex, 0)
  assert.deepEqual((s.acts || []).map(codeOf), ['07236', '07237', '07238'], '三张幕按序')
  assert.deepEqual((s.agendas || []).map(codeOf), ['07232', '07233', '07234', '07235'], '四张密谋按序')
  assert.deepEqual(s.agendas.map(agenda => agenda.doomThreshold), [4, 7, 10, 3], '密谋毁灭阈值')
  // 初始 5 个地点：第 0 行 4 个 + 灯光室 (2,1)；只有门房已揭示，水位全 0。
  assert.equal(s.locations.length, 5, '初始区域 5 个地点')
  assert.deepEqual(positionOf(s, locationOf(s, '07239').id), { x: 0, y: 0, isolated: false })
  assert.deepEqual(positionOf(s, locationOf(s, '07241').id), { x: 2, y: 1, isolated: false }, '灯光室在第二行')
  for (const location of s.locations) {
    assert.equal(floodLevel(s, location.id), 0, `${location.name} 初始未淹没`)
    assert.equal(location.revealed, codeOf(location) === '07239', `${location.name} 初始揭示状态`)
  }
  // 7 色钥匙：5 把正面朝上放在一边，绿/紫扣置。
  assert.equal(Object.keys(mech.keys).length, 7)
  for (const color of ['white', 'black', 'blue', 'yellow', 'red']) {
    assert.equal(mech.keys[color].holder, 'setAside')
    assert.equal(mech.keys[color].revealed, true, `${color} 开局正面朝上`)
  }
  for (const color of ['purple', 'green']) assert.equal(mech.keys[color].revealed, false, `${color} 扣置`)
  // 07252 剧情卡在剧本区（翻面后成为拘禁室）。
  assert.ok((s.storyAssets || []).some(asset => codeOf(asset) === '07252'), '07252 剧情卡在剧本区')
  // 区域守恒：遭遇牌库 36、旁置 5 张。
  assert.equal(s.encounterDeck.length, 36, '遭遇牌库数量守恒')
  assert.equal(s.scenarioZones.setAside.length, 5, '旁置遭遇/支援守恒')
})

test('aLightInTheFog 幕/议程：07236 线索目标与背面布置、07237 进入地下室目标、07238 全员撤退目标', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  const act = s.acts[s.actIndex]
  // 07236 正面：线索不足不出现；支付 3n 线索后推进，背面布置马什/蓝钥匙/尽腥尽力/地下室并直接推进 agenda 2a。
  assert.equal(entityAction(s, act.id), undefined, '线索不足时线索目标不出现')
  s.investigators[0].clues = 6
  s.clues = 6
  const command = entityAction(s, act.id)
  assert.ok(command, '线索目标能力出现在合法行动')
  move(s, command)
  settle(s)
  assert.equal(s.actIndex, 1, '幕推进到 2a（07237）')
  assert.equal(codeOf(s.acts[s.actIndex]), '07237')
  const marsh = s.enemies.find(enemy => codeOf(enemy) === '07253')
  assert.ok(marsh, '背面生成奥赛罗思·马什')
  assert.equal(marsh.exhausted, true, '横置生成')
  assert.equal(marsh.location, locationOf(s, '07243').id, '生成在灯塔看门人小屋')
  assert.equal(keysAt(s, `enemy:${marsh.id}`).includes('blue'), true, '蓝钥匙放在马什上')
  assert.equal(s.encounterDeck.filter(code => code === '07259').length, 2, '尽腥尽力洗入遭遇牌库')
  assert.deepEqual(positionOf(s, '07244'), { x: 2, y: -1, isolated: false }, '地下室放在梯井正下方')
  assert.equal(codeOf(s.agendas[s.agendaIndex]), '07233', '密谋直接推进到 2a（不结算 1b）')
  // 07237 目标：任一未败退调查员进入灯塔地下室；07238 目标：所有未败退者都已撤退。
  assert.equal(typeof registeredEntry('07237').actRule.objective, 'function')
  const s2 = chapterFixture('aLightInTheFog', 2)
  const basement = placeAt(s2, '07244', 2, -1)
  assert.equal(registeredEntry('07237').actRule.objective(s2, s2.acts[1]), false, '无人在地下室时目标不成立')
  s2.investigators[0].location = basement.id
  assert.equal(registeredEntry('07237').actRule.objective(s2, s2.acts[1]), true, '有人进入地下室后目标成立')
  assert.equal(typeof registeredEntry('07238').actRule.objective, 'function')
  assert.equal(typeof registeredEntry('07238').actRule.allResigned, 'function', '全员撤退钩子已接线')
})

test('aLightInTheFog 议程：07232 背面毁灭转移+全员失线索+地下室入场+场景直接推进 2a', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  s.agendaIndex = 0
  s.doom = 3
  s.investigators[0].clues = 2
  s.investigators[1].clues = 1
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.agendaIndex, 1, '推进到密谋 2')
  assert.equal(codeOf(s.agendas[s.agendaIndex]), '07233')
  assert.equal(s.doom, 3, '原密谋的毁灭移动到新密谋')
  assert.equal(s.actIndex, 1, '场景直接推进到 2a')
  assert.equal(codeOf(s.acts[s.actIndex]), '07237')
  const marsh = s.enemies.find(enemy => codeOf(enemy) === '07253')
  assert.ok(marsh, '07232 背面生成马什')
  assert.equal(marsh.engagedSeat, Number(s.campaign.leadSeat) || 0, '马什与队长交战')
  assert.equal(keysAt(s, `enemy:${marsh.id}`).includes('blue'), true, '蓝钥匙在马什上')
  for (const inv of s.investigators) assert.equal(inv.clues, 0, '全员失去线索')
  assert.deepEqual(positionOf(s, '07244'), { x: 2, y: -1, isolated: false }, '灯塔地下室入场')
})

test('aLightInTheFog 议程：07234 浪潮汹涌背面移出猎鹰岬地点、把占位者搬到浅层并提升最底下 4 处淹没', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  placeAt(s, '07244', 2, -1)
  placeAt(s, '07245', 2, -2)
  placeAt(s, '07246', 2, -3)
  placeAt(s, '07247', 0, -1)
  transaction(s, draft => revealLocation(draft, locationOf(draft, '07244').id, [], 0))
  const upper = locationOf(s, '07244')
  const lower = locationOf(s, '07245')
  const final = locationOf(s, '07246')
  s.agendaIndex = 2
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.agendaIndex, 3, '浪潮汹涌推进到下一张密谋')
  const marsh = s.enemies.find(enemy => codeOf(enemy) === '07253')
  assert.ok(marsh, '从场外生成马什')
  assert.equal(marsh.location, upper.id, '生成在沉没岩洞（浅层）')
  assert.equal(s.locations.some(location => (location.traits || []).includes('Falcon Point')), false, '猎鹰岬地点全部移出游戏')
  for (const inv of s.investigators) assert.equal(inv.location, upper.id, '占位调查员被搬到浅层')
  for (const location of [upper, lower, final]) assert.equal(floodLevel(s, location.id), 1, `${location.name} 提升淹没`)
  assert.equal(floodLevel(s, locationOf(s, '07247').id), 1, '同一行剩余名额也提升')
})

test('aLightInTheFog 议程：07235 马什生命修正与背面 4 处淹没（不足则结局3）', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  const here = s.investigators[0].location
  const marsh = scenarioRuntime(s, []).spawn('07253', here)
  const other = scenarioRuntime(s, []).spawn('07078', here)
  s.agendaIndex = 3
  const marshNow = s.enemies.find(enemy => enemy.id === marsh.id)
  const otherNow = s.enemies.find(enemy => enemy.id === other.id)
  assert.equal(entityModifierTotal(s, marshNow, 'enemyHealth'), 4, '2 人局：马什 +2/调查员 生命')
  assert.equal(entityModifierTotal(s, otherNow, 'enemyHealth'), 0, '修正只作用在马什身上')
  // 背面：足够 4 个可提升地点 → 提升最底下 4 处并翻回正面继续（不离开当前密谋）。
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.agendaIndex, 3, '翻回正面继续')
  assert.equal(s.locations.filter(location => floodLevel(s, location.id) > 0).length, 4, '最底下 4 处涨水')
  // 复盘：可提升地点不足 4 张时进入结局 3。
  const poor = chapterFixture('aLightInTheFog', 1)
  poor.agendaIndex = 3
  const water = createMechanicsApi(poor).water
  for (const location of poor.locations) water.set(location.id, codeOf(location) === '07239' ? 1 : 2)
  transaction(poor, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(poor.campaign.scenarioResults.at(-1).resolution, 'resolution3', '不足 4 处 → 结局 3')
})

test('aLightInTheFog 地点与连接：同一行地点互相连接、灯光室垂直连接梯井、07239/07241 淹没上限', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  const row = s.locations.filter(location => positionOf(s, location.id).y === 0)
  assert.equal(row.length, 4, '第 0 行 4 个地点')
  for (const location of row) {
    for (const other of row) {
      if (other.id === location.id) continue
      assert.equal(location.connections.includes(other.id), true, `${location.name} 与同行 ${other.name} 连接`)
    }
  }
  const lantern = locationOf(s, '07241')
  const stairwell = locationOf(s, '07240')
  assert.equal(lantern.connections.includes(stairwell.id), true, '灯光室与灯塔梯井垂直连接')
  assert.equal(stairwell.connections.includes(lantern.id), true, '连接双向')
  const api = createMechanicsApi(s); const water = api.water
  water.set(locationOf(s, '07239').id, 2)
  assert.equal(floodLevel(s, locationOf(s, '07239').id), 1, '门房不能被完全淹没')
  water.set(locationOf(s, '07241').id, 2)
  assert.equal(floodLevel(s, locationOf(s, '07241').id), 0, '灯光室不能被淹没')
  assert.equal(water.canChange(locationOf(s, '07243').id, 1), true, '看门人小屋可涨水')
  assert.equal(water.canChange(locationOf(s, '07241').id, 1), false, '灯光室不可涨水')
})

test('aLightInTheFog 地点行为/钥匙：07241 白钥匙、07243 黄钥匙、07247 红钥匙+帷幕、07249 涨水、07250 全淹没+黑钥匙', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  const api = createMechanicsApi(s)
  const reveal = (code, x, y) => {
    placeAt(s, code, x, y)
    transaction(s, draft => revealLocation(draft, locationOf(draft, code).id, [], 0))
    return locationOf(s, code)
  }
  const lantern = locationOf(s, '07241')
  transaction(s, draft => revealLocation(draft, lantern.id, [], 0))
  assert.deepEqual(keysAt(s, `location:${lantern.id}`), ['white'], '灯光室揭示放白钥匙')
  const cottage = locationOf(s, '07243')
  transaction(s, draft => revealLocation(draft, cottage.id, [], 0))
  assert.deepEqual(keysAt(s, `location:${cottage.id}`), ['yellow'], '看门人小屋揭示放黄钥匙')
  const shrine = reveal('07247', 0, -1)
  assert.deepEqual(keysAt(s, `location:${shrine.id}`), ['red'], '海德拉祭坛揭示放红钥匙')
  const moon = reveal('07249', 0, -2)
  assert.equal(floodLevel(s, moon.id), 1, '月之室揭示提升淹没等级')
  const archives = reveal('07250', 0, -3)
  assert.equal(floodLevel(s, archives.id), 2, '沉没档案库揭示即完全淹没')
  assert.deepEqual(keysAt(s, `location:${archives.id}`), ['black'], '沉没档案库揭示放黑钥匙')
  // 07247 绿钥匙使帷幕 -3（同一地点调查员控制绿钥匙）。
  s.investigators[0].location = shrine.id
  assert.equal(api.keys.transfer('green', 'setAside', 'investigator:0', { reveal: true }), true)
  assert.equal(scenarioRuntime(s, []).locationShroud(shrine.id, 0), 2, '绿钥匙令祭坛帷幕 -3')
})

test('aLightInTheFog 遭遇与捕获：07260 失败被俘、07252 剧情翻面成拘禁室 07252b、07252b 限制与解救', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  s.chaosBag = ['autofail']
  draw(s, '07260')
  assert.equal(isCaptured(s, 1) || capturedSeats(s).length === 1, true, '07260 敏捷(4)失败被俘')
  const cells = locationOf(s, '07252b')
  assert.ok(cells, '07252 翻面成拘禁室入场')
  assert.deepEqual(positionOf(s, cells.id), { x: 5, y: 1, isolated: true }, '拘禁室孤立于 (5,1)，不属于任何行/列')
  assert.deepEqual(capturedAtLocation(s, cells.id), capturedSeats(s), '被俘者放在拘禁室')
  // 07252b：不能被淹没；敌人不能进入；控制黄钥匙时解救自动成功。
  createMechanicsApi(s).water.set(cells.id, 2)
  assert.equal(floodLevel(s, cells.id), 0, '拘禁室不能被淹没')
  assert.equal(registeredEntry('07252b').locationRule.enemiesCannotEnter, true)
  createMechanicsApi(s).keys.transfer('yellow', 'setAside', 'investigator:0', { reveal: true })
  s.investigators[0].location = cells.id
  const freeAction = legalMoves(s).find(command => command.action === 'entityAbility' && command.entityId === cells.id)
  assert.ok(freeAction, '拘留室解救行动出现')
  move(s, freeAction)
  settle(s)
  assert.equal(capturedSeats(s).length, 0, '控制黄钥匙自动成功解救')
})

test('aLightInTheFog 议程 07233 围捕：被俘推进议程、毁灭转移、全员被俘、地图扩张并直接推进 3a', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  s.agendaIndex = 1
  s.doom = 5
  placeAt(s, '07244', 2, -1)
  transaction(s, draft => scenarioRuntime(draft, []).capture(1, { source: '07252', keysTo: 'destination' }))
  assert.equal(s.agendaIndex, 2, '被俘触发当前密谋推进（07233 → 07234）')
  assert.equal(s.doom, 5, '毁灭移动到下个密谋')
  assert.equal(capturedSeats(s).length, 2, '背面「每位调查员被俘」')
  assert.equal(s.encounterDeck.filter(code => code === '07260').length, 2, '惨遭俘虏洗入遭遇牌库')
  assert.equal(codeOf(s.acts[s.actIndex]), '07238', '直接推进到场景 3a（不结算 2b）')
  assert.ok(locationOf(s, '07245') || locationOf(s, '07246'), '沉没岩洞扩张入场')
})

test('aLightInTheFog 混乱/帮助：07231 提示卡分支（skull 追加抽、tablet 淹没才伤害、cultist 涨水）', () => {
  const s = chapterFixture('aLightInTheFog', 1)
  const rule = registeredEntry('07231').scenarioRule
  const runtime = scenarioRuntime(s, [])
  const inv = s.investigators[0]
  assert.equal(rule.resolveChaosToken(s, inv, 'skull', runtime).delta, -1, '普通难度 skull -1')
  s.difficulty = 'hard'
  assert.equal(rule.resolveChaosToken(s, inv, 'skull', runtime).delta, -2, '困难难度 skull -2')
  s.difficulty = 'standard'
  assert.equal(rule.resolveChaosToken(s, inv, 'cultist', runtime).delta, -2)
  assert.equal(rule.resolveChaosToken(s, inv, 'tablet', runtime).delta, -3)
  assert.equal(rule.resolveChaosToken(s, inv, 'elderthing', runtime).delta, -4)
  const water = createMechanicsApi(s).water
  assert.equal(rule.resolveChaosToken(s, inv, 'skull', runtime).drawAnother, false, '未淹没时不追加抽标记')
  water.set(inv.location, 1)
  assert.equal(rule.resolveChaosToken(s, inv, 'skull', runtime).drawAnother, true, '已淹没时 skull 追加抽标记')
  const before = inv.damage
  rule.applyTokenEffect(s, inv, { event: 'damage', amount: 1 }, runtime)
  assert.equal(inv.damage, before + 1, '淹没地点的 tablet 失败伤害生效')
  water.set(inv.location, 0)
  rule.applyTokenEffect(s, inv, { event: 'damage', amount: 1 }, runtime)
  assert.equal(inv.damage, before + 1, '未淹没地点不追加伤害')
  // cultist 失败：把所在地点淹没等级 +1（换到可涨到 2 的沉没岩洞，门房本身上限为 1）。
  const basement = placeAt(s, '07244', 2, -1)
  s.investigators[0].location = basement.id
  water.set(basement.id, 1)
  rule.afterTest(s, s.investigators[0], { success: false }, runtime, { resolvedTokens: ['cultist'], ignoredSymbols: false })
  assert.equal(water.level(basement.id), 2, 'cultist 失败提高所在地点淹没等级')
})

test('aLightInTheFog 结局与记录：resolution1 记录潜水服/黑红钥匙，noResolution 重定向到 R4，R3 击杀全员', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  s.scenarioFlags.resignedInMoonRoom = [0]
  const actId = s.acts[s.actIndex].id
  const api = createMechanicsApi(s)
  api.keys.transfer('black', 'setAside', `act:${actId}`, { reveal: true })
  api.keys.transfer('red', 'setAside', `act:${actId}`, { reveal: true })
  transaction(s, draft => scenarioRuntime(draft, []).finish('resolution1'))
  const result = s.campaign.scenarioResults.at(-1)
  assert.equal(result.resolution, 'resolution1')
  assert.equal(result.recordsAfter.TheInvestigatorsPossessAMapOfYhaNthlei, true, '记录黑钥匙地图')
  assert.equal(result.recordsAfter.TheInvestigatorsPossessTheKeyToYhaNthlei, true, '记录红钥匙')
  assert.equal(s.campaign.investigators[0].records?.PossessesADivingSuit, true, '从月之室撤退者获得潜水服记录')
  assert.ok(result.story, '结局剧情已生成')
  // noResolution：agendaIndex<3 → 重定向到 resolution4。
  const redirect = chapterFixture('aLightInTheFog', 2)
  transaction(redirect, draft => scenarioRuntime(draft, []).finish('noResolution'))
  const redirected = redirect.campaign.scenarioResults.at(-1)
  assert.equal(redirected.resolution, 'noResolution')
  assert.equal(redirected.story.sections.some(section => section.title === 'resolution4'), true, '重定向展示结局4正文')
  // resolution3：击杀全员且不给经验。
  const wipe = chapterFixture('aLightInTheFog', 2)
  transaction(wipe, draft => scenarioRuntime(draft, []).finish('resolution3'))
  assert.equal(wipe.campaign.scenarioResults.at(-1).resolution, 'resolution3')
  assert.equal(Object.values(wipe.campaign.investigators).every(record => record.status === 'killed'), true, '结局3 击杀所有调查员')
})

test('aLightInTheFog 存档与恢复往返：网格行邻接/钥匙/拘禁室/被俘状态在 JSON 往返后一致且校验通过', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  transaction(s, draft => scenarioRuntime(draft, []).capture(1, { source: '07252', keysTo: 'destination' }))
  const restored = json(s)
  assert.doesNotThrow(() => validateMechanicState(restored), '往返存档通过机械状态校验')
  assert.deepEqual(restored.scenarioFlags.mechanics.keys, s.scenarioFlags.mechanics.keys, '钥匙状态一致')
  assert.deepEqual(restored.scenarioFlags.mechanics.grid, s.scenarioFlags.mechanics.grid, '地图网格一致')
  assert.deepEqual(capturedSeats(restored), capturedSeats(s), '被俘座位一致')
  assert.deepEqual(restored.locations.map(location => location.id).sort(), s.locations.map(location => location.id).sort())
  assert.equal(restored.investigators[1].location, s.investigators[1].location)
})
