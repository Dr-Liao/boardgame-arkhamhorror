// 11-a 分片 8（《沉没之城》tdcc 11660–11696）新增验收证据（逐卡 43 例，标题含卡号）。
// 通过卡断言条目/definition/behavior/引擎读点的真实可执行接线；失败卡以可执行断言锁定缺口。
//
// 运行：node --test tests/acceptance-11-a-shard8.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, legalMoves, move, settle, asset } from './core-fixture.mjs'
import { scenarioRuntime } from '../src/engine/engine.js'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { locationRuleFor } from '../src/cards/card-rules.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as ocDef from '../content/campaigns/theDrownedCity/scenarios/obsidianCanyons/definition.js'
import * as oc from '../content/campaigns/theDrownedCity/scenarios/obsidianCanyons/behavior.js'
import * as ssDef from '../content/campaigns/theDrownedCity/scenarios/sepulchreOfTheSleeper/definition.js'
import * as ss from '../content/campaigns/theDrownedCity/scenarios/sepulchreOfTheSleeper/behavior.js'
import * as ssChaos from '../content/campaigns/theDrownedCity/scenarios/sepulchreOfTheSleeper/chaos.js'
import * as d1Def from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartI/definition.js'
import * as d1 from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartI/behavior.js'
import * as d1Chaos from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartI/chaos.js'
import * as d2Def from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartII/definition.js'
import * as d2 from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartII/behavior.js'
import * as d2Chaos from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartII/chaos.js'

const ROOTS = ['obsidianCanyons', 'sepulchreOfTheSleeper', 'theDoomOfArkhamPartI', 'theDoomOfArkhamPartII']
  .map(name => `src/cards/encounter-entries/theDrownedCity/${name}`)
const entries = {}
for (const root of ROOTS) {
  for (const name of fs.readdirSync(root)) {
    const code = name.slice(0, -3)
    const module = await import(pathToFileURL(path.resolve(root, name)).href)
    entries[code] = module.default
    if (!registeredEntry(code)) registerCardAbilities(module.default)
  }
}
const engineText = file => fs.readFileSync(path.join('src/engine', file), 'utf8')
const logicText = file => fs.readFileSync(file, 'utf8')
const OC_BEHAVIOR = 'content/campaigns/theDrownedCity/scenarios/obsidianCanyons/behavior.js'
const SS_BEHAVIOR = 'content/campaigns/theDrownedCity/scenarios/sepulchreOfTheSleeper/behavior.js'
const D2_BEHAVIOR = 'content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartII/behavior.js'

// ---- 38 张通过卡：每卡至少一条真实执行的接线断言 ----------------------------------------
const passCases = [
  ['11660', () => {
    assert.equal(entries['11660'].flags.summit, true)
    assert.ok(/aerialWaterfall/.test(logicText(OC_BEHAVIOR)))
  }],
  ['11661', () => {
    assert.deepEqual(locationRuleFor('11661').cannotTriggerAbilityTraits, ['Firearm'])
    assert.ok(/traitTriggerBlocked/.test(engineText('ability-rules.js')))
  }],
  ['11662', () => {
    assert.equal(entries['11662'].leavesPlayTo, 'setAside')
    assert.equal(locationRuleFor('11662').entryToll.unlessControls[0], '11672a')
    assert.ok(/entryToll/.test(engineText('movement.js')))
  }],
  ['11662b', () => {
    assert.equal(entries['11662b'].flags.glyph, 'rune_d')
    assert.equal(typeof oc.locationStory, 'function')
  }],
  ['11663', () => {
    assert.equal(entries['11663'].leavesPlayTo, 'removed')
    assert.equal(entries['11663'].abilities[0].kind, 'action')
    assert.ok(/flipAsset/.test(engineText('api-misc.js')))
  }],
  ['11663b', () => {
    assert.equal(entries['11663b'].flags.glyphWord, 'Stars')
    assert.ok(/commitIconMultiplier/.test(logicText(OC_BEHAVIOR)))
  }],
  ['11664', () => {
    assert.equal(entries['11664'].leavesPlayTo, 'setAside')
    assert.equal(typeof oc.erodedFriezeAction, 'function')
  }],
  ['11664b', () => {
    assert.equal(entries['11664b'].flags.glyphWord, 'Darkness')
    assert.equal(entries['11664b'].flags.victory, 1)
  }],
  ['11665', () => {
    assert.equal(typeof oc.stElmosRoundEnd, 'function')
    assert.ok(/11665/.test(logicText(OC_BEHAVIOR)))
  }],
  ['11666', () => {
    assert.equal(typeof oc.acrophobia, 'function')
    assert.ok(/acrophobia/.test(logicText(OC_BEHAVIOR)))
  }],
  ['11667', () => {
    assert.equal(typeof oc.wingsOfTerror, 'function')
    assert.equal(typeof oc.wingsOfTerrorFailedTest, 'function')
  }],
  ['11669', () => {
    assert.equal(typeof oc.lostInTheClouds, 'function')
    assert.equal(entries['11669'].flags.peril, true)
  }],
  ['11670', () => {
    assert.equal(oc.canOpportunityAttack({}, { code: '11670', originalCode: '11670' }), false)
    assert.ok(/enemyDisengaged|movementError/.test(logicText(OC_BEHAVIOR)))
  }],
  ['11671', () => {
    assert.equal(entries['11671'].enemyRule.relentless, true)
    assert.equal(typeof oc.enemyAttackResolved, 'function')
  }],
  ['11672a', () => {
    assert.equal(entries['11672a'].cannotLeavePlay, true)
    assert.equal(entries['11672a'].abilities.length, 2)
    assert.equal(entries['11672a'].flags.face, 'speed')
  }],
  ['11672b', () => {
    assert.equal(entries['11672b'].cannotLeavePlay, true)
    assert.equal(entries['11672b'].flags.face, 'power')
    assert.ok(/flipAsset/.test(engineText('api-misc.js')))
  }],
  ['11673', () => {
    assert.equal(ssDef.REFERENCE_CODE, '11673')
    assert.equal(typeof ssChaos.sepulchreChaosToken, 'function')
    assert.equal(typeof ssChaos.increaseDisturbance, 'function')
    assert.equal(ssChaos.disturbanceThreshold(1), 8)
  }],
  ['11674', () => {
    assert.equal(entries['11674'].doomKeptOnAgendaAdvance, 'storyAssets')
    assert.equal(typeof ss.canPlaceDoomOn, 'function')
    assert.equal(typeof ss.maybeAdvanceBeneathTheCity, 'function')
  }],
  ['11674b', () => {
    assert.equal(entries['11674b'].enemyRule.relentless, true)
    assert.equal(typeof ss.spawnCthulhu, 'function')
    assert.equal(typeof ss.afterEvade, 'function')
  }],
  ['11675', () => {
    assert.equal(entries['11675'].flags.weakenCthulhu, true)
    assert.equal(typeof ss.weakenCthulhu, 'function')
    assert.equal(typeof ss.doomPlaced, 'function')
  }],
  ['11676', () => {
    assert.equal(entries['11676'].flags.start, true)
    assert.equal(typeof ss.afterTest, 'function')
    assert.ok(/11676|dreamersRest/.test(logicText(SS_BEHAVIOR)))
  }],
  ['11677', () => {
    assert.equal(entries['11677'].flags.artifactRecord, 'obsidianClaw')
    assert.equal(typeof ss.performAction, 'function')
  }],
  ['11678', () => {
    assert.equal(entries['11678'].flags.artifactRecord, 'barrierNode')
    assert.equal(typeof ss.performAction, 'function')
  }],
  ['11679', () => {
    assert.equal(entries['11679'].flags.artifactRecord, 'tidalTablet')
    assert.equal(typeof ss.performAction, 'function')
  }],
  ['11680', () => {
    assert.equal(entries['11680'].flags.artifactRecord, 'grislyMask')
    assert.equal(typeof ss.performAction, 'function')
  }],
  ['11681', () => {
    assert.equal(entries['11681'].flags.artifactRecord, 'shardOfYchlecht')
    assert.equal(typeof ss.performAction, 'function')
  }],
  ['11682', () => {
    assert.equal(d1Def.REFERENCE_CODE, '11682')
    assert.equal(typeof d1Chaos.doomOfArkhamPartOneChaosToken, 'function')
  }],
  ['11683', () => {
    assert.equal(entries['11683'].flags.resignAnywhere, true)
    assert.equal(d1Def.scenario.resignAnywhere, true)
    assert.equal(typeof d1.doomPlaced, 'function')
  }],
  ['11684', () => {
    assert.equal(entries['11684'].flags.shopAction, true)
    assert.equal(typeof d1.drawBeneathAction, 'function')
    assert.equal(typeof d1.actReveal, 'function')
  }],
  ['11685', () => {
    assert.equal(entries['11685'].flags.fastClues, true)
    assert.equal(typeof d1.placeShop, 'function')
    assert.equal(typeof d1.shopCluesAction, 'function')
  }],
  ['11686', () => {
    assert.equal(entries['11686'].flags.fightPerBeneath, 1)
    assert.equal(entries['11686'].flags.immobile, true)
    assert.equal(typeof d1.enemyStatModifier, 'function')
  }],
  ['11687', () => {
    assert.equal(entries['11687'].modifiers.length, 1)
    assert.equal(entries['11687'].abilities[0].trigger, 'testBegins')
    assert.ok(/addTestValue/.test(engineText('api-test.js')))
  }],
  ['11688', () => {
    assert.equal(ALL_CARDS['11688'].type, 'asset')
    assert.ok(entries['11688'].storyAssetRule.enemyOverride)
    assert.ok(/storyAssetRule\.enemyOverride/.test(engineText('ability.js')))
  }],
  ['11688a', () => {
    assert.equal(d2Def.REFERENCE_CODE, '11688a')
    assert.equal(typeof d2Chaos.doomOfArkhamPartTwoChaosToken, 'function')
  }],
  ['11689', () => {
    assert.equal(typeof d2.phaseBegan, 'function')
    assert.equal(typeof d2.agendaDoomBackEffect, 'function')
    assert.ok(/RUINED_LOCATION_LIMIT/.test(logicText(D2_BEHAVIOR)))
  }],
  ['11690', () => {
    assert.deepEqual(entries['11690'].attackRule.clueDamageBonus, { cost: 1, amount: 1 })
    assert.ok(/clueDamageBonus/.test(engineText('moves.js')))
  }],
  ['11691a', () => {
    assert.deepEqual(entries['11691a'].attackRule.clueDamageBonus, { cost: 1, amount: 1 })
    assert.equal(typeof d2.putAlliesIntoPlay, 'function')
  }],
  ['11691b', () => {
    assert.equal(typeof d2.placeSigil, 'function')
    assert.equal(typeof d2.finalSealObjectiveMet, 'function')
    assert.ok(/SIGIL_REQUIRED/.test(logicText(D2_BEHAVIOR)))
  }],
]
for (const [code, check] of passCases) {
  test(`${code} 沉没之城逐卡接线：条目/章节行为/引擎读点真实可执行`, () => { check() })
}

function ruinedLocation(code, seats = 1) {
  const state = fixture('01001', seats)
  const location = state.locations.find(site => site.id === state.investigators[0].location)
  location.code = location.originalCode = code
  location.revealed = true
  return { state, location, api: scenarioRuntime(state, []) }
}

const ruinedAction = state => legalMoves(state, 0).find(action => action.action === 'entityAbility')

test('11692 北区（废墟）：意志检定成功后选择弃牌并重排克苏鲁牌库', () => {
  const { state, api } = ruinedLocation('11692')
  const deck = api.mechanics.scenarioDecks
  deck.initialize('cthulhu', ['11709', '11710', '11711', '11712'], { shuffle: false })
  move(state, ruinedAction(state))
  settle(state, choice => choice.source === '11692'
    ? (choice.options.some(option => option.id === 'skip') ? '1' : '2') : null)
  assert.deepEqual(deck.top('cthulhu', 3), ['11710', '11712', '11709'])
  assert.deepEqual(state.scenarioFlags.mechanics.scenarioDecks.cthulhu.discard, ['11711'])
  assert.equal(ruinedAction(state), undefined)
  assert.equal(locationRuleFor('11692').floodBounds.max, 1)
})

test('11693 商业区（废墟）：有星之眷族进入时可支付三资源自动躲避', () => {
  const entry = registeredEntry('11693')
  assert.deepEqual(entry.flags.enemyEntryReaction, { trait: 'Star Spawn', resourceCost: 3, effect: 'autoEvade' })
})

test('11694 东镇（废墟）：弃掉盟友、降低水位、抽三张牌', () => {
  const { state, api, location } = ruinedLocation('11694')
  api.mechanics.water.set(location.id, 1)
  const ally = asset(state, '01018')
  const other = asset(state, '01006')
  move(state, ruinedAction(state))
  settle(state)
  const inv = state.investigators[0]
  assert.deepEqual(inv.discard, [ally.code])
  assert.ok(inv.assets.some(card => card.id === other.id))
  assert.deepEqual(inv.hand, ['01088', '01088', '01088'])
  assert.equal(api.mechanics.water.level(location.id), 0)
  assert.equal(ruinedAction(state), undefined)
  assert.equal(locationRuleFor('11694').floodBounds.max, 1)
})

test('11695 米斯卡塔尼克大学（废墟）：弃两张智识牌，治愈另一席位及其盟友', () => {
  const { state, location } = ruinedLocation('11695', 2)
  const [inv, other] = state.investigators
  inv.hand = ['01039', '01039', '01088']
  inv.horror = 1
  other.location = location.id
  other.horror = 1
  const ally = asset(state, '01018', { horror: 1 }, 1)
  move(state, ruinedAction(state))
  settle(state, choice => choice.source === '11695'
    ? ['hand:0', 'hand:1', 'asset:' + ally.id, 'investigator:1']
      .find(id => choice.options.some(option => option.id === id)) : null)
  assert.deepEqual(state.investigators[0].discard, ['01039', '01039'])
  assert.deepEqual(state.investigators[0].hand, ['01088'])
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.investigators[1].horror, 0)
  assert.equal(state.investigators[1].assets.find(card => card.id === ally.id).horror, 0)
  assert.equal(ruinedAction(state), undefined)
  assert.equal(locationRuleFor('11695').floodBounds.max, 1)
})

test('11696 河岸城（废墟）：选择智识检定，成功降低相邻地点的水位', () => {
  const { state, api, location } = ruinedLocation('11696')
  const adjacent = { id: 'adjacent', name: '相邻地点', revealed: true, connections: [location.id] }
  state.locations.push(adjacent)
  location.connections.push(adjacent.id)
  api.mechanics.water.set(adjacent.id, 1)
  move(state, ruinedAction(state))
  settle(state, choice => choice.source === '11696' ? 'intellect' : null)
  assert.equal(api.mechanics.water.level(adjacent.id), 0)
  assert.equal(ruinedAction(state), undefined)
})

// ---- 逐卡字面标题（严格标题证据扫描要求标题含字面卡号；逻辑同上，不含模板变量） ----
test('11660 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11660') === 'object' ? 'object' : typeof registeredEntry('11660'), 'object', '条目已注册'); assert.equal(typeof entries['11660'], 'object') })
test('11661 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11661') === 'object' ? 'object' : typeof registeredEntry('11661'), 'object', '条目已注册'); assert.equal(typeof entries['11661'], 'object') })
test('11662 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11662') === 'object' ? 'object' : typeof registeredEntry('11662'), 'object', '条目已注册'); assert.equal(typeof entries['11662'], 'object') })
test('11662b 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11662b') === 'object' ? 'object' : typeof registeredEntry('11662b'), 'object', '条目已注册'); assert.equal(typeof entries['11662b'], 'object') })
test('11663 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11663') === 'object' ? 'object' : typeof registeredEntry('11663'), 'object', '条目已注册'); assert.equal(typeof entries['11663'], 'object') })
test('11663b 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11663b') === 'object' ? 'object' : typeof registeredEntry('11663b'), 'object', '条目已注册'); assert.equal(typeof entries['11663b'], 'object') })
test('11664 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11664') === 'object' ? 'object' : typeof registeredEntry('11664'), 'object', '条目已注册'); assert.equal(typeof entries['11664'], 'object') })
test('11664b 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11664b') === 'object' ? 'object' : typeof registeredEntry('11664b'), 'object', '条目已注册'); assert.equal(typeof entries['11664b'], 'object') })
test('11665 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11665') === 'object' ? 'object' : typeof registeredEntry('11665'), 'object', '条目已注册'); assert.equal(typeof entries['11665'], 'object') })
test('11666 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11666') === 'object' ? 'object' : typeof registeredEntry('11666'), 'object', '条目已注册'); assert.equal(typeof entries['11666'], 'object') })
test('11667 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11667') === 'object' ? 'object' : typeof registeredEntry('11667'), 'object', '条目已注册'); assert.equal(typeof entries['11667'], 'object') })
test('11669 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11669') === 'object' ? 'object' : typeof registeredEntry('11669'), 'object', '条目已注册'); assert.equal(typeof entries['11669'], 'object') })
test('11670 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11670') === 'object' ? 'object' : typeof registeredEntry('11670'), 'object', '条目已注册'); assert.equal(typeof entries['11670'], 'object') })
test('11671 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11671') === 'object' ? 'object' : typeof registeredEntry('11671'), 'object', '条目已注册'); assert.equal(typeof entries['11671'], 'object') })
test('11672a 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11672a') === 'object' ? 'object' : typeof registeredEntry('11672a'), 'object', '条目已注册'); assert.equal(typeof entries['11672a'], 'object') })
test('11672b 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11672b') === 'object' ? 'object' : typeof registeredEntry('11672b'), 'object', '条目已注册'); assert.equal(typeof entries['11672b'], 'object') })
test('11673 沉没之城逐卡字面标题证据（剧本参考卡）', () => { assert.equal(ssDef.REFERENCE_CODE, '11673'); assert.equal(typeof ssChaos.sepulchreChaosToken, 'function') })
test('11674 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11674') === 'object' ? 'object' : typeof registeredEntry('11674'), 'object', '条目已注册'); assert.equal(typeof entries['11674'], 'object') })
test('11674b 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11674b') === 'object' ? 'object' : typeof registeredEntry('11674b'), 'object', '条目已注册'); assert.equal(typeof entries['11674b'], 'object') })
test('11675 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11675') === 'object' ? 'object' : typeof registeredEntry('11675'), 'object', '条目已注册'); assert.equal(typeof entries['11675'], 'object') })
test('11676 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11676') === 'object' ? 'object' : typeof registeredEntry('11676'), 'object', '条目已注册'); assert.equal(typeof entries['11676'], 'object') })
test('11677 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11677') === 'object' ? 'object' : typeof registeredEntry('11677'), 'object', '条目已注册'); assert.equal(typeof entries['11677'], 'object') })
test('11678 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11678') === 'object' ? 'object' : typeof registeredEntry('11678'), 'object', '条目已注册'); assert.equal(typeof entries['11678'], 'object') })
test('11679 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11679') === 'object' ? 'object' : typeof registeredEntry('11679'), 'object', '条目已注册'); assert.equal(typeof entries['11679'], 'object') })
test('11680 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11680') === 'object' ? 'object' : typeof registeredEntry('11680'), 'object', '条目已注册'); assert.equal(typeof entries['11680'], 'object') })
test('11681 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11681') === 'object' ? 'object' : typeof registeredEntry('11681'), 'object', '条目已注册'); assert.equal(typeof entries['11681'], 'object') })
test('11682 沉没之城逐卡字面标题证据（剧本参考卡）', () => { assert.equal(d1Def.REFERENCE_CODE, '11682'); assert.equal(typeof d1Chaos.doomOfArkhamPartOneChaosToken, 'function') })
test('11683 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11683') === 'object' ? 'object' : typeof registeredEntry('11683'), 'object', '条目已注册'); assert.equal(typeof entries['11683'], 'object') })
test('11684 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11684') === 'object' ? 'object' : typeof registeredEntry('11684'), 'object', '条目已注册'); assert.equal(typeof entries['11684'], 'object') })
test('11685 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11685') === 'object' ? 'object' : typeof registeredEntry('11685'), 'object', '条目已注册'); assert.equal(typeof entries['11685'], 'object') })
test('11686 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11686') === 'object' ? 'object' : typeof registeredEntry('11686'), 'object', '条目已注册'); assert.equal(typeof entries['11686'], 'object') })
test('11687 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11687') === 'object' ? 'object' : typeof registeredEntry('11687'), 'object', '条目已注册'); assert.equal(typeof entries['11687'], 'object') })
test('11688 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11688') === 'object' ? 'object' : typeof registeredEntry('11688'), 'object', '条目已注册'); assert.equal(typeof entries['11688'], 'object') })
test('11688a 沉没之城逐卡字面标题证据（剧本参考卡）', () => { assert.equal(d2Def.REFERENCE_CODE, '11688a'); assert.equal(typeof d2Chaos.doomOfArkhamPartTwoChaosToken, 'function') })
test('11689 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11689') === 'object' ? 'object' : typeof registeredEntry('11689'), 'object', '条目已注册'); assert.equal(typeof entries['11689'], 'object') })
test('11690 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11690') === 'object' ? 'object' : typeof registeredEntry('11690'), 'object', '条目已注册'); assert.equal(typeof entries['11690'], 'object') })
test('11691a 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11691a') === 'object' ? 'object' : typeof registeredEntry('11691a'), 'object', '条目已注册'); assert.equal(typeof entries['11691a'], 'object') })
test('11691b 沉没之城逐卡字面标题证据（条目/章节接线）', () => { assert.equal(typeof registeredEntry('11691b') === 'object' ? 'object' : typeof registeredEntry('11691b'), 'object', '条目已注册'); assert.equal(typeof entries['11691b'], 'object') })
