// P7 深陷危局（inTooDeep）逐章验收测试。
//
// 审计契约（tools/audit-tic-scenarios.mjs#chapterTestFor / CHECK_TITLE_MARKERS）：
//   · 文件必须在 tests/suites.mjs 登记（主进程负责），并显式引用本章：chapterFixture('inTooDeep') /
//     `scenarios/inTooDeep/`；
//   · 工具用 `node --test --test-reporter=tap` 实跑，文件全绿才算通过；
//   · 每个行为检查需要至少一条**通过用例标题**命中它的关键词（setup/幕/地点/遭遇/混乱/结局/存档…），
//     所以标题是验收证据的一部分，改标题前先看工具的 CHECK_TITLE_MARKERS。
//
// 本文件只做章节级验收（真实 chapterFixture 开局事务 + 真实单卡条目/引擎读点），
// 不复制单卡实现；逐卡细节仍由 tests/tic-scenarios-early.test.mjs / tic-flooded-agendas.test.mjs 覆盖。
// 已知缺口（本文件不修、只在报告记录）：07124–07127 的背面 onReveal 尚未实现，
// 直接推进议程会抛 `Innsmouth agenda is not implemented`；本章议程检查只验正面持续规则。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'

import { chapterFixture } from './tic-chapter-fixture.mjs'
import { move, settle } from './core-fixture.mjs'
import { enemyFightValue, enemyHealth, legalMoves, scenarioRuntime } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

// 本章 29 张单卡条目真实注册（chapterFixture 只注册章节定义/开局事务，不注册单卡能力层）。
const chapterDir = new URL('../src/cards/encounter-entries/theInnsmouthConspiracy/inTooDeep/', import.meta.url)
for (const name of readdirSync(chapterDir)) {
  if (!name.endsWith('.js')) continue
  const entry = (await import(new URL(name, chapterDir))).default
  if (!registeredEntry(entry.code)) registerCardAbilities(entry)
}
// 共享遭遇组 07091（涨潮·暗流）用于「共享组行为」验收；它与本章牌库同源，独立成组。
const sharedEntry = (await import(
  new URL('../src/cards/encounter-entries/theInnsmouthConspiracy/_shared/rising_tide/07091.js', import.meta.url))).default
if (!registeredEntry(sharedEntry.code)) registerCardAbilities(sharedEntry)

const codeOf = card => card?.originalCode || card?.code
const deep = (count = 1, options = {}) => chapterFixture('inTooDeep', count, options)

// 真实事务推进：execute 里调引擎 API；ScenarioEnded 是正常结束关卡，继续把待决选择清空。
function run(state, execute) {
  const executeOnce = draft => {
    try { return execute(draft) } catch (error) {
      if (error.constructor?.name !== 'ScenarioEnded') throw error
    }
  }
  resolveTransaction(state, 0, { action: 'testTicInTooDeepChapter' }, executeOnce)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 150, 'TIC 深陷危局 choice loop')
    const choice = state.pendingChoice
    const optionId = ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0].id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, executeOnce)
  }
}

test('P7 深陷危局 setup 初始设置与区域守恒：15 地点网格/33 张遭遇牌库/8 张旁置/13 道屏障/水位 3 处', () => {
  const s = deep()
  assert.equal(s.scenario.id, 'inTooDeep')
  assert.deepEqual(s.acts.map(codeOf), ['07128'])
  assert.deepEqual(s.agendas.map(codeOf), ['07124', '07125', '07126', '07127'])
  // 15 个调查地点全部按真实网格入场，起始地点已揭示
  assert.equal(s.locations.length, 15)
  assert.equal(Object.keys(s.scenario.locations).length, 15)
  assert.equal(Object.values(s.scenario.locations).filter(location => location.identityStatus === 'mapped').length, 15)
  assert.equal(s.locations.filter(location => location.revealed).length, 1)
  // 遭遇牌库与初始屏障守恒：33 张牌库；13 道印刷屏障
  assert.equal(s.encounterDeck.length, 33)
  assert.equal(s.scenarioFlags.mechanics.barriers.length, 13)
  // 旁置区：07144×1、07145×2、01181×2、07150、07151、07062b
  assert.deepEqual(s.scenarioZones.setAside,
    ['07144', '07145', '07145', '01181', '01181', '07150', '07151', '07062b'])
  // 钥匙：黑色移出游戏，其余 6 把背面朝下放一边
  const keys = s.scenarioFlags.mechanics.keys
  assert.deepEqual(keys.black, { holder: 'removed', revealed: false })
  for (const color of ['red', 'yellow', 'green', 'blue', 'purple', 'white']) {
    assert.deepEqual(keys[color], { holder: 'setAside', revealed: false })
  }
  // 初始水位：荒芜海岸/水街老屋/印斯茅斯港口 3 处 = 1，其余 = 0
  const api = createMechanicsApi(s)
  for (const code of ['07143', '07132', '07138']) {
    const location = s.locations.find(location => codeOf(location) === code)
    assert.equal(api.water.level(location.id), 1, `${code} 初始水位`)
  }
  assert.equal(s.locations.filter(location => api.water.level(location.id) === 0).length, 12)
  // 共享遭遇组守恒：本章牌库来自 gatherSets（含 creatures_of_the_deep / rising_tide / syzygy / agents_of_cthulhu）
  const groups = new Set(s.encounterDeck.map(code => ALL_CARDS[code]?.encounterCode))
  for (const group of ['creatures_of_the_deep', 'rising_tide', 'syzygy', 'agents_of_cthulhu']) {
    assert.ok(groups.has(group), `遭遇牌库应包含共享组 ${group}`)
  }
})

test('P7 深陷危局 地点与连接：网格坐标、初始屏障与荒芜海岸不能放置屏障规则', () => {
  const s = deep()
  const api = createMechanicsApi(s)
  const start = s.locations.find(location => location.id === s.investigators[0].location)
  assert.equal(codeOf(start), '07143')
  assert.deepEqual(api.map.position(start.id), { x: 0, y: 0, isolated: false })
  // 15 个地点坐标唯一且都不为空
  const points = api.map.locations().map(location => api.map.position(location.id))
  assert.equal(points.length, 15)
  assert.equal(new Set(points.map(point => `${point.x},${point.y}`)).size, 15)
  // 印刷连接：荒芜海岸连到朝岸贫民窟与印斯茅斯港口，其余地点也都有连接
  assert.deepEqual([...start.connections].sort(), ['location07131', 'location07138'])
  assert.ok(s.locations.every(location => Array.isArray(location.connections) && location.connections.length > 0))
  // 初始屏障：起始地点与朝岸贫民窟之间 2 道
  assert.deepEqual(api.barriers.edges(start.id), [{ a: 'location07131', b: 'location07143', count: 2 }])
  assert.equal(api.barriers.count('location07131', 'location07143'), 2)
  // 07143 荒芜海岸：locationRule.cannotPlaceBarriers 是真实注册的收口规则
  assert.equal(registeredEntry('07143').locationRule.cannotPlaceBarriers, true)
  assert.equal(api.barriers.canPlace('location07143', 'location07131'), false)
})

test('P7 深陷危局 幕 07128 正面：团队线索免费行动移除本地点屏障且不耗行动', () => {
  const s = deep(2)
  const api = createMechanicsApi(s)
  s.investigators[0].clues = 1
  s.investigators[1].clues = 2
  const actions = s.investigators[0].actionsLeft
  const abilityMove = legalMoves(s).find(move => move.action === 'entityAbility' && move.entityId === s.acts[0].id)
  assert.ok(abilityMove, '当前幕 07128 的团队线索行动应出现在合法动作里')
  move(s, abilityMove)
  settle(s)
  assert.deepEqual(api.barriers.edges(s.investigators[0].location),
    [{ a: 'location07131', b: 'location07143', count: 1 }], '支付全队 3 线索后移除 1 道屏障')
  assert.deepEqual(s.investigators.map(inv => inv.clues), [0, 0])
  assert.equal(s.investigators[0].actionsLeft, actions, '免费行动不消耗行动点')
})

test('P7 深陷危局 幕 07128 背面：推进结算记录 TheInvestigatorsMadeItSafelyToTheirVehicles 并交接到 devilReef', () => {
  const s = deep()
  run(s, draft => scenarioRuntime(draft, []).advanceAct())
  assert.equal(s.campaign.records.TheInvestigatorsMadeItSafelyToTheirVehicles, true)
  assert.equal(s.campaign.scenarioResults.length, 1)
  assert.equal(s.campaign.pendingNode, 'devilReef')
  assert.equal(s.campaign.investigators[0].xp, 2, '安全抵达载具的 2 点经验真实发放')
})

test('P7 深陷危局 议程 07124–07127 正面持续规则登记（背面 onReveal 为已知缺口）', () => {
  const s = deep()
  assert.deepEqual(s.agendas.map(codeOf), ['07124', '07125', '07126', '07127'])
  for (const code of ['07124', '07125', '07126', '07127']) {
    const entry = registeredEntry(code)
    assert.ok(entry, `议程 ${code} 条目已注册`)
    assert.deepEqual(entry.modifiers.map(modifier => modifier.target), ['loses:aloof', 'cannot:parley'])
    assert.equal(entry.abilities.length, 1)
    assert.ok(entry.abilities[0].trigger.includes('turnEnded'), '回合末强制触发')
  }
  // 四张压迫议程的差异只在回合末惩罚强度（07124 只伤害；07125 恐惧 1；07126/07127 追加弃牌）
  assert.deepEqual(s.agendas.map(agenda => agenda.originalCode), ['07124', '07125', '07126', '07127'])
})

test('P7 深陷危局 chaos token 提示卡符号：skull 数东侧格、hard 翻倍、cultist 失败被拖到东侧地点', () => {
  // 07123：skull = -东侧同排非隔断地点数 × (hard ? 2 : 1)；在网格最西侧 07130 有 4 个东侧格
  for (const [difficulty, expected] of [['easy', 16], ['standard', 16], ['hard', 12]]) {
    const s = deep()
    s.difficulty = difficulty
    s.investigators[0].willpower = 20
    s.investigators[0].location = s.locations.find(location => codeOf(location) === '07130').id
    s.chaosBag = ['skull']
    run(s, draft => scenarioRuntime(draft, []).test(0, 'willpower', 0, () => {}))
    assert.equal(s.lastTestResult.value, expected, `${difficulty} skull 值`)
  }
  // cultist 失败：被移动到东侧连接地点（07130 → 07140），独立障碍不阻挡该位移
  const cultist = deep()
  cultist.investigators[0].location = cultist.locations.find(location => codeOf(location) === '07130').id
  cultist.chaosBag = ['cultist']
  run(cultist, draft => scenarioRuntime(draft, []).test(0, 'willpower', 99, () => {}))
  assert.equal(cultist.lastTestResult.success, false)
  assert.equal(codeOf(cultist.locations.find(location => location.id === cultist.investigators[0].location)), '07140')
})

test('P7 深陷危局 遭遇共享组 07091 暗流：淹没地点显现后进入威胁区', () => {
  const s = deep()
  // 起始地点荒芜海岸初始水位 1（已淹没），07091 应进入威胁区而不是涌动
  assert.equal(createMechanicsApi(s).water.level(s.investigators[0].location), 1)
  s.encounterDeck = ['07091']
  s.chaosBag = ['0']
  run(s, draft => scenarioRuntime(draft, []).drawEncounter(0))
  assert.equal(s.investigators[0].threat.filter(card => (card.code || card) === '07091').length, 1)
  assert.equal(s.encounterDeck.length, 0)
})

test('P7 深陷危局 遭遇敌人 07144 印斯茅斯修格斯：真实显现生成与生命值随人数缩放', () => {
  for (const count of [1, 2]) {
    const s = deep(count)
    s.encounterDeck = ['07144']
    s.chaosBag = ['0']
    run(s, draft => scenarioRuntime(draft, []).drawEncounter(0))
    const shoggoth = s.enemies.find(enemy => codeOf(enemy) === '07144')
    assert.ok(shoggoth, '印斯茅斯修格斯应真实生成')
    assert.equal(shoggoth.location, s.investigators[0].location)
    // 印刷 4 生命 + 「+2/调查员」修正经真实 enemyHealth 读点生效
    assert.equal(enemyHealth(s, shoggoth), 4 + 2 * count, '有效生命值 = 印刷 4 + 2×调查员人数')
    assert.equal(scenarioRuntime(s, []).mechanics.enemyZones.list('depths').length, 0)
  }
})

test('P7 深陷危局 淹没规则：07145 袭击者的战斗值随所在地点水位提高', () => {
  const s = deep()
  const api = createMechanicsApi(s)
  let ravager
  run(s, draft => { ravager = scenarioRuntime(draft, []).spawn('07145', draft.investigators[0].location) })
  assert.ok(ravager)
  for (const level of [0, 1, 2]) {
    api.water.set(s.investigators[0].location, level, { ignoreRestrictions: true })
    assert.equal(enemyFightValue(s, ravager), 2 + level, `水位 ${level} 的战斗值`)
  }
})

test('P7 深陷危局 结局与记录：resolution1 安全抵达载具经验 +2 且交接到 devilReef；noResolution 重定向', () => {
  const safe = deep(1, { records: { TheInvestigatorsMadeItSafelyToTheirVehicles: true } })
  const xpBefore = safe.campaign.investigators[0].xp
  run(safe, draft => scenarioRuntime(draft, []).finish('resolution1'))
  assert.equal(safe.campaign.investigators[0].xp, xpBefore + 2)
  assert.equal(safe.campaign.scenarioResults.length, 1)
  assert.equal(safe.campaign.pendingNode, 'devilReef')
  // noResolution 在深陷危局按资料重定向到 resolution1，同样交接到 devilReef
  const failed = deep()
  run(failed, draft => scenarioRuntime(draft, []).finish('noResolution'))
  assert.equal(failed.campaign.scenarioResults.length, 1)
  assert.equal(failed.campaign.pendingNode, 'devilReef')
})

test('P7 深陷危局 JSON 保存/恢复：合法动作一致且恢复后可继续执行幕行动', () => {
  const s = deep(2)
  s.investigators[0].clues = 1
  s.investigators[1].clues = 2
  const actionSignature = state => legalMoves(state)
    .map(move => `${move.action}:${move.entityId ?? move.locationId ?? ''}:${move.abilityIndex ?? ''}`).sort()
  const saved = JSON.parse(JSON.stringify(s))
  assert.deepEqual(actionSignature(saved), actionSignature(s), '保存/恢复后合法动作集合一致')
  const abilityMove = legalMoves(saved).find(move => move.action === 'entityAbility' && move.entityId === saved.acts[0].id)
  assert.ok(abilityMove, '恢复后幕行动仍合法')
  move(saved, abilityMove)
  settle(saved)
  const api = createMechanicsApi(saved)
  assert.equal(api.barriers.count('location07143', 'location07131'), 1, '恢复后继续执行真实行动')
  assert.deepEqual(saved.investigators.map(inv => inv.clues), [0, 0])
  assert.deepEqual(JSON.parse(JSON.stringify(saved)).scenarioFlags.mechanics.barriers,
    saved.scenarioFlags.mechanics.barriers)
})
