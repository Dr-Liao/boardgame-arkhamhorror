// 印斯茅斯阴谋 P7 late B 组 7 张卡专属测试：
//   07232 议程·海湾浓雾（aLightInTheFog）
//   07235 议程·猎鹰岬的恐怖（aLightInTheFog）
//   07280 幕·第一誓约（theLairOfDagon）
//   07281 幕·第二誓约（theLairOfDagon）
//   07282 幕·第三誓约（theLairOfDagon）
//   07299 诡计·石障（theLairOfDagon）—— `treacheryRule.attachmentAbilities` +
//                                        `blocksMovementWhileReady` + api.scenario.exhaustLocationAttachment
//   07337 诡计·深海恐惧症（intoTheMaelstrom）
//
// 注册模式：单卡文件直接 import + registeredEntry 判空后 registerCardAbilities，让新条目
// 在本测试进程可见（索引只由 Lead 重建；本文件不写索引）。07232/07235/07337 已由主进程
// 合并进索引，这里的判空避免重复注册；07280–07282 / 07299 尚未进索引，因此必须直接注册。
//
// 事务约定：resolveTransaction 会用草稿整体替换 state，事务前拿到的实体实例在事务后失效，
// 断言一律按 id / code 重新取。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy, legalMoves, move, settle, validateMove } from './core-fixture.mjs'
import { resolveTransaction } from '../src/engine/resolution.js'
import { drawEncounter, scenarioRuntime } from '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { entityModifierTotal, entityRuleActive } from '../src/engine/modifiers.js'
import { parleyForbidden } from '../src/engine/parley.js'
import { keysAt } from '../src/engine/scenario-keys.js'
import { floodLevel } from '../src/engine/flood.js'
import { aloofPreventsAttack } from '../src/engine/engine.js'
import { originalOf } from '../src/cards/encounter-entries/_shared.js'

import card07232 from '../src/cards/encounter-entries/theInnsmouthConspiracy/aLightInTheFog/07232.js'
import card07235 from '../src/cards/encounter-entries/theInnsmouthConspiracy/aLightInTheFog/07235.js'
import card07280 from '../src/cards/encounter-entries/theInnsmouthConspiracy/theLairOfDagon/07280.js'
import card07281 from '../src/cards/encounter-entries/theInnsmouthConspiracy/theLairOfDagon/07281.js'
import card07282 from '../src/cards/encounter-entries/theInnsmouthConspiracy/theLairOfDagon/07282.js'
import card07299 from '../src/cards/encounter-entries/theInnsmouthConspiracy/theLairOfDagon/07299.js'
import card07337 from '../src/cards/encounter-entries/theInnsmouthConspiracy/intoTheMaelstrom/07337.js'

for (const entry of [card07232, card07235, card07280, card07281, card07282, card07299, card07337]) {
  if (!registeredEntry(entry.code)) registerCardAbilities([entry])
}

const codeOf = entity => entity?.originalCode || entity?.code
const locationByCode = (state, code) => state.locations.find(location => codeOf(location) === code) || null
const curseCount = state => createMechanicsApi(state).chaosTokens.count('curse')

function transaction(state, execute, select = () => null) {
  const run = draft => {
    try { return execute(draft) } catch (error) {
      if (error?.constructor?.name !== 'ScenarioEnded') throw error
    }
  }
  resolveTransaction(state, 0, { action: 'ticLateBCards' }, run)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 160, `choice loop: ${state.pendingChoice.source}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, run)
  }
}

function placeDefinition(state, code) {
  const id = Object.entries(state.scenario.locations)
    .find(([, definition]) => codeOf(definition) === code)?.[0]
  assert.ok(id, `chapter has no physical location definition for ${code}`)
  transaction(state, draft => { scenarioRuntime(draft, []).place(id) })
  const placed = locationByCode(state, code)
  assert.ok(placed, `location ${code} not placed`)
  return placed
}

// ---------------------------------------------------------------------------
// 07232 海湾浓雾（议程 1a / 1b）
// ---------------------------------------------------------------------------
test('07232 注册为 agenda：声明 doomToNextAgenda 与背面 onReveal', () => {
  const entry = registeredEntry('07232')
  assert.ok(entry)
  assert.equal(entry.scope, 'agenda')
  assert.equal(entry.implemented, true)
  assert.equal(entry.agendaRule.doomToNextAgenda, true)
  assert.equal(typeof entry.agendaRule.onReveal, 'function')
})

test('07232 背面：毁灭移到下个密谋、马什与队长交战带蓝钥匙、全员失线索、灯塔地下室入场、场景直接推进 2a', () => {
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
  assert.equal(codeOf(s.acts[s.actIndex]), '07237', '不结算 07236b')
  const marsh = s.enemies.find(candidate => codeOf(candidate) === '07253')
  assert.ok(marsh, '马什从 setAside 生成')
  assert.equal(marsh.engagedSeat, leadSeat, '与调查员队长交战')
  assert.equal(marsh.location, s.investigators[leadSeat].location, '生成在队长所在地点')
  assert.equal(keysAt(s, `enemy:${marsh.id}`).includes('blue'), true, '蓝钥匙在马什上')
  assert.equal(s.encounterDeck.filter(code => code === '07259').length, 2, '尽腥尽力洗回遭遇牌库')
  assert.deepEqual(createMechanicsApi(s).map.position(locationByCode(s, '07244').id),
    { x: 2, y: -1, isolated: false }, '灯塔地下室放在灯塔梯井正下方')
  for (const inv of s.investigators) assert.equal(inv.clues, 0, '每位调查员失去所有线索')
})

// ---------------------------------------------------------------------------
// 07235 猎鹰岬的恐怖（议程 4a / 4b）
// ---------------------------------------------------------------------------
test('07235 注册为 agenda：马什生命修正 + 背面 onReveal', () => {
  const entry = registeredEntry('07235')
  assert.ok(entry)
  assert.equal(entry.scope, 'agenda')
  assert.equal(entry.implemented, true)
  assert.equal(entry.modifiers.length, 1)
  assert.equal(entry.modifiers[0].target, 'enemyHealth')
  assert.equal(typeof entry.agendaRule.onReveal, 'function')
})

test('07235 正面：只有奥赛罗思·马什得到 +2[每调查员] 生命值', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  const here = s.investigators[0].location
  const marsh = scenarioRuntime(s, []).spawn('07253', here)
  const other = scenarioRuntime(s, []).spawn('07078', here)
  s.agendaIndex = 3
  const marshNow = s.enemies.find(candidate => candidate.id === marsh.id)
  const otherNow = s.enemies.find(candidate => candidate.id === other.id)
  assert.equal(entityModifierTotal(s, marshNow, 'enemyHealth'), 4, '2 位调查员 → +4 生命')
  assert.equal(entityModifierTotal(s, otherNow, 'enemyHealth'), 0, '只加在马什身上')
})

test('07235 背面：可提升地点不足 4 张 → 结局 3', () => {
  const s = chapterFixture('aLightInTheFog', 1)
  s.agendaIndex = 3
  const water = createMechanicsApi(s).water
  for (const location of s.locations) water.set(location.id, codeOf(location) === '07239' ? 1 : 2)
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.campaign.scenarioResults.at(-1).scenarioId, 'aLightInTheFog')
  assert.equal(s.campaign.scenarioResults.at(-1).resolution, 'resolution3', '进入（→结局3）')
})

test('07235 背面：足够 4 张时提升最底下 4 处并翻回正面继续', () => {
  const s = chapterFixture('aLightInTheFog', 1)
  s.agendaIndex = 3
  assert.equal(s.locations.filter(location => createMechanicsApi(s).water.canChange(location.id, 1)).length, 4,
    '开场 4 个地点能涨水（灯光室本身不可淹没）')
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.agendaIndex, 3, '翻回正面继续，不离开当前密谋')
  assert.equal(s.locations.filter(location => floodLevel(s, location.id) > 0).length, 4, '最底下 4 处涨水')
})

// ---------------------------------------------------------------------------
// 07280 第一誓约（幕 1）
// ---------------------------------------------------------------------------
const oathFrontModifiers = entry => entry.modifiers.map(modifier => modifier.target)

test('07280 注册为 act：三行实体规则 + 免费弃屏障能力 + 目标函数', () => {
  const entry = registeredEntry('07280')
  assert.ok(entry)
  assert.equal(entry.scope, 'act')
  assert.equal(entry.implemented, true)
  assert.deepEqual(oathFrontModifiers(entry), ['enemyHealth', 'loses:aloof', 'cannot:parley'])
  assert.equal(typeof entry.actRule.objective, 'function')
  assert.equal(typeof entry.actRule.onReveal, 'function')
  const ability = entry.abilities[0]
  assert.equal(ability.kind, 'free')
  assert.equal(ability.actionKind, 'activate')
  assert.deepEqual(ability.additionalKeyCost.colors, ['blue', 'red', 'white', 'yellow'])
})

test('07280 正面：[[嫌犯]]敌人 +1[每调查员]生命、失去冷漠、不能谈判；非嫌犯不受影响', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  s.enemies = []
  for (const inv of s.investigators) inv.engaged = []
  const here = s.investigators[0].location
  const suspect = enemy(s, { code: '07076', location: here, engagedSeat: null, aloof: true,
    traits: ['Humanoid', 'Monster', 'Suspect'] })
  const other = enemy(s, { code: '07079', location: here, engagedSeat: null, aloof: true,
    traits: ['Humanoid', 'Monster'] })
  const suspectNow = s.enemies.find(candidate => candidate.id === suspect.id)
  const otherNow = s.enemies.find(candidate => candidate.id === other.id)
  assert.equal(entityModifierTotal(s, suspectNow, 'enemyHealth'), 2, '2 位调查员 → +2 生命')
  assert.equal(entityRuleActive(s, suspectNow, 'loses:aloof'), true)
  assert.equal(entityRuleActive(s, suspectNow, 'cannot:parley'), true)
  assert.equal(aloofPreventsAttack(s, s.investigators[0], suspectNow), false, '失去冷漠后可以攻击')
  assert.equal(parleyForbidden(s, s.investigators[0], suspectNow), true)
  assert.equal(entityModifierTotal(s, otherNow, 'enemyHealth'), 0)
  assert.equal(entityRuleActive(s, otherNow, 'loses:aloof'), false)
  assert.equal(entityRuleActive(s, otherNow, 'cannot:parley'), false)
})

test('07280 目标：全员在宏伟入口且“解锁了洞穴的入口”才推进', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  s.actIndex = 0
  const grand = locationByCode(s, '07283')
  const rule = registeredEntry('07280').actRule
  assert.equal(rule.objective(s, s.acts[0], scenarioRuntime(s, [])), false, '未解锁时不推进')
  scenarioRuntime(s, []).remember('UnlockedTheEntranceToTheCaves')
  assert.equal(rule.objective(s, s.acts[0], scenarioRuntime(s, [])), true, '全员在宏伟入口且已解锁 → 推进')
  const outsider = s.locations.find(location => location.id !== grand.id)
  s.investigators[1].location = outsider.id
  assert.equal(rule.objective(s, s.acts[0], scenarioRuntime(s, [])), false, '有人不在宏伟入口时不推进')
})

test('07280 [fast]：花费蓝/红/白/黄钥匙弃掉你所在地点的[[屏障]]（07299）', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  s.enemies = []
  for (const inv of s.investigators) inv.engaged = []
  const grand = locationByCode(s, '07283')
  s.investigators[0].location = grand.id
  scenarioRuntime(s, []).attachToLocation(grand.id, { code: '07299', originalCode: '07299' })
  const actId = s.acts[s.actIndex].id
  const actAbilityMove = () => legalMoves(s).find(command => command.action === 'entityAbility'
    && command.entityId === actId && command.abilityIndex === 0)
  assert.equal(actAbilityMove(), undefined, '没有蓝/红/白/黄钥匙时能力不可用')
  createMechanicsApi(s).keys.transfer('blue', 'setAside', 'investigator:0', { reveal: true })
  const command = actAbilityMove()
  assert.ok(command, '持有蓝色钥匙后能力出现在合法列表')
  move(s, command)
  settle(s)
  const locationNow = locationByCode(s, '07283')
  assert.equal((locationNow.attachments || []).some(card => codeOf(card) === '07299'), false, '屏障被弃掉')
  assert.equal(s.encounterDiscard.filter(code => code === '07299').length, 1)
  assert.equal(keysAt(s, 'reference').includes('blue'), true, '钥匙进入场景参考区')
  assert.equal(actAbilityMove(), undefined, '没有屏障后能力不再出现')
})

test('07280 背面：移出嫌犯/旧地点、潮水通道全部入场、全场涨水、朔望与星潮合相洗回遭遇牌库', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  s.enemies = []
  for (const inv of s.investigators) inv.engaged = []
  const grand = locationByCode(s, '07283')
  const suspect = enemy(s, { code: '07076', location: grand.id, engagedSeat: null,
    traits: ['Humanoid', 'Monster', 'Suspect'] })
  s.encounterDiscard = ['01165']
  const oldRooms = s.locations.map(location => codeOf(location)).filter(code => code !== '07283')
  assert.ok(oldRooms.length >= 6)
  transaction(s, draft => scenarioRuntime(draft, []).advanceAct())
  assert.equal(s.actIndex, 1, '推进到第二誓约')
  assert.equal(codeOf(s.acts[s.actIndex]), '07281')
  assert.equal(s.enemies.some(candidate => candidate.id === suspect.id), false, '嫌犯敌人被移出游戏')
  assert.equal(s.removedFromGame.includes('07076'), true)
  assert.equal(locationByCode(s, '07283') !== null, true, '宏伟入口保留')
  for (const code of oldRooms) assert.equal(locationByCode(s, code), null, `旧地点 ${code} 已移出游戏`)
  const inPlayCodes = s.locations.map(location => codeOf(location))
  assert.equal(inPlayCodes.length, 8, '宏伟入口 + 7 张潮水通道')
  for (const code of ['07102', '07103', '07104', '07290']) {
    assert.ok(inPlayCodes.includes(code), `潮水通道 ${code} 入场`)
  }
  for (const location of s.locations) {
    assert.equal(createMechanicsApi(s).water.level(location.id), 1, `「${location.name}」淹没等级 +1`)
  }
  assert.equal(s.encounterDeck.filter(code => code === '07101').length, 2, '朔望洗回遭遇牌库')
  assert.equal(s.encounterDeck.filter(code => code === '07100').length, 2, '星潮合相洗回遭遇牌库')
  assert.equal(s.encounterDeck.includes('01165'), true, '遭遇弃牌堆一起洗回')
  assert.deepEqual(s.encounterDiscard, [], '遭遇弃牌堆清空')
  assert.equal(s.scenarioZones.setAside.includes('07100'), false)
  assert.equal(s.scenarioZones.setAside.includes('07101'), false)
})

// ---------------------------------------------------------------------------
// 07281 第二誓约（幕 2）
// ---------------------------------------------------------------------------
test('07281 注册为 act：三行实体规则 + 免费弃屏障能力 + 解锁最终深渊目标', () => {
  const entry = registeredEntry('07281')
  assert.ok(entry)
  assert.equal(entry.scope, 'act')
  assert.equal(entry.implemented, true)
  assert.deepEqual(oathFrontModifiers(entry), ['enemyHealth', 'loses:aloof', 'cannot:parley'])
  assert.equal(typeof entry.actRule.objective, 'function')
  assert.equal(typeof entry.actRule.onReveal, 'function')
})

test('07281 目标：有调查员“解锁了最终深渊”才推进', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  s.actIndex = 1
  const rule = registeredEntry('07281').actRule
  assert.equal(rule.objective(s, s.acts[1], scenarioRuntime(s, [])), false)
  scenarioRuntime(s, []).remember('UnlockedTheFinalDepths')
  assert.equal(rule.objective(s, s.acts[1], scenarioRuntime(s, [])), true)
})

test('07281 背面：达贡巢穴完全淹没入场、沉睡达贡入场、密谋1a 加 10 诅咒', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  s.actIndex = 1
  s.agendaIndex = 0
  assert.equal(s.scenarioZones.setAside.includes('07292a'), true)
  s.chaosBag = ['0']
  transaction(s, draft => scenarioRuntime(draft, []).advanceAct())
  assert.equal(s.actIndex, 2)
  assert.equal(codeOf(s.acts[s.actIndex]), '07282')
  const lair = locationByCode(s, '07291')
  assert.ok(lair, '达贡巢穴入场')
  assert.equal(createMechanicsApi(s).water.level(lair.id), 2, '完全淹没')
  const dagon = s.enemies.find(candidate => codeOf(candidate) === '07292a')
  assert.ok(dagon, '沉睡达贡（07292a）入场')
  assert.equal(dagon.location, lair.id, '放在达贡巢穴')
  assert.equal(curseCount(s), 10, '密谋 1a：加入 10 个诅咒标记')
  assert.equal(s.scenarioZones.setAside.includes('07292a'), false)
})

test('07281 背面：密谋2a 加 5 诅咒、密谋3a 不加诅咒', () => {
  for (const [agendaIndex, expected] of [[1, 5], [2, 0]]) {
    const s = chapterFixture('theLairOfDagon', 1)
    s.actIndex = 1
    s.agendaIndex = agendaIndex
    s.chaosBag = ['0']
    transaction(s, draft => scenarioRuntime(draft, []).advanceAct())
    assert.equal(curseCount(s), expected, `密谋 ${agendaIndex + 1}a → ${expected} 诅咒`)
    assert.equal(createMechanicsApi(s).water.level(locationByCode(s, '07291').id), 2)
  }
})

// ---------------------------------------------------------------------------
// 07282 第三誓约（幕 3）
// ---------------------------------------------------------------------------
test('07282 注册为 act：三行实体规则 + 本幕线索目标', () => {
  const entry = registeredEntry('07282')
  assert.ok(entry)
  assert.equal(entry.scope, 'act')
  assert.equal(entry.implemented, true)
  assert.deepEqual(oathFrontModifiers(entry), ['enemyHealth', 'loses:aloof', 'cannot:parley'])
  assert.equal(typeof entry.actRule.objective, 'function')
  assert.equal(typeof entry.actRule.onReveal, 'function')
})

test('07282 目标：本幕上的线索达到 3[每调查员] 才推进', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  s.actIndex = 2
  const rule = registeredEntry('07282').actRule
  s.actClues = 0
  assert.equal(rule.objective(s, s.acts[2], scenarioRuntime(s, [])), false)
  s.actClues = 3 * s.numInvestigators - 1
  assert.equal(rule.objective(s, s.acts[2], scenarioRuntime(s, [])), false)
  s.actClues = 3 * s.numInvestigators
  assert.equal(rule.objective(s, s.acts[2], scenarioRuntime(s, [])), true)
})

test('07282 背面：达贡沉睡时记录仪式被破坏与仍沉睡 → 结局1', () => {
  const s = chapterFixture('theLairOfDagon', 2)
  s.actIndex = 2
  scenarioRuntime(s, []).spawn('07292a', s.investigators[0].location)
  transaction(s, draft => scenarioRuntime(draft, []).advanceAct())
  assert.equal(s.campaign.records.TheOrdersRitualWasDisrupted, true)
  assert.equal(s.campaign.records.DagonStillSlumbers, true)
  assert.equal(s.campaign.records.DagonHasAwakened, undefined)
  assert.equal(s.campaign.scenarioResults.at(-1).resolution, 'resolution1')
})

test('07282 背面：达贡苏醒（在场或胜利区）时记录已苏醒 → 结局1', () => {
  for (const viaVictory of [false, true]) {
    const s = chapterFixture('theLairOfDagon', 2)
    s.actIndex = 2
    if (viaVictory) {
      s.victoryDisplay = [{ id: 'v07292b', code: '07292b', originalCode: '07292b', name: '达贡', victory: 0 }]
    } else {
      scenarioRuntime(s, []).spawn('07292b', s.investigators[0].location)
    }
    transaction(s, draft => scenarioRuntime(draft, []).advanceAct())
    assert.equal(s.campaign.records.TheOrdersRitualWasDisrupted, true)
    assert.equal(s.campaign.records.DagonHasAwakened, true,
      viaVictory ? '胜利区的苏醒达贡' : '场上的苏醒达贡')
    assert.equal(s.campaign.records.DagonStillSlumbers, undefined)
    assert.equal(s.campaign.scenarioResults.at(-1).resolution, 'resolution1')
  }
})

// ---------------------------------------------------------------------------
// 07337 深海恐惧症（诡计）
// ---------------------------------------------------------------------------
function resolveThalassophobia(state) {
  let returned
  transaction(state, draft => {
    returned = registeredEntry('07337').encounterResolve(draft, draft.investigators[0],
      { code: '07337' }, scenarioRuntime(draft, []))
  })
  return returned
}

test('07337 注册为 treachery 且实现现通道', () => {
  const entry = registeredEntry('07337')
  assert.ok(entry)
  assert.equal(entry.scope, 'treachery')
  assert.equal(entry.implemented, true)
  assert.equal(typeof entry.encounterResolve, 'function')
})

test('07337：没有调查员在淹没地点 → 获得涌动且不造成恐惧', () => {
  const s = chapterFixture('intoTheMaelstrom', 2)
  const water = createMechanicsApi(s).water
  for (const location of s.locations) water.set(location.id, 0)
  const returned = resolveThalassophobia(s)
  assert.deepEqual(returned, { gainSurge: true })
  for (const inv of s.investigators) assert.equal(inv.horror, 0)
})

test('07337：部分淹没 1 恐惧、完全淹没 1 直接恐惧，两者互不影响', () => {
  const s = chapterFixture('intoTheMaelstrom', 2)
  const partial = s.locations.find(location => floodLevel(s, location.id) === 1)
  const full = placeDefinition(s, '07324')
  assert.ok(partial && full)
  assert.equal(floodLevel(s, full.id), 2, '07324 入场即完全淹没')
  s.investigators[0].location = partial.id
  s.investigators[1].location = full.id
  const returned = resolveThalassophobia(s)
  assert.equal(returned, false, '有淹没者时不涌动')
  assert.equal(s.investigators[0].horror, 1, '部分淹没：1 点恐惧')
  assert.equal(s.investigators[1].horror, 1, '完全淹没：1 点直接恐惧')
  assert.equal(s.investigators[0].damage, 0)
  assert.equal(s.investigators[1].damage, 0)
})

// ---------------------------------------------------------------------------
// 07299 石障（诡计 · 地点附属行动）
// ---------------------------------------------------------------------------
function stoneBarrierRoute(count = 1) {
  const s = chapterFixture('theLairOfDagon', count)
  s.enemies = []
  for (const inv of s.investigators) inv.engaged = []
  const route = s.locations.slice(0, 3)
  assert.equal(route.length, 3, '需要 3 个地点组成一条路线')
  for (const location of s.locations) location.connections = []
  const map = createMechanicsApi(s).map
  map.connect(route[0].id, route[1].id)
  map.connect(route[1].id, route[2].id)
  s.investigators[0].location = route[0].id
  const water = createMechanicsApi(s).water
  for (const location of route) water.set(location.id, 0)
  return { s, route }
}

const stoneBarrierAt = (state, locationId) =>
  (state.locations.find(location => location.id === locationId)?.attachments || [])
    .find(attachment => codeOf(attachment) === '07299')

function drawStoneBarrier(state) {
  state.encounterDeck.push('07299')
  transaction(state, draft => drawEncounter(draft, draft.investigators[0], []))
}

const chooseAgility = choice => (choice.options?.some(option => option.id === 'agility') ? 'agility' : null)

test('07299 注册为 treachery：地点附属行动 + 重整时封锁移动声明', () => {
  const entry = registeredEntry('07299')
  assert.ok(entry)
  assert.equal(entry.scope, 'treachery')
  assert.equal(entry.implemented, true)
  assert.equal(typeof entry.encounterResolve, 'function')
  assert.equal(entry.treacheryRule.blocksMovementWhileReady, true)
  assert.equal(entry.treacheryRule.attachmentAbilities.length, 1)
  assert.equal(entry.treacheryRule.attachmentAbilities[0].actionKind, 'activate')
})

test('07299 显现：附属到最近且没有石障的地点，不弃牌；第二张落到下一个最近地点', () => {
  const { s, route } = stoneBarrierRoute()
  drawStoneBarrier(s)
  const first = stoneBarrierAt(s, route[0].id)
  assert.ok(first, '附属到最近地点（调查员所在地点）')
  assert.equal(first.exhausted, false, '入场为重整状态')
  assert.equal(s.encounterDiscard.includes('07299'), false, '附属后不进入遭遇弃牌堆')
  drawStoneBarrier(s)
  assert.ok(stoneBarrierAt(s, route[1].id), '第二张附属到下一个最近且无石障的地点')
  assert.equal((s.locations.find(location => location.id === route[0].id).attachments || [])
    .filter(attachment => codeOf(attachment) === '07299').length, 1, '同一地点不重复附属')
  assert.equal(s.encounterDiscard.includes('07299'), false)
})

test('07299 显现：附属地点已淹没时获得涌动', () => {
  const { s, route } = stoneBarrierRoute()
  createMechanicsApi(s).water.set(route[0].id, 1)
  let returned
  transaction(s, draft => {
    returned = registeredEntry('07299').encounterResolve(draft, draft.investigators[0],
      { code: '07299' }, scenarioRuntime(draft, []))
  })
  assert.equal(returned.placed, true)
  assert.equal(returned.gainSurge, true, '已淹没 → 涌动')
  assert.ok(stoneBarrierAt(s, route[0].id))
})

test('07299 行动：检定敏捷(1)/战力(2)/智力(3)，失败不横置、成功横置；重整时不能离开，补给阶段重整', () => {
  const { s, route } = stoneBarrierRoute()
  drawStoneBarrier(s)
  const outMove = { action: 'move', locationId: route[1].id }
  assert.notEqual(validateMove(s, 0, outMove), null, '石障重整时不能离开附属地点')
  assert.equal(legalMoves(s).some(command => command.action === 'move' && command.locationId === route[1].id), false)

  // 失败（autofail）：不横置。
  s.chaosBag = ['autofail']
  const first = stoneBarrierAt(s, route[0].id)
  let action = legalMoves(s).find(command => command.action === 'entityAbility' && command.entityId === first.id)
  assert.ok(action, '地点附属自身行动出现在合法列表')
  move(s, action)
  settle(s, chooseAgility)
  assert.equal(s.lastTestResult.difficulty, 1, '敏捷(1)')
  assert.equal(stoneBarrierAt(s, route[0].id).exhausted, false, '检定失败不横置')

  // 成功：横置并解除移动封锁。
  s.investigators[0].agility = 9
  s.chaosBag = ['0']
  action = legalMoves(s).find(command => command.action === 'entityAbility' && command.entityId === first.id)
  assert.ok(action)
  move(s, action)
  settle(s, chooseAgility)
  assert.equal(stoneBarrierAt(s, route[0].id).exhausted, true, '检定成功横置石障')
  assert.equal(validateMove(s, 0, outMove), null, '横置后可以离开')

  // 补给阶段重整地点附属（07299 声明了 attachmentAbilities）。
  const restored = JSON.parse(JSON.stringify(s))
  restored.currentSeat = 0
  move(restored, { action: 'endTurn' })
  settle(restored)
  assert.equal(stoneBarrierAt(restored, route[0].id).exhausted, false, '补给阶段重整石障')
  assert.notEqual(validateMove(restored, 0, outMove), null, '重新封锁离开')
})

