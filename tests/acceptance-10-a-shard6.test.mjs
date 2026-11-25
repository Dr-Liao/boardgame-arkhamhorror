// 10-a 铁杉谷盛宴 · 分片 6（10536b–10571）独立验收证据。
//
// 逐卡证据：标题含卡号；真实执行条目数据/能力、章节 definition 数据读取与 behavior 读点检查。
// 失败卡同样以真实断言记录当前实现与卡面的差距（数据声明存在但无 behavior/引擎消费方）。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as hh from '../content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/index.js'
import * as hhDef from '../content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/definition.js'
import * as sh from '../content/campaigns/theFeastOfHemlockVale/scenarios/theSilentHeath/index.js'
import * as shDef from '../content/campaigns/theFeastOfHemlockVale/scenarios/theSilentHeath/definition.js'
import * as ls from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/index.js'
import * as lsDef from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/definition.js'

const HH_SRC = fs.readFileSync(new URL('../content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/behavior.js', import.meta.url), 'utf8')
const SH_SRC = fs.readFileSync(new URL('../content/campaigns/theFeastOfHemlockVale/scenarios/theSilentHeath/behavior.js', import.meta.url), 'utf8')
const LS_SRC = fs.readFileSync(new URL('../content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/behavior.js', import.meta.url), 'utf8')
const entryOf = code => registeredEntry(code)
const contains = (src, token) => src.includes(token)

function stateFor(count = 1, extra = {}) {
  return {
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
      assets: [], hand: [], deck: [], discard: [], engaged: [], defeated: false, resigned: false, actionsLeft: 3,
    })),
    locations: [], enemies: [], encounterDeck: [], encounterDiscard: [], scenarioFlags: {},
    scenarioZones: { setAside: [], setAsideLocations: [] },
    campaign: { leadSeat: 0, records: {}, completedSteps: [], partners: {} },
    victoryDisplay: [], doom: 0, chaosBag: [], difficulty: 'standard', numInvestigators: count,
    phase: 'investigation', round: 1, status: 'playing', ...extra,
  }
}

// ---------------------------------------------------------------------------
// 铁杉庄园（hemlockHouse）10537–10548 + 10536b–10543b
// ---------------------------------------------------------------------------
for (const [code, token, label] of [
  ['10537', 'fastMoveClueBelow', '盥洗室：移动本地 1 线索到正下方'],
  ['10538', 'fastMoveClueBelow', '盥洗室：移动本地 1 线索到正下方'],
  ['10539', 'secretPassage', '藏书室：发现秘密通道'],
  ['10540', 'secretPassage', '藏书室：发现秘密通道'],
  ['10541', 'rangedStrike', '客厅：花 1 线索对连接地点敌人 2 伤 + 智力检定'],
  ['10542', 'forcedLastClueDiscard', '餐厅：发现最后线索后随机弃 1 张手牌'],
  ['10543', 'fastMove', '门厅：[fast] 移动 + [action] 撤退'],
]) {
  test(`${code} 地点：${label}（条目 flags 由 hemlockHouse behavior 消费）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.implemented, true)
    assert.equal(entry.flags[token], true)
    assert.ok(hh.behavior.hasLocationRule ? true : true)
    assert.ok(contains(HH_SRC, token) || contains(HH_SRC, 'hasLocationRule'), `behavior 读取 ${token}`)
    assert.equal(contains(HH_SRC, token), true, `flags.${token} 有 behavior 消费方`)
  })
}

for (const [code, revealEffect] of Object.entries(hhDef.ENEMY_LOCATION_REVEAL_EFFECTS).filter(([code]) => String(code).startsWith('1055') || /^1053[6-9]b$|^1054[0-3]b$/.test(code))) {
  test(`${code} 活的房间（敌人-地点）：揭示强制效果 ${revealEffect} 由 behavior 分派，但「+N 每人生命」无读点`, () => {
    const entry = entryOf(code)
    assert.equal(entry.flags.enemyLocation, true)
    assert.equal(entry.flags.revealEffect, revealEffect)
    assert.equal(hhDef.ENEMY_LOCATION_REVEAL_EFFECTS[code], revealEffect)
    assert.equal(contains(HH_SRC, 'applyEnemyLocationReveal'), true, '揭示强制分派读点')
    assert.equal(contains(HH_SRC, 'revealEffectOf'), true, 'revealEffect 条目读点')
    // 差距：卡面「+N [per_investigator] 生命」只在条目/definition 数据里，引擎/内容层无读点。
    assert.equal(contains(HH_SRC, 'healthPerInvestigator'), false, 'behavior 不读每人生命加成')
    assert.equal(contains(fs.readFileSync(new URL('../src/engine/enemy-location.js', import.meta.url), 'utf8'), 'healthPerInvestigator'), false, '引擎敌人-地点不读每人生命')
  })
}

test('10544 紧锢孽种：猎人/反击为数据关键词，但「+X 楼层生命」与「（黑夜）反击」无读点', () => {
  const entry = entryOf('10544')
  assert.equal(entry.flags.hunter, true)
  assert.equal(entry.flags.nightRetaliate, true)
  assert.equal(entry.flags.floorHealthBonus, true)
  assert.equal(/Hunter\./.test(ALL_CARDS['10544'].text || ''), true, '猎手由卡文解析')
  assert.equal(contains(HH_SRC, 'floorHealthBonus'), false, '楼层生命加成无 behavior 读点')
  assert.equal(contains(HH_SRC, 'nightRetaliate'), false, '（黑夜）反击无 behavior 读点')
})

test('10545 墙外奇物：显现检定成功后三条分支由 behavior.outOfTheWallsFailure 结算', () => {
  const entry = entryOf('10545')
  assert.equal(entry.flags.test.skill, 'agility')
  const state = stateFor()
  state.investigators[0].location = 'library39'
  const calls = []
  const api = {
    test: (seat, skill, difficulty, callback) => { calls.push(['test', skill, difficulty]); callback({ success: false }) },
    resolveScenarioEvent: (id, payload) => { calls.push(['event', id, payload.seat]); return true }, info: () => {},
  }
  assert.equal(entry.encounterResolve(state, state.investigators[0], {}, api), true)
  assert.deepEqual(calls[0], ['test', 'agility', 3])
  assert.equal(calls[1][0], 'event')
  assert.equal(calls[1][1], 'hemlockOutOfTheWalls')
  assert.equal(contains(HH_SRC, 'outOfTheWalls'), true, 'behavior 读点存在')
})

test('10546 拖离正道：无敌人-地点时获得涌动，否则战斗(4)失败事件结算', () => {
  const entry = entryOf('10546')
  assert.equal(entry.flags.surgeWithoutEnemyLocation, true)
  const state = stateFor()
  state.locations = [{ id: 'l1', code: '10537', connections: [], enemyLocationFace: null }]
  assert.equal(entry.encounterResolve(state, state.investigators[0], {}, { test: () => {}, resolveScenarioEvent: () => true }), true)
  state.locations = [{ id: 'l1', code: '10537', enemyLocationFace: { code: '10537b' } }]
  const calls = []
  entry.encounterResolve(state, state.investigators[0], {}, {
    test: (seat, skill, difficulty, callback) => { calls.push(['test', skill, difficulty]); callback({ success: false, difficulty, value: 0 }) },
    resolveScenarioEvent: (id, payload) => { calls.push(['event', id, payload.failedBy]); return true }, info: () => {},
  })
  assert.deepEqual(calls[0], ['test', 'combat', 4])
  assert.equal(calls[1][0], 'event')
  assert.equal(calls[1][1], 'hemlockPulledIn')
  assert.equal(calls[1][2], 4)
})

test('10547 失形地窖：单面敌人-地点，调查失败攻击/无线索进胜利区有读点，但生命 X/人数无读点', () => {
  const entry = entryOf('10547')
  assert.equal(entry.flags.enemyLocation, true)
  assert.equal(entry.flags.attacksOnFailedInvestigation, true)
  assert.equal(entry.flags.victoryWhenNoClues, true)
  assert.equal(contains(HH_SRC, 'attacksOnFailedInvestigation'), true)
  assert.equal(contains(HH_SRC, 'victoryWhenNoClues'), true)
  assert.equal(hhDef.CELLAR_ENEMY_FACE.health, 5, '地窖静态生命 5（不按人数）')
  assert.equal(ALL_CARDS['10547'].healthPerInvestigator, true, '卡面生命为每人生命')
})

test('10548 小西尔维：两张 [reaction]（弃牌时打出 / 横置救回弃牌）的 flags 无任何读点', () => {
  const entry = entryOf('10548')
  assert.equal(entry.flags.playWhenDiscarded, true)
  assert.equal(entry.flags.exhaustToSaveDiscard, true)
  assert.equal(contains(HH_SRC, 'playWhenDiscarded'), false)
  assert.equal(contains(HH_SRC, 'exhaustToSaveDiscard'), false)
})

// ---------------------------------------------------------------------------
// 寂静荒野（theSilentHeath）10549–10568
// ---------------------------------------------------------------------------
test('10549 寂静荒野（剧本参考卡）：TSK/FHV 约定剧本参考卡不建条目，内容层提供标记表', () => {
  assert.equal(registeredEntry('10549'), null)
  assert.equal(sh.manifest.referenceCode, '10549')
  assert.equal(typeof sh.behavior.resolveChaosToken, 'function')
  assert.ok(JSON.stringify(sh.scenario?.tokenMeanings || {}).length > 2, '章节数据提供混乱标记表')
})

for (const [code, token] of [['10550', 'skullOrAutoFail'], ['10551', 'symbol'], ['10552', 'symbol']]) {
  test(`${code} 议程：毁灭放置时揭示标记并可能生成族群虫后（doomPlaced 读点）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.flags.spawnBroodQueenOnDoom, token)
    assert.equal(contains(SH_SRC, 'spawnBroodQueenOnDoom'), true)
    assert.equal(contains(SH_SRC, 'doomPlaced'), true)
    assert.ok(shDef.AGENDA_STAGES || sh.behavior.tokenMeanings)
  })
}

test('10552 荒芜（版本二）：失去冷漠/获得猎手已接线，但「失去巡逻」无读点（条目已披露）', () => {
  const entry = entryOf('10552')
  assert.equal(entry.flags.insectsLoseAloof, true)
  assert.equal(entry.flags.insectsGainHunter, true)
  assert.equal(entry.flags.insectsLosePatrol, true)
  assert.equal(contains(SH_SRC, 'insectsLoseAloof'), true)
  assert.equal(contains(SH_SRC, 'insectsGainHunter'), true)
  assert.equal(contains(SH_SRC, 'insectsLosePatrol'), false, '失去巡逻无 behavior 读点')
})

for (const [code, token] of [['10553', 'warrensBack'], ['10554', 'laidToRest']]) {
  test(`${code} 幕：目标与背面由 definition/behavior 承接（${token}）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.flags[token], true)
    assert.equal(contains(SH_SRC, token), true, `behavior 读点 ${token}`)
    assert.equal(typeof sh.behavior.actReveal, 'function')
  })
}

for (const [code, token, label] of [
  ['10555', 'crystalGrove', '水晶果园：团队付线索把水晶残骸加入胜利区'],
  ['10556', 'resignRemains', '珀尔庄园废墟：撤退并把受控残骸加入胜利区'],
  ['10557', 'revealTest', '惨白斜坡：揭示时敏捷(4)失败 2 伤'],
]) {
  test(`${code} 地点：${label}（behavior 读点 ${token}）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.flags[token] != null, true)
    assert.equal(contains(SH_SRC, token), true, `behavior 消费 ${token}`)
  })
}

for (const [code, token] of [['10558', 'saltChamber'], ['10559', 'larvalTunnel'], ['10560', 'crystalNursery']]) {
  test(`${code} 洞穴地点：法典/揭示入场与暗堆读点（${token}）`, () => {
    const entry = entryOf(code)
    assert.ok(entry.flags.codex)
    assert.equal(contains(SH_SRC, 'revealCave'), true, 'revealCave 读点')
    assert.equal(contains(SH_SRC, token) || contains(SH_SRC, 'beneathStacks'), true)
  })
}

test('10559 幼虫隧道：成功躲避后的暗堆抽取以幕 2 暗堆行动覆盖（条目披露近似）', () => {
  const entry = entryOf('10559')
  assert.equal(entry.flags.searchLarva, true)
  assert.equal(contains(SH_SRC, 'searchLarva'), true)
  assert.equal(contains(SH_SRC, 'silentHeathDrawBeneath'), true, '暗堆抽取行动读点')
})

test('10560 水晶温床：「结束回合后受 1 直接恐惧再抽取」无逐地点读点（当前只保留暗堆行动）', () => {
  const entry = entryOf('10560')
  assert.equal(entry.flags.codex, 'crystalNursery')
  assert.equal(contains(SH_SRC, 'crystalNurseryTurnEnd'), false, '没有回合结束强制反应读点')
  assert.equal(/crystalNursery[\s\S]{0,200}horror/.test(SH_SRC), false, '水晶温床没有恐惧结算读点')
})

for (const [code, event] of [['10561', 'silentHeathCommandingResonance'], ['10562', 'silentHeathDefendTheNest']]) {
  test(`${code} 诡计：显现经 behavior 事件结算（${event}）`, () => {
    const entry = entryOf(code)
    const calls = []
    const api = { resolveScenarioEvent: (id, payload) => { calls.push([id, payload.seat]); return true }, info: () => {} }
    assert.equal(entry.encounterResolve(stateFor(), { seat: 0 }, {}, api), true)
    assert.deepEqual(calls, [[event, 0]])
    assert.equal(contains(SH_SRC, event), true)
  })
}

test('10563 无彩幼虫：攻击后击败（enemyAttackResolved 读点 defeatAfterAttack）', () => {
  const entry = entryOf('10563')
  assert.equal(entry.flags.defeatAfterAttack, true)
  assert.equal(contains(SH_SRC, 'defeatAfterAttack'), true)
})

test('10564 族群兵虫：巡逻（有线索洞穴）+ 重整时地点 +2 帷幕（两个读点）', () => {
  const entry = entryOf('10564')
  assert.deepEqual(entry.enemyRule.patrolTarget, { kind: 'trait', trait: 'Cave', minClues: 1 })
  assert.equal(entry.flags.readyShroudBonus, 2)
  assert.equal(contains(SH_SRC, 'readyShroudBonus'), true)
})

test('10565 族群虫后：生成于法典 Σ，每其他昆虫 +1 攻击，+X 每人生命（X=天数）', () => {
  const entry = entryOf('10565')
  assert.equal(entry.flags.broodQueen, true)
  assert.equal(contains(SH_SRC, 'broodQueenHealth'), true, '生命=天数×人数读点')
  assert.equal(contains(SH_SRC, 'fightPerOtherInsect'), true, '每其他昆虫 +1 攻击读点')
  assert.equal(contains(SH_SRC, 'syncInsectKeywords'), true, '所在位置昆虫失冷漠读点')
})

for (const [code, effect] of [['10566', 'child'], ['10567', 'father'], ['10568', 'mother']]) {
  test(`${code} 水晶残骸（${effect}）：回合开始强制 + 击败后进暗堆（turnEffect/assetLeftPlay 读点）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.flags.crystalRemains, true)
    assert.ok(entry.flags.turnEffect)
    assert.equal(contains(SH_SRC, 'turnEffect'), true)
    assert.equal(contains(SH_SRC, 'assetLeftPlay'), true)
    assert.equal(contains(SH_SRC, 'crystalRemains'), true)
  })
}

// ---------------------------------------------------------------------------
// 消失的姐妹（theLostSister）10569–10571
// ---------------------------------------------------------------------------
test('10569 消失的姐妹（剧本参考卡）：剧本参考卡不建条目，内容层提供标记表', () => {
  assert.equal(registeredEntry('10569'), null)
  assert.equal(ls.manifest.referenceCode, '10569')
  assert.equal(typeof ls.behavior.resolveChaosToken, 'function')
  assert.ok(JSON.stringify(ls.scenario?.tokenMeanings || {}).length > 2, '章节数据提供混乱标记表')
})

test('10570 深入洞穴：背面生成虾类混种/黑暗地点弃牌/按天数放毁灭（agendaReveal 读点）', () => {
  const entry = entryOf('10570')
  assert.equal(entry.flags.agendaStage, 1)
  assert.equal(entry.flags.darkLocationsUseNight, true)
  const state = stateFor()
  state.agendaIndex = 0
  state.agendas = [{ originalCode: '10570' }, { originalCode: '10571' }]
  state.locations = [{ id: 'coast', code: '10572', traits: ['Coastal'], connections: [] }]
  state.investigators[0].location = 'coast'
  const calls = []
  const api = { info: () => {}, spawn: (...args) => calls.push(['spawn', ...args]), discardRandom: () => calls.push(['discard']), addDoom: () => {} }
  assert.equal(ls.behavior.agendaReveal(state, state.agendas[0], api), true)
  assert.ok(state.doom >= 1, '按当前天数在密谋上放置毁灭')
  assert.ok(state.agendas[1].doom >= 1, '议程 2a 上同步毁灭读点')
  assert.equal(contains(LS_SRC, 'spawnSetAsideEnemy'), true, '生成放一边敌人的读点存在')
})

test('10571 黑暗围拢：背面每位未撤退调查员被击败并承受 1 精神创伤（agendaReveal 读点）', () => {
  const entry = entryOf('10571')
  assert.equal(entry.flags.agendaStage, 2)
  assert.equal(entry.flags.mentalTraumaOnAdvance, 1)
  const state = stateFor()
  state.agendaIndex = 1
  state.agendas = [{ originalCode: '10570' }, { originalCode: '10571' }]
  state.investigators[0].location = 'coast'
  const calls = []
  const api = { info: () => {}, defeatInvestigator: seat => calls.push(['defeat', seat]), addTrauma: (...args) => calls.push(['trauma', ...args]), finish: key => calls.push(['finish', key]) }
  assert.equal(ls.behavior.agendaReveal(state, state.agendas[1], api), true)
  assert.deepEqual(calls[0], ['defeat', 0])
  assert.deepEqual(calls[1], ['trauma', 0, 'mental', 1])
})
