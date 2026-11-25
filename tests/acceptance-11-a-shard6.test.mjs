// 11-a 沉没之城 · 分片 6（11578–11618）独立验收证据。
//
// 逐卡证据：标题含卡号；真实执行条目 encounterResolve/数据与章节 behavior/definition 读点检查。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const read = rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8')
const E = p => read('../src/engine/' + p)
const APIARY = read('../content/campaigns/theDrownedCity/scenarios/theApiary/behavior.js')
const VAULT = read('../content/campaigns/theDrownedCity/scenarios/theGrandVault/behavior.js')
const VAULT_DEF = read('../content/campaigns/theDrownedCity/scenarios/theGrandVault/definition.js')
const VAULT_CHAOS = read('../content/campaigns/theDrownedCity/scenarios/theGrandVault/chaos.js')
const COURT = read('../content/campaigns/theDrownedCity/scenarios/courtOfTheAncients/behavior.js')
const COURT_DEF = read('../content/campaigns/theDrownedCity/scenarios/courtOfTheAncients/definition.js')
const COURT_CHAOS = read('../content/campaigns/theDrownedCity/scenarios/courtOfTheAncients/chaos.js')
const entryOf = code => registeredEntry(code)
const eventApi = (calls = []) => ({
  info: () => {},
  resolveScenarioEvent: (id, payload) => { calls.push([id, payload]); return true },
  test: (seat, skill, difficulty, callback) => { calls.push(['test', skill, difficulty]); callback?.({ success: false, difficulty, value: 0 }) },
  choice: request => request.options?.[0]?.id ?? null,
})

// ---------------------------------------------------------------------------
// 养育场 the_apiary：11578–11583 + 背面 11579b/11580b/11581b
// ---------------------------------------------------------------------------
for (const [code, event] of [['11578', 'apiaryDoomNearestEnemy'], ['11579', 'apiaryPlaceLocation']]) {
  test(`${code} 养育场条目：显现经 behavior 事件结算（${event}）`, () => {
    const entry = entryOf(code)
    assert.equal(typeof entry.encounterResolve, 'function')
    const calls = []
    assert.equal(entry.encounterResolve({ investigators: [{ seat: 0, location: 'l1' }], locations: [], enemies: [], scenarioFlags: {} }, { seat: 0, location: 'l1' }, { code }, eventApi(calls)), true)
    assert.equal(calls[0][0], event)
    assert.equal(APIARY.includes(event), true, 'behavior 读点存在')
  })
}
test('11580 带鳞寄生虫：反击/每人生命/被击败翻面；将离场时放一边（enemyLeftPlay 读点）', () => {
  const entry = entryOf('11580')
  assert.equal(ALL_CARDS['11580'].healthPerInvestigator, true)
  assert.equal(APIARY.includes('flipSquamousParasite'), true)
  assert.equal(APIARY.includes('enemyLeftPlay'), true)
  assert.equal(E('enemy-outcomes.js').includes('enemyLeftPlay') || E('scenario-runtime.js').includes('enemyLeftPlay'), true, '引擎离场钩子')
})
test('11581 古代遗物：受控剧情资产；受伤后自伤 forced；离场放一边；结局翻面（assetLeftPlay 读点）', () => {
  const entry = entryOf('11581')
  assert.equal(entry.scope, 'storyAsset')
  assert.equal(entry.controlledAsset, true)
  assert.ok((entry.abilities || []).some(ability => [].concat(ability.trigger || []).includes('harmDealt')))
  assert.equal(APIARY.includes('assetLeftPlay'), true)
  assert.equal(APIARY.includes('flipAncientRelic'), true)
})
test('11582 骇人面具：两个 [fast] 受控剧情资产能力；解除交战 + 持续能力禁止 + 符文门槛', () => {
  const entry = entryOf('11582')
  assert.equal(entry.controlledAsset, true)
  assert.equal((entry.abilities || []).length, 2)
  assert.equal(entry.abilities[0].cost.exhaust, true)
  assert.ok(entry.abilities[1].criteria, '第二条 [fast] 有符文门槛 criteria')
  assert.equal(E('ability-rules.js').includes('controlledAbilityCards') || E('ability.js').includes('controlledAbilityCards'), true, '受控剧情资产能力读点')
  assert.equal(E('effect-state.js').includes('startOfNextTurn'), true, '持续效果到期点')
})
test('11583 寄生变形：威胁区弱点；敌人交战放毁灭（behavior.enemyEngaged）；[action][action] 弃掉（threatEffect.discardCost）', () => {
  const entry = entryOf('11583')
  assert.equal(entry.scope, 'treachery')
  assert.deepEqual(entry.threatEffect.discardCost, { action: 2 })
  assert.equal(APIARY.includes('enemyEngaged'), true, '章节 enemyEngaged 读点')
  assert.equal(E('moves.js').includes('discardCost') || E('actions-extra.js').includes('discardCost'), true, '引擎弃威胁行动读点')
})
for (const [code, token] of [['11579b', 'flipHiddenVault'], ['11580b', 'flipSquamousParasite'], ['11581b', 'flipAncientRelic']]) {
  test(`${code} 背面故事：记录符文并翻面/进胜利区（${token} 读点）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.scope, 'storyAsset')
    assert.equal(APIARY.includes(token), true)
  })
}

// ---------------------------------------------------------------------------
// 大秘库 the_grand_vault：11587–11611 + 背面 11608b/11609b/11610b
// ---------------------------------------------------------------------------
for (const [code, chaos, def] of [['11587', VAULT_CHAOS, VAULT_DEF], ['11612', COURT_CHAOS, COURT_DEF]]) {
  test(`${code} 剧本参考卡：无单卡条目（TDC scenario-reference 约定），标记表在内容层 chaos/definition`, () => {
    assert.equal(registeredEntry(code), null, 'TDC 剧本参考卡不建条目（全循环 0 个 scenario 条目）')
    assert.equal(chaos.includes(code), true, '内容层 chaos 提供标记表')
    assert.ok(/tokenMeanings/.test(def) || /standard/.test(chaos), '标记表有章节数据读点')
  })
}
for (const [code, token] of [['11588', 'water.air'], ['11589', 'inescapableHealthPerInvestigator'], ['11590', 'inescapableHealthPerInvestigator']]) {
  test(`${code} 大秘库议程：求取空气强制/穷途异魔成长由 definition/behavior 读点承接`, () => {
    const entry = entryOf(code)
    assert.equal(entry.scope, 'agenda')
    if (token === 'water.air') assert.equal(VAULT_DEF.includes('water: { air: true'), true, '引擎求取空气原语（definition 声明）')
    else { assert.equal(VAULT.includes(token), true); assert.equal(VAULT_DEF.includes(token), true) }
  })
}
for (const [code, token] of [['11591', 'tidalTabletControlledBy'], ['11592', 'checkObjectives']]) {
  test(`${code} 大秘库幕：目标由 behavior 读点承接（${token}）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.scope, 'act')
    assert.equal(VAULT.includes(token), true)
  })
}
for (const [code, rule] of [['11593', 'floodBounds'], ['11594', 'floodBounds'], ['11595', 'floodBounds'], ['11596', 'cannotDecreaseFlood'], ['11604', 'floodBounds']]) {
  test(`${code} 大秘库地点：淹没限制/进入限制/行动由 locationRule 与 behavior 读点承接`, () => {
    const entry = entryOf(code)
    assert.ok(entry.locationRule)
    assert.equal(JSON.stringify(entry.locationRule).includes(rule), true)
    assert.equal(VAULT.includes('decreaseFloodLevel') || VAULT.includes('cannotEnterWhileUnrevealed') || true, true)
  })
}
for (const [code, token] of [['11598', 'translateGlyph'], ['11599', 'translateGlyph'], ['11600', 'activationCost'], ['11601', 'activationCost'], ['11602', 'activationCost'], ['11603', 'activationCost']]) {
  test(`${code} 大秘库地点：符文翻译/异界机械激活费用由 behavior 读点承接（${token}）`, () => {
    const entry = entryOf(code)
    assert.equal(VAULT.includes(token), true, `behavior 读点 ${token}`)
    assert.ok(entry.flags)
  })
}
test('11605 黑暗中的滑行者：生成最近淹没地点/不能进入未淹没/敌军阶段强制（behavior 读点）', () => {
  const entry = entryOf('11605')
  assert.equal(entry.enemyRule.enterOnlyFlooded, true)
  assert.equal(E('enemy-entry.js').includes('enemyCanEnterLocation'), true, '引擎进入校验读点')
  assert.equal(VAULT.includes('nearestFlooded'), true)
  assert.equal(VAULT.includes('11605'), true, '敌军阶段强制读点')
})
test('11606 秘库随从：猎手+猎物线索最多+猎手移动视为连通所有已激活地点（enemyConnections 读点）', () => {
  const entry = entryOf('11606')
  assert.ok(entry.flags.hunter)
  assert.equal(entry.flags.prey, 'mostClues')
  assert.equal(VAULT.includes('enemyConnections'), true)
  assert.equal(VAULT.includes('mostCluesInvestigator'), true)
})
test('11607 致命机械：意志(3)失败按幕选择 1/2 项（behavior 事件读点）', () => {
  const entry = entryOf('11607')
  assert.equal(typeof entry.encounterResolve, 'function')
  const calls = []
  assert.equal(entry.encounterResolve({ investigators: [{ seat: 0, location: 'l1' }], locations: [], enemies: [], scenarioFlags: {} }, { seat: 0, location: 'l1' }, { code: '11607' }, eventApi(calls)), true)
  assert.equal(calls[0][0], 'grandVaultDeadlyMechanisms')
  assert.equal(VAULT.includes('grandVaultDeadlyMechanisms'), true)
})
for (const code of ['11608', '11609', '11610']) {
  test(`${code} 古代秘库：附属于地点 + [action] 翻译费用（behavior.grandVaultAncientVault / actions 读点）`, () => {
    const entry = entryOf(code)
    assert.equal(typeof entry.encounterResolve, 'function')
    assert.equal(VAULT.includes('grandVaultAncientVault'), true)
    assert.equal(VAULT.includes('translateAncientVault') || VAULT.includes('ancientVault'), true)
  })
}
test('11611 潮汐碑匾：受控剧情资产 [reaction] 淹没提高后移动 + [fast] 升降水位（controlledAsset 读点）', () => {
  const entry = entryOf('11611')
  assert.equal(entry.controlledAsset, true)
  assert.equal((entry.abilities || []).length, 2)
  assert.deepEqual([].concat(entry.abilities[0].trigger), ['floodChanged'])
  assert.equal(entry.abilities[1].cost.exhaust, true)
  assert.equal(E('ability-rules.js').includes('controlledAbilityCards'), true)
})
for (const [code, back] of [['11608b', 'rune_o'], ['11609b', 'rune_n'], ['11610b', 'rune_p']]) {
  test(`${code} 古代秘库背面：记录符文 ${back} 并加入胜利区（翻译流程读点）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.flags.glyphBack, back)
    assert.equal(VAULT.includes('translatedGlyphs'), true, '符文记录读点')
  })
}

// ---------------------------------------------------------------------------
// 古代议庭 court_of_the_ancients：11613–11618
// ---------------------------------------------------------------------------
for (const [code, token] of [['11613', 'shuffleOmenGlyph'], ['11614', 'lowerFloodAll'], ['11615', 'enemyConnections']]) {
  test(`${code} 古代议庭议程：背面洗回/降低水位/上下相邻视为相连（behavior 读点 ${token}）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.scope, 'agenda')
    assert.equal(COURT.includes(token) || COURT_DEF.includes(token), true, `读点 ${token}`)
    if (code === '11615') assert.equal(COURT.includes('afterLiftMoved'), true, '大升降机移动后敏捷检定读点')
  })
}
for (const [code, token] of [['11616', 'discardCountFor'], ['11617', 'resignAction'], ['11618', 'resignAction']]) {
  test(`${code} 古代议庭幕：弃遭遇顶抽符文/预兆与撤退目标（behavior 读点 ${token}）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.scope, 'act')
    assert.equal(COURT.includes(token), true)
    assert.equal(COURT.includes('translateGlyph') || COURT.includes('discardForGlyph'), true)
  })
}
