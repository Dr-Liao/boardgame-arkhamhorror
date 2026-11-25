import test from 'node:test'
import assert from 'node:assert/strict'
import { registerContentBundle } from '../content/registered.js'
import { manifest as tfaCampaignPack } from '../content/packs/tfaCampaign/manifest.js'
import { manifest as campaignManifest } from '../content/campaigns/theForgottenAge/manifest.js'
import * as wilds from '../content/campaigns/theForgottenAge/scenarios/theUntamedWilds/index.js'
import * as eztli from '../content/campaigns/theForgottenAge/scenarios/theDoomOfEztli/index.js'
import * as fate from '../content/campaigns/theForgottenAge/scenarios/threadsOfFate/index.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import {
  actRuleFor, agendaRuleFor, locationRuleFor, enemyRuleFor, enemyScriptFor, enemySpawnRuleFor,
  enemyStatRuleFor, vengeanceWhileFor, scenarioPlayableFor, isPoisonThreat, poisonWeaknessCode,
  relicDiscountLocation, investigateExtraActionsFor, storyCardCode,
} from '../src/cards/card-rules.js'
import { registeredEntry } from '../src/engine/ability.js'
import { entityRuleActive, entityModifierTotal } from '../src/engine/modifiers.js'
import { encounterRules } from '../content/campaigns/theForgottenAge/encounter-rules.js'
import { tfaChaosToken, tfaChaosAfterTest } from '../content/campaigns/theForgottenAge/tfa-chaos.js'
import {
  createGameState, applyMove, legalMoves, validateMove, placeLocation, spawnEnemy, getStat,
  getMaxHealth, enemyFightValue, enemyEvadeValue, scenarioRuntime, canDiscoverClueAt,
  discoverClueAt, poisonInvestigator,
} from '../src/engine/engine.js'
import { locationAttachmentTotal } from '../src/engine/location-attachments.js'

// ---------------------------------------------------------------------------
// 验收测试装置：把三个 04 段剧本克隆成 playable 的验收战役，通过真实引擎
// createGameState 布置。额外注入「验收抽遭遇」场景行动，让任意遭遇卡都能在
// 真实的 drawEncounter → 结算 → 选择 流程里被执行。
// ---------------------------------------------------------------------------
const CHAPTERS = { theUntamedWilds: wilds, theDoomOfEztli: eztli, threadsOfFate: fate }
const PACK_ID = 'tfaAcceptance04aPack'
const CASES = Object.keys(CHAPTERS).map(id => ({ id, campaignId: `tfaAcceptance04a-${id}`, scenarioId: `tfaAcceptance04a-${id}` }))
registerContentBundle({
  packs: [{ ...tfaCampaignPack, id: PACK_ID, status: 'playable' }],
  campaigns: CASES.map(({ id, campaignId, scenarioId }) => ({
    ...campaignManifest,
    id: campaignId,
    name: `失落的时代（04-a 验收：${id}）`,
    status: 'playable',
    scenarioIds: [scenarioId],
    unlock: { [scenarioId]: [] },
    requiredPackIds: ['core', PACK_ID],
    flow: { start: scenarioId, nodes: { [scenarioId]: { type: 'scenario', scenarioId, next: 'end' }, end: { type: 'end' } } },
  })),
  scenarios: CASES.map(({ id, campaignId, scenarioId }) => ({
    scenario: { ...CHAPTERS[id].scenario, id: scenarioId },
    behavior: {
      ...CHAPTERS[id].behavior,
      id: scenarioId,
      actions(state, inv) {
        return [...(CHAPTERS[id].behavior.actions?.(state, inv) || []),
          { action: 'scenarioAction', rule: 'acceptanceEncounter', actions: 0, label: '验收：抽 1 张遭遇' }]
      },
      performAction(state, inv, move, api) {
        if (move.rule === 'acceptanceEncounter') return api.drawEncounter(inv.seat)
        return CHAPTERS[id].behavior.performAction?.(state, inv, move, api)
      },
    },
    manifest: {
      ...Object.fromEntries(Object.entries(CHAPTERS[id].manifest)
        .filter(([key]) => !['catalogReferenceOnly', 'referenceCode'].includes(key))),
      id: scenarioId,
      campaignId,
      status: 'playable',
      name: CHAPTERS[id].scenario.name,
      requiredPackIds: [...new Set([...CHAPTERS[id].manifest.requiredPackIds
        .map(value => (value === 'tfaCampaign' ? PACK_ID : value)), PACK_ID])],
      requiredEncounterGroupIds: [],
      behaviorIds: [scenarioId],
    },
  })),
})

const clone = value => structuredClone(value)
let sequence = 0

function settle(state, choose = null) {
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 400, '选择循环未收敛')
    const pending = state.pendingChoice
    const optionId = (choose && choose(pending))
      || pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
}

function boot(chapter, players = 1, seed = `tfa-04a-${chapter}-${players}`) {
  const state = createGameState({ campaignId: `tfaAcceptance04a-${chapter}`, seed, playerInvestigator: '01001' },
    Array.from({ length: players }, (_, seat) => ({ seat })))
  settle(state)
  for (const inv of state.investigators) {
    inv.actionsLeft = 4
    inv.resources = 10
    inv.deck = Array(20).fill('01020')
    inv.threat ||= []
    inv.assets ||= []
    inv.hand ||= []
  }
  state.chaosBag = ['0']
  return state
}

function place(state, id, seat = null) {
  placeLocation(state, id, [], seat)
  return state.locations.find(location => location.id === id)
}

function spawnTestEnemy(state, code, location) {
  const def = state.scenario?.enemies?.[code] || {}
  const enemy = {
    ...clone(def), id: `enemy-${code}-${++sequence}`, code, originalCode: code,
    location, damageTaken: 0, doom: 0, exhausted: false, engagedSeat: null,
  }
  state.enemies.push(enemy)
  return enemy
}

function testApi(state, overrides = {}) {
  const log = []
  const calls = []
  const base = {
    log,
    calls,
    info: text => log.push(text),
    random: () => 0.5,
    choose: request => {
      calls.push({ kind: 'choose', request })
      return request?.options?.[0]?.id ?? '0'
    },
    test: (seat, skill, difficulty, resolve) => {
      calls.push({ kind: 'test', seat, skill, difficulty })
      resolve({ success: true, value: difficulty, difficulty, skill, drawn: [] })
    },
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    directDamage: (seat, amount) => { state.investigators[seat].damage += amount },
    healDamage: (seat, amount) => { state.investigators[seat].damage = Math.max(0, state.investigators[seat].damage - amount) },
    gainClues: (seat, amount) => { state.investigators[seat].clues += amount },
    loseResources: (seat, amount) => { state.investigators[seat].resources = Math.max(0, state.investigators[seat].resources - amount) },
    drawCards: (seat, amount) => { for (let i = 0; i < amount; i++) state.investigators[seat].hand.push('01020') },
    discardChosen: (seat, amount) => { for (let i = 0; i < amount; i++) state.investigators[seat].hand.pop() },
    discardTop: (seat, amount) => { for (let i = 0; i < amount && state.investigators[seat].deck.length; i++) state.investigators[seat].discard.push(state.investigators[seat].deck.pop()) },
    drawEncounter: seat => { calls.push({ kind: 'drawEncounter', seat }) },
    defeat: inv => { inv.defeated = true },
    resign: seat => { state.investigators[seat].resigned = true },
    trauma: (seat, kind, amount) => {
      const inv = state.investigators[seat]
      inv.trauma ||= {}
      inv.trauma[kind] = (inv.trauma[kind] || 0) + amount
    },
    advanceAct: () => { calls.push({ kind: 'advanceAct' }); state.advanced = (state.advanced || 0) + 1 },
    finish: key => { calls.push({ kind: 'finish', key }); state.finished = key },
    spawn: (code, location) => { const enemy = spawnTestEnemy(state, code, location); calls.push({ kind: 'spawn', code, location }); return enemy },
    giveAsset: (seat, code) => { state.investigators[seat].assets.push({ id: `asset-${code}-${++sequence}`, code, originalCode: code, exhausted: false }); calls.push({ kind: 'giveAsset', seat, code }) },
    checkSupplies: (seat, name) => (state.campaign?.supplies?.[seat] || []).includes(name),
    hasSupply: (seat, name) => (state.campaign?.supplies?.[seat] || []).includes(name),
    shuffleDiscard: () => {
      state.encounterDeck = [...(state.encounterDeck || []), ...(state.encounterDiscard || [])]
      state.encounterDiscard = []
    },
    shuffleEncounterDeck: () => {},
    attachToLocation: (locationId, fields = {}) => {
      const location = state.locations.find(entry => entry.id === locationId)
      if (!location) return null
      location.attachments ||= []
      const attachment = { id: `attachment-${++sequence}`, location: locationId, ...fields, ...(fields.extra || {}) }
      location.attachments.push(attachment)
      return attachment
    },
    threat: (seat, code, extra = {}) => {
      const card = { id: `threat-${code}-${++sequence}`, code, originalCode: code, ...extra }
      state.investigators[seat].threat.push(card)
      return card
    },
    addInvestigatorTrait: (seat, trait) => {
      const owner = state.investigators[seat]
      owner.traits = [...new Set([...(owner.traits || []), String(trait)])]
      return true
    },
    poison: seat => {
      const inv = state.investigators[seat]
      if ((inv.threat || []).some(card => (card.originalCode || card.code) === '04102')) return false
      inv.threat.push({ id: `poison-${++sequence}`, code: '04102', originalCode: '04102' })
      return true
    },
    attack: (enemy, inv) => { calls.push({ kind: 'attack', enemyId: enemy.id, seat: inv.seat }) },
    moveInvestigator: (seat, location) => { state.investigators[seat].location = location },
    loseActions: (seat, amount) => { state.investigators[seat].actionsLeft = Math.max(0, (state.investigators[seat].actionsLeft || 0) - amount) },
    endTurn: seat => { calls.push({ kind: 'endTurn', seat }) },
    addDoom: amount => { state.doom = (state.doom || 0) + amount },
  }
  return Object.assign(base, overrides)
}

// 直接事件卡抽取：把指定卡放在遭遇牌库顶，走验收行动 + 真实遭遇结算。
function drawEncounterCard(state, code, choose = null) {
  state.encounterDeck = [code]
  state.encounterDiscard = []
  const move = legalMoves(state, 0).find(candidate => candidate.rule === 'acceptanceEncounter')
  assert.ok(move, '验收抽遭遇行动必须存在')
  applyMove(state, 0, move)
  settle(state, choose)
}

// ===========================================================================
// 03 · 雨林 / 蛇族 / 远征 / 守卫者 / 时间洪流 / 遗迹 / 毒液等共享遭遇卡
//      （04069–04102）
// ===========================================================================
test('TFA 04069 荆棘之路：调查失败与探索失败各受 1 点伤害', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  const location = place(state, 'pathOfThorns')
  inv.location = location.id
  const rule = locationRuleFor('04069')
  rule.afterTest({ state, inv, result: { success: false, source: { label: '调查' } }, api: testApi(state) })
  assert.equal(inv.damage, 1)
  rule.afterExploreFailure({ state, inv, api: testApi(state) })
  assert.equal(inv.damage, 2)
  rule.afterTest({ state, inv, result: { success: true, source: { label: '调查' } }, api: testApi(state) })
  assert.equal(inv.damage, 2, '调查成功不受伤')
})

test('TFA 04070 河流峡谷：每场游戏一次治愈 1 点（水壶 +2）', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  const canyon = place(state, 'riverCanyon')
  inv.location = canyon.id
  inv.damage = 3
  state.campaign.supplies = { 0: ['canteen'] }
  const rule = locationRuleFor('04070')
  const moves = []
  rule.actions({ state, moves })
  assert.deepEqual(moves.map(move => move.rule), ['healRiverCanyon'])
  rule.performAction(state, inv, { rule: 'healRiverCanyon' }, testApi(state, {
    healDamage: (seat, amount) => { state.investigators[seat].damage = Math.max(0, state.investigators[seat].damage - amount) },
  }))
  assert.equal(inv.damage, 0, '治愈 1 点 + 水壶额外 2 点')
  const second = []
  rule.actions({ state, moves: second })
  assert.equal(second.length, 0, '每场游戏仅限一次')
})

test('TFA 04071 索桥：探索前敏捷(2)失败会取消探索并移动到河流峡谷', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  const bridge = place(state, 'ropeBridge')
  const canyon = place(state, 'riverCanyon')
  inv.location = bridge.id
  const rule = locationRuleFor('04071')
  const api = testApi(state, {
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty, skill, drawn: [] }),
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    loseActions: () => {},
    endTurn: () => {},
    moveInvestigator: (seat, location) => { state.investigators[seat].location = location },
  })
  assert.equal(rule.beforeExplore(state, inv, api), false, '失败取消探索')
  assert.equal(inv.damage, 2)
  assert.equal(inv.location, canyon.id)
  assert.equal(rule.beforeExplore(state, inv, testApi(state)), true, '成功允许探索')
})

test('TFA 04072 万蛇据点：此处蛇族 +1 战斗；已中毒调查/探索后受 1 点伤害', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  const haven = place(state, 'serpentsHaven')
  inv.location = haven.id
  const serpent = spawnTestEnemy(state, '04083', haven.id)
  assert.equal(entityModifierTotal(state, serpent, 'enemyFight'), 1)
  const nonSerpent = spawnTestEnemy(state, '04086', haven.id)
  assert.equal(entityModifierTotal(state, nonSerpent, 'enemyFight'), 0)
  inv.threat = [{ id: 'p', code: '04102', originalCode: '04102' }]
  const rule = locationRuleFor('04072')
  rule.afterTest({ state, inv, result: { success: true, source: { label: '调查' } }, api: testApi(state) })
  assert.equal(inv.damage, 1, '已中毒：调查后受 1 点伤害')
  rule.afterExplore({ state, inv, api: testApi(state) })
  assert.equal(inv.damage, 2, '已中毒：探索后也受 1 点伤害')
})

test('TFA 04073 曲折小道：没有指南针时调查/探索额外花费 3 资源（单人）', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  const trail = place(state, 'circuitousTrail')
  inv.location = trail.id
  inv.resources = 5
  state.campaign.supplies = { 0: [] }
  const rule = locationRuleFor('04073')
  assert.equal(rule.beforeInvestigate(state, inv, trail, testApi(state, { checkSupplies: () => false })), true)
  assert.equal(inv.resources, 2, '没有指南针：调查额外花费 3 资源')
  assert.equal(rule.beforeInvestigate(state, inv, trail, testApi(state, { checkSupplies: () => true })), true)
  assert.equal(inv.resources, 2, '有指南针不再收费')
})

test('TFA 04074 毒牙神庙：胜利区每点复仇使此处帷幕 +1', () => {
  const state = boot('theUntamedWilds')
  const temple = place(state, 'templeOfTheFang')
  state.victoryDisplay = [{ id: 'v', code: '04070', vengeance: 2 }]
  assert.equal(entityModifierTotal(state, temple, 'locationShroud'), 2)
  state.victoryDisplay = []
  assert.equal(entityModifierTotal(state, temple, 'locationShroud'), 0)
})

test('TFA 04075 杂草丛生的遗迹：中毒者进入后失去所有行动并结束回合', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  const ruins = place(state, 'overgrownRuins')
  inv.location = ruins.id
  const rule = locationRuleFor('04075')
  inv.threat = [{ id: 'p', code: '04102', originalCode: '04102' }]
  const ends = []
  rule.onEnter.effect(state, ruins, testApi(state, { endTurn: seat => ends.push(seat) }), inv)
  assert.deepEqual(ends, [0])
  inv.threat = []
  rule.onEnter.effect(state, ruins, testApi(state, { endTurn: seat => ends.push(seat) }), inv)
  assert.deepEqual(ends, [0], '未中毒不触发')
})

test('TFA 04076 疯狂生长：附属地点后不能探索，行动检定战斗/智识成功弃掉', () => {
  const state = boot('theUntamedWilds')
  const locationId = state.investigators[0].location
  drawEncounterCard(state, '04076')
  const location = state.locations.find(entry => entry.id === locationId)
  assert.equal((location.attachments || []).some(card => (card.originalCode || card.code) === '04076'), true)
  assert.equal(encounterRules.canExplore(state, state.investigators[0]), false, '附属地点不能探索')
  const moves = legalMoves(state, 0).filter(move => move.action === 'encounterAction' && move.rule === 'clearOvergrowth')
  assert.deepEqual(moves.map(move => move.skill).sort(), ['combat', 'intellect'])
  const attachmentId = location.attachments[0].id
  encounterRules.performEncounterAction(state, state.investigators[0], { rule: 'clearOvergrowth', attachmentId, skill: 'combat' },
    { test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty, difficulty, skill, drawn: [] }) })
  assert.equal((state.locations.find(entry => entry.id === locationId).attachments || []).length, 0, '成功后弃掉疯狂生长')
})

test('TFA 04077 丛林之声：威胁区；回合末未成功探索受 1 恐惧；行动弃掉', () => {
  const state = boot('theUntamedWilds')
  drawEncounterCard(state, '04077')
  let inv = state.investigators[0]
  const threat = inv.threat.find(card => (card.originalCode || card.code) === '04077')
  assert.ok(threat, '进入威胁区域')
  wilds.behavior.turnEnded(state, inv, testApi(state))
  assert.equal(inv.horror, 1)
  inv.tfaExploredThisTurn = true
  wilds.behavior.turnEnded(state, inv, testApi(state))
  assert.equal(inv.horror, 1, '本回合成功探索过则不受恐惧')
  const action = legalMoves(state, 0).find(move => move.action === 'encounterAction' && move.rule === 'endVoiceOfTheJungle')
  assert.ok(action, '存在检定意志(3)驱散的行动')
  inv = state.investigators[0]
  encounterRules.performEncounterAction(state, inv, { rule: 'endVoiceOfTheJungle', threatId: action.threatId, skill: 'willpower' },
    { test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty, difficulty, skill, drawn: [] }) })
  assert.equal(state.investigators[0].threat.some(card => (card.originalCode || card.code) === '04077'), false)
})

test('TFA 04078 蝮蛇：攻击造成伤害后未中毒者获得中毒弱点', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  const viper = spawnTestEnemy(state, '04078', inv.location)
  enemyScriptFor('04078').onAttackResolved(state, viper, inv, testApi(state, {
    isPoisoned: () => false,
    poison: seat => { state.investigators[seat].threat.push({ id: 'p', code: '04102', originalCode: '04102' }) },
  }), { damage: 1 })
  assert.ok(inv.threat.some(card => (card.originalCode || card.code) === '04102'))
  const before = inv.threat.length
  enemyScriptFor('04078').onAttackResolved(state, viper, inv, testApi(state, { isPoisoned: () => true, poison: () => {} }), { damage: 1 })
  assert.equal(inv.threat.length, before, '已中毒不再重复')
})

test('TFA 04079 蟒蛇：猎手；攻击后下个补给阶段不能重整', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  const boa = spawnTestEnemy(state, '04079', inv.location)
  assert.equal(state.scenario.enemies['04079'].hunter, true)
  const calls = []
  enemyScriptFor('04079').onAttackResolved(state, boa, inv, testApi(state, {
    preventReadyNextUpkeep: seat => calls.push(seat),
  }))
  assert.deepEqual(calls, [0])
})

test('TFA 04080 毒蛇噬咬：敏捷(3)失败后二选一（盟友 5 伤害 / 直接伤害+中毒）', () => {
  const state = boot('theUntamedWilds')
  state.investigators[0].assets = [{ id: 'ally1', code: '04051', originalCode: '04051', traits: ['Ally', 'Wayfarer'] }]
  state.chaosBag = ['autofail']
  let sawAllyOption = false
  drawEncounterCard(state, '04080', pending => {
    if (pending.options.some(option => option.id === 'ally')) {
      sawAllyOption = true
      return 'damage'
    }
    return null
  })
  assert.equal(sawAllyOption, true, '有盟友时提供 5 点盟友伤害选项')
  const inv = state.investigators[0]
  assert.equal(inv.damage, 1, '直接伤害 1 点')
  assert.ok(inv.threat.some(card => (card.originalCode || card.code) === '04102'), '未中毒则获得中毒')
})

test('TFA 04081 迷失荒野：失败按差值受恐惧、入威胁区，不能移动/探索，回合末弃掉', () => {
  const state = boot('theUntamedWilds')
  state.chaosBag = ['autofail']
  drawEncounterCard(state, '04081')
  let inv = state.investigators[0]
  assert.ok(inv.threat.some(card => (card.originalCode || card.code) === '04081'))
  assert.equal(inv.horror, 3, '意志(3)失败 3 点：受到 3 点恐惧')
  assert.match(encounterRules.movementError(state, inv), /迷失荒野/)
  assert.equal(encounterRules.canExplore(state, inv), false)
  wilds.behavior.turnEnded(state, inv, testApi(state))
  assert.equal(state.investigators[0].threat.some(card => (card.originalCode || card.code) === '04081'), false)
})

test('TFA 04082 补给短缺：险境；全队三选一，选择则每位调查员受伤', () => {
  const state = boot('theUntamedWilds', 2)
  for (const inv of state.investigators) { inv.assets = []; inv.hand = [] }
  drawEncounterCard(state, '04082', pending => {
    assert.deepEqual(pending.options.map(option => option.id), ['resources', 'damage'], '没有可弃支援时不再提供弃支援选项')
    return 'damage'
  })
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[1].damage, 1)
})

test('TFA 04083 伊格之子：猎手；胜利区复仇让战斗值上升', () => {
  const state = boot('theUntamedWilds')
  state.victoryDisplay = [{ id: 'v', code: '04070', vengeance: 2 }]
  drawEncounterCard(state, '04083')
  const enemy = state.enemies.find(card => (card.originalCode || card.code) === '04083')
  assert.ok(enemy)
  assert.equal(enemy.hunter, true)
  assert.equal(enemyFightValue(state, enemy, state.investigators[0]), (state.scenario.enemies['04083'].fight || 0) + 2)
})

test('TFA 04084 幽嘶蛇人：复仇 1/2/3 点分别获得反击/猎手/减伤', () => {
  const state = boot('theUntamedWilds')
  state.victoryDisplay = [{ id: 'v', code: '04070', vengeance: 1 }]
  drawEncounterCard(state, '04084')
  const enemy = state.enemies.find(card => (card.originalCode || card.code) === '04084')
  assert.equal(enemy.retaliate, true)
  enemy.hunter = false
  state.victoryDisplay.push({ id: 'v2', code: '04071', vengeance: 1 })
  encounterRules.refreshVengeanceEnemies(state)
  assert.equal(enemy.hunter, true)
  assert.equal(enemy.tfaDamageReduction || 0, 0)
  state.victoryDisplay.push({ id: 'v3', code: '04072', vengeance: 1 })
  encounterRules.refreshVengeanceEnemies(state)
  assert.equal(enemy.tfaDamageReduction, 1)
})

test('TFA 04085 伊格的诅咒：威胁区 -1 战斗 / -1 生命，获得蛇族特性，行动摆脱', () => {
  const state = boot('theDoomOfEztli')
  const baseCombat = getStat(state, state.investigators[0], 'combat')
  const baseHealth = getMaxHealth(state.investigators[0])
  drawEncounterCard(state, '04085')
  const inv = state.investigators[0]
  assert.ok(inv.threat.some(card => (card.originalCode || card.code) === '04085'))
  assert.equal(getStat(state, inv, 'combat'), baseCombat - 1)
  assert.equal(getMaxHealth(inv), baseHealth - 1)
  assert.ok((inv.traits || []).includes('Serpent'), '获得[[蛇族]]特性')
  const action = legalMoves(state, 0).find(move => move.action === 'encounterAction' && move.rule === 'endCurseOfYig')
  assert.ok(action)
  encounterRules.performEncounterAction(state, inv, { rule: 'endCurseOfYig', threatId: action.threatId, skill: 'willpower' },
    { test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty, difficulty, skill, drawn: [] }) })
  assert.equal(state.investigators[0].threat.some(card => (card.originalCode || card.code) === '04085'), false)
})

test('TFA 04086 埃兹特里的守卫者：生成在[[古代]]地点；敌人阶段攻击连接地点的调查员', () => {
  const state = boot('theUntamedWilds', 2)
  const inv = state.investigators[0]
  const camp = state.locations.find(entry => entry.id === inv.location)
  const path = place(state, 'pathOfThorns')
  const guardian = spawnTestEnemy(state, '04086', camp.id)
  inv.location = path.id
  assert.equal(state.scenario.enemies['04086'].spawnAnyEmpty, true)
  assert.equal(registeredEntry('04086').spawnAncientFirst, true)
  const attacked = []
  encounterRules.enemyPhaseStart(state, testApi(state, {
    cannotAttack: () => false,
    attack: (enemy, target) => attacked.push({ enemyId: enemy.id, seat: target.seat }),
  }))
  assert.deepEqual(attacked, [{ enemyId: guardian.id, seat: 0 }], '攻击每个连接地点的调查员')
})

test('TFA 04087 林中暗箭：基础 1 伤害 + 每个盟友 1 点，古代地点的其他调查员同样结算', () => {
  const state = boot('theUntamedWilds', 2)
  place(state, 'ruinsOfEztli')
  state.investigators[0].location = place(state, 'pathOfThorns').id
  state.investigators[1].location = 'ruinsOfEztli'
  state.investigators[1].assets = [{ id: 'ally', code: '04051', originalCode: '04051', traits: ['Ally', 'Wayfarer'] }]
  drawEncounterCard(state, '04087')
  assert.equal(state.investigators[0].damage, 1, '本人没有盟友：1 点伤害')
  assert.equal(state.investigators[1].damage, 2, '古代地点的其他调查员：按盟友数加算')
})

test('TFA 04088 致命错误：敏捷(2+所在地毁灭)失败受 2 伤害', () => {
  const state = boot('theDoomOfEztli')
  const inv = state.investigators[0]
  const location = state.locations.find(entry => entry.id === inv.location)
  location.doom = 2
  const api = testApi(state, {
    test: (seat, skill, difficulty, resolve) => {
      captured = difficulty
      resolve({ success: false, value: 0, difficulty, skill, drawn: [] })
    },
  })
  let captured = 0
  registeredEntry('04088').encounterResolve(state, inv, { code: '04088' }, api, { location })
  assert.equal(captured, 4, '难度 = 2 + 所在地毁灭标记数')
  const inv2 = state.investigators[0]
  assert.equal(inv2.damage, 2)
})

test('TFA 04089 半身入土：不能解除交战/移动；两项行动检定成功弃掉、失败难度 -1', () => {
  const state = boot('theDoomOfEztli')
  drawEncounterCard(state, '04089')
  let inv = state.investigators[0]
  const threat = inv.threat.find(card => (card.originalCode || card.code) === '04089')
  assert.ok(threat)
  assert.equal(encounterRules.canDisengage(state, inv), false)
  assert.match(encounterRules.movementError(state, inv), /半身入土/)
  const moves = legalMoves(state, 0).filter(move => move.action === 'encounterAction' && move.rule === 'escapeEntombed')
  assert.deepEqual(moves.map(move => move.skill).sort(), ['agility', 'combat'])
  encounterRules.performEncounterAction(state, inv, { rule: 'escapeEntombed', threatId: threat.id, skill: 'agility' },
    { test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty, skill, drawn: [] }) })
  assert.equal(inv.threat.find(card => (card.originalCode || card.code) === '04089').difficultyReduction, 1, '失败后难度 -1 直到轮末')
  inv = state.investigators[0]
  encounterRules.performEncounterAction(state, inv, { rule: 'escapeEntombed', threatId: threat.id, skill: 'agility' },
    { test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty, difficulty, skill, drawn: [] }) })
  assert.equal(state.investigators[0].threat.some(card => (card.originalCode || card.code) === '04089'), false)
})

test('TFA 04090 时间裂缝：每低于难度 1 点选择失去 1 行动或受 1 恐惧', () => {
  const state = boot('theDoomOfEztli')
  state.chaosBag = ['autofail']
  let decisions = 0
  drawEncounterCard(state, '04090', pending => {
    if (!String(pending.prompt).includes('时间裂缝')) return null
    decisions += 1
    return 'horror'
  })
  assert.equal(decisions, 3, '意志(3) 失败 3 点：逐点选择')
  assert.equal(state.investigators[0].horror, 3)
})

test('TFA 04091 困于时间：非剧情支援洗回牌库并转移伤害/恐惧；无支援则弃 3 张手牌', () => {
  const state = boot('theDoomOfEztli')
  state.investigators[0].assets = [{ id: 'item', code: '04037', originalCode: '04037', damage: 2, horror: 1 }]
  drawEncounterCard(state, '04091')
  let inv = state.investigators[0]
  assert.equal(inv.assets.some(entry => entry.id === 'item'), false, '支援被洗回牌库')
  assert.equal(inv.damage, 2)
  assert.equal(inv.horror, 1)
  const empty = boot('theDoomOfEztli')
  empty.investigators[0].assets = []
  empty.investigators[0].hand = ['01020', '01021', '01022', '01023']
  drawEncounterCard(empty, '04091', pending => pending.options[0].id)
  inv = empty.investigators[0]
  assert.equal(inv.hand.length, 1, '没有支援时弃 3 张手牌')
})

test('TFA 04092 不祥之兆：险境，选一个地点放毁灭并使该处调查员受 1 恐惧', () => {
  const state = boot('theDoomOfEztli', 2)
  for (const inv of state.investigators) inv.location = state.investigators[0].location
  drawEncounterCard(state, '04092', pending => {
    assert.equal(pending.peril, true)
    return pending.options[0].id
  })
  const location = state.locations.find(entry => entry.id === state.investigators[0].location)
  assert.equal(location.doom, 1)
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.investigators[1].horror, 1)
})

test('TFA 04093 先祖恐惧：险境+涌动；二选一（放毁灭弃卡 / 进胜利区带复仇 1）', () => {
  const state = boot('theDoomOfEztli')
  assert.equal(state.scenario.treacheries['04093'].peril, true)
  assert.equal(state.scenario.treacheries['04093'].surge, true)
  const inv = state.investigators[0]
  const location = state.locations.find(entry => entry.id === inv.location)
  const doomApi = testApi(state, { choose: () => 'doom' })
  registeredEntry('04093').encounterResolve(state, inv, { code: '04093', originalCode: '04093' }, doomApi, { location })
  assert.equal(location.doom, 1)
  const victoryApi = testApi(state, { choose: () => 'victory' })
  registeredEntry('04093').encounterResolve(state, inv, { code: '04093', originalCode: '04093' }, victoryApi, { location })
  const entry = state.victoryDisplay.find(card => (card.originalCode || card.code) === '04093')
  assert.ok(entry, '放进胜利区')
  assert.equal(entry.vengeance, 1)
})

test('TFA 04094 一片漆黑：放在密谋牌库旁；每位调查员每轮从单个地点最多发现 1 线索', () => {
  const state = boot('theDoomOfEztli')
  const inv = state.investigators[0]
  drawEncounterCard(state, '04094')
  assert.ok((state.agendaAside || []).some(card => (card.originalCode || card.code) === '04094'))
  assert.equal(registeredEntry('04094').treacheryRule.clueDiscoveryLimit, 1)
  assert.equal(registeredEntry('04094').treacheryRule.discardOneAtRoundEnd, true)
  const location = state.locations.find(entry => entry.id === inv.location)
  location.clues = 3
  assert.equal(discoverClueAt(state, inv, 1, []), true)
  assert.equal(discoverClueAt(state, inv, 1, []), false, '同一轮同一地点最多发现 1 个线索')
})

test('TFA 04095 兄弟会教徒：猎手；毁灭越多战斗/躲避越高，攻击宣言时放毁灭', () => {
  const state = boot('threadsOfFate')
  drawEncounterCard(state, '04095')
  let enemy = state.enemies.find(card => (card.originalCode || card.code) === '04095')
  assert.ok(enemy)
  assert.equal(enemy.hunter, true)
  enemy.doom = 2
  const inv = state.investigators[0]
  assert.equal(enemyFightValue(state, enemy, inv), (state.scenario.enemies['04095'].fight || 0) + 2)
  assert.equal(enemyEvadeValue(state, enemy, inv), (state.scenario.enemies['04095'].evade || 0) + 2)
  inv.combat = 20
  enemy.health = 30
  const fight = legalMoves(state, 0).find(move => move.action === 'fight' && move.enemyId === enemy.id)
  assert.ok(fight)
  applyMove(state, 0, fight)
  enemy = state.enemies.find(card => (card.originalCode || card.code) === '04095')
  assert.equal(enemy.doom, 3, '对兄弟会异教徒发动攻击时放 1 个毁灭标记')
})

test('TFA 04096 阴影笼罩：无[[异教徒]]敌人时受恐惧并涌动；否则最近异教徒放毁灭并按攻击值检定', () => {
  const noCultist = boot('threadsOfFate')
  drawEncounterCard(noCultist, '04096')
  assert.equal(noCultist.investigators[0].horror, 1)
  const cultistState = boot('threadsOfFate')
  const cultist = spawnTestEnemy(cultistState, '04095', cultistState.investigators[0].location)
  let difficulty = 0
  registeredEntry('04096').encounterResolve(cultistState, cultistState.investigators[0], { code: '04096' }, testApi(cultistState, {
    test: (seat, skill, value, resolve) => {
      difficulty = value
      resolve({ success: false, value: 0, difficulty: value, skill, drawn: [] })
    },
  }))
  const target = cultistState.investigators[0]
  assert.equal(cultist.doom, 1, '最近的[[异教徒]]敌人放 1 个毁灭')
  assert.equal(difficulty, (cultistState.scenario.enemies['04095'].fight || 0) + 1, 'X = 敌人的攻击值（含毁灭修正）')
  assert.equal(target.horror, 2)
})

test('TFA 04097 力量真言：带毁灭敌人同地点时不能伤它/发现线索；花 2 行动弃掉', () => {
  const state = boot('threadsOfFate')
  drawEncounterCard(state, '04097')
  const inv = state.investigators[0]
  const enemy = spawnTestEnemy(state, '04095', inv.location)
  enemy.doom = 1
  assert.equal(encounterRules.enemyDamageAllowed(state, enemy, 'attack', 0), false)
  assert.equal(encounterRules.canDiscoverClues(state, state.investigators[0]), false)
  const action = legalMoves(state, 0).find(move => move.action === 'encounterAction' && move.rule === 'discardWordsOfPower')
  assert.ok(action)
  assert.equal(action.actions, 2, '需要 2 个行动')
})

test('TFA 04098 伊格的獠牙：猎物-中毒调查员；交战时不能打牌/投入卡牌', () => {
  const state = boot('theDoomOfEztli')
  const inv = state.investigators[0]
  assert.equal(enemySpawnRuleFor('04098').preyPoisoned, true)
  assert.equal(state.scenario.enemies['04098'].retaliate, true)
  const fang = spawnTestEnemy(state, '04098', inv.location)
  fang.engagedSeat = inv.seat
  inv.threat = [{ id: 'p', code: '04102', originalCode: '04102' }]
  assert.equal(encounterRules.fangOfYigEngaged(state, inv), true)
  assert.equal(encounterRules.canPlayCard(state, inv), false)
  assert.equal(encounterRules.canCommitCard(state, inv), false)
  inv.threat = []
  assert.equal(encounterRules.fangOfYigEngaged(state, inv), false)
})

test('TFA 04099 毒蛇灾厄：非弱点[[道具]]文本空白；已中毒时涌动；轮末弃掉', () => {
  const state = boot('theDoomOfEztli')
  state.investigators[0].assets.push({ id: 'rosary', code: '01059', originalCode: '01059', exhausted: false })
  const before = getStat(state, state.investigators[0], 'willpower')
  poisonInvestigator(state, 0)
  const api = testApi(state)
  const surged = []
  api.drawEncounter = seat => surged.push(seat)
  registeredEntry('04099').encounterResolve(state, state.investigators[0], { code: '04099' }, api)
  assert.equal(getStat(state, state.investigators[0], 'willpower'), before - 1, '道具上的 +1 意志被空白化')
  assert.deepEqual(surged, [0], '已中毒时获得涌动：再抽 1 张遭遇牌')
  assert.equal(registeredEntry('04099').treacheryRule.threatArea, true)
  const inv = state.investigators[0]
  encounterRules.roundEnded(state, testApi(state))
  assert.equal(state.investigators[0].threat.some(card => (card.originalCode || card.code) === '04099'), false)
})

test('TFA 04100 毒蛇召来：二选一（把放在一边的中毒放入威胁区 / 抽 2 张遭遇）', () => {
  const poisonState = boot('theDoomOfEztli')
  drawEncounterCard(poisonState, '04100', pending => {
    if (pending.options.some(option => option.id === 'poison')) return 'poison'
    return null
  })
  assert.ok(poisonState.investigators[0].threat.some(card => (card.originalCode || card.code) === '04102'))
  const drawState = boot('theDoomOfEztli')
  let draws = 0
  registeredEntry('04100').encounterResolve(drawState, drawState.investigators[0], { code: '04100' }, testApi(drawState, {
    choose: () => 'cards',
    drawEncounter: () => { draws += 1 },
  }))
  assert.equal(draws, 2)
})

test('TFA 04101 毒性蔓延：涌动；中毒的每位调查员受到 1 点伤害', () => {
  const state = boot('theDoomOfEztli', 2)
  const [first, second] = state.investigators
  assert.equal(state.scenario.treacheries['04101'].surge, true)
  poisonInvestigator(state, 0)
  const before = second.damage
  registeredEntry('04101').encounterResolve(state, first, { code: '04101' }, testApi(state))
  assert.equal(first.damage, 1)
  assert.equal(second.damage, before, '未中毒者不受影响')
})

test('TFA 04102 中毒：永久弱点（每名调查员 1 张），是中毒判定的唯一读点', () => {
  assert.equal(isPoisonThreat('04102'), true)
  assert.equal(poisonWeaknessCode(), '04102')
  assert.equal(registeredEntry('04102').treacheryRule.permanent, true)
  const state = boot('theDoomOfEztli')
  assert.equal(poisonInvestigator(state, 0), true)
  assert.equal(poisonInvestigator(state, 0), false, '每名调查员仅限 1 张')
  assert.equal(state.investigators[0].threat.filter(card => (card.originalCode || card.code) === '04102').length, 1)
  assert.ok(state.campaign.investigators[0].deck.includes('04102'), '永久弱点同时写入战役牌组')
})

test('TFA 04054 埃兹特里的覆灭剧本卡：骷髅看所在地毁灭，旧神标记追加揭示/放毁灭', () => {
  const state = boot('theDoomOfEztli')
  const inv = state.investigators[0]
  const location = place(state, 'entryway')
  inv.location = location.id
  const token = (face, difficulty = 'standard') => {
    state.difficulty = difficulty
    return tfaChaosToken('theDoomOfEztli', state, inv, face)
  }
  assert.equal(token('skull').delta, -1)
  location.doom = 1
  assert.equal(token('skull').delta, -3)
  assert.equal(token('skull', 'hard').delta, -4)
  assert.equal(token('cultist').delta, -1, '普通面 X = 有毁灭的地点数量')
  assert.equal(token('cultist', 'hard').delta, -1, '困难面 X = 地点上的毁灭总数')
  const elderThing = token('elderthing')
  assert.equal(elderThing.drawAnother, true, '追加揭示 1 个混乱标记')
  location.clues = 1
  state.difficulty = 'standard'
  tfaChaosAfterTest('theDoomOfEztli', state, inv, { success: true, drawn: ['elderthing'] }, testApi(state))
  assert.equal(location.doom, 1, '普通面成功不放毁灭')
  tfaChaosAfterTest('theDoomOfEztli', state, inv, { success: false, drawn: ['elderthing'] }, testApi(state))
  assert.equal(location.doom, 2, '普通面失败时在所在地点放 1 点毁灭')
  state.difficulty = 'hard'
  tfaChaosAfterTest('theDoomOfEztli', state, inv, { success: true, drawn: ['elderthing'] }, testApi(state))
  assert.equal(location.doom, 3, '困难面不要求失败也放毁灭')
})

test('TFA 04055 暗起波澜：+1×人数毁灭阈值；推进不移除地点毁灭；背面生成预示者', () => {
  const state = boot('theDoomOfEztli')
  const expected = ['04055', '04056'].map(code => Number(ALL_CARDS[code].doom) + state.numInvestigators)
  assert.deepEqual(state.agendas.map(agenda => agenda.doomThreshold), expected,
    '两张密谋都得到 +1[per_investigator] 毁灭阈值')
  assert.equal(registeredEntry('04055').doomKeptOnAgendaAdvance, 'locations', '引擎 advanceAgenda 读点')
  const first = place(state, 'entryway')
  const second = place(state, 'ancientHall')
  first.doom = 0
  second.doom = 2
  const api = testApi(state)
  agendaRuleFor('04055').onReveal(state, state.agendas[0], api)
  const enemy = state.enemies.find(entry => (entry.originalCode || entry.code) === '04062')
  assert.ok(enemy, '生成瓦卢西亚的预示者')
  assert.equal(enemy.location, second.id, '生成在毁灭标记最多的地点')
  assert.equal(state.scenarioZones.setAside.includes('04062'), false, '从「放在一边」取走')
})

test('TFA 04056 神庙看守者：所有未撤退的调查员被击败', () => {
  const state = boot('theDoomOfEztli', 2)
  state.investigators[1].resigned = true
  agendaRuleFor('04056').onReveal(state, state.agendas[1], testApi(state))
  assert.equal(state.investigators[0].defeated, true)
  assert.equal(state.investigators[1].defeated, false)
})

test('TFA 04057 进入遗迹：时间石室洗入探索牌库；有粉笔移出游戏，无粉笔记复仇 1', () => {
  const withChalk = boot('theDoomOfEztli')
  withChalk.campaign.supplies = { 0: ['chalk'] }
  actRuleFor('04057').onReveal(withChalk, withChalk.acts[0], testApi(withChalk, { random: () => 0.5 }))
  assert.ok(withChalk.explorationDeck.includes('chamberOfTime'), '时间石室洗入探索牌库')
  assert.equal(withChalk.victoryDisplay.length, 0)
  assert.equal(withChalk.scenarioZones.setAside.includes('04068'), false)

  const noChalk = boot('theDoomOfEztli')
  actRuleFor('04057').onReveal(noChalk, noChalk.acts[0], testApi(noChalk, { random: () => 0.5 }))
  const entry = noChalk.victoryDisplay.find(card => (card.originalCode || card.code) === '04057')
  assert.ok(entry, '没有粉笔时本幕进胜利区')
  assert.equal(entry.vengeance, 1)
})

test('TFA 04058 科学与魔法：时间石室的调查员取得古代遗物，地点排成一条线', () => {
  const state = boot('theDoomOfEztli')
  const ids = ['entryway', 'ancientHall', 'grandChamber', 'burialPit', 'undergroundRuins', 'secretPassage', 'chamberOfTime']
  for (const id of ids) place(state, id)
  const inv = state.investigators[0]
  inv.location = 'chamberOfTime'
  const given = []
  const api = testApi(state, {
    choose: () => '0',
    giveAsset: (seat, code) => { given.push({ seat, code }); inv.assets.push({ id: 'relic', code, originalCode: code }) },
    moveRelicOfAges: payload => { state.relicOfAges = { code: '04061', ...payload } },
  })
  actRuleFor('04058').onReveal(state, state.acts[1], api)
  assert.deepEqual(given, [{ seat: 0, code: '04061' }])
  assert.equal(state.scenarioFlags.locationsInLine, true)
  const chamber = state.locations.find(entry => entry.id === 'chamberOfTime')
  const entryway = state.locations.find(entry => entry.id === 'entryway')
  assert.equal(chamber.connections.length, 1, '时间石室只连右侧一个地点')
  assert.equal(entryway.connections.includes(chamber.id), false)
  for (const location of state.locations) assert.ok(location.connections.length <= 2)
})

test('TFA 04059 逃出遗迹：复仇 3 点蛇族 +1 躲避；撤退分支 r1、其余 r3', () => {
  const state = boot('theDoomOfEztli')
  const inv = state.investigators[0]
  state.actIndex = 2
  state.victoryDisplay = [{ id: 'v', code: '04076', vengeance: 3 }]
  const serpent = spawnTestEnemy(state, '04084', inv.location)
  assert.equal(serpent.traits.includes('Serpent'), true)
  assert.equal(eztli.behavior.enemyStatModifier(state, serpent, 'evade'), 1, '3 点以上复仇：蛇族 +1 躲避')
  state.relicOfAges = { code: '04061', location: inv.location, seat: 0 }
  inv.resigned = false
  let finished = null
  actRuleFor('04059').onReveal(state, state.acts[2], testApi(state, { finish: key => { finished = key } }))
  assert.equal(finished, 'r3')
  inv.resigned = true
  actRuleFor('04059').onReveal(state, state.acts[2], testApi(state, { finish: key => { finished = key } }))
  assert.equal(finished, 'r1')
})

test('TFA 04060 遗迹入口：撤退与火把查看行动；只有火把能弃掉查看到的诡计', () => {
  const state = boot('theDoomOfEztli')
  const inv = state.investigators[0]
  const entryway = place(state, 'entryway')
  inv.location = entryway.id
  const rule = locationRuleFor('04060')
  const moves = []
  rule.actions({ moves })
  assert.deepEqual(moves.map(move => move.rule).sort(), ['inspectSupplies', 'resignEntryway'])
  const discarded = []
  rule.performAction(state, inv, { rule: 'inspectSupplies' }, testApi(state, {
    checkSupplies: () => false,
  }))
  assert.equal(discarded.length, 0)
  rule.performAction(state, inv, { rule: 'inspectSupplies' }, {
    ...testApi(state),
    checkSupplies: () => true,
    takeExplorationTop: () => ['04076', '04088'],
    discardExploration: code => discarded.push(code),
    shuffleExploration: () => { discarded.push('shuffle') },
    addExplorationTop: () => { discarded.push('keep') },
  })
  assert.deepEqual(discarded, ['04076', '04088', 'shuffle'])
})

test('TFA 04061 古代遗物：剧情资产身份由条目声明并被引擎战役状态复用', () => {
  assert.equal(storyCardCode('relicOfAges'), '04061')
  assert.equal(scenarioPlayableFor('04061'), true)
  assert.equal(registeredEntry('04061').storyRole, 'relicOfAges')
  const state = boot('theDoomOfEztli')
  assert.equal(state.relicOfAges.code, '04061', '布置时古代遗物在一边待用')
})

test('TFA 04062 瓦卢西亚的预示者：横置也反击；2×人数资源后遁去身影并保留伤害', () => {
  const state = boot('theDoomOfEztli')
  const inv = state.investigators[0]
  const rules = enemyRuleFor('04062')
  assert.equal(rules.healthPerInvestigator, 10)
  assert.equal(rules.vengeance, 5)
  assert.equal(rules.retaliateWhileExhausted, true)
  const enemy = spawnTestEnemy(state, '04062', inv.location)
  enemy.damageTaken = 3
  enemyScriptFor('04062').onSpawn(state, enemy, testApi(state))
  assert.equal(enemy.retaliateWhileExhausted, true)
  eztli.behavior.enemyAttackedSuccessfully(state, inv, enemy, testApi(state))
  assert.equal(enemy.resources, 1)
  eztli.behavior.enemyAttackedSuccessfully(state, inv, enemy, testApi(state))
  assert.equal(state.enemies.includes(enemy), false, '2×人数资源后遁去身影')
  assert.equal(state.scenarioZones.setAside.includes('04062'), true)
  assert.equal(state.scenarioFlags.harbingerDamage, 3, '遁去时保留伤害标记')
})

test('TFA 04063 古代石厅：轮末翻 1 个线索为毁灭，可花 3 资源取消', () => {
  const state = boot('theDoomOfEztli')
  const inv = state.investigators[0]
  const hall = place(state, 'ancientHall')
  inv.location = hall.id
  hall.clues = 2
  inv.resources = 3
  eztli.behavior.roundEnded(state, testApi(state, { choose: () => 'skip' }))
  assert.equal(hall.clues, 1)
  assert.equal(hall.doom, 1)
  eztli.behavior.roundEnded(state, testApi(state, { choose: () => '0' }))
  assert.equal(hall.clues, 1, '花 3 资源取消翻面')
  assert.equal(hall.doom, 1)
  assert.equal(inv.resources, 0)
})

test('TFA 04064 华美石室：调查未超过难度 2 点先翻线索为毁灭', () => {
  const state = boot('theDoomOfEztli')
  const inv = state.investigators[0]
  const chamber = place(state, 'grandChamber')
  inv.location = chamber.id
  chamber.clues = 2
  eztli.behavior.investigateResult(state, inv, chamber, { success: true, value: 5, difficulty: 4 }, testApi(state))
  assert.equal(chamber.clues, 1)
  assert.equal(chamber.doom, 1)
  eztli.behavior.investigateResult(state, inv, chamber, { success: true, value: 6, difficulty: 4 }, testApi(state))
  assert.equal(chamber.clues, 1, '超过难度 2 点以上不翻面')
  eztli.behavior.investigateResult(state, inv, chamber, { success: false, value: 1, difficulty: 4 }, testApi(state))
  assert.equal(chamber.clues, 0, '失败也翻面')
})

test('TFA 04065 坑葬墓室：探索成功后两次二选一（抽遭遇或放毁灭）', () => {
  const state = boot('theDoomOfEztli')
  const inv = state.investigators[0]
  const pit = place(state, 'burialPit')
  let draws = 0
  eztli.behavior.afterExplore(state, inv, {
    kind: 'location', code: '04065',
    runtime: testApi(state, { choose: () => 'doom' }),
  })
  assert.equal(pit.doom, 2)
  eztli.behavior.afterExplore(state, inv, {
    kind: 'location', code: '04065',
    runtime: testApi(state, { choose: () => 'draw', drawEncounter: () => { draws += 1 } }),
  })
  assert.equal(draws, 2, '另一选项抽 2 张遭遇牌')
})

test('TFA 04066 地下遗迹：有敌人时计入胜利区复仇，敌人离场放 1 毁灭', () => {
  const state = boot('theDoomOfEztli')
  const ruins = place(state, 'undergroundRuins')
  assert.equal(vengeanceWhileFor('04066'), 'enemyHere')
  const enemy = spawnTestEnemy(state, '04084', ruins.id)
  assert.equal(encounterRules.inPlayVengeance(state), 1, '有敌人时视作在胜利区计入复仇')
  eztli.behavior.enemyDefeated(state, enemy, testApi(state))
  assert.equal(ruins.doom, 1)
  enemy.location = ruins.id
  eztli.behavior.enemyDiscarded(state, enemy, testApi(state))
  assert.equal(ruins.doom, 2)
})

test('TFA 04067 秘密通道：进入时受伤或放毁灭；任一在场调查员带绳索可忽略', () => {
  const state = boot('theDoomOfEztli', 2)
  const inv = state.investigators[0]
  const passage = place(state, 'secretPassage')
  inv.location = passage.id
  eztli.behavior.locationEntered(state, inv, passage, testApi(state, { choose: () => 'doom' }))
  assert.equal(passage.doom, 1)
  eztli.behavior.locationEntered(state, inv, passage, testApi(state, {
    choose: () => 'harm', checkSupplies: () => false,
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
  }))
  assert.equal(inv.damage, 1)
  assert.equal(inv.horror, 1)
  eztli.behavior.locationEntered(state, inv, passage, testApi(state, { checkSupplies: seat => seat === 1 }))
  assert.equal(passage.doom, 1, '有绳索时忽略效果')
})

test('TFA 04068 时间石室：入场附属古代遗物并放 1 毁灭', () => {
  const state = boot('theDoomOfEztli')
  const chamber = place(state, 'chamberOfTime')
  const storyAssets = []
  const moved = []
  eztli.behavior.locationRevealed(state, chamber, testApi(state, {
    storyAsset: (code, location) => storyAssets.push({ code, location }),
    moveRelicOfAges: payload => moved.push(payload),
  }))
  assert.equal(chamber.doom, 1)
  assert.deepEqual(storyAssets, [{ code: '04061', location: chamber.id }])
  assert.deepEqual(moved, [{ location: chamber.id }])
  assert.equal(state.scenarioFlags.chamberPrepared, true)
  assert.equal(state.scenarioZones.setAside.includes('04061'), false)
  assert.equal(state.scenarioZones.setAside.includes('04068'), false)
})

test('TFA 04043 荒莽密林剧本卡：混乱标记按卡面（复仇/地点数/探索牌库/中毒）结算', () => {
  const state = boot('theUntamedWilds')
  state.victoryDisplay = [{ id: 'v1', code: '04085', vengeance: 2 }]
  place(state, 'pathOfThorns')
  place(state, 'riverCanyon')
  state.explorationDeck = Array(7).fill('04069')
  const inv = state.investigators[0]
  const token = (face, difficulty = 'standard') => {
    state.difficulty = difficulty
    return tfaChaosToken('theUntamedWilds', state, inv, face)
  }
  assert.equal(token('skull').delta, -2)
  assert.equal(token('cultist').delta, -3)
  assert.equal(token('tablet').delta, -5)
  assert.equal(token('elderthing').delta, -2)
  assert.equal(token('skull', 'hard').delta, -3)
  assert.equal(token('cultist', 'hard').delta, -3, '困难面不封顶')
  assert.equal(token('tablet', 'hard').delta, -7, '困难面最少 3 点由 X 取牌库数体现')
  assert.equal(token('elderthing', 'hard').delta, -3)
  inv.threat = [{ id: 'p', code: '04102', originalCode: '04102' }]
  assert.equal(token('elderthing').autoFail, true, '中毒时改为本次检定自动失败')
  const poisoned = state.investigators[1] || inv
  const api = testApi(state)
  tfaChaosAfterTest('theUntamedWilds', state, poisoned, { success: false, drawn: ['elderthing'] }, api)
  assert.ok((poisoned.threat || []).some(card => (card.originalCode || card.code) === '04102'), '困难面旧神标记失败后获得中毒弱点')
})

test('TFA 04044 荒野探险：洗入伊格的使徒并按卡面检定（未中毒者获得中毒）', () => {
  const state = boot('theUntamedWilds', 2)
  state.encounterDiscard = ['04076']
  const api = testApi(state, {
    test: (seat, skill, difficulty, resolve) => resolve({ success: seat === 0, value: difficulty, difficulty, skill, drawn: [] }),
  })
  const before = new Set(state.scenarioZones.setAside)
  assert.ok(before.has('04083') && before.has('04084') && before.has('04085'), '布置把伊格的使徒放在一边')
  agendaRuleFor('04044').onReveal(state, state.agendas[0], api)
  const asideAfter = state.scenarioZones.setAside
  assert.ok(!asideAfter.includes('04083') && !asideAfter.includes('04084') && !asideAfter.includes('04085'))
  assert.ok(state.encounterDeck.filter(code => code === '04083').length === 3, '3 张伊格之子洗入遭遇牌库')
  assert.ok(state.encounterDeck.includes('04076'), '遭遇弃牌堆同时洗回')
  assert.ok(state.investigators[1].threat.some(card => card.code === '04102'), '意志(3)失败的未中毒者获得中毒')
  assert.equal(state.investigators[0].threat.some(card => card.code === '04102'), false)
})

test('TFA 04045 入侵者：未中毒者把中毒加入牌库，随后所有调查员被击败', () => {
  const state = boot('theUntamedWilds', 2)
  state.investigators[0].threat = [{ id: 'p0', code: '04102', originalCode: '04102' }]
  const api = testApi(state)
  agendaRuleFor('04045').onReveal(state, state.agendas[1], api)
  assert.ok(state.investigators[0].defeated && state.investigators[1].defeated)
  assert.ok(state.campaign.investigators[1].deck.includes('04102'), '未中毒者的牌组加入中毒')
  assert.equal(state.campaign.investigators[0].deck.includes('04102'), false)
})

test('TFA 04046 探索丛林：揭示生成伊塔卡；轮末非营地共同支付线索推进', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  const spawns = []
  const api = testApi(state, {
    spawn: (code, location) => { spawns.push({ code, location }); return spawnTestEnemy(state, code, location) },
  })
  state.scenarioFlags.ichtacaSpawned = false
  actRuleFor('04046').onReveal(state, state.acts[0], api)
  assert.deepEqual(spawns, [{ code: '04052', location: inv.location }])
  const location = place(state, 'pathOfThorns')
  inv.location = location.id
  inv.clues = 3
  let advanced = 0
  actRuleFor('04046').roundEndCheck(state, state.acts[0], testApi(state, {
    choose: () => 'advance',
    advanceAct: () => { advanced += 1 },
  }))
  assert.equal(advanced, 1)
  assert.equal(inv.clues, 0, '共同支付 3 个线索')
})

test('TFA 04047 埃兹特里的女猎手：线索/击败两分支、胜利区与混沌袋记录', () => {
  const cluesState = boot('theUntamedWilds')
  cluesState.scenarioFlags.ichtacaSpawned = true
  const ichtaca = spawnTestEnemy(cluesState, '04052', cluesState.investigators[0].location)
  ichtaca.clues = cluesState.numInvestigators
  let advanced = 0
  actRuleFor('04047').objectiveCheck(cluesState, cluesState.acts[1], testApi(cluesState, {
    advanceAct: () => { advanced += 1 },
  }))
  assert.equal(cluesState.scenarioFlags.actTwoAdvancedWith, 'clues')
  assert.equal(advanced, 1)
  actRuleFor('04047').onReveal(cluesState, cluesState.acts[1], testApi(cluesState, { choose: () => '0', shuffle: items => items }))
  assert.ok(cluesState.victoryDisplay.some(card => (card.originalCode || card.code) === '04052'))
  assert.ok(cluesState.campaign.chaosBag.includes('cultist'), '增加 1 个[异教徒]标记')
  assert.equal(cluesState.acts[2].originalCode, '04048')

  const fightState = boot('theUntamedWilds')
  fightState.scenarioFlags.ichtacaSpawned = true
  fightState.scenarioFlags.actTwoAdvancedWith = 'defeat'
  actRuleFor('04047').onReveal(fightState, fightState.acts[1], testApi(fightState, {
    choose: () => String(fightState.investigators[0].seat), shuffle: items => items,
  }))
  assert.ok(fightState.campaign.chaosBag.includes('tablet'), '增加 1 个[石板]标记')
  assert.equal(fightState.acts[2].originalCode, '04049')
  assert.ok(fightState.investigators[0].assets.some(asset => asset.code === '04051'), '一位调查员控制亚历山卓·维拉')
})

test('TFA 04048 搜索遗迹：守卫者不能攻击/被攻击、忽略林中暗箭、幕后完成 r1', () => {
  const state = boot('theUntamedWilds')
  state.scenarioFlags.actThree = 'search'
  const guardian = spawnTestEnemy(state, '04086', state.investigators[0].location)
  assert.equal(entityRuleActive(state, guardian, 'cannot:attack'), true)
  assert.equal(entityRuleActive(state, guardian, 'cannot:beAttacked'), true)
  assert.equal(wilds.behavior.ignoreTreachery(state, '04087'), true)
  assert.equal(state.acts[2].originalCode, '04048')
  assert.deepEqual(state.acts[2].objective, { type: 'clues', perInvestigator: 3, atLocation: 'ruinsOfEztli' })
  let finished = null
  actRuleFor('04048').onReveal(state, state.acts[2], testApi(state, { finish: key => { finished = key } }))
  assert.equal(finished, 'r1')
})

test('TFA 04049 守备森严的遗迹：守卫者 +1 战斗/躲避、林中暗箭涌动、幕后完成 r2', () => {
  const state = boot('theUntamedWilds')
  state.scenarioFlags.actThree = 'guarded'
  const guardian = spawnTestEnemy(state, '04086', state.investigators[0].location)
  assert.equal(entityModifierTotal(state, guardian, 'enemyFight'), 1)
  assert.equal(entityModifierTotal(state, guardian, 'enemyEvade'), 1)
  assert.equal(wilds.behavior.encounterGainsSurge(state, '04087'), true)
  let finished = null
  actRuleFor('04049').onReveal(state, state.acts[3], testApi(state, { finish: key => { finished = key } }))
  assert.equal(finished, 'r2')
})

test('TFA 04050 探险营地：撤退/检查补给行动可见，地图把 1 张放底、其余按选择放顶', () => {
  const state = boot('theUntamedWilds')
  state.campaign.supplies = { 0: ['map'] }
  state.explorationDeck = ['04069', '04070', '04071']
  const actions = legalMoves(state, 0).filter(move => move.rule === 'mapSupplies' || move.rule === 'resignCamp')
  assert.deepEqual(actions.map(move => move.rule).sort(), ['mapSupplies', 'resignCamp'])
  const mapMove = legalMoves(state, 0).find(move => move.rule === 'mapSupplies')
  applyMove(state, 0, mapMove)
  settle(state, pending => {
    if (pending.kind === 'deck') {
      // 第一次选择放到底的牌（索引 1），第二次选择其余两张里先放回顶部的。
      return pending.prompt.includes('底部') ? '1' : '1'
    }
    return null
  })
  assert.equal(state.explorationDeck[0], '04070', '选中的那张放在探索牌库底')
  assert.equal(state.explorationDeck.at(-1), '04069', '另一张按选择顺序位于牌库顶')
})

test('TFA 04051 亚历山卓·维拉：[[古代]]地点调查 +1 技能，横置抽 2', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  const ruins = place(state, 'ruinsOfEztli')
  inv.location = ruins.id
  inv.assets.push({ id: 'alejandro', code: '04051', originalCode: '04051', exhausted: false })
  inv.hand = []
  const move = legalMoves(state, 0).find(candidate => candidate.action === 'ability' && candidate.assetId === 'alejandro')
  assert.ok(move, '位于古代地点时「横置抽 2」必须进入合法行动')
  applyMove(state, 0, move)
  const after = state.investigators[0]
  assert.equal(after.hand.length, 2)
  assert.equal(after.assets.find(asset => asset.code === '04051').exhausted, true)
  const condition = registeredEntry('04051').modifiers[0].condition.when
  assert.equal(condition({
    state: { skillTest: { source: { label: '调查' } }, locations: [{ id: 'ruinsOfEztli', traits: ['Ancient'] }] },
    inv: { location: 'ruinsOfEztli' },
  }), true)
  assert.equal(condition({
    state: { skillTest: { source: { label: '攻击' } }, locations: [{ id: 'ruinsOfEztli', traits: ['Ancient'] }] },
    inv: { location: 'ruinsOfEztli' },
  }), false, '只对调查检定生效')
})

test('TFA 04052 伊塔卡：警戒/反击关键词；谈判成功放线索、失败且重整时攻击', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  const definition = wilds.scenario.enemies['04052']
  assert.equal(definition.alert, true)
  assert.equal(definition.retaliate, true)
  const ichtaca = spawnTestEnemy(state, '04052', inv.location)
  const move = wilds.behavior.actions(state, inv).find(entry => entry.rule === 'parleyIchtaca')
  assert.ok(move, '同地点的伊塔卡提供谈判行动')
  wilds.behavior.performAction(state, inv, move, testApi(state, {
    test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty, difficulty, skill, drawn: [] }),
  }))
  assert.equal(ichtaca.clues, 1, '判定智识(4)成功后在伊塔卡上放 1 个线索')
  ichtaca.exhausted = false
  const attacks = []
  wilds.behavior.performAction(state, inv, move, testApi(state, {
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty, skill, drawn: [] }),
    attack: (enemy, target) => attacks.push(enemy.id),
  }))
  assert.deepEqual(attacks, [ichtaca.id], '失败且伊塔卡重整时她攻击你')
})

test('TFA 04053 埃兹特里的遗迹：调查失败后抽 1 张遭遇牌', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  const ruins = place(state, 'ruinsOfEztli')
  inv.location = ruins.id
  const rule = locationRuleFor('04053')
  let drawn = 0
  rule.afterTest({ state, inv, result: { success: false, source: { label: '调查' } }, api: { drawEncounter: () => { drawn += 1 } } })
  assert.equal(drawn, 1)
  rule.afterTest({ state, inv, result: { success: true, source: { label: '调查' } }, api: { drawEncounter: () => { drawn += 1 } } })
  rule.afterTest({ state, inv, result: { success: false, source: { label: '攻击' } }, api: { drawEncounter: () => { drawn += 1 } } })
  assert.equal(drawn, 1, '只有「调查」失败才触发')
})

// ===========================================================================
// 04 · 命运之线 threadsOfFate（04113–04148）
// ===========================================================================
function fateApi(state, overrides = {}) {
  return testApi(state, {
    storyAsset: (code, location) => {
      state.storyAssets ||= []
      if (state.storyAssets.some(asset => (asset.originalCode || asset.code) === code)) return
      state.storyAssets.push({ id: `story-${code}`, code, originalCode: code, location, clues: 0, exhausted: false })
    },
    moveRelicOfAges: payload => {
      state.relicOfAges = { code: '04061', location: null, seat: null, ...payload }
    },
    place: id => {
      placeLocation(state, id, [])
      return state.locations.find(location => location.id === id)
    },
    reveal: id => {
      const location = state.locations.find(entry => entry.id === id)
      if (location) location.revealed = true
    },
    moveEnemy: (enemy, location) => { enemy.location = location },
    ...overrides,
  })
}

function setThreadAct(state, thread, cards, index) {
  const deck = (state.scenarioFlags.actDecks ||= {})[thread]
  deck.cards = [...cards]
  deck.index = index
  deck.completed = false
  fate.behavior.rebuildActs(state)
  return state.acts.find(act => act.thread === thread)
}

function threadAct(state, thread) {
  return state.acts.find(act => act.thread === thread)
}

test('TFA 04113 命运之线剧本卡：普通面骷髅看异教徒毁灭，困难面看场上毁灭总数', () => {
  const state = boot('threadsOfFate')
  const inv = state.investigators[0]
  const cultist = spawnTestEnemy(state, '04095', inv.location)
  cultist.doom = 2
  const token = (face, difficulty = 'standard') => {
    state.difficulty = difficulty
    return tfaChaosToken('threadsOfFate', state, inv, face)
  }
  assert.equal(token('skull').delta, -2, '普通面 X = 异教徒敌人身上的最高毁灭数')
  state.locations[0].doom = 1
  assert.equal(token('skull', 'hard').delta, -3, '困难面 X = 场上毁灭总数（2 + 1）')
  assert.equal(token('cultist').delta, -2)
  assert.equal(token('tablet').delta, -2)
  assert.equal(token('elderthing').delta, -2)
  assert.equal(token('elderthing', 'hard').delta, -3)
  tfaChaosAfterTest('threadsOfFate', state, inv, { success: true, value: 4, difficulty: 4, drawn: ['cultist'] }, testApi(state))
  assert.equal(inv.damage, 1, '普通面未超过难度至少 1 点：受到 1 点伤害')
  inv.clues = 2
  tfaChaosAfterTest('threadsOfFate', state, inv, { success: false, drawn: ['elderthing'] }, testApi(state))
  assert.equal(inv.clues, 1, '失败时失去 1 个线索')
})

test('TFA 04114 三种命运：洗回遭遇弃牌堆；只剩 2 本幕牌库时在下一密谋放 1 毁灭', () => {
  const state = boot('threadsOfFate')
  state.encounterDiscard = ['04076']
  let doom = 0
  const api = fateApi(state, { addDoom: amount => { doom += amount }, shuffleDiscard: () => { state.encounterDeck.push(...state.encounterDiscard.splice(0)) } })
  agendaRuleFor('04114').onReveal(state, state.agendas[0], api)
  assert.equal(doom, 0, '3 本幕牌库在场时不放毁灭')
  assert.ok(state.encounterDeck.includes('04076'))
  state.scenarioFlags.actDecks.cd.completed = true
  agendaRuleFor('04114').onReveal(state, state.agendas[0], api)
  assert.equal(doom, 1)
})

test('TFA 04115 幕后：只剩 2/1 本幕牌库时分别放 1/2 毁灭', () => {
  const state = boot('threadsOfFate')
  let doom = 0
  const api = fateApi(state, { addDoom: amount => { doom += amount } })
  state.scenarioFlags.actDecks.ef.completed = true
  agendaRuleFor('04115').onReveal(state, state.agendas[1], api)
  assert.equal(doom, 1)
  doom = 0
  state.scenarioFlags.actDecks.cd.completed = true
  agendaRuleFor('04115').onReveal(state, state.agendas[1], api)
  assert.equal(doom, 2)
})

test('TFA 04116 暗藏纠葛：每位存活调查员被击败并受到 1 点精神创伤', () => {
  const state = boot('threadsOfFate', 2)
  state.investigators[1].resigned = true
  agendaRuleFor('04116').onReveal(state, state.agendas[2], fateApi(state))
  assert.equal(state.investigators[0].defeated, true)
  assert.equal(state.investigators[0].trauma?.mental, 1)
  assert.equal(state.investigators[1].defeated, false)
})

test('TFA 04117a 遗物不见了！：揭示后放置埃兹特里展品；目标限米斯卡塔尼克大学', () => {
  const state = boot('threadsOfFate')
  const act = threadAct(state, 'ab')
  assert.equal(act.originalCode, '04117a')
  assert.deepEqual(act.objective, { type: 'clues', perInvestigator: 1, atLocation: 'miskatonicUniversity' })
  fate.behavior.actReveal(state, act, fateApi(state))
  const exhibit = state.locations.find(location => location.id === 'eztliExhibit')
  assert.ok(exhibit, '埃兹特里展品进入游戏')
  assert.equal(exhibit.revealed, true)
})

test('TFA 04117b 埃兹特里展品：调查到符号标记受 1 恐惧；与米斯卡塔尼克大学相连、胜利 1', () => {
  const state = boot('threadsOfFate')
  const exhibit = state.scenario.locations.eztliExhibit
  assert.equal(exhibit.victory, 1)
  assert.ok(exhibit.connections.includes('miskatonicUniversity'))
  place(state, 'eztliExhibit')
  const inv = state.investigators[0]
  inv.location = 'eztliExhibit'
  fate.behavior.afterTest(state, inv, { drawn: ['skull'], source: { label: '调查' } }, fateApi(state))
  assert.equal(inv.horror, 1)
  fate.behavior.afterTest(state, inv, { drawn: ['0'], source: { label: '调查' } }, fateApi(state))
  assert.equal(inv.horror, 1, '普通标记不触发')
})

test('TFA 04118a 哈伦有危险！：揭示后在东城区放置哈伦·恩斯通（旁人）', () => {
  const state = boot('threadsOfFate')
  const act = setThreadAct(state, 'ab', ['04118a', '04121', '04123'], 0)
  fate.behavior.actReveal(state, act, fateApi(state))
  const harlan = state.storyAssets.find(asset => (asset.originalCode || asset.code) === '04118b')
  assert.ok(harlan, '哈伦·恩斯通进入游戏')
  assert.equal(harlan.location, 'easttown')
})

test('TFA 04118b 哈伦·恩斯通：同地点谈判行动弃牌库顶 3 张，成功放线索', () => {
  const state = boot('threadsOfFate')
  fate.behavior.actReveal(state, setThreadAct(state, 'ab', ['04118a', '04121', '04123'], 0), fateApi(state))
  const inv = state.investigators[0]
  inv.location = 'easttown'
  const move = fate.behavior.actions(state, inv).find(entry => entry.rule === 'parleyHarlan')
  assert.ok(move, '同地点的旁人资产提供谈判行动')
  const harlan = state.storyAssets.find(asset => (asset.originalCode || asset.code) === '04118b')
  const beforeDeck = inv.deck.length
  fate.behavior.performAction(state, inv, move, fateApi(state))
  assert.equal(inv.deck.length, beforeDeck - 3, '代价：弃牌库顶 3 张')
  assert.equal(harlan.clues, 1, '检定意志(4)成功：在哈伦上放 1 个线索')
})

test('TFA 04119 来到展厅：放置市政厅并把古代遗物附属到市政厅', () => {
  const state = boot('threadsOfFate')
  const act = setThreadAct(state, 'ab', ['04117a', '04119', '04123'], 1)
  state.scenarioFlags.actDecks.cd.completed = true
  fate.behavior.actReveal(state, act, fateApi(state))
  const hall = state.locations.find(location => location.id === 'townHall')
  assert.ok(hall, '市政厅进入游戏')
  assert.equal(state.relicOfAges.location, 'townHall', '古代遗物附属到市政厅')
  assert.equal(hall.clues, 2, '只剩 2 本幕牌库时市政厅额外加线索')
})

test('TFA 04120 来到展厅（另一面）：生成兄弟会教徒、治疗全部伤害并让遗物附在其上', () => {
  const state = boot('threadsOfFate')
  const act = setThreadAct(state, 'ab', ['04117a', '04120', '04124'], 1)
  state.encounterDeck = ['04095']
  const spawned = []
  fate.behavior.actReveal(state, act, fateApi(state, {
    spawn: (code, location) => {
      const enemy = spawnTestEnemy(state, code, location)
      spawned.push(enemy)
      return enemy
    },
  }))
  const cultist = spawned.find(enemy => (enemy.originalCode || enemy.code) === '04095')
  assert.ok(cultist, '生成兄弟会异教徒')
  assert.equal(cultist.damageTaken, 0, '治疗全部伤害')
  assert.equal(state.relicOfAges.enemyId, cultist.id, '古代遗物附属到最远的兄弟会异教徒')
})

test('TFA 04121 哈伦的诅咒：古代遗物附属到珍品店；2 本幕牌库时在店中生成侍僧', () => {
  const state = boot('threadsOfFate')
  const act = setThreadAct(state, 'ab', ['04118a', '04121', '04123'], 1)
  state.scenarioFlags.actDecks.ef.completed = true
  state.encounterDeck = ['01169', '01169', '01169']
  const spawned = []
  fate.behavior.actReveal(state, act, fateApi(state, {
    spawn: (code, location) => { spawned.push({ code, location }); return spawnTestEnemy(state, code, location) },
  }))
  assert.equal(state.relicOfAges.location, 'curiositieShoppe')
  assert.equal(spawned.filter(entry => entry.code === '01169').length, 1, '1-2 名调查员时生成 1 个侍僧')
})

test('TFA 04122 哈伦的诅咒（切换面）：把旁人换成敌人并把遗物附到敌人上', () => {
  const state = boot('threadsOfFate')
  fate.behavior.actReveal(state, setThreadAct(state, 'ab', ['04118a', '04121', '04123'], 0), fateApi(state))
  const act = setThreadAct(state, 'ab', ['04118a', '04122', '04124'], 1)
  const spawned = []
  fate.behavior.actReveal(state, act, fateApi(state, {
    spawn: (code, location) => { const enemy = spawnTestEnemy(state, code, location); spawned.push(enemy); return enemy },
  }))
  assert.equal(state.storyAssets.some(asset => (asset.originalCode || asset.code) === '04118b'), false, '移除旁人版本')
  const enemy = spawned.find(entry => (entry.originalCode || entry.code) === '04122b')
  assert.ok(enemy, '生成被诅咒的哈伦')
  assert.equal(state.relicOfAges.enemyId, enemy.id)
})

test('TFA 04122b 哈伦·恩斯通（敌人）：生成时接管古代遗物；躲避超过 3 点进胜利区', () => {
  const state = boot('threadsOfFate')
  const enemy = spawnTestEnemy(state, '04122b', 'easttown')
  enemyScriptFor('04122b').onSpawn(state, enemy, fateApi(state))
  assert.equal(state.relicOfAges.enemyId, enemy.id)
  assert.equal(enemyRuleFor('04122b').victory, 1)
  const inv = state.investigators[0]
  inv.location = 'easttown'
  fate.behavior.afterEvade(state, inv, enemy, { success: true, value: 6, difficulty: 3 }, fateApi(state))
  assert.ok(state.victoryDisplay.some(card => (card.originalCode || card.code) === '04122b'), '躲避超过 3 点：加入胜利区')
  assert.equal(state.enemies.includes(enemy), false)
})

test('TFA 04123 寻找遗物：遗迹若附在地点则帷幕 +2；无线索时推进并取得遗物', () => {
  const state = boot('threadsOfFate')
  setThreadAct(state, 'ab', ['04117a', '04119', '04123'], 2)
  const hall = place(state, 'townHall')
  hall.clues = 0
  state.relicOfAges = { code: '04061', location: 'townHall', seat: null }
  assert.equal(fate.behavior.locationShroudModifier(state, hall), 2, '遗物所在地点帷幕 +2')
  fate.behavior.checkObjectives(state, fateApi(state))
  const inv = state.investigators[0]
  assert.ok(inv.assets.some(asset => (asset.originalCode || asset.code) === '04061'), '最近的调查员取得古代遗物')
  assert.equal(state.scenarioFlags.actDecks.ab.completed, true)
})

test('TFA 04124 夺回遗物：遗物附在敌人上时其生命 +2×人数；敌人离场时推进并取得遗物', () => {
  const state = boot('threadsOfFate')
  setThreadAct(state, 'ab', ['04117a', '04120', '04124'], 2)
  const enemy = spawnTestEnemy(state, '04095', 'rivertown')
  state.relicOfAges = { code: '04061', location: 'rivertown', enemyId: enemy.id }
  assert.equal(fate.behavior.enemyStatModifier(state, enemy, 'health'), 2 * state.numInvestigators)
  state.enemies = state.enemies.filter(entry => entry.id !== enemy.id)
  fate.behavior.checkObjectives(state, fateApi(state))
  assert.ok(state.investigators[0].assets.some(asset => (asset.originalCode || asset.code) === '04061'))
})

test('TFA 04125a 寻找亚历山卓：揭示后在维尔玛小餐馆放置亨利·德沃（旁人）', () => {
  const state = boot('threadsOfFate')
  const act = setThreadAct(state, 'cd', ['04125a', '04129', '04131'], 0)
  fate.behavior.actReveal(state, act, fateApi(state))
  const henry = state.storyAssets.find(asset => (asset.originalCode || asset.code) === '04125b')
  assert.ok(henry, '亨利·德沃进入游戏')
  assert.equal(henry.location, 'velmasDiner')
})

test('TFA 04125b 亨利·德沃：同地点谈判弃 1 张手牌，智识(3)成功放线索', () => {
  const state = boot('threadsOfFate')
  fate.behavior.actReveal(state, setThreadAct(state, 'cd', ['04125a', '04129', '04131'], 0), fateApi(state))
  const inv = state.investigators[0]
  inv.location = 'velmasDiner'
  inv.hand = ['01020', '01021']
  const move = fate.behavior.actions(state, inv).find(entry => entry.rule === 'parleyHenry')
  assert.ok(move)
  fate.behavior.performAction(state, inv, move, fateApi(state))
  assert.equal(inv.hand.length, 1, '代价：弃 1 张手牌')
  const henry = state.storyAssets.find(asset => (asset.originalCode || asset.code) === '04125b')
  assert.equal(henry.clues, 1)
})

test('TFA 04126a 失踪人口：揭示后放置阿卡姆警察局并与东城区相连', () => {
  const state = boot('threadsOfFate')
  const act = setThreadAct(state, 'cd', ['04126a', '04128a', '04131'], 0)
  fate.behavior.actReveal(state, act, fateApi(state))
  const station = state.locations.find(location => location.id === 'arkhamPoliceStation')
  assert.ok(station, '阿卡姆警察局进入游戏')
  assert.ok(station.connections.includes('easttown'), '与东城区相连')
  assert.equal(station.clues, 2 * state.numInvestigators, '地点印刷 2[per_investigator] 线索')
})

test('TFA 04126b 阿卡姆警察局：行动从牌库顶 6 张找武器加入手牌', () => {
  const state = boot('threadsOfFate')
  const location = place(state, 'arkhamPoliceStation')
  const inv = state.investigators[0]
  inv.location = location.id
  const weapon = Object.values(ALL_CARDS).find(card => card.pack === 'core' && card.type === 'asset'
    && (card.traits || []).includes('Weapon'))
  assert.ok(weapon, '存在武器卡用于测试')
  inv.deck = ['01022', '01022', weapon.code, '01022', '01022', '01022']
  inv.hand = []
  const move = fate.behavior.actions(state, inv).find(entry => entry.rule === 'policeSearchWeapon')
  assert.ok(move, '警局提供「查找武器」行动')
  fate.behavior.performAction(state, inv, move, fateApi(state))
  assert.ok(inv.hand.includes(weapon.code), '找到的武器加入手牌')
})

test('TFA 04127 车站：生成狩猎中的夜魇于最远地点并把亚历山卓附属其上（不加毁灭）', () => {
  const state = boot('threadsOfFate')
  const act = setThreadAct(state, 'cd', ['04126a', '04127', '04132'], 1)
  state.encounterDeck = ['01172']
  const spawned = []
  fate.behavior.actReveal(state, act, fateApi(state, {
    spawn: (code, location) => { const enemy = spawnTestEnemy(state, code, location); spawned.push(enemy); return enemy },
  }))
  const nightgaunt = spawned.find(enemy => (enemy.originalCode || enemy.code) === '01172')
  assert.ok(nightgaunt, '生成狩猎中的夜魇')
  assert.equal(state.scenarioFlags.alejandro?.enemyId, nightgaunt.id, '亚历山卓附属到夜魇上')
  assert.equal(nightgaunt.doom || 0, 0, '本条背面没有「放毁灭」文本')
})

test('TFA 04128a 车站（另一面）：放置火车轨道并把亚历山卓附属到轨道', () => {
  const state = boot('threadsOfFate')
  const act = setThreadAct(state, 'cd', ['04126a', '04128a', '04131'], 1)
  fate.behavior.actReveal(state, act, fateApi(state))
  assert.ok(state.locations.some(location => location.id === 'trainTracks'), '火车轨道进入游戏')
  assert.equal(state.scenarioFlags.alejandro?.location, 'trainTracks')
})

test('TFA 04128b 火车轨道：花费 1 个线索抽 4 张（每场游戏一次）；与北区相连', () => {
  const state = boot('threadsOfFate')
  const tracks = place(state, 'trainTracks')
  assert.ok(tracks.connections.includes('northside'))
  const inv = state.investigators[0]
  inv.location = tracks.id
  inv.clues = 1
  inv.hand = []
  const move = fate.behavior.actions(state, inv).find(entry => entry.rule === 'trainTracksDraw')
  assert.ok(move)
  fate.behavior.performAction(state, inv, move, fateApi(state))
  assert.equal(inv.clues, 0)
  assert.equal(inv.hand.length, 4)
  assert.equal(state.scenarioFlags.usedAbilities.trainTracks, true)
  const again = fate.behavior.actions(state, inv).find(entry => entry.rule === 'trainTracksDraw')
  assert.equal(again.used, true, '每场游戏仅限一次')
})

test('TFA 04129 位高权重：放置市政厅并把亚历山卓附属到市政厅', () => {
  const state = boot('threadsOfFate')
  const act = setThreadAct(state, 'cd', ['04125a', '04129', '04131'], 1)
  fate.behavior.actReveal(state, act, fateApi(state))
  assert.ok(state.locations.some(location => location.id === 'townHall'))
  assert.equal(state.scenarioFlags.alejandro?.location, 'townHall')
})

test('TFA 04130a 位高权重（切换面）：把亨利换成敌人并把亚历山卓附属到敌人', () => {
  const state = boot('threadsOfFate')
  fate.behavior.actReveal(state, setThreadAct(state, 'cd', ['04125a', '04129', '04131'], 0), fateApi(state))
  const act = setThreadAct(state, 'cd', ['04125a', '04130a', '04132'], 1)
  const spawned = []
  fate.behavior.actReveal(state, act, fateApi(state, {
    spawn: (code, location) => { const enemy = spawnTestEnemy(state, code, location); spawned.push(enemy); return enemy },
  }))
  assert.equal(state.storyAssets.some(asset => (asset.originalCode || asset.code) === '04125b'), false)
  const enemy = spawned.find(entry => (entry.originalCode || entry.code) === '04130b')
  assert.ok(enemy)
  assert.equal(state.scenarioFlags.alejandro?.enemyId, enemy.id)
})

test('TFA 04130b 亨利·德沃（敌人）：生成时接管亚历山卓；反击关键词', () => {
  const state = boot('threadsOfFate')
  const enemy = spawnTestEnemy(state, '04130b', 'velmasDiner')
  enemyScriptFor('04130b').onSpawn(state, enemy, fateApi(state))
  assert.equal(state.scenarioFlags.alejandro?.enemyId, enemy.id)
  assert.equal(enemyRuleFor('04130b').victory, 1)
  assert.equal(state.scenario.enemies['04130b'].retaliate, true)
})

test('TFA 04131 亚历山卓的监狱：亚历山卓附在地点上时帷幕 +2；无线索时推进并救人', () => {
  const state = boot('threadsOfFate')
  setThreadAct(state, 'cd', ['04125a', '04129', '04131'], 2)
  const hall = place(state, 'townHall')
  hall.clues = 0
  state.scenarioFlags.alejandro = { code: '04051', location: 'townHall' }
  assert.equal(fate.behavior.locationShroudModifier(state, hall), 2)
  fate.behavior.checkObjectives(state, fateApi(state))
  assert.ok(state.investigators[0].assets.some(asset => (asset.originalCode || asset.code) === '04051'))
})

test('TFA 04132 亚历山卓遇险：亚历山卓附在敌人上时其生命 +2×人数；离场时推进并救人', () => {
  const state = boot('threadsOfFate')
  setThreadAct(state, 'cd', ['04125a', '04130a', '04132'], 2)
  const enemy = spawnTestEnemy(state, '04130b', 'rivertown')
  state.scenarioFlags.alejandro = { code: '04051', location: 'rivertown', enemyId: enemy.id }
  assert.equal(fate.behavior.enemyStatModifier(state, enemy, 'health'), 2 * state.numInvestigators)
  state.enemies = state.enemies.filter(entry => entry.id !== enemy.id)
  fate.behavior.checkObjectives(state, fateApi(state))
  assert.ok(state.investigators[0].assets.some(asset => (asset.originalCode || asset.code) === '04051'))
})

test('TFA 04133a 女猎手的苦旅：揭示后放置漆黑洞穴', () => {
  const state = boot('threadsOfFate')
  const act = setThreadAct(state, 'ef', ['04133a', '04135', '04140'], 0)
  fate.behavior.actReveal(state, act, fateApi(state))
  assert.ok(state.locations.some(location => location.id === 'blackCave'))
})

test('TFA 04133b 漆黑洞穴：回合末二选一（1 恐惧 / 弃 2 张手牌）；与河岸城相连', () => {
  const state = boot('threadsOfFate')
  const cave = place(state, 'blackCave')
  assert.ok(cave.connections.includes('rivertown'))
  const inv = state.investigators[0]
  inv.location = cave.id
  inv.hand = ['01020', '01021', '01022']
  fate.behavior.turnEnded(state, inv, fateApi(state, { choose: () => 'horror' }))
  assert.equal(inv.horror, 1)
  fate.behavior.turnEnded(state, inv, fateApi(state, { choose: () => 'discard' }))
  assert.equal(inv.hand.length, 1, '选择弃 2 张手牌')
})

test('TFA 04134a 守卫者的追根究底：揭示后在珍品店放置玛利亚·德西瓦（旁人）', () => {
  const state = boot('threadsOfFate')
  const act = setThreadAct(state, 'ef', ['04134a', '04137a', '04140'], 0)
  fate.behavior.actReveal(state, act, fateApi(state))
  const maria = state.storyAssets.find(asset => (asset.originalCode || asset.code) === '04134b')
  assert.ok(maria)
  assert.equal(maria.location, 'curiositieShoppe')
})

test('TFA 04134b 玛利亚·德西瓦：同地点谈判花费 1 资源，智识(3)成功放线索', () => {
  const state = boot('threadsOfFate')
  fate.behavior.actReveal(state, setThreadAct(state, 'ef', ['04134a', '04137a', '04140'], 0), fateApi(state))
  const inv = state.investigators[0]
  inv.location = 'curiositieShoppe'
  const move = fate.behavior.actions(state, inv).find(entry => entry.rule === 'parleyMaria')
  assert.ok(move)
  const resources = inv.resources
  fate.behavior.performAction(state, inv, move, fateApi(state))
  assert.equal(inv.resources, resources - 1, '代价：花费 1 资源')
  const maria = state.storyAssets.find(asset => (asset.originalCode || asset.code) === '04134b')
  assert.equal(maria.clues, 1)
})

test('TFA 04135 漆黑的洞穴：弃遭遇直到弃出异教徒并在洞穴生成，记为伊塔卡的猎物', () => {
  const state = boot('threadsOfFate')
  const act = setThreadAct(state, 'ef', ['04133a', '04135', '04140'], 1)
  state.encounterDeck = ['04076', '04095']
  const spawned = []
  fate.behavior.actReveal(state, act, fateApi(state, {
    spawn: (code, location) => { const enemy = spawnTestEnemy(state, code, location); spawned.push({ code, location }); return enemy },
  }))
  const cultist = spawned.find(entry => entry.code === '04095')
  assert.ok(cultist, '弃到异教徒后生成')
  assert.equal(cultist.location, 'blackCave')
  assert.equal(state.scenarioFlags.ichtacasPrey.length, 1, '记为伊塔卡的猎物')
})

test('TFA 04136 漆黑的洞穴（另一面）：放置市政厅、连接两地点、逐人弃遭遇牌', () => {
  const state = boot('threadsOfFate')
  const act = setThreadAct(state, 'ef', ['04133a', '04136', '04139'], 1)
  place(state, 'blackCave')
  state.encounterDeck = ['01166']
  fate.behavior.actReveal(state, act, fateApi(state))
  assert.ok(state.locations.some(location => location.id === 'townHall'))
  assert.ok(state.scenarioFlags.ichtacasDestinations.includes('townHall'))
  const cave = state.locations.find(location => location.id === 'blackCave')
  const hall = state.locations.find(location => location.id === 'townHall')
  assert.ok(cave.connections.includes('townHall') && hall.connections.includes('blackCave'))
  assert.ok(state.encounterDiscard.includes('01166'), '弃掉的非诡计牌进入遭遇弃牌堆')
})

test('TFA 04137a 古怪遗物：把玛利亚换成敌人并记为伊塔卡的猎物', () => {
  const state = boot('threadsOfFate')
  fate.behavior.actReveal(state, setThreadAct(state, 'ef', ['04134a', '04137a', '04140'], 0), fateApi(state))
  const act = setThreadAct(state, 'ef', ['04134a', '04137a', '04140'], 1)
  const spawned = []
  fate.behavior.actReveal(state, act, fateApi(state, {
    spawn: (code, location) => { const enemy = spawnTestEnemy(state, code, location); spawned.push(enemy); return enemy },
  }))
  assert.equal(state.storyAssets.some(asset => (asset.originalCode || asset.code) === '04134b'), false)
  const enemy = spawned.find(entry => (entry.originalCode || entry.code) === '04137b')
  assert.ok(enemy)
  assert.ok(state.scenarioFlags.ichtacasPrey.includes(enemy.id))
})

test('TFA 04137b 玛利亚·德西瓦（敌人）：生成时成为伊塔卡的猎物；胜利 1', () => {
  const state = boot('threadsOfFate')
  const enemy = spawnTestEnemy(state, '04137b', 'curiositieShoppe')
  enemyScriptFor('04137b').onSpawn(state, enemy)
  assert.ok(state.scenarioFlags.ichtacasPrey.includes(enemy.id))
  assert.equal(enemyRuleFor('04137b').victory, 1)
})

test('TFA 04138 古怪遗物（另一面）：记住两个目的地并逐人弃遭遇牌', () => {
  const state = boot('threadsOfFate')
  const act = setThreadAct(state, 'ef', ['04134a', '04138', '04139'], 1)
  state.encounterDeck = ['01166']
  fate.behavior.actReveal(state, act, fateApi(state))
  assert.ok(state.scenarioFlags.ichtacasDestinations.includes('downtown'))
  assert.ok(state.scenarioFlags.ichtacasDestinations.includes('rivertown'))
  assert.ok(state.encounterDiscard.includes('01166'))
})

test('TFA 04139 怪事丛生：目的地每轮第一张遭遇诡计获得涌动；推进时让最近调查员获得伊塔卡', () => {
  const state = boot('threadsOfFate')
  const act = setThreadAct(state, 'ef', ['04133a', '04136', '04139'], 2)
  state.scenarioFlags.ichtacasDestinations = ['rivertown']
  const inv = state.investigators[0]
  inv.location = 'rivertown'
  assert.equal(fate.behavior.encounterGainsSurge(state, '04076', inv), true)
  assert.equal(fate.behavior.encounterGainsSurge(state, '04076', inv), false, '每轮只对第一张生效')
  fate.behavior.actReveal(state, act, fateApi(state))
  assert.ok(state.investigators.some(entry => entry.assets.some(asset => (asset.originalCode || asset.code) === '04147')),
    '最近的调查员控制伊塔卡')
})

test('TFA 04140 兄弟会暴露：猎物在无线索地点 +1 战斗/躲避/生命；全部离场后推进并获得伊塔卡', () => {
  const state = boot('threadsOfFate')
  setThreadAct(state, 'ef', ['04137a', '04137b', '04140'], 2)
  const enemy = spawnTestEnemy(state, '04095', 'rivertown')
  state.scenarioFlags.ichtacasPrey = [enemy.id]
  state.scenarioFlags.ichtacasPreyCodes = { [enemy.id]: '04137b' }
  state.scenarioFlags.ichtacasDestinations = []
  const location = state.locations.find(entry => entry.id === 'rivertown')
  location.clues = 0
  assert.equal(fate.behavior.enemyStatModifier(state, enemy, 'fight'), 1)
  assert.equal(fate.behavior.enemyStatModifier(state, enemy, 'evade'), 1)
  assert.equal(fate.behavior.enemyStatModifier(state, enemy, 'health'), state.numInvestigators)
  state.enemies = []
  fate.behavior.checkObjectives(state, fateApi(state))
  assert.ok(state.investigators.some(entry => entry.assets.some(asset => (asset.originalCode || asset.code) === '04147')))
})

test('TFA 04141 维尔玛小餐馆：与东城区相连；3 行动听闲聊获得 2 个线索（每场游戏一次）', () => {
  const state = boot('threadsOfFate')
  assert.ok(state.scenario.locations.velmasDiner.connections.includes('easttown'))
  const inv = state.investigators[0]
  inv.location = 'velmasDiner'
  // 引擎侧的行动费用读点：2 个行动时不出现在合法行动里，4 个行动时以 3 行动出现。
  inv.actionsLeft = 2
  assert.equal(legalMoves(state, 0).some(move => move.rule === 'velmasGossip'), false)
  inv.actionsLeft = 4
  const engineMove = legalMoves(state, 0).find(move => move.rule === 'velmasGossip')
  assert.equal(engineMove.actions, 3)
  const move = fate.behavior.actions(state, inv).find(entry => entry.rule === 'velmasGossip')
  assert.ok(move)
  assert.equal(move.actions, 3, '需要 3 个行动')
  const clues = inv.clues
  fate.behavior.performAction(state, inv, move, fateApi(state))
  assert.equal(inv.clues, clues + 2)
  const again = fate.behavior.actions(state, inv).find(entry => entry.rule === 'velmasGossip')
  assert.equal(again.used, true, '每场游戏仅限一次')
})

test('TFA 04142 珍品店：与北区相连；位于此处打出[[遗物]]支援费用 -2', () => {
  const state = boot('threadsOfFate')
  assert.ok(state.scenario.locations.curiositieShoppe.connections.includes('northside'))
  assert.equal(relicDiscountLocation('04142'), true)
  assert.equal(registeredEntry('04142').relicDiscountLocation, true)
})

test('TFA 04143 市政厅：进入时手牌 4+ 弃到只剩 3 张', () => {
  const state = boot('threadsOfFate')
  const hall = place(state, 'townHall')
  const inv = state.investigators[0]
  inv.location = hall.id
  inv.hand = ['01020', '01021', '01022', '01023', '01024']
  fate.behavior.locationEntered(state, inv, hall, fateApi(state))
  assert.equal(inv.hand.length, 3)
  inv.hand = ['01020', '01021', '01022']
  fate.behavior.locationEntered(state, inv, hall, fateApi(state))
  assert.equal(inv.hand.length, 3, '不足 4 张不弃')
})

test('TFA 04144 密不可泄：检定难度与失败伤害随已完成幕牌库数增加', () => {
  const state = boot('threadsOfFate')
  let difficulty = 0
  const damages = []
  registeredEntry('04144').encounterResolve(state, state.investigators[0], { code: '04144' }, fateApi(state, {
    test: (seat, skill, value, resolve) => {
      difficulty = value
      resolve({ success: false, value: 0, difficulty: value, skill, drawn: [] })
    },
    damage: (seat, amount) => damages.push(amount),
    horror: (seat, amount) => damages.push(amount),
  }))
  assert.equal(difficulty, 3, '3 本幕牌库在场：难度 3')
  assert.equal(damages.length, 2, '失败受到 1 伤害 + 1 恐惧')
  state.scenarioFlags.actDecks.cd.completed = true
  registeredEntry('04144').encounterResolve(state, state.investigators[0], { code: '04144' }, fateApi(state, {
    test: (seat, skill, value, resolve) => { difficulty = value; resolve({ success: false, value: 0, difficulty: value, skill, drawn: [] }) },
    damage: () => {},
    horror: () => {},
  }))
  assert.equal(difficulty, 4, '已完成 1 本幕牌库：难度 +1')
})

test('TFA 04145 屋中无人：附属地点调查 +1 行动；地点无线索时涌动、轮末弃掉', () => {
  const state = boot('threadsOfFate')
  const inv = state.investigators[0]
  const location = state.locations.find(entry => entry.id === inv.location)
  location.clues = 2
  registeredEntry('04145').encounterResolve(state, inv, { code: '04145' }, fateApi(state))
  const attachment = (location.attachments || []).find(entry => (entry.originalCode || entry.code) === '04145')
  assert.ok(attachment, '附属到你的地点')
  assert.equal(locationAttachmentTotal(location, 'investigateExtraActions'), 1, '调查额外花费 1 行动')
  const noClues = boot('threadsOfFate')
  const empty = noClues.locations.find(entry => entry.id === noClues.investigators[0].location)
  empty.clues = 0
  let drew = 0
  registeredEntry('04145').encounterResolve(noClues, noClues.investigators[0], { code: '04145' },
    fateApi(noClues, { drawEncounter: () => { drew += 1 } }))
  assert.equal(drew, 1, '无线索时获得涌动：再抽 1 张遭遇牌')
  fate.behavior.roundEnded(noClues, fateApi(noClues))
  assert.equal((empty.attachments || []).length, 0, '轮末弃掉')
})

test('TFA 04146 鲜血阴谋：附属密谋使毁灭阈值 -1；异教徒谈判成功弃掉并回复阈值', () => {
  const state = boot('threadsOfFate')
  const inv = state.investigators[0]
  const thresholdBefore = state.agendas[state.agendaIndex].doomThreshold
  registeredEntry('04146').encounterResolve(state, inv, { code: '04146' }, fateApi(state, {
    addAgendaDoomThreshold: delta => { state.agendas[state.agendaIndex].doomThreshold += delta },
    attachToAgenda: code => {
      const agenda = state.agendas[state.agendaIndex]
      agenda.attachments ||= []
      agenda.attachments.push({ id: `att-${code}`, code, originalCode: code })
    },
  }))
  assert.equal(state.agendas[state.agendaIndex].doomThreshold, thresholdBefore - 1)
  assert.ok((state.agendas[state.agendaIndex].attachments || []).some(card => (card.originalCode || card.code) === '04146'))
  const cultist = spawnTestEnemy(state, '04095', inv.location)
  const move = fate.behavior.actions(state, inv).find(entry => entry.rule === 'parleyConspiracy')
  assert.ok(move, '异教徒获得谈判行动')
  fate.behavior.performAction(state, inv, move, fateApi(state, { choose: () => 'success' }))
  assert.equal(state.agendas[state.agendaIndex].doomThreshold, thresholdBefore, '成功弃掉后毁灭阈值回复')
  assert.equal((state.agendas[state.agendaIndex].attachments || []).length, 0)
  assert.ok(state.encounterDiscard.includes('04146'))
  void cultist
})

test('TFA 04147 伊塔卡：+1 战斗/敏捷（对胜利/复仇敌人 +2）；击败敌人后横置治愈恐惧', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  const baseCombat = getStat(state, inv, 'combat')
  const baseAgility = getStat(state, inv, 'agility')
  inv.assets.push({ id: 'ichtaca', code: '04147', originalCode: '04147', exhausted: false, horror: 1 })
  inv.horror = 1
  assert.equal(getStat(state, inv, 'combat'), baseCombat + 1)
  assert.equal(getStat(state, inv, 'agility'), baseAgility + 1)
  const entry = registeredEntry('04147')
  assert.deepEqual(entry.passive, { stats: { combat: 1, agility: 1 } })
  assert.equal(entry.bonusVsVictoryCombat, 1)
  assert.equal(entry.bonusVsVengeanceAgility, 1)
  assert.equal(entry.exhaustOnEnemyDefeatedHealHorror, 1)
  // 击败带胜利点的敌人：伊塔卡被横置并治愈自己与持有者各 1 点恐惧。
  const enemy = spawnEnemy(state, '04084', inv.location)
  enemy.damageTaken = (enemy.health || 5) - 1
  inv.combat = 20
  const fight = legalMoves(state, 0).find(move => move.action === 'fight' && move.enemyId === enemy.id)
  assert.ok(fight)
  applyMove(state, 0, fight)
  for (let guard = 0; state.pendingChoice && guard < 20; guard++) {
    const pending = state.pendingChoice
    const optionId = pending.options.some(option => option.id === 'heal') ? 'heal' : pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
  const after = state.investigators[0]
  const ichtaca = after.assets.find(asset => asset.code === '04147')
  assert.equal(after.horror, 0, '治愈自己 1 点恐惧')
  assert.equal(ichtaca.horror, 0, '同时治愈伊塔卡 1 点恐惧')
  assert.equal(ichtaca.exhausted, true, '伊塔卡被横置')
  assert.ok((state.victoryDisplay || []).some(card => (card.originalCode || card.code) === '04084'))
})

test('TFA 04148 探险日志：每回合额外一次只能用于探索的行动', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  inv.assets.push({ id: 'journal', code: '04148', originalCode: '04148', exhausted: false })
  inv.actionsLeft = 1
  inv.exploreOnlyActions = 1
  assert.match(validateMove(state, 0, { action: 'resource' }), /额外行动只能用于探索/)
  state.explorationDeck = ['pathOfThorns']
  const explore = legalMoves(state, 0).find(move => move.action === 'explore')
  assert.ok(explore, '探索行动应在合法行动里')
  assert.equal(validateMove(state, 0, explore), null, '探索可以花掉探索专用行动')
  applyMove(state, 0, explore)
  settle(state)
  assert.ok(state.log.some(line => (typeof line === 'string' ? line : line.text || '').includes('荆棘之路')))
})


