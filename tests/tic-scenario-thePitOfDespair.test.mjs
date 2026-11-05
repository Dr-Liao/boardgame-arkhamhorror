// P7 绝望深坑（thePitOfDespair）逐章验收测试。
//
// 审计契约（tools/audit-tic-scenarios.mjs#chapterTestFor / CHECK_TITLE_MARKERS）：
//   · 文件必须在 tests/suites.mjs 登记（主进程负责），并显式引用本章：chapterFixture('thePitOfDespair') /
//     `scenarios/thePitOfDespair/`；
//   · 工具用 `node --test --test-reporter=tap` 实跑，文件全绿才算通过；
//   · 每个行为检查需要至少一条**通过用例标题**命中它的关键词（setup/幕/地点/遭遇/混乱/结局/存档…），
//     所以标题是验收证据的一部分，改标题前先看工具的 CHECK_TITLE_MARKERS。
//
// 本文件只做章节级验收（真实 chapterFixture 开局事务 + 真实单卡条目/引擎读点），
// 不复制单卡实现；逐卡细节仍由 tests/tic-scenarios-early.test.mjs 等专项覆盖。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'

import { chapterFixture } from './tic-chapter-fixture.mjs'
import { move } from './core-fixture.mjs'
import { checkAct, legalMoves, revealLocation, scenarioRuntime } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

// 本章 15 张单卡条目真实注册（chapterFixture 只注册章节定义/开局事务，不注册单卡能力层）。
const chapterDir = new URL('../src/cards/encounter-entries/theInnsmouthConspiracy/thePitOfDespair/', import.meta.url)
for (const name of readdirSync(chapterDir)) {
  if (!name.endsWith('.js')) continue
  const entry = (await import(new URL(name, chapterDir))).default
  if (!registeredEntry(entry.code)) registerCardAbilities(entry)
}

const codeOf = card => card?.originalCode || card?.code
const pit = count => chapterFixture('thePitOfDespair', count)

// 真实事务推进：execute 里调引擎 API；ScenarioEnded 是正常结束关卡，继续把待决选择清空。
function run(state, execute) {
  const executeOnce = draft => {
    try { return execute(draft) } catch (error) {
      if (error.constructor?.name !== 'ScenarioEnded') throw error
    }
  }
  resolveTransaction(state, 0, { action: 'testTicPitChapter' }, executeOnce)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 150, 'TIC 绝望深坑 choice loop')
    const choice = state.pendingChoice
    const optionId = ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0].id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, executeOnce)
  }
}

test('P7 绝望深坑 setup 初始设置与区域守恒：4 地点/25 张遭遇牌库/6 张旁置/8 条潮汐隧道模板', () => {
  const s = pit()
  assert.equal(s.scenario.id, 'thePitOfDespair')
  assert.equal(s.investigators[0].location, s.scenario.startLocation)
  // 幕/议程：真实卡号序列（07045/07046 幕，07042–07044 议程）
  assert.deepEqual(s.acts.map(codeOf), ['07045', '07046'])
  assert.deepEqual(s.agendas.map(codeOf), ['07042', '07043', '07044'])
  // 起始地点已揭示 + 3 条初始潮汐隧道未揭示
  assert.equal(s.locations.length, 4)
  assert.equal(s.locations.filter(location => location.revealed).length, 1)
  // 遭遇牌库与旁置区守恒：25 张牌库；6 张印刷旁置（07053×1 + 07054×2 + 07055×3）
  assert.equal(s.encounterDeck.length, 25)
  assert.deepEqual(s.scenarioZones.setAside, ['07053', '07054', '07054', '07055', '07055', '07055'])
  assert.equal(Object.keys(s.scenario.locations).length, 12) // 12 个印刷地点（4 在场 + 8 定义/旁置）
  assert.equal(s.scenario.setAsideLocations.length, 8)
  const inPlayIds = new Set(s.locations.map(location => location.id))
  assert.ok(s.scenario.setAsideLocations.every(id => !inPlayIds.has(id)), '放一边地点不得同时在场')
  // 潮汐隧道物理实例守恒：8 条模板 = 3 初始 + 5 备用；3 个初始坐标点
  assert.equal(s.scenarioFlags.initialTunnelPositions.length, 3)
  assert.equal(s.scenarioFlags.pitTunnelReserve.length, 5)
  assert.equal(Object.keys(s.scenarioFlags.innsmouthLocations).length, 8)
  assert.ok(s.locations.filter(location => location.id !== s.scenario.startLocation)
    .every(location => s.scenarioFlags.initialTunnelPositions.some(item => item.id === location.id)))
  // 钥匙初始状态：蓝/绿正面朝上放一边；黑/白移出游戏；红/黄/紫背面朝下；起始地点揭示强制暗置红钥匙
  const keys = s.scenarioFlags.mechanics.keys
  assert.deepEqual(keys.blue, { holder: 'setAside', revealed: true })
  assert.deepEqual(keys.green, { holder: 'setAside', revealed: true })
  assert.deepEqual(keys.black, { holder: 'removed', revealed: false })
  assert.deepEqual(keys.white, { holder: 'removed', revealed: false })
  assert.deepEqual(keys.yellow, { holder: 'setAside', revealed: false })
  assert.deepEqual(keys.purple, { holder: 'setAside', revealed: false })
  assert.deepEqual(keys.red, { holder: `location:${s.scenario.startLocation}`, revealed: false })
  // 共享遭遇组守恒：本章牌库来自 gatherSets（含 agents_of_cthulhu / creatures_of_the_deep / rising_tide 等）
  const groups = new Set(s.encounterDeck.map(code => ALL_CARDS[code]?.encounterCode))
  for (const group of ['agents_of_cthulhu', 'creatures_of_the_deep', 'rising_tide', 'shattered_memories']) {
    assert.ok(groups.has(group), `遭遇牌库应包含共享组 ${group}`)
  }
})

test('P7 绝望深坑 地点与连接：随机隧道隐藏身份、真实地图坐标与双向连接守恒', () => {
  const s = pit()
  const api = createMechanicsApi(s)
  const start = s.locations.find(location => location.id === s.scenario.startLocation)
  assert.deepEqual(api.map.position(start.id), { x: 0, y: 0, isolated: false })
  const tunnels = s.locations.filter(location => location.id !== start.id)
  assert.equal(tunnels.length, 3)
  assert.deepEqual(
    tunnels.map(tunnel => api.map.position(tunnel.id)).map(point => `${point.x},${point.y}`).sort(),
    ['-1,0', '0,-1', '1,0'])
  // 连接：起始地点连到 3 条隧道，每条隧道双向连回起始地点
  assert.deepEqual([...start.connections].sort(), tunnels.map(tunnel => tunnel.id).sort())
  for (const tunnel of tunnels) assert.deepEqual(tunnel.connections, [start.id])
  // 隐藏身份：未揭示的潮汐隧道只暴露通用名与 artCode，真实地点名放在 unrevealedActualName
  for (const tunnel of tunnels) {
    assert.equal(tunnel.hiddenIdentity, true)
    assert.equal(tunnel.nameEn, 'Tidal Tunnel')
    assert.ok(tunnel.artCode)
    assert.ok(tunnel.unrevealedActualNameEn)
    assert.equal(tunnel.revealed, false)
  }
  // 印刷定义全部登记身份且可复算
  const definitions = Object.values(s.scenario.locations)
  assert.equal(definitions.length, 12)
  for (const location of definitions) {
    assert.ok(location.originalCode, '地点必须有真实卡号')
    assert.equal(location.identityStatus, 'mapped')
  }
})

test('P7 绝望深坑 幕 07045 推进与背面：生成阿玛尔加姆/洗入 07054/07055/初始化潮汐隧道牌堆', () => {
  const s = pit()
  run(s, draft => scenarioRuntime(draft, []).advanceAct())
  assert.equal(s.actIndex, 1)
  assert.equal(codeOf(s.acts[1]), '07046')
  // 07045 背面：生成在场的阿玛尔加姆（与队首交战）
  const amalgam = s.enemies.find(enemy => codeOf(enemy) === '07053')
  assert.ok(amalgam, '07045 背面应生成阿玛尔加姆')
  assert.equal(amalgam.engagedSeat, 0)
  assert.equal(amalgam.location, s.investigators[0].location)
  assert.equal(s.scenarioZones.setAside.filter(code => code === '07053').length, 0)
  // 07045 背面：2×07054 + 3×07055 洗入遭遇牌库（25 → 30）
  assert.equal(s.encounterDeck.length, 30)
  assert.equal(s.encounterDeck.filter(code => code === '07054').length, 2)
  assert.equal(s.encounterDeck.filter(code => code === '07055').length, 3)
  // 07045 背面：备用隧道全部进入 tidalTunnels 牌堆（5 备用 + 3 特殊）
  assert.equal(s.scenarioFlags.pitTunnelReserve.length, 0)
  assert.equal(createMechanicsApi(s).scenarioDecks.size('tidalTunnels'), 8)
})

test('P7 绝望深坑 幕 07046 目标与背面：全部撤退/败北才推进，推进结算 resolution1 记录', () => {
  const s = pit(2)
  s.actIndex = 1 // 当前幕 = 07046（07045 已推进）
  assert.equal(codeOf(s.acts[1]), '07046')
  const objective = registeredEntry('07046').actRule.objective
  assert.equal(objective(s), false, '仍有未败北/未撤退的调查员时不得推进')
  for (const inv of s.investigators) inv.resigned = true
  assert.equal(objective(s), true)
  run(s, draft => checkAct(draft, []))
  // 07046 背面：finish('resolution1') → 记录写入 scenarioResults 并交接到 interlude1
  assert.equal(s.campaign.scenarioResults.length, 1)
  assert.equal(s.campaign.pendingNode, 'interlude1')
  assert.deepEqual(s.campaign.scenarioResults[0].story.sections.map(section => section.title), ['resolution1'])
  // 真实撤退动作驱动幕推进（审计 H7 回归）：最后一名调查员撤退时引擎 doResign 先给当前幕
  // allResigned 钩子；修复前缺失它，checkOutcome 抢先落到 noResolution，结局键退化。
  const driven = pit(2)
  driven.actIndex = 1
  run(driven, draft => scenarioRuntime(draft, []).resign(0))
  assert.equal(driven.campaign.scenarioResults.length, 0, '仍有幸存者时不结算')
  run(driven, draft => scenarioRuntime(draft, []).resign(1))
  assert.equal(driven.campaign.scenarioResults.length, 1)
  assert.equal(driven.campaign.scenarioResults[0].resolution, 'resolution1', '真实撤退驱动得到 R1 而非 noResolution')
})

test('P7 绝望深坑 议程推进：07042→07043 水位升级与已揭示地点结算', () => {
  const s = pit()
  const api = createMechanicsApi(s)
  assert.equal(codeOf(s.agendas[0]), '07042')
  run(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.agendaIndex, 1)
  assert.equal(codeOf(s.agendas[1]), '07043')
  const revealed = s.locations.filter(location => location.revealed)
  assert.equal(revealed.length, 1)
  assert.equal(api.water.level(revealed[0].id), 1, '议程背面把已揭示地点的水位提高 1')
  // 未揭示地点不受影响（07042/07043 只对已揭示地点结算）
  assert.ok(s.locations.filter(location => !location.revealed).every(location => api.water.level(location.id) === 0))
})

test('P7 绝望深坑 chaos token 四档提示卡符号：skull 按水位、hard 提高难度、tablet 失败持钥匙恐惧', () => {
  // 07041 scenarioRule：skull = -(1 + hard + 有效水位)；easy/standard 水位 2 → -3，hard → -4
  for (const [difficulty, expected] of [['easy', 17], ['standard', 17], ['hard', 16]]) {
    const s = pit()
    s.difficulty = difficulty
    s.investigators[0].willpower = 20
    createMechanicsApi(s).water.set(s.investigators[0].location, 2, { ignoreRestrictions: true })
    s.chaosBag = ['skull']
    run(s, draft => scenarioRuntime(draft, []).test(0, 'willpower', 0, () => {}))
    assert.equal(s.lastTestResult.value, expected, `${difficulty} skull 值`)
    assert.equal(s.lastTestResult.success, true)
  }
  // tablet 失败：若控制钥匙则受到 1 点恐惧（07041 的 onFail 事件）
  const tablet = pit()
  createMechanicsApi(tablet).keys.transfer('red', `location:${tablet.scenario.startLocation}`, 'investigator:0', { reveal: true })
  assert.deepEqual(createMechanicsApi(tablet).keys.at('investigator:0', { reveal: true }), ['red'])
  tablet.chaosBag = ['tablet']
  run(tablet, draft => scenarioRuntime(draft, []).test(0, 'willpower', 99, () => {}))
  assert.equal(tablet.lastTestResult.success, false)
  assert.equal(tablet.investigators[0].horror, 1, 'tablet 失败且持钥匙 → 1 恐惧')
})

test('P7 绝望深坑 遭遇敌人/诡计 07053/07054/07055：深渊出入与真实涌动显现', () => {
  const s = pit()
  // 真实生成阿玛尔加姆，再按牌库顺序抽 07055（送深渊并涌动）→ 07054（失败恢复并攻击）
  run(s, draft => { scenarioRuntime(draft, []).spawn('07053', draft.investigators[0].location) })
  assert.equal(s.enemies.filter(enemy => codeOf(enemy) === '07053').length, 1)
  s.encounterDeck = ['07054', '07055'] // drawEncounter 从牌库末位抽：先 07055
  s.chaosBag = ['0']
  run(s, draft => scenarioRuntime(draft, []).drawEncounter(0))
  assert.equal(scenarioRuntime(s, []).mechanics.enemyZones.list('depths').length, 0, '深渊里的阿玛尔加姆应被 07054 拉回')
  const amalgam = s.enemies.find(enemy => codeOf(enemy) === '07053')
  assert.ok(amalgam)
  assert.equal(amalgam.engagedSeat, 0)
  assert.equal(amalgam.location, s.investigators[0].location)
  assert.equal(s.investigators[0].damage, 1, '07054 失败后被拉回的阿玛尔加姆真实攻击一次')
  assert.equal(s.encounterDeck.length, 0)
  assert.deepEqual([...s.encounterDiscard].sort(), ['07054', '07055'])
})

test('P7 绝望深坑 地点揭示与连接扩张：07046 背面只扩空位且 8 条物理隧道总数守恒', () => {
  const s = pit()
  run(s, draft => scenarioRuntime(draft, []).advanceAct()) // 07045 背面初始化 tidalTunnels（8）
  const hidden = s.locations.find(location => !location.revealed)
  assert.ok(hidden)
  const before = s.locations.length + createMechanicsApi(s).scenarioDecks.size('tidalTunnels')
  run(s, draft => revealLocation(draft, hidden.id, [], 0))
  const api = createMechanicsApi(s)
  assert.equal(s.locations.length + api.scenarioDecks.size('tidalTunnels'), before, '物理隧道总数守恒')
  assert.ok(s.locations.length > 4, '07046 背面把隧道扩展入场')
  assert.equal(s.locations.filter(location => location.revealed).length, 2)
})

test('P7 绝望深坑 结局与记录：noResolution 结算交接到 interlude1', () => {
  const s = pit()
  run(s, draft => scenarioRuntime(draft, []).finish('noResolution'))
  assert.equal(s.campaign.scenarioResults.length, 1)
  assert.equal(s.campaign.pendingNode, 'interlude1')
  const story = s.campaign.scenarioResults[0].story
  assert.equal(story.title, s.scenario.name)
  assert.ok(Array.isArray(story.sections) && story.sections.length > 0)
  assert.equal(s.campaign.failed, undefined)
})

test('P7 绝望深坑 JSON 保存/恢复：合法动作集合与继续游戏一致', () => {
  const s = pit()
  const actionSignature = state => legalMoves(state)
    .map(move => `${move.action}:${move.entityId ?? move.locationId ?? ''}:${move.abilityIndex ?? ''}`).sort()
  const before = actionSignature(s)
  const saved = JSON.parse(JSON.stringify(s))
  assert.deepEqual(actionSignature(saved), before, '保存/恢复后合法动作集合一致')
  assert.deepEqual(saved.scenarioFlags.mechanics, s.scenarioFlags.mechanics, '机制状态 JSON 往返不变')
  const walk = legalMoves(saved).find(move => move.action === 'move')
  assert.ok(walk, '恢复后仍可移动')
  move(saved, walk)
  assert.notEqual(saved.investigators[0].location, s.investigators[0].location, '恢复后可继续真实行动')
  assert.deepEqual(JSON.parse(JSON.stringify(saved)).scenarioFlags.mechanics, saved.scenarioFlags.mechanics)
})
