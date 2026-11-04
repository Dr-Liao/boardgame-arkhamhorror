// TIC 第七章「达贡巢穴 theLairOfDagon」逐章验收测试（P7 · w2 batch C）。
//
// 口径：tools/audit-tic-scenarios.mjs 的行为类检查（setupAndZones / actsAndAgendas /
// locationsAndConnections / encounterBehaviors / chaosEffects / resolutionsAndRecords / saveReplay）
// 只认「本章验收测试文件 + 实跑通过 + 通过用例标题命中该项关键词」。
// 本文件因此每例标题显式带对应关键词，正文全部走真实 chapterFixture('theLairOfDagon') 开局与引擎
// 写入口（不直写 state 规则；测试夹具改状态的部分是布置棋盘，不替代卡牌行为）。
//
// 覆盖：开局区域/初始地点/随机槽位/钥匙/旁置区(守恒)、幕 07280-82 目标与背面、议程 07276-79
// （含变体 07275/07277）、地点 07283-07291 与连接、敌人 07292a/b/07293/07294、诡计 07295-07299、
// 提示卡 07274 的混乱标记口径、结局记录、JSON 存档往返与恢复后继续。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy, move, settle } from './core-fixture.mjs'
import { drawEncounter, enemyHealth, legalMoves, revealLocation, validateMove, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { keysAt } from '../src/engine/scenario-keys.js'
import { registeredEntry } from '../src/engine/ability.js'
import { lateAfterChaosBagSetup } from '../content/campaigns/theInnsmouthConspiracy/late-setup.js'

const json = value => JSON.parse(JSON.stringify(value))
const codeOf = entity => entity?.originalCode || entity?.code
const lairFixture = (count = 1, options = {}) => chapterFixture('theLairOfDagon', count, options)

// ScenarioEnded 是剧本收尾信号：测试里在事务内部捕获，其余异常照常抛出。
function transaction(state, execute, select = () => null) {
  const run = draft => {
    try { return execute(draft) } catch (error) {
      if (error.constructor?.name !== 'ScenarioEnded') throw error
      return 'scenario-ended'
    }
  }
  resolveTransaction(state, 0, { action: 'ticLairAcceptance' }, run)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 100, `choice loop ${state.pendingChoice.source}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0]?.id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, run)
  }
}
const locationOf = (state, code) => state.locations.find(location => codeOf(location) === code)
function placePrinted(state, code) {
  const existing = locationOf(state, code)
  if (existing) return existing
  const definition = Object.entries(state.scenario.locations).find(([, location]) => codeOf(location) === code)
  assert.ok(definition, `chapter has no physical definition for ${code}`)
  scenarioRuntime(state, []).place(definition[0])
  const placed = locationOf(state, code)
  assert.ok(placed, `${code} did not enter play`)
  return placed
}
function draw(state, code) {
  state.encounterDeck.push(code)
  transaction(state, draft => drawEncounter(draft, draft.investigators[0], []))
}
function lastResult(state) {
  return state.campaign.scenarioResults.at(-1) || null
}

// ===========================================================================
// 1) setupAndZones：真实开局、区域守恒、钥匙、旁置区
// ===========================================================================
test('theLairOfDagon setup：真实开局的初始地点/随机槽位/区域守恒', () => {
  const s = lairFixture()
  const codes = s.locations.map(codeOf).sort()
  assert.deepEqual(codes, ['07283', '07284', '07285', '07286', '07287', '07288', '07289'],
    '固定地点 07283/07286/07289 + 两组随机槽位（07284/07285、07287/07288）')
  assert.deepEqual(s.acts.map(codeOf), ['07280', '07281', '07282'])
  assert.deepEqual(s.agendas.map(codeOf), ['07276', '07278', '07279'], '无记忆时议程取 else 分支')
  assert.equal(s.actIndex, 0)
  assert.equal(s.agendaIndex, 0)
  const start = locationOf(s, '07283')
  assert.equal(start.id, s.scenario.startLocation)
  assert.equal(start.revealed, true, '起始地点已揭示')
  assert.equal(s.scenario.startLocation, start.id)
  assert.ok(s.investigators.every(inv => inv.location === start.id), '全体调查员在宏伟入口')
  assert.notEqual(locationOf(s, '07286').revealed, true, '其余地点未揭示')
  assert.equal(s.encounterDeck.length, 27, '遭遇牌库按章节数据 27 张')
  // 区域守恒：旁置地点定义既不在地图上，也没有丢失定义；旁置遭遇/物理卡在 setAside。
  assert.equal(s.locations.length, 7)
  const setAsideLocations = s.scenario.setAsideLocations || []
  assert.ok(setAsideLocations.length >= 8)
  assert.ok(setAsideLocations.every(id => !s.locations.some(location => location.id === id)), '旁置地点不在场')
  for (const code of ['07290', '07291']) {
    assert.ok(Object.values(s.scenario.locations).some(definition => codeOf(definition) === code), `定义 ${code} 存在`)
  }
  // JSON 往返后区域与初始位置不漂移。
  const restored = json(s)
  assert.deepEqual(restored.locations.map(codeOf).sort(), codes)
  assert.deepEqual(restored.scenarioZones.setAside, s.scenarioZones.setAside)
})

test('theLairOfDagon setup：钥匙初始状态、旁置区与章节机制（air/adjacency）', () => {
  const s = lairFixture()
  const keys = s.scenarioFlags.mechanics.keys
  assert.equal(Object.keys(keys).length, 7, '7 把钥匙（5 正面 + 2 隐藏洗混）')
  for (const color of ['black', 'blue', 'green', 'purple', 'red']) {
    assert.deepEqual(keys[color], { holder: 'setAside', revealed: true }, `${color} 钥匙正面放在一边`)
  }
  for (const color of ['white', 'yellow']) {
    assert.deepEqual(keys[color], { holder: 'setAside', revealed: false }, `${color} 钥匙隐藏放在一边`)
  }
  assert.equal(keysAt(s, 'setAside').filter(color => color !== 'unrevealed').length, 5)
  assert.equal(keysAt(s, 'setAside').filter(color => color === 'unrevealed').length, 2)
  const setAside = s.scenarioZones.setAside
  for (const code of ['07100', '07101', '07293', '07292a', '07300']) {
    assert.ok(setAside.includes(code), `${code} 放在一边`)
  }
  assert.equal(setAside.filter(code => code === '07100').length, 2)
  assert.equal(setAside.filter(code => code === '07101').length, 2)
  assert.equal(s.scenario.mechanics.water.air, true, '本章求取空气由 mechanics.water.air 承担')
  assert.equal(s.scenario.mechanics.water.damage, 5)
  assert.equal(s.scenarioFlags.mechanics.gridAdjacency, 'none', '达贡巢穴不做自动网格邻接')
  assert.deepEqual(s.scenarioFlags.mechanics.grid ? Object.keys(s.scenarioFlags.mechanics.grid).sort() : [],
    s.locations.map(location => location.id).sort())
  // 旁置区 + 场上区域 + 牌库不重复收容同一物理卡（除设计上的 2 份副本）。
  assert.equal(setAside.includes('07082'), true, '无「决定共同进退」记忆时托马斯·道森放在一边')
})

test('章节开局混乱标记：记忆数决定祝福/诅咒袋（afterChaosBagSetup）', () => {
  // 注：chapterFixture 末尾把 chaosBag 归一为 ['0']（测试确定性），所以这里直接观察章节
  // setup 钩子对标记池的写入（同一钩子在真实开局时已执行过一次）。
  const fresh = lairFixture()
  fresh.chaosBag = []
  lateAfterChaosBagSetup(fresh, [], scenarioRuntime(fresh, []))
  assert.equal(createMechanicsApi(fresh).chaosTokens.count('bless'), 5, '记忆 ≤4：加入 5 个祝福标记')
  const middle = lairFixture(1, { memoriesRecovered: ['a', 'b', 'c', 'd', 'e'] })
  middle.chaosBag = []
  lateAfterChaosBagSetup(middle, [], scenarioRuntime(middle, []))
  assert.equal(createMechanicsApi(middle).chaosTokens.count('curse'), 2, '记忆 5-7：加入 2 个诅咒标记')
  const late = lairFixture(1, { memoriesRecovered: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] })
  late.chaosBag = []
  lateAfterChaosBagSetup(late, [], scenarioRuntime(late, []))
  assert.equal(createMechanicsApi(late).chaosTokens.count('curse'), 5, '记忆 ≥8：加入 5 个诅咒标记')
})

// ===========================================================================
// 2) actsAndAgendas：幕 07280-82 目标与背面 / 议程 07276-79
// ===========================================================================
test('幕 07280 目标：全员在宏伟入口且解锁洞穴入口时才成立（objective）', () => {
  const s = lairFixture(2)
  const objective = registeredEntry('07280').actRule.objective
  const grand = locationOf(s, '07283')
  s.investigators[1].location = s.locations.find(location => location.id !== grand.id).id
  assert.equal(objective(s), false, '有调查员不在宏伟入口')
  s.investigators[1].location = grand.id
  assert.equal(objective(s), false, '未解锁洞穴入口')
  scenarioRuntime(s, []).scenarioFlag
  s.scenarioFlags.remembered = ['UnlockedTheEntranceToTheCaves']
  assert.equal(objective(s), true, '全员在宏伟入口且已解锁')
  s.investigators[1].resigned = true
  assert.equal(objective(s), true, '撤退调查员不计入「幸存调查员」')
})

test('幕 07280 背面：移除旧地点、潮水通道入场、提升淹没并洗回朔望/星潮合相', () => {
  const s = lairFixture()
  s.enemies = []
  const suspect = enemy(s, { code: '07078', originalCode: '07078', traits: ['Suspect'],
    location: s.investigators[0].location })
  transaction(s, draft => scenarioRuntime(draft, []).advanceAct())
  assert.equal(s.actIndex, 1, '进入幕 2')
  const codes = s.locations.map(codeOf)
  assert.deepEqual(codes.filter(code => code === '07283'), ['07283'], '宏伟入口保留')
  assert.equal(codes.includes('07286'), false, '其余旧地点移出游戏')
  assert.equal(codes.includes('07289'), false)
  const tidalCodes = ['07102', '07103', '07104', '07290']
  const tidal = codes.filter(code => tidalCodes.includes(code))
  assert.equal(tidal.length, 7, '放在一边的 7 个潮水通道地点全部入场')
  assert.ok(s.locations.every(location => createMechanicsApi(s).water.level(location.id) >= 1), '每个地点提升淹没等级')
  assert.equal(s.encounterDeck.filter(code => code === '07100' || code === '07101').length, 4, '朔望/星潮合相混洗入遭遇牌库')
  assert.equal(s.encounterDeck.includes('07102'), false, '潮水通道地点不留在遭遇牌库')
  assert.equal((s.removedFromGame || []).includes('07078'), true, '在场的嫌犯被移出游戏')
  assert.ok(!s.enemies.includes(suspect))
  assert.equal(s.scenarioZones.setAside.filter(code => code === '07100' || code === '07101').length, 0,
    '朔望/星潮合相已从旁置区洗入遭遇牌库')
})

test('幕 07281 背面：达贡巢穴完全淹没、沉睡达贡入场、诅咒按密谋次序加入', () => {
  const s = lairFixture()
  s.enemies = []
  s.actIndex = 1
  transaction(s, draft => scenarioRuntime(draft, []).advanceAct())
  assert.equal(s.actIndex, 2, '进入幕 3')
  const lair = locationOf(s, '07291')
  assert.ok(lair, '达贡巢穴入场')
  assert.equal(createMechanicsApi(s).water.level(lair.id), 2, '达贡巢穴完全淹没')
  const dagon = s.enemies.find(entity => codeOf(entity) === '07292a')
  assert.ok(dagon, '沉睡达贡入场')
  assert.equal(dagon.location, lair.id)
  assert.equal(createMechanicsApi(s).chaosTokens.count('curse'), 10, '密谋 1a 时加入 10 个诅咒标记')
  assert.equal(s.scenarioZones.setAside.includes('07292a'), false, '达贡从旁置区取出')
})

test('幕 07282 背面：记录仪式被破坏与达贡仍沉睡，结算结局 1', () => {
  const s = lairFixture()
  s.enemies = []
  s.actIndex = 2
  scenarioRuntime(s, []).spawn('07292a', s.investigators[0].location)
  transaction(s, draft => scenarioRuntime(draft, []).advanceAct())
  assert.equal(s.campaign.records.TheOrdersRitualWasDisrupted, true, '记录仪式被破坏')
  assert.equal(s.campaign.records.DagonStillSlumbers, true, '沉睡达贡在场 → 记录仍沉睡')
  assert.equal(lastResult(s)?.resolution, 'resolution1', '背面的 (→结局 1)')
  assert.equal(s.campaign.failed ?? false, false)
})

test('议程 07276：移除混乱袋诅咒并让越狱嫌犯横置于三楼（无蓝钥匙）', () => {
  const s = lairFixture()
  s.enemies = []
  createMechanicsApi(s).recordSets.add('memoriesRecovered', 'AJailbreak')
  s.scenarioZones.setAside.push('07078')
  s.chaosBag.push('curse', 'curse', 'curse', 'curse')
  const third = locationOf(s, '07289')
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.agendaIndex, 1, '进入议程 2')
  const suspect = s.enemies.find(entity => codeOf(entity) === '07078')
  assert.ok(suspect, '越狱嫌犯入场')
  assert.equal(suspect.location, third.id, '生成在三楼地点')
  assert.equal(suspect.exhausted, true, '横置入场')
  assert.equal(keysAt(s, `enemy:${suspect.id}`).includes('blue'), false, '不放蓝色钥匙')
  assert.equal(s.scenarioZones.setAside.includes('07078'), false)
  assert.ok(createMechanicsApi(s).chaosTokens.count('curse') <= 2, '从混乱袋移除最多 2 个诅咒标记')
})

test('议程 07278：移除混乱袋诅咒并给出不占盟友槽位的托马斯·道森', () => {
  const s = lairFixture()
  s.enemies = []
  s.agendaIndex = 1
  s.chaosBag.push('curse', 'curse', 'curse', 'curse')
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda(), choice =>
    choice.kind === 'investigator' ? '0' : null)
  assert.equal(s.agendaIndex, 2, '进入最终议程 07279')
  assert.equal(s.scenarioZones.setAside.includes('07082'), false, '道森从旁置区取出')
  const carriers = s.investigators.filter(inv => inv.assets.some(asset => codeOf(asset) === '07082'))
  assert.equal(carriers.length, 1, '一位调查员控制道森')
  const dawson = carriers[0].assets.find(asset => codeOf(asset) === '07082')
  assert.deepEqual(dawson.ignoredSlots || [], ['ally'], '不占盟友槽位')
  assert.ok(createMechanicsApi(s).chaosTokens.count('curse') <= 0, '移除 4 个诅咒标记（库存不足时尽量移除）')
})

test('议程 07279 背面：击败未撤退调查员、记录达贡已苏醒并进入结局 1', () => {
  const s = lairFixture()
  s.enemies = []
  s.agendaIndex = 2
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.investigators.every(inv => inv.defeated), true, '未撤退调查员被击败')
  assert.equal(s.campaign.records.DagonHasAwakened, true, '日志：达贡已苏醒')
  assert.equal(lastResult(s)?.resolution, 'resolution1')
})

test('议程变体 07275/07277：恢复记忆时的正面诅咒与背面加诅咒', () => {
  const s = lairFixture(1, { memoriesRecovered: ['AnEncounterWithASecretCult', 'ADecisionToStickTogether'] })
  s.enemies = []
  assert.deepEqual(s.agendas.map(codeOf), ['07275', '07277', '07279'], '记忆分支选择变体议程')
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.agendaIndex, 1)
  assert.equal(createMechanicsApi(s).chaosTokens.count('curse'), 2, '07275 背面加入 2 个诅咒标记')
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.agendaIndex, 2)
  assert.equal(createMechanicsApi(s).chaosTokens.count('curse'), 6, '07277 背面加入 4 个诅咒标记')
})

// ===========================================================================
// 3) locationsAndConnections：地点行为与连接
// ===========================================================================
test('地点 07283 宏伟入口：与[[洞穴]]地点双向连接，可真实移动', () => {
  const s = lairFixture(2)
  const grand = placePrinted(s, '07283')
  const tunnel = placePrinted(s, '07102')
  transaction(s, draft => revealLocation(draft, tunnel.id, [], 0))
  assert.ok((locationOf(s, '07283').connections || []).includes(tunnel.id), '宏伟入口连接到[[洞穴]]地点')
  assert.ok((locationOf(s, '07102').connections || []).includes(grand.id), '反之亦然')
  s.investigators[0].location = grand.id
  s.investigators[1].location = grand.id
  assert.equal(validateMove(s, 0, { action: 'move', locationId: tunnel.id }), null, '可移动到连接地点')
  const resign = legalMoves(s).find(command => command.action === 'entityAbility'
    && command.entityId === grand.id && command.abilityIndex === 0)
  assert.ok(resign, '撤退行动可见')
  move(s, resign)
  settle(s)
  assert.equal(s.investigators[0].resigned, true, '只让行动者撤退')
  assert.equal(s.investigators[1].resigned, false, '另一名调查员不受影响')
  assert.equal(validateMove(s, 1, { action: 'move', locationId: tunnel.id }), null, '其余调查员仍可移动')
})

test('地点 07286/07289：黑钥匙解锁三楼，寂静厅堂放紫钥匙且本地检定失败加诅咒', () => {
  const s = lairFixture()
  const hall = placePrinted(s, '07289')
  hall.revealed = false
  const corridorId = placePrinted(s, '07286').id
  transaction(s, draft => revealLocation(draft, corridorId, [], 0))
  s.investigators[0].location = corridorId
  createMechanicsApi(s).map.connect(corridorId, hall.id)
  // 未解锁三楼时不能移动到未揭示的 07289。
  assert.notEqual(validateMove(s, 0, { action: 'move', locationId: hall.id }), null)
  // 黑钥匙在旁置区，先交给调查员再使用 07286 的行动。
  createMechanicsApi(s).keys.transfer('black', 'setAside', 'investigator:0', { reveal: true })
  const unlockMove = legalMoves(s).find(command => command.action === 'entityAbility' && command.entityId === corridorId)
  assert.ok(unlockMove, '花费黑钥匙解锁三楼的行动可见')
  move(s, unlockMove)
  settle(s)
  assert.ok((s.scenarioFlags.remembered || []).includes('UnlockedTheThirdFloor'))
  assert.equal(validateMove(s, 0, { action: 'move', locationId: hall.id }), null, '解锁后可移动')
  move(s, { action: 'move', locationId: hall.id })
  settle(s)
  assert.ok(keysAt(s, `location:${hall.id}`).includes('purple'), '揭示后放紫色钥匙')
  // 本地检定失败加 1 诅咒（紫色钥匙在本地；07289 的强制）。
  createMechanicsApi(s).chaosTokens.add('curse', 0)
  const curseBefore = createMechanicsApi(s).chaosTokens.count('curse')
  s.chaosBag = ['autofail']
  s.investigators[0].intellect = 0
  transaction(s, draft => {
    const runtime = scenarioRuntime(draft, [])
    runtime.test(0, 'intellect', 3, () => {})
  })
  assert.ok(createMechanicsApi(s).chaosTokens.count('curse') + (s.chaos?.removed || []).filter(t => t === 'curse').length > curseBefore,
    '本地检定失败后加入诅咒标记')
})

test('地点 07284/07285：红钥匙揭示、调查失败恐惧与用红钥匙取得雕像资产', () => {
  const s = lairFixture()
  const hall = placePrinted(s, '07284')
  hall.revealed = false
  transaction(s, draft => revealLocation(draft, hall.id, [], 0))
  assert.deepEqual(keysAt(s, `location:${hall.id}`), ['red'], '揭示后放红色钥匙')
  s.investigators[0].location = hall.id
  s.investigators[0].assets = []
  s.chaosBag = ['autofail']
  const horrorBefore = s.investigators[0].horror
  move(s, { action: 'investigate' })
  settle(s)
  assert.equal(s.investigators[0].horror, horrorBefore + 1, '本地调查失败受到 1 点恐惧')
  const deep = placePrinted(s, '07285')
  deep.revealed = false
  transaction(s, draft => revealLocation(draft, deep.id, [], 0))
  assert.equal(createMechanicsApi(s).water.level(deep.id), 1, '揭示后提升淹没等级')
  s.investigators[0].location = deep.id
  createMechanicsApi(s).keys.transfer('red', `location:${hall.id}`, 'investigator:0', { reveal: true })
  const takeStatue = legalMoves(s).find(command => command.action === 'entityAbility'
    && command.entityId === deep.id)
  assert.ok(takeStatue, '花费红钥匙取得雕像的行动可见')
  move(s, takeStatue)
  settle(s)
  assert.equal(s.investigators[0].assets.some(asset => codeOf(asset) === '07300'), true, '取得受诅咒的伊哈-恩斯雷雕像')
})

test('地点 07287/07288：钥匙恩赐与揭示实际抽取旁置的达贡宣教士', () => {
  const s = lairFixture()
  const bless = placePrinted(s, '07287')
  bless.revealed = true
  s.investigators[0].location = bless.id
  s.investigators[0].damage = 1
  createMechanicsApi(s).keys.transfer('blue', 'setAside', 'investigator:0', { reveal: true })
  const command = legalMoves(s).find(move => move.action === 'entityAbility' && move.entityId === bless.id)
  assert.ok(command, '花费钥匙获得恩赐的快速行动可见')
  move(s, command)
  settle(s)
  assert.equal(s.investigators[0].damage, 0, '选择「治疗 1 点伤害」')
  const reborn = placePrinted(s, '07288')
  s.enemies = []
  transaction(s, draft => revealLocation(draft, reborn.id, [], 0))
  const apostle = s.enemies.find(entity => codeOf(entity) === '07293')
  assert.ok(apostle, '揭示后实际抽取放在一边的达贡宣教士并生成')
  assert.equal(s.scenarioZones.setAside.includes('07293'), false)
})

test('地点 07290/07291：绿钥匙放到线索最多地点、解锁最终深处与达贡巢穴行动', () => {
  const s = lairFixture()
  const gate = placePrinted(s, '07290')
  gate.revealed = false
  const mostClues = s.locations.find(location => location.id !== gate.id)
  mostClues.clues = 2
  transaction(s, draft => revealLocation(draft, gate.id, [], 0))
  assert.ok(keysAt(s, `location:${mostClues.id}`).includes('green'), '绿色钥匙放到线索最多的地点')
  // 解锁最终深处：每人 3 线索 + 此处绿钥匙（钥匙在「这里」= 位于本地点的调查员持有）。
  s.investigators[0].location = gate.id
  s.investigators[0].clues = 3
  createMechanicsApi(s).keys.transfer('green', `location:${mostClues.id}`, 'investigator:0', { reveal: true })
  const unlock = legalMoves(s).find(command => command.action === 'entityAbility' && command.entityId === gate.id)
  assert.ok(unlock, '解锁最终深处的行动可见')
  move(s, unlock)
  settle(s)
  assert.ok((s.scenarioFlags.remembered || []).includes('UnlockedTheFinalDepths'))
  // 达贡巢穴进入检定：取最低技能(3)。
  const lair = placePrinted(s, '07291')
  lair.revealed = true
  createMechanicsApi(s).map.connect(gate.id, lair.id)
  s.investigators[0].location = gate.id
  Object.assign(s.investigators[0], { willpower: 5, intellect: 5, combat: 1, agility: 1 })
  s.chaosBag = ['autofail']
  const horrorBefore = s.investigators[0].horror
  transaction(s, draft => scenarioRuntime(draft, []).moveInvestigator(0, lair.id),
    choice => choice.options.some(option => option.id === 'agility') ? 'agility' : null)
  assert.equal(s.lastTestResult.skill, 'agility', '并列最低技能由玩家选择')
  assert.equal(s.lastTestResult.difficulty, 3)
  assert.equal(s.investigators[0].horror, horrorBefore + 1, '进入检定失败受到 1 点恐惧')
})

// ===========================================================================
// 4) encounterBehaviors：敌人/诡计
// ===========================================================================
test('敌人 07293 达贡宣教士：+1[每调查员]生命、入场黑钥匙、受伤加诅咒', () => {
  const s = lairFixture(2)
  s.enemies = []
  let id = null
  transaction(s, draft => {
    const spawned = scenarioRuntime(draft, []).spawn('07293', draft.investigators[0].location)
    id = spawned.id
  })
  const apostle = s.enemies.find(entity => entity.id === id)
  assert.equal(enemyHealth(s, apostle), 3 + 2, '印刷 3 生命 + 每人 1')
  assert.ok(keysAt(s, `enemy:${id}`, { reveal: true }).includes('black'), '入场后拿走放在一边的黑色钥匙')
  s.chaosBag = ['0']
  const curseBefore = createMechanicsApi(s).chaosTokens.count('curse')
    + (s.chaos?.removed || []).filter(token => token === 'curse').length
  transaction(s, draft => {
    const runtime = scenarioRuntime(draft, [])
    runtime.damageEnemy(id, 2, 0)
  })
  assert.equal(s.enemies.find(entity => entity.id === id)?.damageTaken ?? 0, 2)
  assert.ok(createMechanicsApi(s).chaosTokens.count('curse')
    + (s.chaos?.removed || []).filter(token => token === 'curse').length > curseBefore,
  '调查员造成伤害后加入 1 个诅咒标记')
})

test('敌人 07292a/b 沉睡达贡：失败叠资源翻面，苏醒面生命与本地失败后重整攻击', () => {
  const s = lairFixture(2)
  s.enemies = []
  s.investigators[0].location = s.investigators[1].location
  let bossId = null
  transaction(s, draft => {
    bossId = scenarioRuntime(draft, []).spawn('07292a', draft.investigators[0].location).id
  })
  s.chaosBag = ['autofail']
  for (let index = 0; index < s.numInvestigators + 2; index++) {
    transaction(s, draft => scenarioRuntime(draft, []).test(0, 'willpower', 20, () => {}))
  }
  const boss = s.enemies.find(entity => entity.id === bossId)
  assert.equal(codeOf(boss), '07292b', '达到 1[每调查员]+2 资源后翻至(苏醒狂怒)面')
  assert.equal(enemyHealth(s, boss), 18, '苏醒面 +6[每调查员]生命')
  const bossDamage = Number(boss.damage || 0)
  transaction(s, draft => scenarioRuntime(draft, []).exhaustEnemy(draft.enemies.find(entity => entity.id === bossId)))
  s.investigators[0].assets = []
  s.chaosBag = ['autofail']
  const damageBefore = s.investigators[0].damage
  transaction(s, draft => scenarioRuntime(draft, []).test(0, 'intellect', 20, () => {}))
  assert.equal(s.enemies.find(entity => entity.id === bossId).exhausted, false, '本地检定失败后重整')
  assert.equal(s.investigators[0].damage, damageBefore + bossDamage, '随后攻击本地调查员')
})

test('敌人 07294 与诡计 07296/07298：交战后加诅咒、显现失败的毁灭/诅咒', () => {
  const s = lairFixture(2)
  s.enemies = []
  const here = s.investigators[0].location
  let deepOneId = null
  transaction(s, draft => {
    deepOneId = scenarioRuntime(draft, []).spawn('07294', here).id
    scenarioRuntime(draft, []).engage(draft.enemies.find(entity => entity.id === deepOneId), 0)
  })
  const curseSupply = () => createMechanicsApi(s).chaosTokens.count('curse')
    + (s.chaos?.removed || []).filter(token => token === 'curse').length
  assert.ok(createMechanicsApi(s).chaosTokens.count('curse') >= 2, '交战后加入 2 个诅咒标记')
  // 07296 显现：加入 1 诅咒后做意志(4) 检定（诅咒标记可能在本次检定中被消耗，所以按「袋 + 已消耗」统计）。
  const supplyBefore = curseSupply()
  assert.ok(s.chaosBag.length > 0)
  draw(s, '07296')
  assert.ok(curseSupply() > supplyBefore, '07296 显现加 1 个诅咒标记')
  assert.ok(s.lastTestResult, '07296 显现进行了意志检定')
  // 07298 显现：完全淹没时难度 5；失败按差值加诅咒（池容量内尽量加）。
  s.chaosBag = ['autofail']
  s.investigators[0].willpower = 0
  createMechanicsApi(s).water.set(s.investigators[0].location, 2)
  const beforeSurge = curseSupply()
  draw(s, '07298')
  assert.equal(s.encounterDiscard.includes('07298'), true)
  assert.equal(s.lastTestResult.difficulty, 5, '完全淹没时难度 5')
  assert.ok(curseSupply() > beforeSurge, '07298 失败后按差值加入诅咒标记')
})

test('诡计 07297 玄密仪式：失败二选一，揭示诅咒标记时两者都执行', () => {
  const s = lairFixture()
  s.investigators[0].hand = ['01090', '01091', '01092']
  s.investigators[0].assets = [{ id: 'probeAsset', code: '01090', exhausted: false }]
  s.chaosBag = ['autofail']
  const handBefore = s.investigators[0].hand.length
  draw(s, '07297')
  // 未揭示诅咒：二选一（这里让默认选择弃手牌）。
  const handAfter = s.investigators[0].hand.length
  const assetsAfter = s.investigators[0].assets.filter(asset => asset.id === 'probeAsset').length
  assert.ok(handAfter === handBefore - 2 || assetsAfter === 0, '失败后只执行两个分支之一')
  // 揭示诅咒：两个分支都执行。
  const t = lairFixture()
  t.investigators[0].hand = ['01090', '01091', '01092']
  t.investigators[0].assets = [{ id: 'probeAsset', code: '01090', exhausted: false }]
  const api = createMechanicsApi(t)
  api.chaosTokens.add('curse', 1)
  // 诅咒标记揭示后要再揭示一个标记（TIC 诅咒规则），因此袋里另给 1 个普通标记。
  t.chaosBag = ['curse', '0']
  draw(t, '07297')
  assert.equal(t.lastTestResult.drawn.includes('curse'), true, '本次检定揭示了诅咒标记')
  assert.equal(t.investigators[0].hand.length <= 1, true, '揭示诅咒标记时同时弃 2 张手牌')
  assert.equal(t.investigators[0].assets.some(asset => asset.id === 'probeAsset'), false, '同时弃掉支援')
})

test('诡计 07299 石障：附属最近地点、重整时封锁移动、成功检定横置', () => {
  const s = lairFixture()
  s.enemies = []
  const locations = s.locations.slice(0, 3)
  for (const location of s.locations) location.connections = []
  const map = createMechanicsApi(s).map
  map.connect(locations[0].id, locations[1].id)
  map.connect(locations[1].id, locations[2].id)
  s.investigators[0].location = locations[0].id
  draw(s, '07299')
  const attached = s.locations.find(location => location.id === locations[0].id)
    .attachments.find(card => codeOf(card) === '07299')
  assert.ok(attached, '附属到最近的合法地点')
  assert.equal(attached.exhausted, false)
  assert.ok(validateMove(s, 0, { action: 'move', locationId: locations[1].id }), '未横置时移动被拒绝')
  s.investigators[0].agility = 9
  s.chaosBag = ['0']
  const action = legalMoves(s).find(command => command.action === 'entityAbility' && command.entityId === attached.id)
  assert.ok(action, '石障自身的摆脱检定行动可见')
  move(s, action)
  settle(s, choice => choice.options.some(option => option.id === 'agility') ? 'agility' : null)
  assert.equal(s.lastTestResult.difficulty, 1, '敏捷(1) 检定')
  assert.equal(s.locations.find(location => location.id === locations[0].id)
    .attachments.find(card => card.id === attached.id).exhausted, true, '成功后横置')
  assert.equal(validateMove(s, 0, { action: 'move', locationId: locations[1].id }), null, '横置后可以移动')
})

test('敌人与诡计 07295：按幕序号连续检定并造成失败伤害', () => {
  const s = lairFixture()
  s.actIndex = 2
  s.chaosBag = ['autofail']
  s.investigators[0].assets = []
  const damageBefore = s.investigators[0].damage
  draw(s, '07295')
  assert.equal(s.investigators[0].damage, damageBefore + 3, '幕 3 时三次检定失败各 1 伤')
  assert.equal(s.lastTestResult.skill, 'intellect')
  assert.equal(s.lastTestResult.difficulty, 2)
})

// ===========================================================================
// 5) chaosEffects：提示卡 07274 的混乱标记修正/效果
// ===========================================================================
test('提示卡 07274：skull/cultist/tablet/elderthing 的混乱标记修正与效果', () => {
  const s = lairFixture()
  const entry = registeredEntry('07274')
  assert.ok(entry?.scenarioRule, '本章提示卡已实现 scenarioRule')
  const runtime = scenarioRuntime(s, [])
  const api = createMechanicsApi(s)
  api.keys.transfer('black', 'setAside', 'reference', { reveal: true })
  api.keys.transfer('purple', 'setAside', 'reference', { reveal: true })
  const skull = entry.scenarioRule.resolveChaosToken(s, s.investigators[0], 'skull', runtime)
  assert.equal(skull.delta, -2, '骷髅：每个钥匙 -1（普通）')
  const cultist = entry.scenarioRule.resolveChaosToken(s, s.investigators[0], 'cultist', runtime)
  assert.equal(cultist.delta, 0, '邪教徒：0 并再揭示一个标记')
  assert.equal(cultist.drawAnother, true)
  const tablet = entry.scenarioRule.resolveChaosToken(s, s.investigators[0], 'tablet', runtime)
  assert.equal(tablet.delta, -3)
  assert.deepEqual(tablet.onFail, [{ type: 'scenarioToken', event: 'dropKeys', damage: 0 }], '石板失败：钥匙放到所在地点')
  const elderthing = entry.scenarioRule.resolveChaosToken(s, s.investigators[0], 'elderthing', runtime)
  assert.equal(elderthing.delta, -4)
  assert.deepEqual(elderthing.onFail, [{ type: 'scenarioToken', event: 'addCurse', amount: 1 }], '触手失败：加 1 诅咒')
  // 困难难度：石板/触手改在揭示时结算且数值更强。
  s.difficulty = 'hard'
  const hardTablet = entry.scenarioRule.resolveChaosToken(s, s.investigators[0], 'tablet', runtime)
  assert.deepEqual(hardTablet.onDraw, [{ type: 'scenarioToken', event: 'dropKeys', damage: 1 }])
  const hardElder = entry.scenarioRule.resolveChaosToken(s, s.investigators[0], 'elderthing', runtime)
  assert.deepEqual(hardElder.onDraw, [{ type: 'scenarioToken', event: 'addCurse', amount: 2 }])
  // applyTokenEffect：钥匙落地+伤害；加诅咒进标记池。
  s.investigators[0].location = s.locations[0].id
  api.keys.transfer('black', 'reference', 'investigator:0', { reveal: true })
  entry.scenarioRule.applyTokenEffect(s, s.investigators[0], { event: 'dropKeys', damage: 0 }, runtime)
  assert.ok(keysAt(s, `location:${s.investigators[0].location}`).includes('black'), '石板效果把钥匙放到所在地点')
  const curseBefore = createMechanicsApi(s).chaosTokens.count('curse')
  entry.scenarioRule.applyTokenEffect(s, s.investigators[0], { event: 'addCurse', amount: 1 }, runtime)
  assert.equal(createMechanicsApi(s).chaosTokens.count('curse'), curseBefore + 1, '触手效果加入诅咒标记')
  // 邪教徒 + 诅咒：本次检定自动失败（含 ignoredSymbols 边界）。
  assert.equal(entry.scenarioRule.testAutoFail(s, s.investigators[0],
    { ignoredSymbols: false, resolvedTokens: ['cultist'], drawn: ['curse'] }), true)
  assert.equal(entry.scenarioRule.testAutoFail(s, s.investigators[0],
    { ignoredSymbols: false, resolvedTokens: ['cultist'], drawn: ['0'] }), false)
  assert.equal(entry.scenarioRule.testAutoFail(s, s.investigators[0],
    { ignoredSymbols: true, resolvedTokens: ['cultist'], drawn: ['curse'] }), false)
})

// ===========================================================================
// 6) resolutionsAndRecords / saveReplay
// ===========================================================================
test('结局与战役记录：无结局重定向到 resolution1 并记录达贡已苏醒', () => {
  const s = lairFixture()
  transaction(s, draft => scenarioRuntime(draft, []).finish('noResolution'))
  assert.equal(s.campaign.records.DagonHasAwakened, true, 'noResolution 记录达贡已苏醒')
  const result = lastResult(s)
  assert.ok(result, '剧本结果已写入战役账本')
  assert.equal(result.resolution, 'noResolution', '引擎记录触发键')
  const sectionTitles = (result.story?.sections || []).map(section => section.title)
  assert.ok(sectionTitles.includes('resolution1'), '叙事重定向到 resolution1（结局 1 正文已生成）')
})

test('存档 JSON 往返：开局区域/钥匙/水位/地点附属在序列化后保持一致', () => {
  const s = lairFixture()
  s.enemies = []
  const gate = placePrinted(s, '07290')
  gate.revealed = false
  transaction(s, draft => revealLocation(draft, gate.id, [], 0))
  createMechanicsApi(s).water.set(s.investigators[0].location, 1)
  draw(s, '07299')
  const attachment = locationOf(s, '07283').attachments.find(card => codeOf(card) === '07299')
  assert.ok(attachment)
  const snapshot = json(s)
  const before = legalMoves(s).map(command => command.label || command.action).sort()
  const restored = json(snapshot)
  const after = legalMoves(restored).map(command => command.label || command.action).sort()
  assert.deepEqual(after, before, '序列化前后合法行动一致')
  assert.deepEqual(json(restored.scenarioFlags.mechanics), json(s.scenarioFlags.mechanics), '机��状态（钥匙/水位/网格）一致')
  assert.deepEqual(restored.scenarioZones.setAside, s.scenarioZones.setAside)
  const restoredAttachment = locationOf(restored, '07283').attachments.find(card => codeOf(card) === '07299')
  assert.equal(restoredAttachment?.id, attachment.id, '附属实例 id 保留')
})

test('存档恢复后继续：JSON 往返后的地点连接与幕推进仍按印刷结算', () => {
  const s = lairFixture()
  s.enemies = []
  const grand = placePrinted(s, '07283')
  const tunnel = placePrinted(s, '07102')
  transaction(s, draft => revealLocation(draft, tunnel.id, [], 0))
  const restored = json(s)
  assert.ok(locationOf(restored, '07102').connections.includes(grand.id), '恢复后[[洞穴]]连接仍存在')
  s.investigators[0].location = grand.id
  assert.equal(validateMove(s, 0, { action: 'move', locationId: tunnel.id }), null)
  transaction(restored, draft => scenarioRuntime(draft, []).advanceAct())
  assert.equal(restored.actIndex, 1, '恢复后仍能推进幕')
  assert.equal(restored.locations.map(codeOf).filter(code => ['07102', '07103', '07104', '07290'].includes(code)).length, 7)
})
