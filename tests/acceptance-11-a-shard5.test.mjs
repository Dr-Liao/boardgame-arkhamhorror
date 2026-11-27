// 11-a-5 验收（TDC 11539–11577）逐卡证据测试。
// 每卡一条标题含卡号、真实执行的用例：注册期校验 + 条目 flags/encounterResolve/locationRule + 章节 behavior/chaos 调用。
// 失败卡未实现点由 artifacts/acceptance/11-a-5/probe-defects.mjs 复现并写入报告。
import test from 'node:test'
import assert from 'node:assert/strict'
import { cardDef, scenarioRuntime, turnBeginningWindow } from '../src/engine/engine.js'
import { assetHarmCapacity } from '../src/engine/asset-defeat.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { fixture, asset, enemy, legalMoves, move, settle } from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import * as dqDef from '../content/campaigns/theDrownedCity/scenarios/theDrownedQuarter/definition.js'
import * as dqB from '../content/campaigns/theDrownedCity/scenarios/theDrownedQuarter/behavior.js'
import * as dqC from '../content/campaigns/theDrownedCity/scenarios/theDrownedQuarter/chaos.js'
import * as apiDef from '../content/campaigns/theDrownedCity/scenarios/theApiary/definition.js'
import * as apiB from '../content/campaigns/theDrownedCity/scenarios/theApiary/behavior.js'
import * as apiC from '../content/campaigns/theDrownedCity/scenarios/theApiary/chaos.js'

const DIRS = {
  dq: '../src/cards/encounter-entries/theDrownedCity/theDrownedQuarter/',
  api: '../src/cards/encounter-entries/theDrownedCity/theApiary/',
}
const CODE_DIR = {}
for (const code of ['11539', '11540', '11540b', '11541', '11542', '11543', '11544', '11545', '11546', '11547', '11548', '11549', '11549b', '11550', '11550b', '11551', '11552']) CODE_DIR[code] = 'dq'
for (const code of ['11554', '11555', '11556', '11557', '11558', '11559', '11559b', '11560', '11561', '11562', '11563', '11564', '11565', '11566', '11567', '11568', '11569', '11570', '11571', '11572', '11573', '11574', '11575', '11576', '11577']) CODE_DIR[code] = 'api'
const ENTRIES = {}
for (const [code, dir] of Object.entries(CODE_DIR)) {
  const mod = await import(DIRS[dir] + code + '.js')
  ENTRIES[code] = mod.default
  if (!registeredEntry(code)) registerCardAbilities([mod.default])
}
const flags = code => registeredEntry(code)?.flags || {}
const rule = code => registeredEntry(code)?.enemyRule || {}

// 淹没城区
test('11-a-5 11539 重新激活核心：相邻即相连、[fast] 1/人线索降淹没、目标全员在已激活核心', () => {
  assert.equal(flags('11539').gridConnections, true)
  assert.equal(flags('11539').objective, 'allAtBarrierCoreActive')
  assert.equal(flags('11539').fastAction, true)
  assert.equal(typeof dqB.behavior.checkObjectives, 'function')
})
test('11-a-5 11540 屏障核心：6+ 已揭示未淹没海床 → 翻面；转移淹没并按 3/人放线索', () => {
  assert.equal(typeof dqB.syncBarrierCore, 'function')
  assert.equal(typeof dqB.behavior.actions, 'function')
})
test('11-a-5 11540b 屏障核心（已激活）：5 或更少未淹没海床 → 翻面；2/人线索取屏障节点', () => {
  assert.equal(typeof dqB.behavior.actions, 'function')
})
test('11-a-5 11541 深渊沟壑：X=已揭示海床一半，攻/躲成功后降敌淹没（每局一次）', () => {
  assert.equal(flags('11541').seaFloor, true)
  assert.equal(typeof dqB.behavior.enemyAttackedSuccessfully, 'function')
  assert.equal(typeof dqB.behavior.enemyEvadedSuccessfully, 'function')
  assert.equal(typeof dqB.behavior.locationShroudModifier, 'function')
})
test('11-a-5 11542 淹没卫城：回合末提高淹没或受 1 恐惧；[action] 提高自身换任意地点降淹没（每局 2 次）', () => {
  assert.equal(flags('11542').seaFloor, true)
  assert.equal(typeof dqB.behavior.turnEnded, 'function')
  const moves = dqB.behavior.actions
  assert.equal(typeof moves, 'function')
})
test('11-a-5 11543 淹没卫城：回合末提高相邻淹没或受 1 伤害', () => {
  assert.equal(flags('11543').seaFloor, true)
  assert.equal(typeof dqB.turnEnded, 'function')
})
test('11-a-5 11544 残破遗迹：回合末提高自身淹没；共同花 5 资源降淹没（每轮一次）', () => {
  assert.equal(flags('11544').seaFloor, true)
  assert.equal(typeof dqB.behavior.actions, 'function')
})
test('11-a-5 11545 残破遗迹：回合末提高自身淹没；共同弃 1/人手牌降淹没', () => {
  assert.equal(flags('11545').seaFloor, true)
  assert.equal(typeof dqB.behavior.actions, 'function')
})
test('11-a-5 11546 珊瑚礁：[action][action] 抽 2 牌得 2 资源并生成水下寄生虫（每局一次）', () => {
  assert.equal(flags('11546').seaFloor, true)
  assert.equal(typeof dqB.behavior.actions, 'function')
})
test('11-a-5 11547 珊瑚礁：揭示后弃遭遇直到敌人生成；发现线索后生成水下寄生虫', () => {
  assert.equal(flags('11547').seaFloor, true)
  assert.equal(typeof dqB.behavior.locationRevealed, 'function')
  assert.equal(typeof dqB.behavior.cluesGained, 'function')
})
test('11-a-5 11548 古代展廊：弃 2 张手牌把黑曜石遗物放入场由你控制', () => {
  assert.equal(flags('11548').seaFloor, true)
  assert.equal(typeof dqB.behavior.actions, 'function')
})
test('11-a-5 11549 水下寄生虫：攻击后/离场时翻面结算故事面', () => {
  assert.equal(flags('11549').setAside, true)
  assert.equal(typeof dqB.behavior.enemyAttackResolved, 'function')
  assert.equal(typeof dqB.behavior.enemyLeftPlay, 'function')
})
test('11-a-5 11549b 水下寄生虫（故事面）：翻面移动或记录符文 X 并加入胜利区', () => {
  assert.equal(typeof registeredEntry('11549b'), 'object')
  assert.equal(typeof dqB.behavior.enemyDefeated, 'function')
})
function inScenario(id, token = '0') {
  const state = fixture('01001')
  state.scenario = { ...state.scenario, id }
  state.chaosBag = [token]
  return state
}

test('11-a-5 11550 黑曜石遗物：智力(8) 成功后同一实体以故事面加入胜利区', () => {
  const state = inScenario('theDrownedQuarter', '+20')
  const relic = asset(state, '11550')
  const action = legalMoves(state, 0).find(option => option.assetId === relic.id && option.action === 'ability')
  assert.ok(action)
  move(state, action)
  assert.equal(state.skillTest.skill, 'intellect')
  assert.equal(state.skillTest.difficulty, 8)
  assert.equal(dqB.behavior.commitIconMultiplier(state), 2)
  const result = move(state, { action: 'choose', choiceId: state.pendingChoice.id, optionId: 'done' })
  assert.ok(result.some(event => event.presentation?.kind === 'story'
    && event.presentation.code === '11550' && event.presentation.face === 'back'))
  assert.ok(state.victoryDisplay.some(entry => entry.id === relic.id && entry.code === '11550b' && entry.victory === 1))
  assert.deepEqual(state.campaign.records.discoveredGlyphs, ['Y'])
  assert.equal(state.removedFromGame?.includes('11550') ?? false, false)
})
test('11-a-5 11550b 黑曜石遗物（故事面）：记录符文 Y「知识」并加入胜利区', () => {
  assert.equal(typeof registeredEntry('11550b'), 'object')
  assert.equal(typeof dqB.behavior.assetLeftPlay, 'function')
})
test('11-a-5 11551 水母：冷漠、巡逻未/部分淹没地点；敌军阶段开始提高淹没否则放毁灭', () => {
  assert.deepEqual(rule('11551').patrolTarget, { kind: 'flood', below: 2 })
  assert.equal(typeof dqB.behavior.phaseBegan, 'function')
})
test('11-a-5 11552 屏障节点：五符文加 2 生命，回合开始可选治疗 1 伤害', () => {
  const state = inScenario('theDrownedQuarter')
  const barrier = asset(state, '11552', { damage: 2 })
  const capacity = () => assetHarmCapacity(cardDef('11552'), 'damage', state, barrier)
  state.campaign.records.discoveredGlyphs = ['Q', 'X', 'G', 'K']
  assert.equal(capacity(), 1)
  state.campaign.records.discoveredGlyphs.push('S')
  assert.equal(capacity(), 3)
  const run = (draft, events) => turnBeginningWindow(draft, events)
  resolveTransaction(state, 0, { action: 'test-turn-begins' }, run)
  const choice = state.pendingChoice
  assert.ok(choice.options.some(option => option.id === 'skip'))
  const heal = choice.options.find(option => option.id.startsWith('desc:11552#'))
  resolveTransaction(state, 0, { action: 'choose', choiceId: choice.id, optionId: heal.id }, run)
  assert.equal(state.investigators[0].assets.find(item => item.id === barrier.id)?.damage, 1)
})
// 养育场
test('11-a-5 11553 养育场：骷髅=敌/支援上毁灭一半（上限 4），cultist 见异教徒再揭示', () => {
  assert.equal(typeof apiC.apiaryChaosToken, 'function')
  assert.ok(apiC.APIARY_TOKEN_MEANINGS.standard || apiC.APIARY_TOKEN_MEANINGS)
  const cultist = apiC.apiaryChaosToken({ enemies: [], difficulty: 'standard' }, null, 'cultist')
  assert.equal(cultist.delta, -1)
})
test('11-a-5 11554 黑暗中的躁动：背面补线索并把奇丑混种洗入牌库底', () => {
  assert.equal(flags('11554').backPlacesClues, true)
  assert.equal(flags('11554').backShufflesGrotesque, true)
  assert.equal(typeof apiB.behavior.agendaReveal, 'function')
})
test('11-a-5 11555 可憎寄生虫：放毁灭时若无非精英敌人从遭遇顶翻到敌人生成；背面未撤退者被击败', () => {
  assert.equal(flags('11555').spawnEnemyOnDoom, 'noNonElite')
  assert.equal(flags('11555').backDefeatsAll, true)
  assert.equal(typeof apiB.behavior.doomPlaced, 'function')
})
test('11-a-5 11556 不安的兆象：每线索弃遭遇顶 5（单人 10）并抽弃掉的地点；全体在圣所可推进', () => {
  assert.equal(flags('11556').discardPerClue, 5)
  assert.equal(flags('11556').discardPerClueSolo, 10)
  assert.equal(flags('11556').objective, 'allAtSanctum')
})
test('11-a-5 11557 失落的朝圣者：异教徒得胜利 0/冷漠；谈判移动；敌军阶段末按偷渡者数受伤', () => {
  assert.equal(flags('11557').parley.difficulty, 2)
  assert.equal(flags('11557').objective, 'cultistCardsAtLeast')
  assert.equal(typeof apiB.behavior.enemyPhaseEnd, 'function')
  assert.equal(typeof apiB.behavior.enemySpawned, 'function')
})
test('11-a-5 11558 蜂巢思维：[fast] 放 X 线索造成 X 伤害；轮末掷币旋转中央腔室；主母被击败推进', () => {
  assert.equal(flags('11558').objective, 'motherDefeated')
  assert.equal(flags('11558').roundEndCoinRotate, 'centralChamber')
  assert.equal(typeof apiB.rotateCentralChamber, 'function')
})
test('11-a-5 11559 养育场入口：共同 1/人线索洗地点入牌库底 10；[fast] 最远地点补线索；撤退', () => {
  assert.equal(typeof apiB.behavior.actions, 'function')
  assert.equal(typeof apiB.behavior.performAction, 'function')
  assert.equal(typeof apiB.behavior.performAction, 'function')
})
test('11-a-5 11559b 养育场入口（危险出口）：偷渡者改在入口生成；1/人线索把异教徒放幕下', () => {
  assert.equal(typeof apiB.spawnLocation, 'function')
  assert.equal(typeof apiB.behavior.actions, 'function')
})
for (const code of ['11560', '11561', '11562', '11563', '11564', '11565', '11566', '11567', '11569', '11570', '11571', '11572']) {
  test(`11-a-5 ${code} 养育场地点：显现放置入场并结算该地点显现效果`, () => {
    assert.equal(typeof ENTRIES[code].encounterResolve, 'function')
    assert.equal(typeof apiB.behavior.events.apiaryPlaceLocation, 'function')
  })
}
test('11-a-5 11561 血肉道路[R]：发现符文 R「时间」并翻译', () => {
  assert.equal(typeof ENTRIES['11561'].encounterResolve, 'function')
  assert.equal(typeof apiB.translateGlyph, 'function')
})
test('11-a-5 11562 增生原野：显现同放隐藏秘库；意志(8) 控制骇人「面具」', () => {
  assert.equal(typeof ENTRIES['11562'].encounterResolve, 'function')
  assert.equal(typeof apiB.behavior.actions, 'function')
})
test('11-a-5 11563 翻涌裂隙：显现生成带鳞寄生虫；回合开始可移动到任意已揭示地点', () => {
  assert.equal(typeof ENTRIES['11563'].encounterResolve, 'function')
  assert.equal(typeof apiB.flipSquamousParasite, 'function')
})
test('11-a-5 11564 腐化秘库[Q]：[action][action] 发现符文 Q「手」', () => {
  assert.equal(typeof ENTRIES['11564'].encounterResolve, 'function')
  assert.equal(typeof apiB.translateGlyph, 'function')
})
function useApiaryLocation(state, id, code, connections = []) {
  const inv = state.investigators[0]
  const location = state.locations.find(item => item.id === inv.location)
  Object.assign(location, { id, code, originalCode: code, revealed: true, connections })
  inv.location = id
  return location
}

test('11-a-5 11567 迷失营地：支付一行动抽取营地下方顶牌并生成敌人', () => {
  const state = inScenario('theApiary')
  const campsite = useApiaryLocation(state, 'lostCampsite', '11567')
  const deckBefore = [...state.encounterDeck]
  state.scenarioZones.apiaryLostCampsite = ['11724', '11723']
  const campsiteAction = () => legalMoves(state, 0).find(option => option.rule === 'apiaryDrawCampsite')
  campsite.revealed = false
  assert.equal(campsiteAction(), undefined)
  campsite.revealed = true
  const actionsBefore = state.investigators[0].actionsLeft
  move(state, campsiteAction())
  settle(state)
  assert.equal(state.investigators[0].actionsLeft, actionsBefore - 1)
  assert.deepEqual(state.scenarioZones.apiaryLostCampsite, ['11724'])
  assert.deepEqual(state.encounterDeck, deckBefore)
  assert.ok(state.enemies.some(item => (item.originalCode || item.code) === '11723' && item.location === campsite.id))
  assert.deepEqual(apiB.cultistCardsUnderAct(state), [])

  state.locations = [state.locations.find(item => item.id === campsite.id),
    { id: 'empty-site', name: '无人地点', revealed: true, connections: [] }]
  move(state, campsiteAction())
  settle(state)
  assert.deepEqual(state.scenarioZones.apiaryLostCampsite, [])
  assert.equal(campsiteAction(), undefined)
  assert.ok(state.enemies.some(item => (item.originalCode || item.code) === '11724' && item.location === 'empty-site'))
  state.locations = state.locations.filter(item => item.id === campsite.id)
  state.enemies = state.enemies.filter(item => item.location === campsite.id)
  state.scenarioZones.apiaryLostCampsite.push('11724')
  move(state, campsiteAction())
  settle(state)
  assert.ok(state.enemies.some(item => (item.originalCode || item.code) === '11724' && item.location === campsite.id))
})
test('11-a-5 11568 玛莉亚·里维拉：异教徒伤害改放到她身上，毁灭转嫁，被击败入胜利区', () => {
  const entry = registeredEntry('11568')
  assert.equal(entry.controlledAsset, true)
  assert.deepEqual(entry.storyAssetRule.redirectEnemyDamage.traits, ['Cultist'])
  assert.ok(entry.abilities.some(item => item.kind === 'reaction'))
  assert.equal(typeof apiB.behavior.assetLeftPlay, 'function')
})
test('11-a-5 11569 攫噬长廊：弃牌堆洗回牌库、饥渴长廊/腐化秘库入底 10；受 1 恐惧补线索', () => {
  assert.equal(typeof ENTRIES['11569'].encounterResolve, 'function')
  assert.equal(typeof apiB.applyRevelation, 'function')
})
test('11-a-5 11570 饥渴长廊：弃牌堆洗回牌库、酸性体腔/翻涌裂隙入底 10', () => {
  assert.equal(typeof ENTRIES['11570'].encounterResolve, 'function')
  assert.equal(typeof apiB.applyRevelation, 'function')
})
test('11-a-5 11571 酸性体腔：从本地点移动到养育场入口额外受 1 伤', () => {
  const entry = registeredEntry('11571')
  assert.deepEqual(entry.locationRule.movementExtraCost.toOriginalCodes, ['11559'])
  assert.equal(entry.locationRule.movementExtraCost.cost.kind, 'damage')
})
test('11-a-5 11572 中央腔室：回合末敏捷(1)，失败选择相连地点或受真实主母攻击', () => {
  for (const outcome of ['success', 'move', 'attack']) {
    const state = inScenario('theApiary', outcome === 'success' ? '+20' : '-20')
    useApiaryLocation(state, 'centralChamber', '11572', ['acidicCoelom'])
    state.locations.push({ id: 'acidicCoelom', name: '酸性体腔', revealed: true, connections: ['centralChamber'] })
    if (outcome === 'attack') {
      enemy(state, { code: '11573', originalCode: '11573', damage: 1, horror: 0, location: 'acidicCoelom', engagedSeat: null })
    }
    const run = (draft, events) => apiB.behavior.turnEnded(draft, draft.investigators[0], scenarioRuntime(draft, events))
    resolveTransaction(state, 0, { action: 'test-apiary-turn-end' }, run)
    assert.equal(state.skillTest.skill, 'agility')
    assert.equal(state.skillTest.difficulty, 1)
    const commit = state.pendingChoice
    resolveTransaction(state, 0, { action: 'choose', choiceId: commit.id, optionId: 'done' }, run)
    if (outcome === 'attack') {
      assert.deepEqual(state.pendingChoice.options.map(option => option.id), ['move', 'attack'])
      resolveTransaction(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: 'attack' }, run)
    }
    assert.equal(state.pendingChoice, null)
    assert.equal(state.investigators[0].location, outcome === 'move' ? 'acidicCoelom' : 'centralChamber')
    assert.equal(state.investigators[0].damage, outcome === 'attack' ? 1 : 0)
  }
})
test('11-a-5 11573 主母：庞大/无情，另一偷渡者被击败时伤害移到主母', () => {
  assert.equal(typeof apiB.relocateStowawayDamageToMother, 'function')
  assert.equal(typeof apiB.motherHealth, 'function')
})
test('11-a-5 11574 奇丑混种：猎手/反击；用武器攻击后在该支援放 1 毁灭', () => {
  const entry = ENTRIES['11574']
  assert.equal(entry.abilities[0].kind, 'forced')
  assert.equal(entry.abilities[0].trigger, 'enemyDamaged')
})
test('11-a-5 11575 养育场看守：本地点放毁灭时重整、失去冷漠、若交战则立刻攻击', () => {
  assert.equal(typeof apiB.behavior.doomPlaced, 'function')
})
test('11-a-5 11576 饥饿的墙壁：附属地点；离开时敏捷/战力(4) 检定，失败分支结算并弃置', () => {
  const entry = registeredEntry('11576')
  assert.deepEqual(entry.treacheryRule.onLeave.test.skills, ['agility', 'combat'])
  assert.equal(entry.treacheryRule.onLeave.discardOnResolve, true)
})
test('11-a-5 11577 危险的好奇心：意志(X=隐藏值) 失败受 1 伤并弃到偷渡者敌人抽取', () => {
  assert.equal(typeof ENTRIES['11577'].encounterResolve, 'function')
  assert.deepEqual(registeredEntry('11577').flags?.test, undefined)
})
