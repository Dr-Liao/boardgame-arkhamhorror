import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { createClueApi } from '../src/engine/api-clue.js'
import { applyHarm, canDamageEnemy, canEquip, cardDef, descriptorUsable, enemyAttack, enemyPhase, executeDescriptor, healDamageFrom,
  leaveAsset, relocateEnemy, runMulligans, scenarioRuntime, restrictedKindOfMove, startScenario } from '../src/engine/engine.js'
import { availablePurchases, purchaseCard, replacementOptions } from '../src/campaign/campaign.js'
import { createCardApi } from '../src/engine/api-card.js'
import { applyLocationDefenses } from '../src/engine/location-defenses.js'
import { matchesDeckOptions } from '../src/deck/deckbuilding.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { normalizeScenarioMechanics, validateMechanicState } from '../src/engine/mechanic-state.js'
import { migrateState } from '../src/engine/save-migration.js'
import { prepareSurvey } from '../src/engine/survey-preparation.js'
import { duringPeriod } from '../src/engine/matcher.js'
import { firstAssetDiscount, recordPlayedCard } from '../src/engine/action-history.js'
import { grantRestrictedAction, actionsAvailable, consumeAction } from '../src/engine/restricted-actions.js'
import { scenarioRuntimeExtras } from '../src/engine/scenario-runtime-extras.js'
import { payUseCost, availableUseCost } from '../src/engine/use-transfer.js'
import { asset, enemy, fixture, legalMoves, move, settle } from './core-fixture.mjs'

const copy = value => JSON.parse(JSON.stringify(value))

function viaAbilityApi(state, resolve) {
  let output
  const inv = state.investigators[0]
  executeDescriptor(state, { inv, events: [], silent: true, alreadyPaid: true,
    descriptor: { kind: 'free', code: inv.code, cost: {}, resolve: ({ api }) => { output = resolve(api) } } })
  return output
}

test('双类型地点存档后仍能调查、躲避和攻击，击败时只进一次胜利区并坍塌', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const here = state.locations.find(loc => loc.id === inv.location)
  Object.assign(here, { code: 'fixture-room', revealed: true, clues: 2, shroud: 1, traits: ['House'], attachments: [] })
  const above = { id: 'fixture-above', name: '楼上', code: 'fixture-above', revealed: true, clues: 0, shroud: 1, traits: [], connections: [] }
  state.locations.push(above)
  const api = scenarioRuntime(state, [])
  api.mechanics.map.place(here.id, 0, 0)
  api.mechanics.map.place(above.id, 0, 1)
  const face = { code: 'fixture-living', name: '活化房间', shroud: 1, traits: ['House'],
    fight: 1, evade: 1, health: 1, damage: 1, horror: 0, victory: 0 }
  assert.equal(api.changeLocationSeals(here.id, 1), 1)
  assert.equal(api.turnLocationIntoEnemy(here.id, face), false)
  assert.equal(api.changeLocationSeals(here.id, -1), 0)
  assert.equal(api.turnLocationIntoEnemy(here.id, face).id, here.id)
  api.doomOn(state.enemies.find(item => item.id === here.id))
  assert.equal(here.doom, 1)
  const saved = copy(state)
  migrateState(saved)
  const target = saved.enemies.find(item => item.id === here.id)
  const choices = legalMoves(saved, 0)
  assert.ok(choices.some(item => item.action === 'investigate'))
  assert.ok(choices.some(item => item.action === 'fight' && item.enemyId === here.id))
  assert.ok(choices.some(item => item.action === 'evade' && item.enemyId === here.id))
  assert.equal(choices.some(item => item.action === 'engage' && item.enemyId === here.id), false)
  assert.equal(relocateEnemy(saved, target, above.id, []), undefined)
  move(saved, { action: 'investigate' })
  settle(saved)
  assert.equal(saved.locations.find(item => item.id === here.id).clues, 1)
  move(saved, { action: 'evade', enemyId: here.id })
  settle(saved)
  assert.equal(saved.enemies.find(item => item.id === here.id).exhausted, true)
  const api2 = scenarioRuntime(saved, [])
  assert.ok(api2.restoreEnemyLocation(here.id))
  assert.equal(saved.enemies.some(item => item.id === here.id), false)
  assert.equal(api2.turnLocationIntoEnemy(here.id, face).exhausted, true)
  assert.equal(api2.changeLocationSeals(here.id, 1), 1)
  assert.equal(api2.restoreEnemyLocation(here.id), false)
  move(saved, { action: 'fight', enemyId: here.id })
  settle(saved)
  assert.equal(saved.locations.some(item => item.id === here.id), false)
  assert.equal(saved.enemies.some(item => item.id === here.id), false)
  assert.equal(saved.investigators[0].location, above.id)
  assert.deepEqual(saved.locations.find(item => item.id === above.id).grid, { x: 0, y: 0 })
  assert.equal(saved.victoryDisplay.filter(item => item.id === here.id).length, 1)
  assert.equal(saved.encounterDiscard.includes(face.code), false)
  migrateState(copy(saved))
})

test('跨章节整备保存身份、实物支援、线索和手牌，开局消费整备并跳过换牌', () => {
  const state = fixture()
  const inv = state.investigators[0]
  state.scenario.mechanics = normalizeScenarioMechanics({ survey: { destinations: ['theMidnightMasks'], resolutions: ['R1'] } })
  state.resolution = 'R1'
  inv.hand = ['01088', '01088', '01088', '01088', '01088', '01090']
  inv.clues = 3
  const keep = asset(state, '01016', { exhausted: true, uses: 1, clues: 2, ownerSeat: 0 })
  asset(state, '01018', { clues: 1 })
  const record = state.campaign.investigators[0]
  record.deck = ['01016', '01018', '01090', ...Array(10).fill('01088')]
  const deps = { cardDef, entryOf: registeredEntry, investigatorRule: () => ({}),
    choose: spec => spec.kind === 'asset' ? keep.id : '5' }
  assert.throws(() => prepareSurvey(state, { ...deps, choose: () => 'bad' }), /无效整备支援/)
  assert.equal(state.campaign.surveyPreparation, undefined)
  assert.equal(prepareSurvey(state, deps), true)
  assert.equal(state.campaign.upgradesAllowed, false)
  const saved = copy(state)
  migrateState(saved)
  startScenario(saved, 1, [])
  const prepared = saved.investigators[0]
  assert.equal(saved.scenario.id, 'theMidnightMasks')
  assert.equal(saved.campaign.surveyPreparation, undefined)
  assert.equal(prepared.hand.length, 5)
  assert.equal(prepared.resources, 5)
  assert.equal(prepared.clues, 4)
  assert.deepEqual(prepared.assets.map(item => [item.id, item.uses, item.clues, item.exhausted]), [[keep.id, 1, 2, true]])
  assert.equal(prepared.deck.includes('01016'), false)
  assert.equal(prepared.deck.includes('01018'), true)
  assert.equal(prepared.deck.includes('01090'), true)
  assert.equal(prepared.deck.filter(code => code === '01088').length, 5)
  runMulligans(saved, [])
  assert.equal(saved.pendingChoice, null)
  assert.equal(prepared.hand.length, 5)
  migrateState(copy(saved))
})

test('序曲阻止普通伤恐和直接击败，禁用依赖遭遇牌库的能力', () => {
  const state = fixture()
  state.scenario.mechanics = normalizeScenarioMechanics({ noEncounterDeck: true, protectInvestigators: true })
  const inv = state.investigators[0]
  applyHarm(state, inv, 8, 8, [], true)
  assert.deepEqual([inv.damage, inv.horror, inv.defeated], [0, 0, false])
  const api = scenarioRuntime(state, [])
  assert.equal(api.defeatInvestigator(0), false)
  assert.equal(executeDescriptor(state, { inv, events: [], descriptor: { kind: 'free', cost: {}, requiresEncounterDeck: true, resolve: assert.fail } }), false)
  assert.equal(inv.defeated, false)
  migrateState(copy(state))
})

test('代执行行动分别免行动费与全部费用，来源必须属于操作者', () => {
  const state = fixture('01001', 2)
  const source = 'p2-activation-probe'
  registerCardAbilities({ code: source, abilities: [{ kind: 'action', cost: { uses: 1, exhaust: true },
    resolve: ({ source: card }) => { assert.equal(card.code, source) } }] })
  const own = asset(state, source, { uses: 2 })
  const other = asset(state, source, { uses: 2 }, 1)
  const inv = state.investigators[0]
  inv.actionsLeft = 0
  assert.equal(viaAbilityApi(state, api => api.resolveAssetAction(0, { assetId: other.id, abilityIndex: 0 })), false)
  assert.equal(viaAbilityApi(state, api => api.resolveAssetAction(0, { assetId: own.id, abilityIndex: 0 })), true)
  assert.deepEqual([inv.actionsLeft, own.uses, own.exhausted], [0, 1, true])
  assert.equal(viaAbilityApi(state, api => api.resolveAssetAction(0, { assetId: own.id, abilityIndex: 0 })), false)
  inv.discard = [source]
  const api = createCardApi(state, [], { cardDef: () => ({ type: 'asset' }), registeredEntry, descriptorUsable,
    enumerateTargets: () => [], executeDescriptor })
  assert.equal(api.resolveAssetAction(0, { discardIndex: 0, abilityIndex: 0, waive: 'all' }), true)
  assert.deepEqual(inv.discard, [source])
  migrateState(copy(state))
})

test('宿主上的支援保留身份与原所有者，同地点调查员可取回并使用', () => {
  const state = fixture('01001', 2)
  const inv = state.investigators[0]
  const friend = state.investigators[1]
  const target = asset(state, '01016', { uses: 1 })
  const host = enemy(state)
  assert.ok(viaAbilityApi(state, api => api.attachControlledAsset(0, target.id, 'enemy', host.id)))
  assert.equal(inv.assets.includes(target), false)
  const saved = copy(state)
  migrateState(saved)
  saved.investigators[1].location = 'elsewhere'
  assert.equal(viaAbilityApi(saved, api => api.claimHostedAsset(1, 'enemy', host.id, target.id)), false)
  saved.investigators[1].location = friend.location
  const claimed = viaAbilityApi(saved, api => api.claimHostedAsset(1, 'enemy', host.id, target.id))
  assert.deepEqual([claimed.id, claimed.ownerSeat, claimed.controllerSeat, claimed.uses], [target.id, 0, 1, 1])
  assert.ok(viaAbilityApi(saved, api => api.attachControlledAsset(1, target.id, 'enemy', host.id)))
  scenarioRuntime(saved, []).damageEnemy(host.id, 30, 1)
  assert.deepEqual(saved.investigators[0].discard, ['01016'])
  assert.deepEqual(saved.investigators[1].discard, [])
})

test('面具同特质上限，并区分地点入场与第一次放置毁灭', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const name = 'p2-mask-probe'
  const seen = []
  registerCardAbilities({ code: name, assetRule: { controlledTraitLimit: { trait: 'Mask', amount: 1 } },
    abilities: [{ kind: 'forced', trigger: ['locationPlaced', 'doomPlaced'],
      resolve: ({ context }) => seen.push([context.when, context.hadDoom]) }] })
  const mask = asset(state, name, { traits: ['Mask'] })
  assert.equal(canEquip(inv, { code: name, traits: ['Mask'], slots: [] }), false)
  state.scenario.locations.fixtureRoom = { id: 'fixtureRoom', name: '新房间', connections: [], shroud: 1, clues: 0 }
  const api = scenarioRuntime(state, [])
  api.place('fixtureRoom', 0)
  api.doomOn(mask)
  api.doomOn(mask)
  assert.deepEqual(seen, [['locationPlaced', undefined], ['doomPlaced', false], ['doomPlaced', true]])
  migrateState(copy(state))
})

test('打出弃牌区谈判事件花费宿主一次使用次数，嵌套检定保留谈判行动性质', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const target = enemy(state, { traits: ['Humanoid'] })
  const code = '04105'
  registerCardAbilities({ code: 'p2-parley-source', assetRule: { parleyEventsFromDiscard: true } })
  const host = asset(state, 'p2-parley-source', { uses: 1, usesType: 'charge' })
  inv.actionsLeft = 0
  inv.discard = [code]
  grantRestrictedAction(state, inv, 'parley')
  const option = legalMoves(state, 0).find(item => item.cardId === code && item.fromDiscardProviderId === host.id)
  assert.ok(option)
  move(state, option)
  settle(state)
  assert.equal(state.enemies.some(item => item.id === target.id), false)
  assert.equal(state.investigators[0].assets.find(item => item.id === host.id).uses, 0)
  assert.deepEqual(state.investigators[0].discard, [])
  assert.ok(state.removedFromGame.includes(code))
  assert.equal(actionsAvailable(state.investigators[0], 'parley'), 0)
  migrateState(copy(state))
})

test('谈判能力中的攻击只消费谈判额度且不触发其他敌人的借机攻击', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const actor = enemy(state, { damage: 2 })
  const foe = enemy(state, { fight: 0 })
  const id = 'p2-parley-fight'
  state.storyAssets.push({ id, code: id, location: inv.location, name: '测试剧情' })
  registerCardAbilities({ code: id, scope: 'storyAsset', abilities: [{
    kind: 'action', actionKind: 'parley', resolve: ({ api, seat }) => api.fight(seat, foe.id),
  }] })
  inv.actionsLeft = 0
  grantRestrictedAction(state, inv, 'parley')
  const option = legalMoves(state, 0).find(item => item.entityId === id && item.actionKind === 'parley')
  assert.ok(option)
  move(state, option)
  settle(state)
  assert.equal(state.investigators[0].damage, 0)
  assert.ok(state.enemies.find(item => item.id === foe.id).damageTaken > 0)
  assert.equal(state.enemies.find(item => item.id === actor.id).damageTaken, 0)
})

test('真实检定在揭示前取出袋内多数标记并继续连抽', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const loc = state.locations.find(item => item.id === inv.location)
  loc.revealed = true
  loc.clues = 1
  loc.shroud = 0
  state.chaosBag = ['bless', 'bless', 'curse', '0']
  state.debugNextTokens = ['0']
  state.campaign.chaosBag = [...state.chaosBag]
  registerCardAbilities({ code: 'p2-rank-probe', abilities: [{ kind: 'forced', trigger: 'beforeChaosTokenReveal',
    criteria: ({ source }) => !source.exhausted, cost: { exhaust: true },
    resolve: ({ api, context }) => {
      assert.equal(api.revealRankedTokenInstead(context, 'curse', ['bless', 'curse'], { order: 'most' }), false)
      assert.equal(api.revealRankedTokenInstead(context, 'bless', ['bless', 'curse'], { order: 'most' }), true)
    } }] })
  asset(state, 'p2-rank-probe')
  move(state, { action: 'investigate' })
  settle(state)
  assert.deepEqual(state.chaosBag, ['bless', 'curse', '0'])
  assert.deepEqual(state.campaign.chaosBag, ['bless', 'curse', '0'])
  assert.equal(state.debugNextTokens, undefined)
  assert.equal(state.investigators[0].clues, 1)
  migrateState(copy(state))
})

test('逃逸关键词可暂时授予或取消，取消的攻击结算后无连接也会横置', () => {
  const state = fixture()
  const inv = state.investigators[0]
  state.locations.find(loc => loc.id === inv.location).connections = []
  const target = enemy(state)
  const api = scenarioRuntime(state, [])
  assert.equal(api.setEnemyKeywords(target, ['elusive'], { enabled: true }), true)
  assert.equal(api.setEnemyKeywords(target, ['elusive'], { enabled: false }), true)
  assert.equal(enemyAttack(state, target, inv, []), true)
  assert.equal(Boolean(target.exhausted), false)
  assert.equal(api.setEnemyKeywords(target, ['elusive', 'alert'], { enabled: true }), true)
  registerCardAbilities({ code: 'p2-attack-cancel', abilities: [{ kind: 'forced', trigger: 'enemyAttack',
    resolve: ({ context }) => { context.cancelled = true } }] })
  asset(state, 'p2-attack-cancel')
  const saved = copy(state)
  migrateState(saved)
  const foe = saved.enemies.find(item => item.id === target.id)
  assert.equal(enemyAttack(saved, foe, saved.investigators[0], []), false)
  assert.equal(foe.location, inv.location)
  assert.equal(foe.engagedSeat, null)
  assert.equal(foe.exhausted, true)
  foe.exhausted = false
  saved.round++
  assert.equal(enemyAttack(saved, foe, saved.investigators[0], []), false)
  assert.equal(foe.exhausted, false)
})

test('绑定池只取选定副本，池内用完后按实体从弃牌取同一张', () => {
  const state = fixture()
  const inv = state.investigators[0]
  assert.equal(viaAbilityApi(state, api => api.bonded.shuffleCopyIntoDeck(0, '10005', '10006')), true)
  assert.equal(inv.deck.filter(code => code === '10006').length, 1)
  assert.equal(viaAbilityApi(state, api => api.bonded.shuffleCopyIntoDeck(0, '10005', '10006')), false)
  const index = inv.deck.indexOf('10006')
  inv.discard.push(...inv.deck.splice(index, 1))
  const saved = copy(state)
  migrateState(saved)
  assert.equal(viaAbilityApi(saved, api => api.bonded.shuffleCopyIntoDeck(0, '10005', '10006')), true)
  assert.equal(saved.investigators[0].discard.includes('10006'), false)
  assert.equal(viaAbilityApi(saved, api => api.bonded.shuffleCopyIntoDeck(0, '10005', '10007')), true)
  assert.equal(saved.investigators[0].deck.filter(code => ['10006', '10007'].includes(code)).length, 2)
  const host = asset(saved, '10005', { clues: 1, uses: 2, attachments: [{ id: 'att', code: '01089' }] })
  const flipped = scenarioRuntime(saved, []).flipAsset(host, '10005b')
  assert.equal(flipped.changed, true)
  assert.deepEqual([host.code, host.clues, host.uses, host.attachments[0].id], ['10005b', 1, 2, 'att'])
})

test('工具互换按印刷费用与可用槽位检查，原支援退回手牌且新支援原位入场', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const old = asset(state, '01030')
  const other = asset(state, '01018')
  inv.hand.push('05024', '01040')
  assert.equal(viaAbilityApi(state, api => api.swapControlledAssetFromHand(0, old.id, 0, { trait: 'Tool' })), false)
  const placed = viaAbilityApi(state, api => api.swapControlledAssetFromHand(0, old.id, 1, { trait: 'Tool' }))
  assert.equal(placed.code, '01040')
  assert.deepEqual(inv.assets.map(card => card.id), [placed.id, other.id])
  assert.deepEqual(inv.hand, ['05024', '01030'])
  migrateState(copy(state))
})

test('濒败替换形态清除既有伤恐，读档后按声明阻止治疗', () => {
  const state = fixture()
  const inv = state.investigators[0]
  registerCardAbilities({ code: 'p2-survive-probe', abilities: [{ kind: 'forced', trigger: 'wouldDefeat',
    criteria: ({ inv: actor }) => !actor.form,
    resolve: ({ api, context, seat }) => {
      assert.ok(api.scenario.replaceLethalHarmWithForm(seat, context, { code: '04244', form: 'alternate', healingProhibited: true }))
    } }] })
  asset(state, 'p2-survive-probe')
  applyHarm(state, inv, 10, 0, [], true)
  assert.deepEqual([inv.code, inv.defeated, inv.damage], ['04244', false, 0])
  const saved = copy(state)
  migrateState(saved)
  const actor = saved.investigators[0]
  applyHarm(saved, actor, 1, 0, [], true)
  assert.equal(healDamageFrom(saved, actor, 1, []), 0)
  assert.equal(actor.damage, 1)
  assert.ok(scenarioRuntime(saved, []).restoreInvestigatorForm(0))
  assert.equal(healDamageFrom(saved, actor, 1, []), 1)
})

test('同地点调查员可承接直接给予盟友的伤恐并在读档后完成选择', () => {
  const state = fixture('01001', 2)
  const inv = state.investigators[1]
  const ally = asset(state, '01018')
  assert.equal(inv.location, state.investigators[0].location)
  registerCardAbilities({ code: 'p2-harm-witness', flags: { assignInvestigatorHarmAtLocation: true } })
  inv.code = 'p2-harm-witness'
  const id = 'p2-harm-source'
  state.storyAssets.push({ id, code: id, location: inv.location, name: '测试剧情' })
  registerCardAbilities({ code: id, scope: 'storyAsset', abilities: [{
    kind: 'action', actionKind: 'parley', resolve: ({ api }) => api.scenario.damageAsset(0, ally.id, 1),
  }] })
  const option = legalMoves(state, 0).find(item => item.entityId === id)
  assert.ok(option)
  move(state, option)
  const paused = copy(state)
  assert.equal(paused.pendingChoice.seat, 1)
  migrateState(paused)
  settle(paused, () => '1')
  assert.equal(paused.investigators[1].damage, 1)
  assert.equal(paused.investigators[0].assets.find(item => item.id === ally.id).damage || 0, 0)
})

test('追击区往返保留敌人实体与附属，离场回到来源牌库的独立弃牌区', () => {
  const state = fixture('01002')
  const alias = 'p2-pursuit-enemy'
  registerCardAbilities({ code: alias, enemyRule: { discardToScenarioDeck: 'pursuit' } })
  const foe = enemy(state, { code: alias, health: 2, damageTaken: 1, attachments: [{ id: 'att', code: '01165' }] })
  const api = scenarioRuntime(state, [])
  api.mechanics.scenarioDecks.initialize('pursuit', [], { shuffle: false })
  assert.equal(api.mechanics.enemyZones.enter(foe, 'chase', { clearTokens: false }), foe.id)
  const saved = copy(state)
  migrateState(saved)
  const restoredApi = scenarioRuntime(saved, [])
  const restored = restoredApi.mechanics.enemyZones.restore('chase', foe.id, { location: foe.location || state.investigators[0].location })
  assert.equal(restored.id, foe.id)
  assert.equal(restored.damageTaken, 1)
  assert.equal(restored.attachments[0].id, 'att')
  restoredApi.damageEnemy(foe.id, 1, 0)
  assert.deepEqual(saved.scenarioFlags.mechanics.scenarioDecks.pursuit.discard, [alias])
  assert.equal(saved.encounterDiscard.includes(alias), false)
  migrateState(copy(saved))
})

test('同时有诱饵与陷阱时可先结算陷阱，敌人离场后保留未用诱饵', () => {
  const state = fixture('01002')
  state.scenario.mechanics = normalizeScenarioMechanics({ defenses: true })
  const foe = enemy(state, { health: 2 })
  const api = scenarioRuntime(state, [])
  api.mechanics.defenses.place('decoy', foe.location)
  api.mechanics.defenses.place('trap', foe.location)
  applyLocationDefenses(state, foe, [], { choose: options => {
    assert.deepEqual(options, ['decoy', 'trap'])
    return 'trap'
  }, damage: (item, amount) => api.damageEnemy(item.id, amount, 0), disengage: assert.fail, exhaust: assert.fail })
  assert.equal(state.enemies.includes(foe), false)
  const saved = copy(state)
  migrateState(saved)
  assert.deepEqual(saved.scenarioFlags.mechanics.defenses.decoy, [foe.location])
  assert.deepEqual(saved.scenarioFlags.mechanics.defenses.trap, [])
})

test('轨道多出口选择跨存档保留，计数按比例兑换并可切回普通连通', () => {
  const state = fixture()
  const id = state.investigators[0].location
  const next = 'track-junction'
  state.locations.push({ id: next, name: '岔道', connections: [] })
  const api = scenarioRuntime(state, [])
  api.mechanics.map.place(id, 0, 0)
  api.mechanics.map.place(next, 1, 0)
  api.mechanics.vehicles.register('cart', { location: id, running: true, capacity: 2, driverRequired: false })
  api.mechanics.vehicles.enter(0, 'cart', { setup: true })
  api.mechanics.rail.configure('cart', 'east', { [id]: ['east'], [next]: ['west', 'north', 'south'] })
  assert.equal(api.mechanics.rail.advance(() => 'west'), false)
  assert.equal(state.investigators[0].location, id)
  assert.deepEqual(api.mechanics.rail.advance(options => {
    assert.deepEqual(options, ['north', 'south'])
    return 'south'
  }), { location: next, facing: 'south' })
  api.markers.add('scrap', 5)
  assert.equal(api.mechanics.rail.convertMarkers('scrap', 'switch', { per: 2 }), 2)
  const saved = copy(state)
  migrateState(saved)
  const nextApi = scenarioRuntime(saved, [])
  assert.equal(nextApi.markers.get('scrap'), 1)
  assert.equal(nextApi.markers.get('switch'), 2)
  assert.equal(nextApi.mechanics.rail.end({ adjacency: 'orthogonal' }), true)
  assert.equal(saved.scenarioFlags.mechanics.rail, undefined)
})

test('混合场外牌库从底部抽取遭遇牌，跳过的牌保留且调查员形态可恢复', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const api = scenarioRuntime(state, [])
  const original = [...state.encounterDeck]
  api.mechanics.scenarioDecks.initialize('mixed', ['01001', 'ghoulMinion', '01016'], { shuffle: false })
  api.applyInvestigatorForm(0, { code: '04244', form: 'alternate' })
  const saved = copy(state)
  migrateState(saved)
  const savedApi = scenarioRuntime(saved, [])
  saved.scenario.locations.fixtureNest = { id: 'fixtureNest', code: 'probe-nest', name: '镜巢', shroud: 1, clues: 0, connections: [] }
  assert.equal(savedApi.placeLocationVariant('wrong', { awake: 'probe-nest' }), false)
  assert.equal(savedApi.placeLocationVariant('awake', { awake: 'probe-nest' }), 'fixtureNest')
  assert.equal(savedApi.mechanics.scenarioDecks.drawBottomMatching('mixed', 0, code => code === 'ghoulMinion'), 'ghoulMinion')
  assert.deepEqual(savedApi.mechanics.scenarioDecks.cards('mixed'), ['01016', '01001'])
  assert.deepEqual(saved.encounterDeck, original)
  assert.equal(saved.investigators[0].code, '04244')
  assert.equal(savedApi.restoreInvestigatorForm(0), true)
  assert.equal(saved.investigators[0].code, inv.formOriginal.code)
  migrateState(copy(saved))
})

test('临时购牌折扣用于不同名新购，确认才消耗并在下次开局失效', () => {
  assert.equal(matchesDeckOptions(ALL_CARDS['10009'], ALL_CARDS['04105']), true)
  assert.equal(matchesDeckOptions(ALL_CARDS['10009'], ALL_CARDS['01030']), false)
  assert.equal(matchesDeckOptions(ALL_CARDS['10001'], ALL_CARDS['05024']), true)
  const state = fixture()
  const record = state.campaign.investigators[0]
  record.xp = 40
  state.campaign.phase = 'interlude'
  const offers = availablePurchases(record, state.campaign.records)
  const selected = offers.flatMap(code => replacementOptions(record, code, state.campaign.records)
    .filter(option => option.cost > 0 && cardDef(option.code)?.name !== cardDef(code).name).map(option => ({ ...option, added: code })))[0]
  assert.ok(selected)
  assert.equal(scenarioRuntime(state, []).grantPurchaseDiscount(0, { amount: 2, uses: 2 }), true)
  const saved = copy(state)
  migrateState(saved)
  assert.throws(() => purchaseCard(saved.campaign, 0, selected.added, 'missing'), /非法升级/)
  assert.equal(saved.campaign.investigators[0].purchaseDiscount.uses, 2)
  const purchase = purchaseCard(saved.campaign, 0, selected.added, selected.code)
  assert.equal(purchase.cost, Math.max(0, selected.cost - 2))
  assert.equal(saved.campaign.investigators[0].purchaseDiscount.uses, 1)
  startScenario(saved, 1, [])
  assert.equal(saved.campaign.investigators[0].purchaseDiscount, undefined)
})

test('法典按已付费触发者结算首个合格分支，按幕重开并通过存档校验', () => {
  const state = fixture()
  state.scenario = { ...state.scenario, mechanics: normalizeScenarioMechanics({ codex: [{ id: 'omega', limit: 'act',
    resident: { relationship: 'trust', notes: 'notes', crossedOut: 'gone' },
    branches: [{ id: 'trusted', minRelationship: 2, notes: ['helped'] }, { id: 'ordinary' }] }] }) }
  Object.assign(state.campaign.records, { trust: 2, notes: ['helped'] })
  const api = scenarioRuntime(state, []).mechanics.codex
  assert.equal(api.available('missing'), false)
  assert.throws(() => api.resolve('omega', 7, () => {}), /触发者/)
  assert.throws(() => api.resolve('omega', 0, () => { throw new Error('rollback') }), /rollback/)
  assert.ok(api.available('omega'))
  assert.equal(api.resolve('omega', null, choice => {
    assert.deepEqual(choice, { entry: 'omega', branch: 'trusted', seat: 0 })
    assert.equal(api.available('omega'), false)
  }), true)
  assert.equal(api.resolve('omega', 0, assert.fail), false)
  const saved = copy(state)
  validateMechanicState(saved)
  assert.equal(createMechanicsApi(saved).codex.available('omega'), false)
  saved.actIndex++
  assert.ok(createMechanicsApi(saved).codex.available('omega'))
  saved.campaign.records.gone = true
  assert.equal(createMechanicsApi(saved).codex.available('omega'), false)
  assert.throws(() => normalizeScenarioMechanics({ codex: [{ id: 'bad', branches: [{ id: 'a', notes: ['x'] }] }] }), /居民记录/)
})

test('日期记录跨场可读，局部昼夜由地点特质决定', () => {
  const state = fixture()
  state.scenario = { ...state.scenario, mechanics: normalizeScenarioMechanics({ calendar: { maximumDay: 3, record: 'date', periodByLocationTrait: 'Dark' } }) }
  const api = createMechanicsApi(state).calendar
  assert.equal(api.current(), null)
  assert.throws(() => api.set(4, 'night'), /日期/)
  assert.deepEqual(api.set(2, 'night'), { day: 2, period: 'night' })
  const location = state.locations.find(location => location.id === state.investigators[0].location)
  assert.equal(api.periodAt(location.id), 'day')
  location.traits = ['Dark']
  assert.ok(duringPeriod('night')({ state, source: location }))
  const saved = copy(state)
  validateMechanicState(saved)
  saved.scenarioFlags = {}
  assert.deepEqual(createMechanicsApi(saved).calendar.current(), { day: 2, period: 'night' })
  assert.throws(() => duringPeriod('twilight'), /昼夜/)
})

test('组合祝福诅咒费用不可部分支付，疲劳仅替换不同的数字刻面', () => {
  const state = fixture()
  state.chaosBag = ['bless', 'curse', 'curse', '0', '-1', 'skull']
  const api = createMechanicsApi(state).chaosTokens
  assert.deepEqual(api.rank(['bless', 'curse']), ['bless'])
  assert.equal(api.payMixed({ bless: 2, curse: 2 }), false)
  assert.equal(api.payMixed({ bless: 1, curse: 1 }), true)
  assert.equal(api.replaceNumeric(3, -1), false)
  assert.deepEqual(api.replaceNumeric(2, -1).map(item => item.to).sort(), ['-1', '-2'])
  assert.deepEqual(state.chaosBag, ['curse', '-1', '-2', 'skull'])
  assert.deepEqual(createMechanicsApi(copy(state)).chaosTokens.rank(['bless', 'curse'], { order: 'most' }), ['curse'])
  state.campaign.chaosBag = ['0', 'skull']
  assert.deepEqual(api.replaceCampaignNumeric(1, -1), [{ from: '0', to: '-1' }])
  assert.deepEqual(state.campaign.chaosBag, ['-1', 'skull'])
  assert.deepEqual(state.chaosBag, state.campaign.chaosBag)
})

test('独立猎杀袋揭示后可归还、转移，标记不会触发玩家检定', () => {
  const state = fixture()
  const { tokenBag } = scenarioRuntimeExtras(state)
  tokenBag.create('predation', ['skull', 'skull'])
  assert.equal(tokenBag.reveal('predation'), 'skull')
  assert.equal(tokenBag.transfer('predation', 'skull', 'missing'), false)
  assert.equal(tokenBag.transfer('predation', 'skull'), true)
  assert.equal(tokenBag.transfer('predation', 'skull'), false)
  assert.equal(state.skillTest == null, true)
  assert.deepEqual(state.chaosBag, ['0', 'skull'])
  const saved = copy(state)
  validateMechanicState(saved)
  assert.equal(scenarioRuntimeExtras(saved).tokenBag.info('predation').count, 1)
  saved.tokenBags.predation.tokens.push({ unknown: true })
  assert.throws(() => validateMechanicState(saved), /独立袋标记/)
})

test('支付补给／弹药只能用自己控制的合法来源，非法选择不部分扣费', () => {
  const state = fixture('01001', 2)
  registerCardAbilities({ code: 'p2-supply-probe', assetRule: { shareSuppliesAs: ['ammo', 'supply'] } })
  const target = asset(state, '01016', { uses: 1, usesType: 'ammo' })
  const provider = asset(state, 'p2-supply-probe', { uses: 2, usesType: 'supplies' })
  asset(state, 'p2-supply-probe', { uses: 9, usesType: 'supplies' }, 1)
  assert.equal(availableUseCost(state, target, registeredEntry), 3)
  assert.equal(payUseCost(state, 0, target, 4, registeredEntry, assert.fail), false)
  let call = 0
  assert.equal(payUseCost(state, 0, target, 2, registeredEntry, () => call++ ? '9' : '1'), false)
  assert.deepEqual([target.uses, provider.uses], [1, 2])
  assert.equal(payUseCost(state, 0, target, 2, registeredEntry, () => '1', (actual, count) => {
    assert.equal(actual, provider)
    assert.equal(count, 2)
  }), true)
  assert.deepEqual([target.uses, provider.uses], [1, 0])
  assert.throws(() => registerCardAbilities({ code: 'p2-invalid-supply', assetRule: { shareSuppliesAs: ['secret'] } }), /补给代付/)
})

test('支援线索转移校验归属、特质和容量，真实离场归还地点', () => {
  const state = fixture('01001', 2)
  const inv = state.investigators[0]
  inv.clues = 2
  const item = asset(state, '01016', { traits: ['Tool'] })
  const other = asset(state, '01016', { traits: ['Tool'] }, 1)
  const api = createClueApi(state, [], { syncClues() {} })
  const options = { traits: ['tool'], emptyTarget: true }
  assert.equal(api.transferControlledClues(0, 'investigator', other.id, 1, options), false)
  assert.equal(api.transferControlledClues(0, 'investigator', item.id, 1, options), 1)
  assert.equal(api.transferControlledClues(0, 'investigator', item.id, 1, options), false)
  validateMechanicState(copy(state))
  const location = state.locations.find(loc => loc.id === inv.location)
  const before = location.clues
  leaveAsset(state, inv, item, [])
  assert.equal(location.clues, before + 1)
})

test('巡逻与逃逸由真实敌人阶段和攻击结算触发', () => {
  const state = fixture()
  const from = state.investigators[0].location
  const location = state.locations.find(item => item.id === from)
  const to = 'empty-test-location'
  location.connections = [to]
  state.locations.push({ id: to, name: '测试空地点', connections: [from], traits: ['Cave'], clues: 1 })
  registerCardAbilities({ code: 'p2-elusive-probe', enemyRule: { elusive: true } })
  const fleeing = enemy(state, { code: 'p2-elusive-probe' })
  assert.equal(enemyAttack(state, fleeing, state.investigators[0], []), true)
  assert.equal(fleeing.location, to)
  assert.equal(fleeing.engagedSeat, null)
  assert.equal(fleeing.exhausted, true)
  registerCardAbilities({ code: 'p2-patrol-probe', enemyRule: { patrolTarget: { kind: 'named', locationId: from } } })
  const patrol = enemy(state, { code: 'p2-patrol-probe', location: to, engagedSeat: null })
  enemyPhase(state)
  assert.equal(patrol.location, from)
  assert.throws(() => registerCardAbilities({ code: 'invalid-patrol', enemyRule: { patrolTarget: { kind: 'trait' } } }), /trait/)
})

test('工事在移动管线拦截关键词移动，诱饵阻止当轮重整', () => {
  const state = fixture()
  state.scenario = { ...state.scenario, mechanics: { defenses: true } }
  const from = state.investigators[0].location
  const to = 'defense-test-location'
  state.locations.find(item => item.id === from).connections = [to]
  state.locations.push({ id: to, connections: [from] })
  const actor = enemy(state)
  const api = scenarioRuntime(state, [])
  api.mechanics.barriers.set(from, to, 2)
  assert.equal(api.mechanics.defenses.place('decoy', to), true)
  assert.equal(api.mechanics.defenses.place('decoy', to), false)
  assert.equal(relocateEnemy(state, actor, to, [], { cause: 'patrol' }).blockedBy, 'barrier')
  assert.equal(api.mechanics.barriers.count(from, to), 1)
  assert.equal(relocateEnemy(state, actor, to, [], { cause: 'effect' }).moved, true)
  assert.equal(actor.damageTaken, 1)
  assert.equal(actor.exhausted, true)
  assert.equal(api.readyEnemy(actor), false)
  validateMechanicState(copy(state))
  state.round++
  assert.equal(api.readyEnemy(actor), true)
})

test('网格交换先校验全部坐标，地点实体及在场内容随地点标识保留', () => {
  const state = fixture()
  const first = state.locations[0]
  const second = { id: 'grid-test-location', connections: [], clues: 3 }
  state.locations.push(second)
  const grid = createMechanicsApi(state).map
  grid.place(first.id, 0, 0)
  grid.place(second.id, 1, 0)
  assert.equal(grid.emptyAdjacent(first.id).length, 3)
  assert.equal(grid.relocate([{ id: first.id, x: 1, y: 0 }]), false)
  assert.ok(grid.relocate([{ id: first.id, x: 1, y: 0 }, { id: second.id, x: 0, y: 0 }]))
  assert.equal(second.clues, 3)
  validateMechanicState(copy(state))
})

test('谈判额度不能用于普通行动，来源限制拒绝未知的直接伤害', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.actionsLeft = 0
  grantRestrictedAction(state, inv, 'parley')
  assert.equal(actionsAvailable(inv), 0)
  assert.equal(restrictedKindOfMove(state, inv, { action: 'parley' }), 'parley')
  assert.equal(actionsAvailable(copy(inv), 'parley'), 1)
  consumeAction(inv, 1, 'parley')
  assert.equal(inv.actionsLeft, 0)
  registerCardAbilities({ code: 'p2-harm-probe', enemyRule: { allowedDamageSources: { encounter: true, traits: ['Spell'] } } })
  const target = enemy(state, { code: 'p2-harm-probe' })
  assert.equal(canDamageEnemy(state, target, 0), false)
  assert.equal(canDamageEnemy(state, target, 0, '01165'), true)
})

test('独立遭遇牌库只洗自己的弃牌堆，空牌库不调用主遭遇管线', () => {
  const state = fixture()
  const drawn = []
  const api = createMechanicsApi(state, { drawCard: (seat, code) => drawn.push([seat, code]) }).scenarioDecks
  api.initialize('horde', [], { shuffle: false })
  assert.equal(api.draw('horde', 0, { recycle: true }), null)
  api.discard('horde', 'enemy-test')
  assert.equal(api.draw('horde', 0, { recycle: true }), 'enemy-test')
  assert.deepEqual(drawn, [[0, 'enemy-test']])
  assert.equal(state.encounterDiscard.length, 0)
  validateMechanicState(copy(state))
  const markers = scenarioRuntimeExtras(state).markers
  assert.equal(markers.get('darkness'), 0)
  assert.equal(markers.add('darkness', 2), 2)
  assert.equal(scenarioRuntimeExtras(copy(state)).markers.get('darkness'), 2)
})

test('轨道只连接相对的出口，载具经权威入口移动并在断轨时记录脱轨', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const id = inv.location, next = 'rail-next'
  state.locations.push({ id: next, connections: [] })
  const api = createMechanicsApi(state, { moveInvestigator: (seat, location) => { state.investigators[seat].location = location } })
  api.map.place(id, 0, 0)
  api.map.place(next, 1, 0)
  api.vehicles.register('train', { location: id, running: true, capacity: 2, driverRequired: false })
  api.vehicles.enter(0, 'train', { setup: true })
  assert.throws(() => api.rail.configure('train', 'west', { [id]: ['east'] }), /当前轨道/)
  api.rail.configure('train', 'east', { [id]: ['east'], [next]: ['west', 'north'] })
  assert.equal(api.rail.steer('west'), false)
  assert.deepEqual(api.rail.advance(), { location: next, facing: 'north' })
  assert.equal(inv.location, next)
  assert.deepEqual(api.rail.advance(), { derailed: true })
  assert.equal(api.rail.advance(), false)
  validateMechanicState(copy(state))
})

test('居民记录按范围增减，划除后笔记不可见且不可修改', () => {
  const state = fixture()
  const spec = { level: 'trust', notes: 'notes', crossedOut: 'gone', max: 3 }
  const api = createMechanicsApi(state).residents
  assert.equal(api.change(spec, 8), 3)
  assert.equal(api.note(spec, 'helped'), true)
  assert.equal(api.note(spec, 'helped'), false)
  assert.equal(api.change(spec, -1), 2)
  assert.equal(api.crossOut(spec), true)
  assert.equal(api.change(spec, 1), false)
  assert.deepEqual(createMechanicsApi(copy(state)).residents.status(spec), { crossedOut: true, notes: [], level: 2 })
})

test('渗坑达到阈值翻面，保留线索与遭遇附属并弃掉玩家附属', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const location = state.locations.find(item => item.id === inv.location)
  const encounter = { code: '01165', encounterAttached: true }
  Object.assign(location, { damage: 2, clues: 2, attachments: [encounter, { code: '01088', ownerSeat: 0 }] })
  const face = { code: 'sunken-probe', name: '沉没', shroud: 4, traits: ['Sunken'] }
  const api = scenarioRuntime(state, [])
  assert.equal(api.sinkLocation(location.id, face), false)
  location.damage++
  assert.equal(api.sinkLocation(location.id, face), true)
  assert.equal(location.damage, 0)
  assert.equal(location.clues, 2)
  assert.deepEqual(location.attachments, [encounter])
  assert.deepEqual(inv.discard, ['01088'])
  assert.equal(copy(state).locations.find(item => item.id === location.id).originalCode, face.code)
})

test('首张支援折扣按打出记录与卡种计算，不消费同特质事件', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const trait = { traits: ['Tool'] }
  const entry = code => code === inv.code ? { investigator: { firstAssetOfRound: { trait: 'tool', amount: 1 } } } : null
  const item = { ...trait, type: 'asset' }, event = { ...trait, type: 'event' }
  recordPlayedCard(state, inv, event, entry)
  assert.equal(firstAssetDiscount(state, inv, item, entry), 1)
  recordPlayedCard(state, inv, item, entry)
  assert.equal(firstAssetDiscount(state, copy(inv), item, entry), 0)
  state.round++
  assert.equal(firstAssetDiscount(state, inv, item, entry), 1)
})
