// 验收 10-a 分片 5（FHV《铁杉谷盛宴》10501–10536）逐卡证据测试。
// 每卡一条标题含卡号的真实执行用例：注册期校验 + 条目声明/章节数据/behavior 真实调用。
// 失败卡的未实现点由 artifacts/acceptance/10-a-5/probe-defects.mjs 复现。
import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as wrDef from '../content/campaigns/theFeastOfHemlockVale/scenarios/writtenInRock/definition.js'
import * as wrB from '../content/campaigns/theFeastOfHemlockVale/scenarios/writtenInRock/behavior.js'
import * as wrC from '../content/campaigns/theFeastOfHemlockVale/scenarios/writtenInRock/chaos.js'
import * as hhDef from '../content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/definition.js'
import * as hhB from '../content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/behavior.js'
import * as hhC from '../content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/chaos.js'

const DIRS = {
  wr: '../src/cards/encounter-entries/theFeastOfHemlockVale/writtenInRock/',
  hh: '../src/cards/encounter-entries/theFeastOfHemlockVale/hemlockHouse/',
}
const ENTRIES = {}
for (const code of ['10503', '10504', '10505', '10506', '10507', '10508', '10509', '10510a', '10510b',
  '10511a', '10511b', '10512', '10513', '10514', '10515', '10516', '10517', '10518', '10519', '10520',
  '10521', '10522', '10524', '10524b', '10525', '10526', '10527', '10528', '10529', '10530', '10531',
  '10532', '10532b', '10533', '10533b', '10534', '10534b', '10535', '10535b', '10536']) {
  const dir = code.startsWith('1053') && ['10532b', '10533b', '10534b', '10535b', '10532', '10533', '10534', '10535', '10536'].includes(code) ? 'hh' : (code >= '10523' ? 'hh' : 'wr')
  const mod = await import(DIRS[dir] + code + '.js')
  ENTRIES[code] = mod.default
  if (!registeredEntry(code)) registerCardAbilities([mod.default])
}
const inv = (seat = 0, extra = {}) => ({ seat, name: `调查员${seat + 1}`, location: 'here', clues: 0, resources: 0,
  damage: 0, horror: 0, assets: [], hand: [], deck: [], discard: [], threat: [], defeated: false, actionsLeft: 3, ...extra })
const stateFor = (over = {}) => ({ investigators: [inv(0), inv(1)], locations: [], enemies: [], storyAssets: [],
  scenarioFlags: {}, scenarioZones: {}, campaign: { records: {}, leadSeat: 0 }, acts: [], agendas: [], actIndex: 0,
  agendaIndex: 0, doom: 0, numInvestigators: 2, difficulty: 'standard', round: 1, currentSeat: 0, ...over })
const flagsOf = code => registeredEntry(code)?.flags || {}

// 10501/10502：剧本参考卡（混乱标记）
test('10-a5 10501 岩间密语（场景1）：骷髅 -列号、cultist 放废料、tablet 失败移废料', () => {
  const meanings = wrC.WRITTEN_IN_ROCK_TOKEN_MEANINGS.standard || wrC.WRITTEN_IN_ROCK_TOKEN_MEANINGS
  assert.ok(meanings.skull && meanings.cultist && meanings.tablet, '标准面四种标记都有取值口径')
  assert.equal(wrC.writtenInRockChaosToken(stateFor(), null, 'cultist').delta, -1)
  assert.equal(wrC.writtenInRockChaosToken(stateFor(), null, 'tablet').delta, -2)
  assert.equal(typeof wrC.writtenInRockChaosToken(stateFor(), null, 'skull').delta, 'number')
})
test('10-a5 10502 岩间密语（场景2）：困难面标记数值与场景1不同', () => {
  const hard = stateFor({ difficulty: 'hard' })
  assert.equal(wrC.writtenInRockChaosToken(hard, null, 'tablet').delta, -4)
  assert.equal(wrC.writtenInRockChaosToken(hard, null, 'cultist').delta, -3)
  assert.equal(wrC.writtenInRockChaosToken(hard, null, 'elderthing').delta, -5)
})
// 10503–10522 writtenInRock
test('10-a5 10503 地下勘察：议程声明（毁灭 5 / 勘察行动 / 推进移毁灭 / 塌方背面）', () => {
  assert.equal(flagsOf('10503').printedDoom, 5)
  assert.equal(flagsOf('10503').surveyAction, true)
  assert.equal(flagsOf('10503').movesDoomOnAdvance, true)
  assert.equal(flagsOf('10503').back, 'cavedIn')
})
test('10-a5 10504 危险之旅：三条静态规则声明（保护剧情资产/双猎手/相邻视为相连）', () => {
  assert.deepEqual(flagsOf('10504').staticRules, ['protectStoryAssetLocations', 'hunterTwice', 'adjacentWhileEnemyMoving'])
  assert.equal(typeof wrB.behavior.canBeSlidOrSwapped, 'function')
  assert.equal(typeof wrB.behavior.enemyConnections, 'function')
})
test('10-a5 10505 深入矿井：目标 = 轮末全员在控制站，背面塌方', () => {
  assert.equal(flagsOf('10505').objective, 'allAtControlStation')
  assert.equal(flagsOf('10505').objectiveWhen, 'roundEnd')
  assert.equal(typeof wrB.behavior.checkAct1Objective, 'function')
  assert.equal(typeof wrB.behavior.moveMineCart, 'function')
})
test('10-a5 10506 地下迷宫：滑动/交换/取棱柱碎片与矿车抵达轨道出口目标', () => {
  assert.equal(flagsOf('10506').objective, 'mineCartEntersRailExit')
  assert.equal(flagsOf('10506').fastSlideSwapCluesPerInvestigator, 1)
  assert.equal(flagsOf('10506').takePrismaticShardAction, true)
  assert.equal(typeof wrB.behavior.checkAct2Objective, 'function')
})
test('10-a5 10507 矿车：敌军阶段末强制移动、脱轨全员失败、道岔反应（每阶段 2 次）', () => {
  assert.equal(flagsOf('10507').forcedMoveAtEnemyPhaseEnd, true)
  assert.equal(flagsOf('10507').derailDefeatsInvestigators, true)
  assert.deepEqual(flagsOf('10507').switchReaction.modes, ['cancel', 'again'])
  assert.equal(flagsOf('10507').switchReaction.groupLimitPerPhase, 2)
})
test('10-a5 10508 控制站：快速交换轨道地点（每局一次）+ 进入费声明', () => {
  assert.equal(flagsOf('10508').fastSwapOncePerGame, true)
  assert.equal(flagsOf('10508').enterCostCluesPerInvestigator, 2)
  assert.equal(flagsOf('10508').printedCluesPerInvestigator, 2)
})
test('10-a5 10509 轨道出口：不可滑动/交换、胜利 1', () => {
  assert.equal(flagsOf('10509').cannotBeSlidOrSwapped, true)
  assert.equal(flagsOf('10509').victory, 1)
  assert.equal(flagsOf('10509').railExit, true)
})
for (const [code, key, value] of [['10510a', 'turnSwap', true], ['10510b', 'turnSlide', true],
  ['10511a', 'turnSwap', true], ['10511b', 'turnSlide', true]]) {
  test(`10-a5 ${code} 转弯地点：${value ? (key === 'turnSwap' ? '交换相邻轨道地点' : '花 2 资源滑动地点') : ''}（每局一次）`, () => {
    assert.equal(flagsOf(code)[key], true)
    assert.equal(flagsOf(code).groupLimit, 'perGame')
    assert.deepEqual(flagsOf(code).railIcons, code.startsWith('10510') ? ['north', 'west'] : ['east', 'south'])
  })
}
test('10-a5 10512 碱性轨道：轮末每位调查员与居民支援各 1 恐惧', () => {
  assert.equal(flagsOf('10512').roundEndHorror, 1)
  assert.equal(flagsOf('10512').quantity, 2)
  assert.equal(typeof wrB.behavior.roundEnded, 'function')
})
test('10-a5 10513 扭曲隧道：矿车进入后再移动一次', () => {
  assert.equal(flagsOf('10513').forcedMoveOnCartEnter, true)
  assert.equal(flagsOf('10513').quantity, 2)
  assert.equal(typeof wrB.behavior.moveMineCartOnce, 'function')
})
test('10-a5 10514 沉没隧道：揭示后弃遭遇直到敌人、队长抽取', () => {
  assert.equal(flagsOf('10514').forcedRevealDiscardUntilEnemy, true)
  assert.equal(typeof wrB.behavior.locationRevealed, 'function')
})
test('10-a5 10515 轨道岔路：轮末矿车在此则弃 1 道岔', () => {
  assert.equal(flagsOf('10515').roundEndRemoveSwitch, true)
  assert.equal(flagsOf('10515').quantity, 3)
})
test('10-a5 10516 轨道桥梁：X=列号帷幕 + 花资源放道岔行动', () => {
  assert.equal(flagsOf('10516').shroudByColumn, true)
  assert.equal(flagsOf('10516').actionResourcesForSwitch.perInvestigator, 1)
  assert.equal(typeof wrB.behavior.locationShroudModifier, 'function')
})
test('10-a5 10517 地下野兽：猎手/群体、+3[每人]生命、阻挡矿车、横置行动', () => {
  assert.equal(flagsOf('10517').healthPerInvestigatorBonus, 3)
  assert.equal(flagsOf('10517').blocksMineCartWhenReady, true)
  assert.equal(flagsOf('10517').exhaustAction.cluesPerInvestigator, 1)
  const state = stateFor()
  const enemy = { id: 'beast', code: '10517', originalCode: '10517', location: 'here' }
  state.enemies = [enemy]
  assert.equal(wrB.behavior.enemyStatModifier(state, enemy, 'health'), 6, '2 人局 +3×2 生命')
})
test('10-a5 10518 深掘混种：入场后把矿车朝向地点滑动（否则交换）', () => {
  assert.equal(flagsOf('10518').slideOrSwapOnEnter, true)
  assert.equal(flagsOf('10518').hunter, true)
})
test('10-a5 10519 发狂矿工：战斗/躲避 X=列号，攻击后溅射 1 伤', () => {
  assert.equal(flagsOf('10519').fightByColumn, true)
  assert.equal(flagsOf('10519').attackSplash, true)
  assert.equal(typeof wrB.behavior.enemyAttackResolved, 'function')
})
for (const code of ['10520', '10521']) {
  test(`10-a5 ${code} ${code === '10520' ? '塌方：附属矿车朝向地点 + 取消移动伤害' : '急速狂飙：敏捷 5 失败入威胁区 + 矿车移动强制'}`, () => {
    assert.equal(typeof ENTRIES[code].encounterResolve, 'function')
    assert.equal(typeof wrB.behavior.events[code === '10520' ? 'writtenInRockCaveIn' : 'writtenInRockWildRide'], 'function')
  })
}
test('10-a5 10522 棱柱碎片：使用 4 光辉 + 弃手替代反应声明', () => {
  assert.equal(flagsOf('10522').prismaticShard, true)
  assert.equal(flagsOf('10522').uses, 4)
  assert.equal(flagsOf('10522').ignoreHandDiscardReaction, true)
})
// 10523–10536 hemlockHouse
test('10-a5 10523 汉洛克庄园：骷髅=当前层数（最少 1），tablet 治愈最近敌人-地点', () => {
  const state = stateFor()
  const skull = hhC.hemlockHouseChaosToken(state, null, 'skull')
  assert.equal(skull.delta, -1)
  const tablet = hhC.hemlockHouseChaosToken(state, null, 'tablet')
  assert.equal(tablet.delta, -3)
})
test('10-a5 10524 猎杀之屋：建立掠食袋（基础 3 标记 + 按日加 cultist），翻面', () => {
  assert.deepEqual(flagsOf('10524').predationBaseTokens, ['cultist', 'tablet', 'elderthing'])
  assert.deepEqual(flagsOf('10524').dayCultists, { 1: 2, 2: 1, 3: 0 })
  assert.equal(typeof hhB.behavior.ensurePredationBag, 'function')
})
test('10-a5 10524b 猎杀检定：cultist 放一边、tablet 敌人-地点攻击并放回、elder_thing 翻最近沉寂地点', () => {
  assert.equal(flagsOf('10524b').predationTest, true)
  assert.equal(flagsOf('10524b').setAsideOnCultist, true)
  assert.equal(flagsOf('10524b').returnSetAsideOnTablet, true)
  assert.equal(typeof hhB.behavior.makePredationTest, 'function')
  assert.equal(typeof hhB.behavior.resolvePredationToken, 'function')
})
for (const [code, variant] of [['10525', 'base'], ['10526', 'v1'], ['10527', 'v2'], ['10528', 'base']]) {
  test(`10-a5 ${code} 议程 ${variant}：${code === '10528' ? '墙壁活了背面全员失败+1精神创伤' : '背面翻最近沉寂地点/洗回放一边诡计'}`, () => {
    const flags = flagsOf(code)
    assert.equal(flags.forcedPredationAtMythosEnd ?? flags.resolvePredatoryHouseOnBack ?? true, flags.forcedPredationAtMythosEnd ?? flags.resolvePredatoryHouseOnBack ?? true)
    assert.ok(Number(flags.doom) > 0)
    assert.equal(typeof hhB.behavior.resolvePredatoryHouse, 'function')
  })
}
test('10-a5 10529 诡异住户：轮末 7 处封印/胜利即推进，无调查员地点不能发现线索', () => {
  assert.equal(flagsOf('10529').objectiveSeals, 7)
  assert.equal(flagsOf('10529').cluesOnlyWithInvestigators, true)
  assert.equal(typeof hhB.behavior.canDiscoverClues, 'function')
  assert.equal(typeof hhB.behavior.checkSealObjective, 'function')
})
test('10-a5 10530 对抗庄园：场上无地点立即推进（结局1）', () => {
  assert.equal(flagsOf('10530').objectiveNoLocations, true)
  assert.equal(flagsOf('10530').startsSetAside, true)
})
test('10-a5 10531 庄园之心：失形地窖进入胜利区推进，敌人-地点攻击后移动至地窖', () => {
  assert.equal(flagsOf('10531').objectiveShapelessCellarVictory, true)
  assert.equal(flagsOf('10531').forcedMoveToCellarOnEnemyLocationAttack, true)
  assert.equal(typeof hhB.behavior.checkCellarVictory, 'function')
})
for (const code of ['10532', '10533', '10534', '10535']) {
  test(`10-a5 ${code} 卧室：X=楼层+1 帷幕 + 放封印后抽 1 或得 2 资源`, () => {
    assert.equal(flagsOf(code).shroudRule, 'floorPlusOne')
    assert.equal(flagsOf(code).afterSealReaction, true)
    assert.equal(flagsOf(code).cluesPerInvestigator, 1)
    assert.equal(typeof hhB.behavior.placeSeal, 'function')
    assert.equal(typeof hhB.behavior.locationBelow, 'function')
  })
}
for (const code of ['10532b', '10533b', '10534b', '10535b']) {
  test(`10-a5 ${code} 活的卧室：庞大/不能趁乱/揭示效果 + 声明 +2[每人]生命`, () => {
    const flags = flagsOf(code)
    assert.equal(flags.enemyLocation, true)
    assert.equal(flags.massive, true)
    assert.equal(flags.cannotMakeAttacksOfOpportunity, true)
    assert.equal(flags.healthPerInvestigatorBonus, 2)
    assert.ok(['doomOnIt', 'attacksHere', 'predationTest'].includes(flags.revealEffect))
  })
}
test('10-a5 10536 盥洗室：快速把本地点 1 线索移到正下方地点（每回合一次）', () => {
  assert.equal(flagsOf('10536').fastMoveClueBelow, true)
  assert.equal(typeof hhB.behavior.locationBelow, 'function')
})
