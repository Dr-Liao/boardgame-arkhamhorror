// N4 战役回归（快速部分）：卡池/升级、事务回滚、结局结算、创伤与牌组迁移。
//
// 2026-10-24 P0 拆分：原文件的"连续取消购卡"压测移到 campaign-n4-purchase-stress.test.mjs，
// "1/2/4 人整局合法走子矩阵"移到 campaign-n4-matrix.test.mjs——它们都是 30s+ 的重活用例，
// 拆开后由 node --test 按文件并行，不再串行拖长整个文件；建局/结算样板统一在
// campaign-n4-fixture.mjs。
import test from 'node:test'
import assert from 'node:assert/strict'
import { legalMoves, validateMove } from '../src/engine/engine.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { SCENARIOS } from '../src/cards/scenarios-data.js'
import { CORE_PLAYER_CODES, PLAYER_CARD_CODES, CORE_UPGRADE_CODES, getAvailability } from '../src/deck/availability.js'
import { buildDeckFromList } from '../src/deck/deckbuilding.js'
import { availablePurchases, purchaseCard, upgradeCost, campaignCardChange, updateCampaignStatus } from '../src/campaign/campaign.js'
import { viewState } from '../src/integration/observation.js'
import { resolveTransaction, resolutionCheckpoint } from '../src/engine/resolution.js'
import { RULES_VERSION, STATE_SCHEMA_VERSION } from '../src/engine/rules-state.js'
import { move, answer, settle, game, gatheringConclusion, finishInterlude, clone } from './campaign-n4-fixture.mjs'

test('N4 检查点后续发生异常时整条命令仍原子回滚', () => {
  const state = game()
  const before = clone(state)
  assert.throws(() => resolveTransaction(state, 0, { action: 'test-checkpoint' }, (draft, seat, command) => {
    if (command.action === 'test-checkpoint') {
      draft.investigators[0].resources += 10
      resolutionCheckpoint(draft, seat, { action: 'fail-after-checkpoint' })
    }
    throw new Error('检查点后的异常')
  }), /检查点后的异常/)
  assert.deepEqual(clone(state), before)
})

test('N4 开局固定持久牌组，观察者只见本人无序清单，不见他人牌组和升级明细', () => {
  const state = game('01001', 4)
  assert.equal(state.schemaVersion, STATE_SCHEMA_VERSION)
  assert.equal(state.rulesVersion, RULES_VERSION)
  for (const inv of state.investigators) {
    const record = state.campaign.investigators[inv.seat]
    assert.ok(record.deck.length >= 33)
    assert.deepEqual(record.deck, [...record.deck].sort())
    assert.deepEqual([...inv.hand, ...inv.deck].sort(), record.deck)
    assert.equal(record.id, inv.campaignId)
    assert.equal(record.xp, 0)
  }
  const view = viewState(state, 0)
  assert.deepEqual(view.campaign.investigators[0].deck, state.campaign.investigators[0].deck)
  for (const seat of [1, 2, 3]) {
    assert.equal(view.campaign.investigators[seat].deck, undefined)
    assert.equal(view.campaign.investigators[seat].purchases, undefined)
    assert.equal(view.campaign.investigators[seat].deckSize, state.campaign.investigators[seat].deck.length)
  }
  assert.ok(Object.values(viewState(state).campaign.investigators).every(record => record.deck === undefined))
})

test('N4 集结 R2 队长单独多得1XP，失败和撤退队友仍获共同奖励；关间不能执行普通动作', () => {
  const state = game('01001', 3)
  state.investigators[1].defeated = true
  state.investigators[1].defeatCause = 'horror'
  state.investigators[2].resigned = true
  gatheringConclusion(state)
  assert.equal(state.campaign.phase, 'interlude')
  assert.equal(state.scenario.id, 'theGathering')
  assert.deepEqual(Object.values(state.campaign.investigators).map(record => record.xp), [3, 2, 2])
  assert.equal(state.campaign.trauma[1].mental, 1)
  assert.ok(Object.values(state.campaign.investigators).every(record => !record.deck.includes('01117')))
  assert.match(validateMove(state, 0, { action: 'draw' }), /待决/)
  assert.ok(legalMoves(state).every(command => command.action === 'choose'))
})

test('N4 R1 丽塔由明确选择加入队长牌组，JSON恢复不重复奖励、创伤或剧情卡', () => {
  const state = game()
  const deck = [...state.campaign.investigators[0].deck]
  gatheringConclusion(state, 'r1')
  assert.equal(state.pendingChoice.kind, 'storyCard')
  const restored = clone(state)
  answer(state, '0'); answer(restored, '0')
  assert.deepEqual(clone(state), restored)
  assert.equal(state.pendingChoice.kind, 'interlude')
  assert.equal(state.campaign.investigators[0].xp, 2)
  assert.equal(state.campaign.trauma[0].mental, 1)
  assert.equal(state.campaign.investigators[0].deck.filter(code => code === '01117').length, 1)
  const before = clone(state)
  assert.throws(() => answer(state, '999'), /无效/)
  assert.deepEqual(clone(state), before)
  finishInterlude(state)
  assert.equal(state.scenario.id, 'theMidnightMasks')
  assert.deepEqual([...state.investigators[0].hand, ...state.investigators[0].deck].sort(), [...deck, '01117'].sort())
  assert.equal(state.investigators[0].maxSanity, ALL_CARDS['01001'].sanity)
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.investigators[0].location, 'rivertown')
  assert.equal(state.campaign.scenarioResults.length, 1)
})

test('N4 跨关不重抽基础弱点、不恢复已更换牌组；合法购买只扣一次经验', () => {
  const state = game()
  const original = [...state.campaign.investigators[0].deck]
  gatheringConclusion(state)
  answer(state, 'upgrade')
  answer(state, '01094')
  assert.equal(state.pendingChoice.kind, 'upgradeRemove')
  const hidden = viewState(state)
  assert.deepEqual(hidden.pendingChoice.options, [])
  assert.equal(hidden.pendingChoice.source.code, undefined)
  assert.equal(hidden.pendingChoice.source.cardCode, undefined)
  const removed = state.pendingChoice.options.find(option => option.id !== 'cancel').id
  const restored = clone(state)
  answer(state, removed); answer(restored, removed)
  assert.deepEqual(clone(state), restored)
  const record = state.campaign.investigators[0]
  assert.equal(record.xp, 0)
  assert.equal(record.spentXp, 3)
  assert.equal(record.purchases.length, 1)
  assert.equal(record.deck.length, original.length)
  const expected = [...original]
  expected.splice(expected.indexOf(removed), 1, '01094')
  finishInterlude(state)
  assert.deepEqual([...state.investigators[0].hand, ...state.investigators[0].deck].sort(), expected.sort())
  assert.deepEqual(state.campaign.investigators[0].deck, expected)
  assert.equal(state.investigators[0].resources, 5)
  assert.equal(state.investigators[0].actionsLeft, 3)
  assert.equal(state.round, 1)
})

test('N4 Core 升级池只在关间开放，非法卡/签名/弱点/剧情/超量与XP不足均拒绝', () => {
  const state = game()
  const cp = state.campaign
  const record = cp.investigators[0]
  const removed = record.deck.find(code => CORE_PLAYER_CODES.includes(code))
  assert.throws(() => purchaseCard(cp, 0, '01094', removed), /关间/)
  cp.phase = 'interlude'
  assert.throws(() => purchaseCard(cp, 0, '01094', removed), /非法/)
  record.xp = 10
  assert.ok(availablePurchases(record).includes('01094'))
  for (const added of ['02001', '01006', '01096', '01117', '__proto__']) {
    const before = clone(cp)
    assert.throws(() => purchaseCard(cp, 0, added, removed), /非法/)
    assert.deepEqual(clone(cp), before)
  }
  for (const code of record.deck.filter(code => !PLAYER_CARD_CODES.includes(code))) {
    assert.throws(() => purchaseCard(cp, 0, '01094', code), /非法/)
  }
  purchaseCard(cp, 0, '01094', removed)
  purchaseCard(cp, 0, '01094', record.deck.find(code => CORE_PLAYER_CODES.includes(code)))
  assert.throws(() => purchaseCard(cp, 0, '01094', record.deck.find(code => CORE_PLAYER_CODES.includes(code))), /非法/)
  assert.deepEqual(CORE_UPGRADE_CODES, ['01026', '01027', '01028', '01029', '01040', '01041', '01042', '01043', '01054', '01055', '01056', '01057', '01068', '01069', '01070', '01071', '01082', '01083', '01084', '01085', '01094', '01095'])
  assert.ok(CORE_UPGRADE_CODES.every(code => getAvailability(code).upgradeOnly && getAvailability(code).strictAccepted))
  const players = state.campaign.investigators[0].deck.filter(code => CORE_PLAYER_CODES.includes(code))
  for (const code of CORE_UPGRADE_CODES) assert.ok(buildDeckFromList(ALL_CARDS['01001'], [code, ...players.slice(0, 29)], { xpBudget: 99 }).errors.length)
})

test('N4 新购0级至少1XP，同名升级只付差价，不同名全价且不退旧卡XP', () => {
  assert.equal(upgradeCost({ name: 'A', xp: 0 }, { name: 'B', xp: 4 }), 1)
  assert.equal(upgradeCost({ name: 'A', xp: 3 }, { name: 'A', xp: 1 }), 2)
  assert.equal(upgradeCost({ name: 'A', xp: 3 }, { name: 'B', xp: 2 }), 3)
  const state = game()
  state.campaign.phase = 'interlude'
  const record = state.campaign.investigators[0]
  record.xp = 1
  const added = availablePurchases(record)[0]
  assert.ok(added)
  const removed = record.deck.find(code => CORE_PLAYER_CODES.includes(code) && code !== added)
  purchaseCard(state.campaign, 0, added, removed)
  assert.equal(record.xp, 0)
})

test('N4 结局重新核对地点残留线索，不把曾经清空的地点提前计入XP', () => {
  const state = game()
  state.locations.push({ ...SCENARIOS.theGathering.locations.attic, revealed: true, clues: 1, victoryAwarded: true })
  state.victory = 99
  gatheringConclusion(state)
  assert.equal(state.victory, 0)
  assert.equal(state.campaign.investigators[0].xp, 3)
  assert.equal(state.campaign.scenarioResults[0].victory, 0)
})

test('N4 掩盖罪证剩余线索导致精神创伤，清空计数则不产生创伤', () => {
  for (const counters of [0, 1]) {
    const state = game()
    state.investigators[0].threat = [{ id: 'cover-up', code: '01007', counters }]
    gatheringConclusion(state)
    assert.equal(state.campaign.trauma[0].mental, counters ? 1 : 0)
  }
})

test('N4 创伤达到印刷上限后更换独立人物，不继承旧牌组XP或创伤，旧人物不可再选', () => {
  const state = game()
  const cp = state.campaign
  const original = clone(cp.investigators[0])
  cp.trauma[0].physical = ALL_CARDS['01001'].health
  updateCampaignStatus(cp, 0)
  gatheringConclusion(state)
  assert.equal(state.pendingChoice.kind, 'replacement')
  assert.ok(!state.pendingChoice.options.some(option => option.id === '01001'))
  const restored = clone(state)
  answer(state, '01002'); answer(restored, '01002')
  assert.deepEqual(clone(state), restored)
  const current = state.campaign.investigators[0]
  assert.notEqual(current.id, original.id)
  assert.equal(current.code, '01002')
  assert.equal(current.xp, 0)
  assert.deepEqual(current.trauma, { physical: 0, mental: 0 })
  assert.ok(current.deck.includes('01008') && !current.deck.includes('01006'))
  assert.equal(state.campaign.retired[0].id, original.id)
  finishInterlude(state)
  assert.equal(state.investigators[0].code, '01002')
  assert.equal(state.investigators[0].damage, 0)
})

test('N4 集结R3杀死未撤退者，不授予XP；幸存者可收留丽塔并替换死亡队长', () => {
  const state = game('01001', 2)
  state.agendaIndex = 2
  state.doom = SCENARIOS.theGathering.agendas[2].doomThreshold - 1
  state.investigators[1].resigned = true
  state.investigators[0].deck = ['01088']
  state.investigators[0].hand = []
  const oldId = state.campaign.investigators[0].id
  move(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice.kind, 'storyCard')
  assert.equal(state.pendingChoice.seat, 1)
  assert.deepEqual(state.pendingChoice.options.map(option => option.id), ['skip', '1'])
  answer(state, '1')
  assert.equal(state.pendingChoice.kind, 'replacement')
  const replacement = state.pendingChoice.options[0].id
  answer(state, replacement)
  assert.equal(state.campaign.retired[0].status, 'killed')
  assert.equal(state.campaign.retired[0].id, oldId)
  assert.ok(state.campaign.investigators[1].deck.includes('01117'))
  assert.ok(Object.values(state.campaign.investigators).every(record => record.xp === 0))
  assert.equal(state.campaign.scenarioResults[0].resolution, 'r3')
  assert.equal(state.campaign.scenarioResults[0].investigators[0].status, 'killed')
  finishInterlude(state)
  assert.equal(state.scenario.id, 'theMidnightMasks')
  assert.equal(state.campaign.records.ghoulPriestAlive, true)
})

test('N4 同次伤害恐惧同时击败时显式选择一种创伤，不自动双罚', () => {
  const state = game()
  const inv = state.investigators[0]
  inv.hand = []
  inv.damage = inv.maxHealth - 1
  inv.horror = inv.maxSanity - 1
  state.enemies = [{ id: 'both', code: 'ghoulMinion', name: '双重败退测试', location: inv.location,
    engagedSeat: 0, damage: 1, horror: 1, health: 10, fight: 1, evade: 1, damageTaken: 0 }]
  inv.engaged = ['both']
  move(state, { action: 'resource' })
  assert.equal(state.pendingChoice.kind, 'trauma')
  const restored = clone(state)
  answer(state, 'mental'); answer(restored, 'mental')
  assert.deepEqual(clone(state), restored)
  settle(state, 'interlude')
  assert.deepEqual(state.campaign.trauma[0], { physical: 0, mental: 1 })
  finishInterlude(state)
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.investigators[0].damage, 0)
})

test('N4 跨关牌组变化区分本关移除与永久移除；疯狂弱点允许多张', () => {
  const state = game()
  const cp = state.campaign
  campaignCardChange(cp, 0, '01117', 'add', 'test')
  campaignCardChange(cp, 0, '01117', 'add', 'test')
  assert.equal(cp.investigators[0].deck.filter(code => code === '01117').length, 1)
  campaignCardChange(cp, 0, '01117', 'remove', 'sacrifice')
  assert.ok(!cp.investigators[0].deck.includes('01117'))
  assert.equal(cp.investigators[0].removedCards[0].reason, 'sacrifice')
  campaignCardChange(cp, 0, '01096', 'add', 'madness')
  campaignCardChange(cp, 0, '01096', 'add', 'madness')
  assert.ok(cp.investigators[0].deck.filter(code => code === '01096').length >= 2)
  state.exiled = ['01088']
  const persistent = [...cp.investigators[0].deck]
  gatheringConclusion(state)
  finishInterlude(state)
  assert.deepEqual(state.campaign.investigators[0].deck, persistent)
  assert.deepEqual(state.exiled, [])
})

test('N4 午夜已至在下关换牌后随机弃两张，不补抽且可确定性恢复', () => {
  const state = game()
  gatheringConclusion(state)
  finishInterlude(state)
  state.agendaIndex = 1
  state.doom = SCENARIOS.theMidnightMasks.agendas[1].doomThreshold - 1
  state.enemies = []
  state.investigators[0].hand = []
  move(state, { action: 'endTurn' })
  settle(state, 'interlude')
  assert.equal(state.campaign.records.pastMidnight, true)
  settle(state, 'mulligan')
  const restored = clone(state)
  answer(state, 'done'); answer(restored, 'done')
  assert.deepEqual(clone(state), restored)
  assert.equal(state.scenario.id, 'theDevourerBelow')
  assert.equal(state.investigators[0].hand.length, 3)
  assert.equal(state.investigators[0].discard.length, 2)
  assert.equal(state.investigators[0].resources, 5)
  assert.equal(state.round, 1)
  assert.equal(state.campaign.scenarioResults.length, 2)
})

for (const code of ['01094', '01095']) test(`N4 ${code} 以资产自身容量承伤，不提高调查员上限`, () => {
  const state = game()
  const inv = state.investigators[0]
  inv.hand = [code]
  move(state, { action: 'play', cardId: code })
  assert.equal(state.investigators[0].maxHealth, ALL_CARDS['01001'].health)
  assert.equal(state.investigators[0].maxSanity, ALL_CARDS['01001'].sanity)
  const asset = state.investigators[0].assets[0]
  const horror = code === '01095'
  state.enemies = [{ id: 'harm-enemy', code: 'ghoulMinion', name: '容量测试敌人', location: inv.location,
    engagedSeat: 0, health: 10, fight: 1, evade: 1, damageTaken: 0, damage: horror ? 0 : 4, horror: horror ? 4 : 0 }]
  state.investigators[0].engaged = ['harm-enemy']
  move(state, { action: 'resource' })
  for (let i = 0; i < 4; i++) {
    assert.equal(state.pendingChoice.kind, horror ? 'assign-horror' : 'assign-damage')
    answer(state, asset.id)
  }
  assert.ok(!state.investigators[0].assets.some(item => item.id === asset.id))
  assert.ok(state.investigators[0].discard.includes(code))
  assert.equal(state.investigators[0].damage, 0)
  assert.equal(state.investigators[0].horror, 0)
})

// 「1/2/4 人整局合法走子矩阵」拆到 campaign-n4-matrix.test.mjs；
// 「连续取消购卡压测」拆到 campaign-n4-purchase-stress.test.mjs。

