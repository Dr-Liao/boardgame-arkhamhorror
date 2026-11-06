import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, enemy, move, settle, legalMoves, validateMove } from './core-fixture.mjs'
import {
  buildExplorationDeck, addToExplorationDeck, doExplore,
  grantSupplies, crossOffSupply, checkSupplies, suppliesAtLocation,
  vengeancePoints, recordVengeance,
  isPoisoned, poisonInvestigator,
  yigsFury, addYigsFury,
  expeditionLeaderSeat, setExpeditionLeader,
  moveRelicOfAges, relicOfAges, relicOfAgesLocation,
  applyMove, createGameState, finishScenario, startScenario,
} from '../src/engine/engine.js'
import { supportedMechanics, missingMechanics } from '../content/mechanics.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { contentRegistry } from '../content/registered.js'

const me = state => state.investigators[0]
const TFA_MECHANICS = ['tfaExploration', 'tfaSupplies', 'tfaVengeance', 'tfaYigsFury',
  'tfaPoisoned', 'tfaRelicOfAges', 'tfaExpeditionLeader']

test('M3-A registers all seven Forgotten Age mechanics', () => {
  for (const id of TFA_MECHANICS) {
    assert.equal(supportedMechanics.has(id), true, id)
  }
  assert.deepEqual(missingMechanics(TFA_MECHANICS), [])
  // 目录数据不会自行新增机制。
  assert.deepEqual(missingMechanics(['tfaUnregistered']), ['tfaUnregistered'])
})

test('M3-A builds an exploration deck deterministically and without duplicates', () => {
  const build = seed => {
    const state = fixture('01001', 1, { seed })
    buildExplorationDeck(state, ['hallway', 'cellar', 'attic', 'hallway', 'parlor'])
    return state.explorationDeck
  }
  const first = build('tfa-explore')
  const again = build('tfa-explore')
  assert.deepEqual(first, again)
  assert.equal(first.length, 4, '重复编号只登记一次')
  assert.deepEqual([...first].sort(), ['attic', 'cellar', 'hallway', 'parlor'])
  const other = build('tfa-explore-2')
  assert.notDeepEqual(first, other, '不同种子给出不同顺序')
})

test('M3-A explore places a scenario location, connects it and moves the explorer', () => {
  const state = fixture('01001')
  buildExplorationDeck(state, ['hallway'])
  assert.equal(legalMoves(state).filter(option => option.action === 'explore').length, 1)
  move(state, { action: 'explore' })
  settle(state)
  const placed = state.locations.find(location => location.id === 'hallway')
  assert.ok(placed, '探索地点进入游戏')
  assert.equal(placed.revealed, true)
  assert.ok(placed.connections.includes('study'), '与出发地点相连')
  assert.ok(state.locations.find(location => location.id === 'study').connections.includes('hallway'))
  assert.equal(me(state).location, 'hallway')
  assert.equal(state.explorationDeck.length, 0)
  assert.notEqual(validateMove(state, 0, { action: 'explore' }), null, '牌库为空时不能探索')
})

test('M3-A explore resolves an enemy and a treachery through the encounter path', () => {
  const enemyState = fixture('01001')
  buildExplorationDeck(enemyState, ['ghoulMinion'])
  move(enemyState, { action: 'explore' })
  settle(enemyState)
  const spawned = enemyState.enemies.find(item => item.code === 'ghoulMinion')
  assert.ok(spawned, '敌人从探索牌库生成')
  assert.equal(spawned.engagedSeat, 0)

  const treacheryState = fixture('01001')
  buildExplorationDeck(treacheryState, ['dissonantVoices'])
  const before = me(treacheryState).threat.length
  move(treacheryState, { action: 'explore' })
  settle(treacheryState)
  assert.equal(me(treacheryState).threat.length, before + 1, '诡计按遭遇结算进入威胁区域')
  assert.equal(treacheryState.encounterDiscard.includes('dissonantVoices'), false)
})

test('M3-A exploration deck survives JSON round-trips without changing order', () => {
  const state = fixture('01001')
  buildExplorationDeck(state, ['hallway', 'cellar', 'attic'])
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.explorationDeck, state.explorationDeck)
  const restoreOrder = JSON.parse(JSON.stringify(restored))
  doExplore(restored, 0, [])
  doExplore(restoreOrder, 0, [])
  assert.deepEqual(restored, restoreOrder, '同序恢复后探索结果一致')
  assert.equal(addToExplorationDeck(state, ['parlor']), 4)
})

test('M3-A supplies are recorded per investigator and checked at a location', () => {
  const state = fixture('01001', 2)
  grantSupplies(state, 0, ['rope', 'torches'])
  grantSupplies(state, 0, ['rope'])
  assert.deepEqual(state.campaign.supplies[0], ['rope', 'torches'], '重复授予不叠加')
  assert.equal(checkSupplies(state, me(state), 'rope'), true)
  assert.equal(checkSupplies(state, me(state), 'map'), false)
  // 同地点队友的补给也算通过；离开后不再算。
  grantSupplies(state, 1, ['map'])
  assert.equal(checkSupplies(state, me(state), 'map'), true)
  assert.deepEqual(suppliesAtLocation(state, me(state).location).map(entry => entry.seat).sort(), [0, 1])
  state.investigators[1].location = 'attic'
  assert.equal(checkSupplies(state, me(state), 'map'), false)
  assert.equal(crossOffSupply(state, 0, 'rope'), true)
  assert.equal(crossOffSupply(state, 0, 'rope'), false)
  assert.deepEqual(state.campaign.supplies[0], ['torches'])
})

test('M3-A vengeance counts cards in the victory display', () => {
  const state = fixture('01001')
  const target = enemy(state, { id: 'vengeful', fight: 0, evade: 0, health: 1, victory: 0, vengeance: 2 })
  assert.equal(vengeancePoints(state), 0)
  state.chaosBag = ['0']
  move(state, { action: 'fight', enemyId: target.id })
  settle(state)
  assert.equal(state.enemies.some(item => item.id === target.id), false, '敌人被击败')
  assert.equal(vengeancePoints(state), 2)
  assert.equal(recordVengeance(state, 3, { code: '04191' }), 5)
  assert.equal(vengeancePoints(state), 5)
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(vengeancePoints(restored), 5, '复仇点数随存档保留')
  assert.equal(recordVengeance(state, 0), 5)
})

test("M3-A Yig's Fury is a clamped numeric campaign record", () => {
  const state = fixture('01001')
  assert.equal(yigsFury(state), 0)
  assert.equal(addYigsFury(state, 3), 3)
  assert.equal(state.campaign.records.yigsFury, 3)
  assert.equal(addYigsFury(state, -10), 0, '不会为负')
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(yigsFury(restored), 0)
})

test('M3-A poison puts the permanent Poisoned weakness into the threat area once', () => {
  const state = fixture('01001')
  assert.equal(isPoisoned(me(state)), false)
  assert.equal(poisonInvestigator(state, 0), true)
  assert.equal(isPoisoned(me(state)), true)
  assert.equal(ALL_CARDS['04102'].nameZh, '中毒')
  assert.ok(me(state).threat.some(card => card.code === '04102'))
  const record = state.campaign.investigators[0]
  assert.deepEqual(record.deck.filter(code => code === '04102'), ['04102'],
    '永久弱点同时写入战役牌组记录')
  assert.equal(poisonInvestigator(state, 0), false, '同一调查员只中毒一次')
  assert.equal(record.deck.filter(code => code === '04102').length, 1, '重复调用不会再写第二张')
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(isPoisoned(restored.investigators[0]), true, '中毒状态随存档保留')
  assert.equal(restored.campaign.investigators[0].deck.filter(code => code === '04102').length, 1,
    '牌组中的中毒弱点随存档保留')
})

// 回归：中毒必须永久进入战役牌组记录，下一关按记录重建牌组时以永久卡开局入场。
// 口径 = 参考实现 becomePoisoned（createWeaknessInThreatArea + addCampaignCardToDeck DoNotShuffleIn）。
test('M3-A poison persists in the campaign deck and is in play at the next scenario', () => {
  const state = createGameState(
    { campaignId: 'theForgottenAge', campaignHub: true, seed: 'tfa-poison-persist' },
    [{ seat: 0, role: 'human' }])
  const scenarioIds = contentRegistry.getCampaign('theForgottenAge').scenarioIds
  startScenario(state, scenarioIds.indexOf('theUntamedWilds'), [])
  settleTfaChoices(state)
  assert.equal(isPoisoned(state.investigators[0]), false, '第一关开局未中毒')
  assert.equal(poisonInvestigator(state, 0, []), true)
  const record = state.campaign.investigators[0]
  assert.ok(record.deck.includes('04102'), '中毒弱点写入战役牌组记录')

  // 下一关：按战役记录重建牌组，永久卡开局进入威胁区域。
  startScenario(state, scenarioIds.indexOf('theDoomOfEztli'), [])
  settleTfaChoices(state)
  assert.equal(isPoisoned(state.investigators[0]), true, '下一关开局即处于中毒状态')
  assert.ok(state.investigators[0].threat.some(card => card.code === '04102'), '中毒弱点在威胁区域')
  assert.equal(state.campaign.investigators[0].deck.filter(code => code === '04102').length, 1,
    '战役记录只保留一张中毒弱点')
  assert.equal((state.scenarioZones.setAside || []).filter(code => code === '04102').length, 3,
    '已在牌组里的中毒弱点不再放在一边（4 张里只剩 3 张）')
})

// 兼容旧存档（更新前「中毒只进威胁区」）：关末把威胁区里的永久弱点补记进战役牌组，
// 否则旧存档跨关后中毒仍会丢失（canonical 修复点在 campaign-plugin#poisonInvestigator）。
test('M3-A legacy save: poison in the threat area is persisted to the campaign deck at scenario end', () => {
  const state = createGameState(
    { campaignId: 'theForgottenAge', campaignHub: true, seed: 'tfa-legacy-poison' },
    [{ seat: 0, role: 'human' }])
  const scenarioIds = contentRegistry.getCampaign('theForgottenAge').scenarioIds
  startScenario(state, scenarioIds.indexOf('theUntamedWilds'), [])
  settleTfaChoices(state)
  state.investigators[0].threat.push({ id: 'legacy-poison', code: '04102', originalCode: '04102', permanent: true })
  const record = state.campaign.investigators[0]
  assert.equal(record.deck.includes('04102'), false, '旧存档的战役牌组里还没有中毒弱点')
  assert.throws(() => finishScenario(state, 'noResolution', []),
    error => error?.constructor?.name === 'ScenarioEnded')
  assert.equal(record.deck.filter(code => code === '04102').length, 1,
    '关末把威胁区的中毒弱点补记进战役牌组（只记一张）')
})

function settleTfaChoices(state, limit = 300) {
  for (let guard = 0; state.pendingChoice && guard < limit; guard++) {
    const pending = state.pendingChoice
    const optionId = ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
}

test('M3-A Relic of Ages follows its bearer and can be placed at a location', () => {
  const state = fixture('01001')
  assert.equal(relicOfAges(state), null)
  moveRelicOfAges(state, { seat: 0 })
  assert.equal(relicOfAges(state).seat, 0)
  assert.equal(relicOfAgesLocation(state), me(state).location)
  state.locations.push({ id: 'attic', name: '阁楼', revealed: true, clues: 0, maxClues: 0, shroud: 1,
    connections: [me(state).location] })
  state.locations.find(location => location.id === me(state).location).connections.push('attic')
  move(state, { action: 'move', locationId: 'attic' })
  settle(state)
  assert.equal(relicOfAgesLocation(state), 'attic', '携带者移动后遗物跟随')
  moveRelicOfAges(state, { location: 'study' })
  assert.equal(relicOfAgesLocation(state), 'study')
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(relicOfAges(restored), relicOfAges(state))
})

test('M3-A expedition leader defaults to the campaign lead and can be reassigned', () => {
  const state = fixture('01001', 2)
  const seat = expeditionLeaderSeat(state)
  assert.ok([0, 1].includes(seat))
  assert.equal(setExpeditionLeader(state, 1), 1)
  assert.equal(expeditionLeaderSeat(state), 1)
  assert.equal(state.campaign.expeditionLeader, 1)
  assert.equal(setExpeditionLeader(state, 9), null, '未入场的座位不能担任领队')
  assert.equal(expeditionLeaderSeat(state), 1)
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(expeditionLeaderSeat(restored), 1, '领队随存档保留')
})
