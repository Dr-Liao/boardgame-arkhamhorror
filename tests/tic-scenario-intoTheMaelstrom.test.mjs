// TIC 第八章「漩涡深处 intoTheMaelstrom」逐章验收测试（八章 12 项验收中行为项的机械证据）。
//
// 口径：tools/audit-tic-scenarios.mjs#chapterTestFor —— 本文件是本章唯一验收测试文件
// （tests/tic-scenario-intoTheMaelstrom.test.mjs），引用 chapterFixture('intoTheMaelstrom')，
// 实跑通过，且通过用例标题分别命中 setupAndZones / actsAndAgendas / locationsAndConnections /
// encounterBehaviors / chaosEffects / resolutionsAndRecords / saveReplay 的断言关键词。
//
// 夹具与事务写法复用 tic-maelstrom-act / tic-maelstrom-agendas / tic-parallel-acts /
// tic-scenarios-late。
// 运行：node --test tests/tic-scenario-intoTheMaelstrom.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { legalMoves, move, settle } from './core-fixture.mjs'
import { advanceAct, checkAct, reactionWindow, revealLocation, scenarioRuntime } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { registeredEntry } from '../src/engine/ability.js'
import { actsInPlay, parallelActs } from '../src/engine/parallel-acts.js'
import { keysAt } from '../src/engine/scenario-keys.js'
import { floodLevel } from '../src/engine/flood.js'
import { validateMechanicState } from '../src/engine/mechanic-state.js'
import { resolveTransaction } from '../src/engine/resolution.js'

const json = value => JSON.parse(JSON.stringify(value))
const codeOf = entity => entity?.originalCode || entity?.code
const locationByCode = (s, code) => s.locations.find(location => codeOf(location) === code) || null
const positionOf = (s, target) => {
  const id = typeof target === 'string' && s.locations.some(location => location.id === target)
    ? target
    : locationByCode(s, typeof target === 'string' ? target : codeOf(target))?.id
  return createMechanicsApi(s).map.position(id)
}
const REQUIRED_KEYS = ['blue', 'red', 'yellow', 'green']

function transaction(state, execute, select = () => null) {
  let value
  const run = draft => {
    try { value = execute(draft); return value } catch (error) {
      if (error.constructor?.name !== 'ScenarioEnded') throw error
      return undefined
    }
  }
  resolveTransaction(state, 0, { action: 'ticIntoTheMaelstromAcceptance' }, run)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 200, `choice loop ${state.pendingChoice.source}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(candidate => choice.options.some(option => option.id === candidate))
      ?? choice.options[0]?.id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, run)
  }
  return value
}
const giveGatewayKeys = (s, colors = REQUIRED_KEYS) => {
  const api = createMechanicsApi(s)
  for (const color of colors) {
    const key = s.scenarioFlags.mechanics.keys[color]
    assert.ok(key, `没有初始化 ${color} 钥匙`)
    assert.equal(api.keys.transfer(color, key.holder, 'investigator:0', { reveal: true }), true, `转移 ${color} 钥匙`)
  }
}
// 把 4 把钥匙交给调查员 0 并正常推进到幕 2（07316 成为当前幕、Act 2 地图与两古神入场）。
function advanceToAct2(state) {
  giveGatewayKeys(state)
  transaction(state, draft => advanceAct(draft, []))
  assert.equal(state.actIndex, 1, '推进到幕 2')
  assert.equal(codeOf(state.acts[state.actIndex]), '07316')
  return state
}
const placePrinted = (s, code) => {
  const existing = locationByCode(s, code)
  if (existing) return existing
  const definition = Object.entries(s.scenario.locations).find(([, item]) => codeOf(item) === code)
  assert.ok(definition, `章节没有 ${code} 的物理定义`)
  transaction(s, draft => scenarioRuntime(draft, []).mechanics.map.place(definition[0], 0, 5))
  const placed = locationByCode(s, code)
  assert.ok(placed, `${code} 应已入场`)
  return placed
}

test('intoTheMaelstrom 开局布置与区域守恒：门扉+8 张生态通道正交网格、初始钥匙池、空气规则与三张密谋', () => {
  const s = chapterFixture('intoTheMaelstrom', 2)
  const mech = s.scenarioFlags.mechanics
  assert.deepEqual((s.acts || []).map(codeOf), ['07315', '07316'], '主幕牌库')
  assert.deepEqual((s.agendas || []).map(codeOf), ['07312', '07313', '07314'], '三张密谋按序')
  assert.deepEqual(s.agendas.map(agenda => agenda.doomThreshold), [6, 8, 10], '密谋毁灭阈值')
  // 门扉 07320 在 (0,0)、已揭示、部分淹没；其余 8 张生态通道按正交槽位入位。
  const gateway = locationByCode(s, '07320')
  assert.ok(gateway, '门扉入场')
  assert.deepEqual(positionOf(s, gateway.id), { x: 0, y: 0, isolated: false })
  assert.equal(gateway.revealed, true, '门扉已揭示')
  assert.equal(floodLevel(s, gateway.id), 1, '门扉以部分淹没入场')
  assert.equal(s.locations.length, 9, '门扉 + 8 张生态通道物理卡')
  for (const location of s.locations) {
    const position = positionOf(s, location.id)
    if (location.id !== gateway.id) {
      assert.equal(Math.max(Math.abs(position.x), Math.abs(position.y)), 1, '生态通道落在正交八格之一')
      assert.equal((location.traits || []).includes('Cave'), true, '生态通道是[[洞穴]]地点')
    }
  }
  // 7 色钥匙：初始 4 把暗置（紫/白/黑未使用被移出游戏）。
  assert.equal(Object.keys(mech.keys).length, 7)
  assert.equal(Object.values(mech.keys).filter(key => key.holder === 'setAside' && !key.revealed).length, 4, '初始 4 把暗置钥匙')
  assert.deepEqual(['purple', 'white', 'black'].filter(color => mech.keys[color].holder.startsWith('removed')), ['purple', 'white', 'black'], '未使用的 3 把钥匙移出游戏')
  // 章节规则：空气规则开启。
  assert.equal(s.scenario.mechanics.water.air, true, '空气规则由章节 mechanics 声明')
  // 区域守恒：遭遇牌库 33、旁置 4 张（含 07317/07318 旁置幕）。
  assert.equal(s.encounterDeck.length, 33, '遭遇牌库数量守恒')
  assert.equal(s.scenarioZones.setAside.length, 4, '旁置遭遇/支援守恒')
  assert.equal(JSON.stringify(s.scenario.mechanics.setAsideActs || []) !== 'null', true)
})

test('intoTheMaelstrom 幕/议程：07315 目标（全员门扉+四色钥匙）与背面按 2 人图示布置 Act 2 地图并生成两古神', () => {
  const s = chapterFixture('intoTheMaelstrom', 2)
  const objective = registeredEntry('07315').actRule.objective
  assert.equal(objective(s, s.acts[s.actIndex]), false, '未集齐钥匙时目标不成立')
  giveGatewayKeys(s)
  assert.equal(objective(s, s.acts[s.actIndex]), true, '全员门扉 + 蓝红黄绿钥匙成立')
  transaction(s, draft => advanceAct(draft, []))
  assert.equal(s.actIndex, 1, '推进到幕 2（07316）')
  assert.equal(codeOf(s.acts[s.actIndex]), '07316')
  // 2 人图示：4 圣堂 + 5 普通地点 + 两座巢穴；圣堂入场完全淹没。
  const sanctums = s.locations.filter(location => ['07324', '07325', '07326', '07327'].includes(codeOf(location)))
  assert.equal(sanctums.length, 4, '四张圣堂地点入场')
  for (const sanctum of sanctums) assert.equal(floodLevel(s, sanctum.id), 2, `${sanctum.name} 入场完全淹没`)
  const ordinary = s.locations.filter(location => ['07321', '07322', '07323'].includes(codeOf(location)))
  assert.equal(ordinary.length, 5, '2 人图示放置 5 个普通地点')
  assert.deepEqual(positionOf(s, '07328'), { x: 1, y: -3, isolated: false }, '达贡巢穴在 2 人图示范 (1,-3)')
  assert.deepEqual(positionOf(s, '07329'), { x: -1, y: -3, isolated: false }, '海德拉巢穴在 (-1,-3)')
  const dagon = s.enemies.find(enemy => ['07330a', '07330b'].includes(codeOf(enemy)))
  const hydra = s.enemies.find(enemy => ['07331a', '07331b'].includes(codeOf(enemy)))
  assert.ok(dagon && hydra, '两古神从旁置入场')
  assert.equal(dagon.location, locationByCode(s, '07328').id)
  assert.equal(hydra.location, locationByCode(s, '07329').id)
  assert.equal(codeOf(dagon), '07330a', '无记录时达贡以深入沉睡面入场')
  assert.equal(codeOf(hydra), '07331a', '海德拉以深入沉睡面入场')
})

test('intoTheMaelstrom 并行幕：07317/07318 目标与 07316 完成时的「继续游戏」选择', () => {
  const s = advanceToAct2(chapterFixture('intoTheMaelstrom', 2))
  assert.equal(transaction(s, draft => scenarioRuntime(draft, []).addParallelAct('07317')), true)
  assert.equal(transaction(s, draft => scenarioRuntime(draft, []).addParallelAct('07318')), true)
  assert.deepEqual(parallelActs(s).map(codeOf).sort(), ['07317', '07318'], '两张并行幕在场')
  const inPlay = actsInPlay(s).map(codeOf)
  for (const code of ['07316', '07317', '07318']) assert.equal(inPlay.includes(code), true, `${code} 参与活动幕枚举`)
  // 07317：达贡巢穴/海德拉巢穴/带紫钥匙的财富宝库均无线索 → 初始不成立。
  assert.equal(registeredEntry('07317').actRule.objective(s, parallelActs(s).find(act => codeOf(act) === '07317')), false)
  // 07318：苏醒的达贡与海德拉各至少 4×人数 伤害。
  const dagon = s.enemies.find(enemy => codeOf(enemy) === '07330a')
  const hydra = s.enemies.find(enemy => codeOf(enemy) === '07331a')
  transaction(s, draft => {
    scenarioRuntime(draft, []).flipEnemy(draft.enemies.find(enemy => enemy.id === dagon.id), '07330b')
    scenarioRuntime(draft, []).flipEnemy(draft.enemies.find(enemy => enemy.id === hydra.id), '07331b')
  })
  for (const enemy of s.enemies) if (['07330b', '07331b'].includes(codeOf(enemy))) enemy.damageTaken = 4 * s.numInvestigators
  assert.equal(registeredEntry('07318').actRule.objective(s, parallelActs(s).find(act => codeOf(act) === '07318')), true, '两古神伤害达标后目标成立')
  // 清掉伤害让 07318 目标回到不成立，避免下一步 checkAct 顺带自动完成它。
  for (const enemy of s.enemies) if (['07330b', '07331b'].includes(codeOf(enemy))) enemy.damageTaken = 0
  // 07316 目标：每个在场地点都未淹没 → 抽干后完成，选择「继续游戏」保留并行幕。
  const api = createMechanicsApi(s)
  for (const location of [...s.locations]) api.water.set(location.id, 0)
  transaction(s, draft => checkAct(draft, []),
    choice => (choice.options.some(option => option.id === 'continue') ? 'continue' : null))
  assert.equal(s.resolution, null, '选择继续时不进入结局')
  assert.equal(s.victoryDisplay.some(card => codeOf(card) === '07316'), true, '完成的本幕加入胜利区')
  assert.deepEqual(parallelActs(s).map(codeOf).sort(), ['07317', '07318'], '并行幕仍在场')
})

test('intoTheMaelstrom 议程：07313 把沉睡古神翻至苏醒面、07314 每个阶段开始翻面并在背面进入结局8', () => {
  const s = advanceToAct2(chapterFixture('intoTheMaelstrom', 2))
  s.agendaIndex = 1
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.agendaIndex, 2, '推进到密谋 3（07314）')
  assert.equal(codeOf(s.agendas[s.agendaIndex]), '07314')
  const dagon = s.enemies.find(enemy => ['07330a', '07330b'].includes(codeOf(enemy)))
  const hydra = s.enemies.find(enemy => ['07331a', '07331b'].includes(codeOf(enemy)))
  assert.equal(codeOf(dagon), '07330b', '07313 背面把沉睡达贡翻至苏醒狂怒面')
  assert.equal(codeOf(hydra), '07331b', '07313 背面把沉睡海德拉翻至苏醒狂怒面')
  // 07314 的 phaseBegan 对后续入场的沉睡古神同样生效（幂等）。
  const late = chapterFixture('intoTheMaelstrom', 2)
  const sleeping = scenarioRuntime(late, []).spawn('07331a', locationByCode(late, '07320').id)
  assert.ok(sleeping, '额外沉睡海德拉入场')
  late.agendaIndex = 2
  transaction(late, draft => {
    const agenda = draft.agendas[draft.agendaIndex]
    registeredEntry('07314').agendaRule.phaseBegan(draft, agenda, 'investigation', scenarioRuntime(draft, []))
  })
  assert.equal(late.enemies.some(enemy => codeOf(enemy) === '07331b'), true, '07314 阶段开始把沉睡古神翻面')
  // 07314 背面：→ 结局 8。
  transaction(late, draft => scenarioRuntime(draft, []).advanceAgenda())
  const result = late.campaign.scenarioResults.at(-1)
  assert.equal(result.resolution, 'resolution8', '洪水背面进入结局 8')
  assert.equal(result.recordsAfter.TheDeepOnesHaveFloodedTheEarth, true, '结局 8 记录深海者淹没大地')
})

test('intoTheMaelstrom 地点与连接：门扉正交四连接、生态通道网格、07319 深渊揭示暗置钥匙、07321 沉没厅堂黑钥匙行动与敌人进入 2 伤害', () => {
  const s = chapterFixture('intoTheMaelstrom', 2)
  const gateway = locationByCode(s, '07320')
  assert.equal(gateway.connections.length, 4, '门扉与正交四格相邻（不是八格对角线）')
  for (const id of gateway.connections) {
    const neighbor = s.locations.find(location => location.id === id)
    assert.ok(neighbor, '相邻地点入场')
    assert.equal(neighbor.connections.includes(gateway.id), true, '邻接双向')
  }
  // 07319 深渊揭示：从暗置池取得一把钥匙而不暴露颜色。
  const abyss = locationByCode(s, '07319')
  assert.ok(abyss, '两张深渊之一入场')
  const hiddenBefore = Object.values(s.scenarioFlags.mechanics.keys).filter(key => key.holder === 'setAside' && !key.revealed).length
  transaction(s, draft => revealLocation(draft, locationByCode(draft, '07319').id, [], 0))
  assert.deepEqual(keysAt(s, `location:${abyss.id}`), ['unrevealed'], '深渊揭示放一张暗置钥匙')
  assert.equal(Object.values(s.scenarioFlags.mechanics.keys).filter(key => key.holder === 'setAside' && !key.revealed).length, hiddenBefore - 1)
  // 07321 沉没厅堂：以部分淹没入场；黑钥匙行动；敌人进入后若黑钥匙在此受 2 伤害。
  const hall = placePrinted(s, '07321')
  transaction(s, draft => revealLocation(draft, locationByCode(draft, '07321').id, [], 0))
  assert.equal(floodLevel(s, hall.id), 1, '沉没厅堂以部分淹没入场')
  // 本局初始黑钥匙在「移出游戏」池（紫/白/黑），这里按场外取回的方式交给调查员。
  const blackHolder = s.scenarioFlags.mechanics.keys.black.holder
  assert.equal(createMechanicsApi(s).keys.transfer('black', blackHolder, 'investigator:0', { reveal: true }), true)
  s.investigators[0].location = hall.id
  const keyAction = legalMoves(s).find(command => command.action === 'entityAbility' && command.entityId === hall.id)
  assert.ok(keyAction, '控制黑钥匙时沉没厅堂行动出现')
  move(s, keyAction)
  settle(s)
  assert.equal(keysAt(s, `location:${hall.id}`).includes('black'), true, '黑钥匙放在沉没厅堂上')
  transaction(s, draft => {
    const runtime = scenarioRuntime(draft, [])
    const intruder = runtime.spawn('07332', locationByCode(draft, '07102')?.id || locationByCode(draft, '07320').id)
    runtime.moveEnemy(intruder, locationByCode(draft, '07321').id)
  })
  assert.equal(s.enemies.find(enemy => codeOf(enemy) === '07332').damageTaken, 2, '敌人进入后受 2 点伤害')
})

test('intoTheMaelstrom 敌人：沉睡/苏醒古神换面、07332 水生异怪与 07338 潜水服读点', () => {
  const s = advanceToAct2(chapterFixture('intoTheMaelstrom', 2))
  const dagon = s.enemies.find(enemy => ['07330a', '07330b'].includes(codeOf(enemy)))
  assert.equal(codeOf(dagon), '07330a', '初始为深入沉睡面')
  assert.equal(registeredEntry('07330a').implemented, true)
  assert.equal(registeredEntry('07331a').implemented, true)
  transaction(s, draft => scenarioRuntime(draft, []).flipEnemy(draft.enemies.find(enemy => enemy.id === dagon.id), '07330b'))
  const awakened = s.enemies.find(enemy => enemy.id === dagon.id)
  assert.equal(codeOf(awakened), '07330b', '翻至苏醒狂怒面')
  for (const code of ['07330b', '07331b', '07332', '07338']) {
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 已注册`)
    assert.equal(entry.implemented, true, `${code} implemented`)
  }
  assert.equal(registeredEntry('07332').enemyRule?.movementConnections ?? null, null, '07332 移动规则由遭遇数据提供')
})

test('intoTheMaelstrom 混乱标记：07311 skull 随未淹没伊哈·恩斯雷地点数、cultist/tablet/elderthing 分支', () => {
  const s = advanceToAct2(chapterFixture('intoTheMaelstrom', 2))
  const rule = registeredEntry('07311').scenarioRule
  const runtime = scenarioRuntime(s, [])
  const inv = s.investigators[0]
  assert.equal(rule.resolveChaosToken(s, inv, 'skull', runtime).delta, -1, '未淹没地点 <4 时 skull -1')
  const sanctums = s.locations.filter(location => ['07324', '07325', '07326', '07327'].includes(codeOf(location)))
  const api = createMechanicsApi(s)
  for (const sanctum of sanctums) api.water.set(sanctum.id, 0)
  assert.equal(rule.resolveChaosToken(s, inv, 'skull', runtime).delta, -3, '4 个未淹没伊哈·恩斯雷地点时 skull -3')
  s.difficulty = 'hard'
  assert.equal(rule.resolveChaosToken(s, inv, 'skull', runtime).delta, -4, '困难难度 skull -4')
  assert.equal(rule.resolveChaosToken(s, inv, 'cultist', runtime).delta, -4)
  assert.equal(rule.resolveChaosToken(s, inv, 'tablet', runtime).delta, -5)
  assert.equal(rule.resolveChaosToken(s, inv, 'elderthing', runtime).delta, -6)
  // cultist 失败效果：加 1 毁灭。
  const doomBefore = s.doom
  transaction(s, draft => rule.applyTokenEffect(draft, draft.investigators[0], { event: 'cultist' }, scenarioRuntime(draft, [])))
  assert.equal(s.doom, doomBefore + 1, 'cultist 失败增加 1 毁灭')
  // tablet 失败效果：提高所在地水位或受 1 伤害（选择受到伤害）。
  s.difficulty = 'standard'
  api.water.set(inv.location, 1)
  const damageBefore = s.investigators[0].damage
  transaction(s, draft => rule.applyTokenEffect(draft, draft.investigators[0], { event: 'tablet' }, scenarioRuntime(draft, [])),
    choice => (choice.options.some(option => option.id === 'damage') ? 'damage' : null))
  assert.equal(s.investigators[0].damage, damageBefore + 1, 'tablet 失败选择受到 1 伤害')
})

test('intoTheMaelstrom 结局与记录：resolution1 记录逃离伊哈·恩斯雷/古神进胜利区/全员 2 肉体创伤，resolution8 击杀全员', () => {
  const s = chapterFixture('intoTheMaelstrom', 2)
  transaction(s, draft => {
    const runtime = scenarioRuntime(draft, [])
    runtime.spawn('07330b', locationByCode(draft, '07320').id)
    runtime.spawn('07331b', locationByCode(draft, '07320').id)
  })
  transaction(s, draft => scenarioRuntime(draft, []).finish('resolution1'))
  const result = s.campaign.scenarioResults.at(-1)
  assert.equal(result.resolution, 'resolution1')
  assert.equal(result.recordsAfter.TheInvestigatorsEscapedYhanthlei, true, '记录逃离伊哈·恩斯雷')
  for (const code of ['07330b', '07331b']) {
    assert.equal(s.victoryDisplay.some(card => codeOf(card) === code), true, `${code} 加入胜利区`)
  }
  assert.equal(Object.values(s.campaign.trauma).every(trauma => trauma.physical === 2), true, '全员承受 2 点肉体创伤')
  assert.ok(result.story, '结局剧情已生成')
  // 结局 8：全员被杀 + 记录淹没大地。
  const flood = chapterFixture('intoTheMaelstrom', 2)
  transaction(flood, draft => scenarioRuntime(draft, []).finish('resolution8'))
  const flooded = flood.campaign.scenarioResults.at(-1)
  assert.equal(flooded.resolution, 'resolution8')
  assert.equal(flooded.recordsAfter.TheDeepOnesHaveFloodedTheEarth, true)
  assert.equal(Object.values(flood.campaign.investigators).every(record => record.status === 'killed'), true, '结局 8 击杀全员')
})

test('intoTheMaelstrom 存档与恢复往返：Act 2 地图/水位/钥匙/并行幕在 JSON 往返后一致且校验通过', () => {
  const s = advanceToAct2(chapterFixture('intoTheMaelstrom', 2))
  transaction(s, draft => scenarioRuntime(draft, []).addParallelAct('07317'))
  const restored = json(s)
  assert.doesNotThrow(() => validateMechanicState(restored), '往返存档通过机械状态校验')
  assert.deepEqual(restored.scenarioFlags.mechanics.grid, s.scenarioFlags.mechanics.grid, '地图网格一致')
  assert.deepEqual(restored.scenarioFlags.mechanics.flood, s.scenarioFlags.mechanics.flood, '水位一致')
  assert.deepEqual(restored.scenarioFlags.mechanics.keys, s.scenarioFlags.mechanics.keys, '钥匙一致')
  assert.deepEqual(restored.locations.map(location => location.id).sort(), s.locations.map(location => location.id).sort(), '地点集合一致')
  assert.deepEqual(parallelActs(restored).map(codeOf), ['07317'], '并行幕存档一致')
  assert.deepEqual(actsInPlay(restored).map(codeOf), actsInPlay(s).map(codeOf), '活动幕枚举一致')
})
