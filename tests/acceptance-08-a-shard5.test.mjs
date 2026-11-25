// 验收 08-a 分片 5（EOTE《地球边缘》08546–08573）逐卡证据补充。
//
// 背景：EOTE 战役卡此前没有任何「标题含卡号」的测试（scope-map 显示 45/45 缺标题证据；
// 账本只有文件级/模式级证据，且 summary missing 118 / blocked 23）。本文件为分片内
// 45 张卡逐张补一条真实执行、标题含卡号的用例：断言走真实内容层（章节 behavior /
// 单卡条目 flags / 卡牌数据）的可执行读点，失败卡的缺失点由 artifacts/acceptance/08-a-5/
// probe-defects.mjs 单独复现并写进报告。
//
// 主进程合并时需登记进 tests/suites.mjs 与 tests/node-suite.mjs。
import test from 'node:test'
import assert from 'node:assert/strict'

import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { entryFlags, enemyRuleFor } from '../src/cards/card-rules.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as fm from '../content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js'
import * as fmDef from '../content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js'
import { fatalMirageChaosToken } from '../content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/chaos.js'
import * as p3 from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js'
import * as p3Def from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/definition.js'

const INV = (seat = 0) => ({
  seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
  assets: [], engaged: [], deck: [], discard: [], threat: [], defeated: false, resigned: false,
})
const stateFor = (n = 1, flags = {}) => ({
  investigators: Array.from({ length: n }, (_, seat) => INV(seat)),
  locations: [], enemies: [], encounterDeck: [], encounterDiscard: [], scenarioFlags: { ...flags },
  scenarioZones: {}, campaign: { leadSeat: 0, records: {}, completedSteps: [], trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: n,
  phase: 'investigation', round: 1, status: 'playing',
})
const apiOf = (overrides = {}) => ({
  info: () => {}, choose: request => request?.options?.[0]?.id ?? 'tekelili',
  randomValue: () => 0.5, ...overrides,
})
const setupFatalMirage = (state, overrides = {}) => {
  fm.setupScenario(state, { ...apiOf(overrides), shuffle: items => items })
  return state
}
const codeToLocation = Object.fromEntries(Object.entries(fmDef.LOCATIONS).map(([id, data]) => [String(data.code), id]))
const codeToStory = Object.fromEntries(Object.entries(fmDef.LOCATIONS).map(([id, data]) => [String(data.code), data.storyCode]))

// ---------------------------------------------------------------------------
// 地点 08556–08573（18）：Mirage 关键词（层级 / 目标映射 / 线索总量）真实读点。
// 注：08557–08573 的印刷特殊规则当前未实现（见 probe-defects.mjs 与报告 §3），
// 本用例只覆盖已实现的 Mirage 关键词部分。
// ---------------------------------------------------------------------------
const LOCATION_CODES = ['08556', '08557', '08558', '08559', '08560', '08561', '08562', '08563', '08564',
  '08565', '08566', '08567', '08568', '08569', '08570', '08571', '08572', '08573']
for (const code of LOCATION_CODES) {
  test(`08-a5 ${code} ${ALL_CARDS[code].nameZh}：Mirage 层级/目标映射/入场线索与卡面一致`, () => {
    const state = setupFatalMirage(stateFor(1))
    const id = codeToLocation[code]
    assert.ok(id, `${code} 应在本章地点表内`)
    const printed = /幻景(\d)/.exec(ALL_CARDS[code].textZh || '') || /Mirage (\d)/.exec(ALL_CARDS[code].text || '')
    assert.ok(printed, '印刷应有 Mirage 层级')
    const tier = Number(printed[1])
    assert.equal(entryFlags(code).tier, tier, '条目 flags.tier 与印刷层级一致')
    // 目标映射来自地点剧情卡（storyFlip）——真实读点 behavior.mirageTargets。
    const storyCode = codeToStory[code]
    const flip = entryFlags(storyCode)?.storyFlip || {}
    const expected = flip.memoryEnemy
      ? [{ kind: 'enemy', code: String(flip.memoryEnemy) }]
      : (flip.choices || []).filter(choice => fmDef.LOCATIONS[choice]).map(choice => ({ kind: 'location', id: choice }))
    assert.deepEqual(fm.mirageTargets(id), expected, 'Mirage 目标 = 对应剧情卡声明的选项')
    // 入场线索 = max(0, 印刷基础线索 - 层级 × 已入场/已放逐目标数) × 人数；尚未有目标在场。
    const base = Number(fmDef.LOCATIONS[id].clues) || 0
    assert.equal(fm.mirageClueTotal(state, id), Math.max(0, base - tier * 0), '未翻开任何目标时线索总量')
  })
}

// ---------------------------------------------------------------------------
// 剧情卡 08556b–08572b（17）：翻面后「放置指定地点 / 生成记忆敌人 / 放逐并进胜利区」
// 与卡面条目数据一致（真实读点 behavior.flipStoryFace ← 引擎 locationStory/enemyDefeated）。
// ---------------------------------------------------------------------------
const STORY_CODES = ['08556b', '08557b', '08558b', '08559b', '08560b', '08561b', '08562b', '08563b',
  '08564b', '08565b', '08566b', '08567b', '08568b', '08569b', '08570b', '08571b', '08572b']
for (const code of STORY_CODES) {
  test(`08-a5 ${code} ${ALL_CARDS[code].nameZh}：剧情卡翻面按卡面选项放置地点或生成记忆敌人`, () => {
    const parentCode = code.replace(/b$/, '')
    const parentId = codeToLocation[parentCode]
    const story = entryFlags(code)?.storyFlip
    assert.ok(story, '条目应声明 storyFlip 数据')
    const state = setupFatalMirage(stateFor(1))
    state.investigators[0].location = parentId
    if (story.memoryEnemy) {
      state.scenarioZones.setAside = [String(story.memoryEnemy)]
      const result = fm.flipStoryFace(state, code, apiOf(), { location: parentId })
      assert.equal(result.spawnEnemy, String(story.memoryEnemy), '伙伴活着 → 在本地生成记忆敌人')
      assert.ok(state.enemies.some(enemy => String(enemy.code) === String(story.memoryEnemy) && enemy.location === parentId))
      assert.equal(story.victoryOnBanish, true, '伙伴被划掉时本卡加入胜利区（victoryOnBanish）')
    } else {
      const choice = story.choices[0]
      assert.ok(fmDef.LOCATIONS[choice], '选项应是本章幻景地点')
      const result = fm.flipStoryFace(state, code, apiOf(), { location: parentId, choice })
      assert.deepEqual(result.placed, [choice], '按选项放置下一层记忆地点')
      const placed = state.locations.find(location => location.id === choice)
      assert.ok(placed, '地点已入场')
      assert.equal(placed.revealed, true, '剧情卡 placeRevealed：入场即揭示')
      assert.equal(story.placeRevealed, true)
    }
  })
}

// ---------------------------------------------------------------------------
// 议程 08550–08552：版本映射与背面结算（剩余调查员被击败/创伤/洗牌）。
// 注：正面 [fast]「受到 1 点恐惧：移动到记忆囚笼」当前无执行读点（见 probe-defects.mjs）。
// ---------------------------------------------------------------------------
test('08-a5 08550 虚灵纠缠（版本一）：背面击败剩余调查员并把忒咳哩-哩牌洗入牌库', () => {
  const state = setupFatalMirage(stateFor(2))
  assert.equal(fmDef.AGENDA_VERSION_CODES[1], '08550')
  assert.equal(registeredEntry('08550').flags.version, 1)
  assert.equal(fm.agendaReveal(state, { originalCode: '08550' }, apiOf()), true)
  assert.ok(state.investigators.every(inv => inv.defeated), '剩余调查员全部被击败')
  assert.equal(state.campaign.trauma?.[0]?.mental || 0, 0, '版本一不承受精神创伤')
})
test('08-a5 08551 虚灵纠缠（版本二）：背面可选精神创伤或洗入 2 张忒咳哩-哩牌', () => {
  const state = setupFatalMirage(stateFor(2))
  assert.equal(fmDef.AGENDA_VERSION_CODES[2], '08551')
  assert.equal(registeredEntry('08551').flags.version, 2)
  assert.equal(fm.agendaReveal(state, { originalCode: '08551' }, apiOf({ choose: () => 'trauma' })), true)
  assert.ok(state.investigators.every(inv => inv.defeated), '剩余调查员全部被击败')
  assert.equal(state.campaign.trauma[0].mental, 1, '选择承受 1 点精神创伤')
})
test('08-a5 08552 虚灵纠缠（版本三）：背面剩余调查员被击败并承受 1 点精神创伤', () => {
  const state = setupFatalMirage(stateFor(2))
  assert.equal(fmDef.AGENDA_VERSION_CODES[3], '08552')
  assert.equal(registeredEntry('08552').flags.version, 3)
  assert.equal(fm.agendaReveal(state, { originalCode: '08552' }, apiOf()), true)
  assert.ok(state.investigators.every(inv => inv.defeated), '剩余调查员全部被击败')
  assert.equal(state.campaign.trauma[1].mental, 1, '版本三承受 1 点精神创伤')
})

// ---------------------------------------------------------------------------
// 幕 08553–08555：直面内心恶魔后出现「推进当前幕」行动，背面进入结局 1。
// ---------------------------------------------------------------------------
for (const [version, code] of Object.entries(fmDef.ACT_VERSION_CODES)) {
  test(`08-a5 ${code} 旧事阴影（版本${version}）：直面内心恶魔后可推进幕，背面进入结局 1`, () => {
    const state = setupFatalMirage(stateFor(1))
    assert.equal(fmDef.ACT_VERSION_CODES[Number(version)], code)
    assert.equal(registeredEntry(code).flags.actVersion, true)
    state.scenarioFlags.fatalMirageMayAdvance = true
    const inv = state.investigators[0]
    const advance = fm.actions(state, inv).find(move => move.rule === 'fatalMirageAdvanceAct')
    assert.ok(advance, '直面内心恶魔后 actions 应给出推进幕行动')
    let advanced = 0
    assert.equal(fm.performAction(state, inv, advance, apiOf({ advanceAct: () => { advanced += 1 } })), true)
    assert.equal(advanced, 1, '真实调用 advanceAct')
    let finishCalls = 0
    assert.equal(fm.actReveal(state, { originalCode: code }, apiOf({ finish: () => { finishCalls += 1 } })), true)
    assert.equal(finishCalls, 1, '背面通过引擎 finish 钩子进入结局')
  })
}

// ---------------------------------------------------------------------------
// 08549 致命幻景（scenario）：混乱标记数值与失败追加效果（真实读点 behavior.resolveChaosToken/afterTest）。
// ---------------------------------------------------------------------------
test('08-a5 08549 致命幻景：剧情卡计数/密谋编号修正 skull，cultist 失败放线索', () => {
  const state = stateFor(1)
  const inv = state.investigators[0]
  inv.location = 'prisonOfMemories'
  state.locations = [{ id: 'prisonOfMemories', clues: 0, maxClues: 3 }]
  state.victoryDisplay = [{ code: '08556b' }, { code: '08557b' }]
  assert.equal(registeredEntry('08549').flags.tokenMeanings.skull != null, true, '条目声明 tokenMeanings 数据')
  assert.equal(fm.resolveChaosToken(state, inv, 'skull').delta, -2, '简单/普通：skull = -胜利区剧情卡数')
  state.difficulty = 'hard'
  assert.equal(fm.resolveChaosToken(state, inv, 'skull').delta, -3, '困难/专家：skull = -(剧情卡数 + 当前密谋编号)')
  state.difficulty = 'standard'
  inv.clues = 1
  const result = { success: false, difficulty: 2, value: 0, drawn: ['cultist'] }
  assert.deepEqual(fm.afterTest(state, inv, result, apiOf()), [{ token: 'cultist', rider: 'clueOnLocation' }])
  assert.equal(inv.clues, 0, '失败后失去 1 个线索')
  assert.equal(state.locations[0].clues, 1, '把 1 个线索放到所在地点')
})

// ---------------------------------------------------------------------------
// 08546 陷入围攻！（act）：幕目标 / 营地撤退行动 / 背面结局 1、2。
// 注：「每个幻灵敌人获得胜利 0」当前无执行读点（见 probe-defects.mjs 与报告 §3）。
// ---------------------------------------------------------------------------
test('08-a5 08546 陷入围攻！：幕目标/营地撤退行动/背面结局 1 与结局 2', () => {
  const state = stateFor(2)
  state.acts = [{ originalCode: '08546' }]
  state.actIndex = 0
  state.scenarioFlags.camp = 'crashSite'
  state.locations = [{ id: 'crashSite', revealed: true }]
  state.investigators.forEach(inv => { inv.location = 'crashSite'; inv.clues = 2 })
  // 营地撤退行动：共同花 4 线索 → 全体撤退。
  const resign = p3.actions(state, state.investigators[0]).find(move => move.rule === 'campResign')
  assert.ok(resign, '营地应提供共同花 4 线索的撤退行动')
  assert.equal(p3.performAction(state, state.investigators[0], resign, apiOf()), true)
  assert.equal(state.investigators.reduce((sum, inv) => sum + inv.clues, 0), 0, '共同支付 4 线索')
  assert.ok(state.investigators.every(inv => inv.resigned), '全体撤退')
  // 幕目标：场上没有幻灵敌人 → 达标并推进。
  const noEnemy = stateFor(1)
  noEnemy.acts = [{ originalCode: '08546' }]
  let advanced = 0
  assert.equal(p3.checkObjectives(noEnemy, apiOf({ advanceAct: () => { advanced += 1 } })), true)
  assert.equal(advanced, 1, '无幻灵敌人时推进幕')
  // 背面结局 1（无幻灵敌人）/结局 2（通过撤退推进）。
  let first = null
  assert.equal(p3.actReveal(stateFor(1), { originalCode: '08546' }, apiOf({ finish: key => { first = key } })), true)
  assert.equal(first, 'resolution1')
  const resignedState = stateFor(1)
  resignedState.investigators[0].resigned = true
  resignedState.enemies = [{ code: p3Def.EIDOLON_ENEMY_CODES[0], originalCode: p3Def.EIDOLON_ENEMY_CODES[0], defeated: false }]
  let second = null
  assert.equal(p3.actReveal(resignedState, { originalCode: '08546' }, apiOf({ finish: key => { second = key } })), true)
  assert.equal(second, 'resolution2')
})

// ---------------------------------------------------------------------------
// 08547 渗出梦魇（enemy）：击败时移除底下所有面朝下卡（真实引擎读点
// enemies.js#defeatEnemy → behavior.enemyDefeated）；其余印刷子句见 probe-defects.mjs。
// ---------------------------------------------------------------------------
test('08-a5 08547 渗出梦魇：被击败时底下所有正面朝下的卡移出游戏', () => {
  const state = stateFor(1)
  const nightmare = { id: 'sn-1', code: '08547', originalCode: '08547', location: 'crashSite',
    beneath: ['08515', '08522'], beneathFaceDown: [true, true], defeated: false }
  state.enemies = [nightmare]
  assert.equal(enemyRuleFor('08547').removeBeneathOnDefeat, true, '条目 enemyRule 读点')
  assert.equal(p3.enemyDefeated(state, nightmare, apiOf()), false, '保留正常弃置流程')
  assert.deepEqual(nightmare.beneath, [], '底下卡全部移除')
  assert.deepEqual(state.scenarioZones.removed, ['08515', '08522'], '移出游戏（不是弃置）')
})

// ---------------------------------------------------------------------------
// 08548 千变幻景（treachery）：唯一条目契约（spawnBeneathOrHunterAttack 与涌动 flag）。
// 该卡显现效果当前无执行读点，失败结论见 probe-defects.mjs 与报告 §3（F3）。
// ---------------------------------------------------------------------------
test('08-a5 08548 千变幻景：条目声明「翻出底下卡或移动攻击」与「无渗出梦魇则涌动」契约', () => {
  const entry = registeredEntry('08548')
  assert.equal(entry.treacheryRule.spawnBeneathOrHunterAttack, true)
  assert.equal(entry.flags.surgeIfNoSeepingNightmare, true)
  assert.equal(entry.flags.curse, true)
  assert.equal(ALL_CARDS['08548'].type, 'treachery')
})
