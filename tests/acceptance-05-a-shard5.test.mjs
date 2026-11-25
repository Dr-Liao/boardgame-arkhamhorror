import test from 'node:test'
import assert from 'node:assert/strict'
import { registerContentBundle } from '../content/registered.js'
import { manifest as tcuCampaignPack } from '../content/packs/tcuCampaign/manifest.js'
import { manifest as campaignManifest } from '../content/campaigns/theCircleUndone/manifest.js'
import * as fgg from '../content/campaigns/theCircleUndone/scenarios/forTheGreaterGood/index.js'
import { behavior } from '../content/campaigns/theCircleUndone/scenarios/forTheGreaterGood/behavior.js'
import { fggChaosToken } from '../content/campaigns/theCircleUndone/scenarios/forTheGreaterGood/chaos.js'
import { membersAct1, KEY_IDS, LOCATIONS, ACT_OBTAINING_DEVICE, NATHAN_WICK_INITIATION, PUZZLE_BOX, AUGUST_LINDQUIST } from '../content/campaigns/theCircleUndone/scenarios/forTheGreaterGood/definition.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { createGameState, applyMove, legalMoves, placeLocation, spawnEnemy, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registeredEntry } from '../src/engine/ability.js'

// ---------------------------------------------------------------------------
// 05-a 分片 5 验收装置：把《崇高利益》克隆成可启动的验收关卡，用真实引擎布置。
// 逐卡证据：本文件只补「既有测试没有标题含卡号用例」的卡（05200/05202/05206/
// 05207/05209/05211/05212/05214/05216/05217b/05227）并加固 05197 的困难面分支。
// ---------------------------------------------------------------------------
const PACK_ID = 'tcuAcceptance05a5Pack'
const CAMPAIGN_ID = 'tcuAcceptance05a5Campaign'
const SCENARIO_ID = 'tcuAcceptance05a5Scenario'
registerContentBundle({
  packs: [{ ...tcuCampaignPack, id: PACK_ID, status: 'playable' }],
  campaigns: [{
    ...campaignManifest,
    id: CAMPAIGN_ID,
    name: '万象无终（05-a 分片 5 验收）',
    status: 'playable',
    scenarioIds: [SCENARIO_ID],
    unlock: { [SCENARIO_ID]: [] },
    requiredPackIds: ['core', PACK_ID],
    flow: { start: SCENARIO_ID, nodes: { [SCENARIO_ID]: { type: 'scenario', scenarioId: SCENARIO_ID, next: 'end' }, end: { type: 'end' } } },
  }],
  scenarios: [{
    scenario: { ...fgg.scenario, id: SCENARIO_ID },
    behavior: { ...fgg.behavior, id: SCENARIO_ID },
    manifest: {
      ...Object.fromEntries(Object.entries(fgg.manifest).filter(([key]) => !['catalogReferenceOnly', 'referenceCode'].includes(key))),
      id: SCENARIO_ID,
      campaignId: CAMPAIGN_ID,
      status: 'playable',
      name: fgg.scenario.name,
      requiredPackIds: ['core', PACK_ID],
      requiredEncounterGroupIds: [],
      behaviorIds: [SCENARIO_ID],
    },
  }],
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

function boot(seed = 'tcu-05a5') {
  const state = createGameState({ campaignId: CAMPAIGN_ID, seed, playerInvestigator: '01001' }, [{ seat: 0 }])
  settle(state)
  for (const inv of state.investigators) {
    inv.actionsLeft = 4
    inv.resources = 10
    inv.clues = 0
    inv.deck = Array(20).fill('01020')
    inv.threat ||= []
    inv.assets ||= []
    inv.hand ||= []
  }
  return state
}

function place(state, id) {
  placeLocation(state, id, [])
  return state.locations.find(location => location.id === id)
}

function apiStub(state, overrides = {}) {
  const calls = []
  const base = {
    calls,
    info: () => {},
    random: () => 0.5,
    choose: request => request?.options?.[0]?.id ?? '0',
    reveal: id => { const location = state.locations.find(entry => entry.id === id); if (location) location.revealed = true },
    place: id => { place(state, id); return state.locations.find(entry => entry.id === id) },
    spawn: (code, location) => {
      const def = state.scenario?.enemies?.[code] || {}
      const enemy = { ...clone(def), id: `enemy-${code}-${++sequence}`, code, originalCode: code, location, damageTaken: 0, doom: 0, exhausted: false, engagedSeat: null }
      state.enemies.push(enemy)
      calls.push({ kind: 'spawn', code, location })
      return enemy
    },
    giveAsset: (seat, code) => { state.investigators[seat].assets.push({ id: `asset-${code}-${++sequence}`, code, originalCode: code, exhausted: false }) },
    payClues: (amount, locationId) => { calls.push({ kind: 'payClues', amount, locationId }) },
    advanceAct: () => calls.push({ kind: 'advanceAct' }),
    revealToken: seat => calls.push({ kind: 'revealToken', seat }),
    addDoom: amount => { state.doom = (state.doom || 0) + amount },
    directHorror: (seat, amount) => { state.investigators[seat].horror += amount },
    horrorAsset: (seat, id, amount) => calls.push({ kind: 'horrorAsset', seat, id, amount }),
    resign: seat => { state.investigators[seat].resigned = true },
    banish: enemy => calls.push({ kind: 'banish', id: enemy.id }),
    test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty, difficulty, skill, drawn: [] }),
  }
  return Object.assign(base, overrides)
}

function keyHolder(state, id, seat) {
  state.scenarioKeys ||= behavior.createKeys()
  state.scenarioKeys[id].holder = seat
}

// ===========================================================================
// 05197 混乱标记（加固困难面与「无目标改揭示」分支）
// ===========================================================================
test('TCU 05197 崇高利益：困难面骷髅取异教徒毁灭总和，无目标时改再揭示', () => {
  const state = boot('05197-hard')
  const me = state.investigators[0]
  const first = spawnEnemy(state, '05218', me.location)
  const second = spawnEnemy(state, '05219', me.location)
  first.doom = 1
  second.doom = 3
  state.difficulty = 'hard'
  assert.equal(fggChaosToken(state, me, 'skull').delta, -4, '困难面 X = 异教徒敌人毁灭总和 1+3')
  state.difficulty = 'standard'
  assert.equal(fggChaosToken(state, me, 'skull').delta, -3, '普通面 X = 单卡最高毁灭')
  assert.equal(fggChaosToken(state, me, 'cultist').drawAnother, true, '异教徒标记追加揭示')
  const noCultists = boot('05197-none')
  noCultists.enemies = []
  const stub = apiStub(noCultists)
  noCultists.difficulty = 'hard'
  behavior.afterTest(noCultists, noCultists.investigators[0], { success: false, drawn: ['tablet'] }, stub)
  assert.deepEqual(stub.calls.filter(call => call.kind === 'revealToken').length, 1, '困难面石板失败且场上无异教徒：再揭示一个标记')
  const targets = boot('05197-targets')
  targets.enemies = []
  const a = spawnEnemy(targets, '05218', targets.investigators[0].location)
  const b = spawnEnemy(targets, '05219', targets.investigators[0].location)
  a.doom = 0
  b.doom = 0
  targets.difficulty = 'hard'
  behavior.afterTest(targets, targets.investigators[0], { success: false, drawn: ['tablet'] }, apiStub(targets))
  assert.equal(a.doom, 1)
  assert.equal(b.doom, 1, '困难面石板失败：每个异教徒敌人各 +1 毁灭')
  behavior.afterTest(targets, targets.investigators[0], { success: false, drawn: ['elderthing'] }, apiStub(targets))
  assert.equal(a.doom + b.doom, 1, '困难面古神失败：把毁灭最多的敌人身上的毁灭全部移到议程')
  assert.equal(targets.doom, 1, '移动的毁灭进入当前议程')
})

// ===========================================================================
// 05200 热烈欢迎（成员分支幕 1）
// ===========================================================================
test('TCU 05200 热烈欢迎：背面放入藏书室、生成南森（引导大师）并附属机关盒', () => {
  const state = boot('05200')
  const runtime = scenarioRuntime(state, [])
  behavior.actReveal(state, clone(membersAct1), runtime)
  const library = state.locations.find(location => location.id === LOCATIONS.library)
  assert.ok(library, '藏书室进入游戏')
  const nathan = state.enemies.find(enemy => (enemy.originalCode || enemy.code) === NATHAN_WICK_INITIATION)
  assert.ok(nathan, '生成南森·威克（引导大师）')
  assert.equal(nathan.location, library.id)
  assert.equal(state.scenarioFlags.puzzleBox.holder, 'enemy', '机关盒附属到南森')
  assert.equal(state.scenarioFlags.puzzleBox.enemyId, nathan.id)
  assert.equal(state.scenarioZones.setAside.includes(PUZZLE_BOX), false, '机关盒离开放一边区')
})

// ===========================================================================
// 05202 取得仪器（幕 2 目标）
// ===========================================================================
test('TCU 05202 取得仪器：南森进胜利区后由一位调查员取得机关盒并推进', () => {
  const state = boot('05202')
  state.actIndex = 1
  assert.equal(state.acts[1].originalCode, ACT_OBTAINING_DEVICE)
  state.victoryDisplay.push({ id: 'v-nathan', code: NATHAN_WICK_INITIATION, originalCode: NATHAN_WICK_INITIATION, victory: 1 })
  const stub = apiStub(state, { choose: () => '0' })
  behavior.checkObjectives(state, stub)
  assert.equal(state.scenarioFlags.puzzleBox.holder, 'seat', '机关盒交给一位调查员')
  assert.equal(stub.calls.filter(call => call.kind === 'advanceAct').length, 1, '推进到下一幕')
})

// ===========================================================================
// 05206 前厅（「我们一直在等你」面）
// ===========================================================================
test('TCU 05206 前厅：未揭示前不能进入，秘社大门谈判后揭示', () => {
  const state = boot('05206')
  const inv = state.investigators[0]
  const gates = state.locations.find(location => location.id === LOCATIONS.lodgeGatesMembers)
  const lobby = place(state, LOCATIONS.lobbyWeve)
  lobby.revealed = false
  inv.location = gates.id
  assert.match(behavior.investigatorEntryError(state, lobby), /尚未开放/)
  const move = behavior.actions(state, inv).find(entry => entry.rule === 'parleyLobby')
  assert.ok(move, '秘社大门提供谈判揭示前厅的行动')
  behavior.performAction(state, inv, move, scenarioRuntime(state, []))
  assert.equal(lobby.revealed, true, '谈判后前厅被揭示')
})

// ===========================================================================
// 05207 前厅（秘社成员面）
// ===========================================================================
test('TCU 05207 前厅：揭示后放置 1 把随机放一边的钥匙', () => {
  const state = boot('05207')
  const lobby = place(state, LOCATIONS.lobbyMembers)
  behavior.locationRevealed(state, lobby, apiStub(state, { random: () => 0 }))
  const keys = KEY_IDS.map(id => state.scenarioKeys[id]).filter(key => key.location === lobby.id)
  assert.equal(keys.length, 1, '前厅上放置 1 把随机钥匙')
})

// ===========================================================================
// 05209 秘社地窖（秘社成员面）
// ===========================================================================
test('TCU 05209 秘社地窖：不能进入；秘社大门共同支付每人 1 线索后揭示', () => {
  const state = boot('05209')
  const inv = state.investigators[0]
  const gates = state.locations.find(location => location.id === LOCATIONS.lodgeGatesMembers)
  const cellar = state.locations.find(location => location.id === LOCATIONS.lodgeCellarMembers)
  cellar.revealed = false
  inv.location = gates.id
  inv.clues = state.numInvestigators
  assert.match(behavior.investigatorEntryError(state, cellar), /尚未开放/)
  const move = behavior.actions(state, inv).find(entry => entry.rule === 'revealCellar')
  assert.ok(move, '秘社大门提供共同支付线索揭示地窖的行动')
  assert.equal(move.reason, null, '线索足够时不显示理由')
  const paid = []
  behavior.performAction(state, inv, move, apiStub(state, {
    payClues: (amount, locationId) => paid.push({ amount, locationId }),
    reveal: id => { const location = state.locations.find(entry => entry.id === id); if (location) location.revealed = true },
  }))
  assert.deepEqual(paid, [{ amount: state.numInvestigators, locationId: gates.id }], '按每人 1 线索共同支付')
  assert.equal(cellar.revealed, true)
})

// ===========================================================================
// 05211 机密室
// ===========================================================================
test('TCU 05211 机密室：未控制古神钥匙不能进入；揭示后放 1 把随机钥匙', () => {
  const state = boot('05211')
  const inv = state.investigators[0]
  const vault = place(state, LOCATIONS.vault)
  vault.revealed = false
  assert.match(behavior.investigatorEntryError(state, vault), /古神钥匙/)
  keyHolder(state, 'elderthing', inv.seat)
  assert.equal(behavior.investigatorEntryError(state, vault), null, '控制古神钥匙后可进入')
  behavior.locationRevealed(state, vault, apiStub(state, { random: () => 0.4 }))
  const keys = KEY_IDS.map(id => state.scenarioKeys[id]).filter(key => key.location === vault.id)
  assert.equal(keys.length, 1)
})

// ===========================================================================
// 05212 藏书室
// ===========================================================================
test('TCU 05212 藏书室：调查时控制石板钥匙则帷幕 -3', () => {
  const state = boot('05212')
  const inv = state.investigators[0]
  const library = place(state, LOCATIONS.library)
  inv.location = library.id
  assert.equal(behavior.locationShroudModifier(state, library, inv), 0)
  keyHolder(state, 'tablet', inv.seat)
  assert.equal(behavior.locationShroudModifier(state, library, inv), -3, '控制石板钥匙：藏书室帷幕 -3')
  assert.equal(ALL_CARDS['05212'].shroud, 6, '印刷帷幕 6')
})

// ===========================================================================
// 05214 典礼室
// ===========================================================================
test('TCU 05214 典礼室：轮末调查员与盟友各受 1 直接恐惧，骷髅钥匙可取消', () => {
  const state = boot('05214')
  const inv = state.investigators[0]
  const allyCode = Object.values(ALL_CARDS).find(card => card.type === 'asset'
    && (card.traits || []).includes('Ally') && card.pack === 'core').code
  const room = place(state, LOCATIONS.sanctumDoorwayCeremony)
  room.revealed = true
  inv.location = room.id
  inv.assets.push({ id: 'ally', code: allyCode, originalCode: allyCode, traits: ['Ally'], exhausted: false })
  const stub = apiStub(state)
  behavior.roundEnded(state, stub)
  assert.equal(inv.horror, 1, '在典礼室的调查员受到 1 点直接恐惧')
  assert.equal(stub.calls.filter(call => call.kind === 'horrorAsset').length, 1, '每个盟友支援各受 1 点直接恐惧')
  keyHolder(state, 'skull', inv.seat)
  const before = inv.horror
  const cancelled = apiStub(state)
  behavior.roundEnded(state, cancelled)
  assert.equal(inv.horror, before, '控制骷髅钥匙时取消典礼室恐惧')
  assert.equal(cancelled.calls.filter(call => call.kind === 'horrorAsset').length, 0)
})

// ===========================================================================
// 05216 圣堂内室
// ===========================================================================
test('TCU 05216 圣堂内室：未控制异教徒钥匙不能进入；揭示后放 1 把随机钥匙', () => {
  const state = boot('05216')
  const inv = state.investigators[0]
  const sanctum = place(state, LOCATIONS.innerSanctum)
  sanctum.revealed = false
  assert.match(behavior.investigatorEntryError(state, sanctum), /异教徒钥匙/)
  keyHolder(state, 'cultist', inv.seat)
  assert.equal(behavior.investigatorEntryError(state, sanctum), null)
  behavior.locationRevealed(state, sanctum, apiStub(state, { random: () => 0.6 }))
  const keys = KEY_IDS.map(id => state.scenarioKeys[id]).filter(key => key.location === sanctum.id)
  assert.equal(keys.length, 1)
})

// ===========================================================================
// 05217b 南森·威克（教化大师）
// ===========================================================================
test('TCU 05217b 南森·威克（教化大师）：躲避超过 3 点偷走机关盒并加入胜利区', () => {
  const state = boot('05217b')
  const inv = state.investigators[0]
  const lounge = place(state, LOCATIONS.lounge)
  lounge.revealed = true
  inv.location = lounge.id
  const nathan = spawnEnemy(state, '05217b', lounge.id)
  assert.ok(nathan, '南森（教化大师）能生成')
  state.storyAssets ||= []
  state.storyAssets.push({ id: 'story-box', code: PUZZLE_BOX, originalCode: PUZZLE_BOX, location: lounge.id })
  state.scenarioFlags.puzzleBox = { holder: 'enemy', enemyId: nathan.id, seat: null }
  const stub = apiStub(state)
  behavior.afterEvade(state, inv, nathan, { success: true, value: 7, difficulty: 4 }, stub)
  assert.equal(state.scenarioFlags.puzzleBox.holder, 'seat', '机关盒被躲避者偷走')
  assert.equal(state.scenarioFlags.nathanDefeated, true)
  assert.deepEqual(stub.calls.filter(call => call.kind === 'banish').map(call => call.id), [nathan.id], '南森加入胜利区')
  assert.equal(state.scenario.enemies['05217b'].alert, true, '警戒关键词由印刷数据读取')
})

// ===========================================================================
// 05227 奥古斯特·林奎斯特
// ===========================================================================
test('TCU 05227 奥古斯特·林奎斯特：共同支付 2×人数线索，付费者受伤/恐惧，取得钥匙并移出游戏', () => {
  const state = boot('05227', 2)
  const lounge = place(state, LOCATIONS.lounge)
  lounge.revealed = true
  state.storyAssets ||= []
  state.storyAssets.push({ id: 'story-august', code: AUGUST_LINDQUIST, originalCode: AUGUST_LINDQUIST, location: lounge.id })
  for (const inv of state.investigators) {
    inv.location = lounge.id
    inv.clues = 2
  }
  keyHolder(state, 'skull', 1)
  const august = state.storyAssets.find(asset => (asset.originalCode || asset.code) === AUGUST_LINDQUIST)
  state.scenarioKeys.skull.assetId = august.id
  state.scenarioKeys.skull.holder = null
  const move = legalMoves(state, 0).find(entry => entry.rule === 'parleyAugust')
  assert.ok(move, '奥古斯特所在地点提供谈判行动')
  assert.equal(move.actionKind, 'parley', '谈判行动不引发借机攻击')
  applyMove(state, 0, move)
  settle(state, pending => {
    if (pending.kind === 'payment') return pending.options.at(-1).id
    if (pending.kind === 'harm') return 'damage'
    return null
  })
  const cluesLeft = state.investigators.reduce((sum, inv) => sum + (inv.clues || 0), 0)
  assert.equal(cluesLeft, 0, '共同支付 2×人数线索')
  assert.equal(state.investigators.reduce((sum, inv) => sum + (inv.damage || 0) + (inv.horror || 0), 0) >= 1, true, '实际付费者受到 1 点伤害或 1 点恐惧')
  assert.equal(state.scenarioKeys.skull.holder, 0, '取得奥古斯特身上的钥匙')
  assert.equal(state.storyAssets.some(asset => (asset.originalCode || asset.code) === AUGUST_LINDQUIST), false, '奥古斯特移出游戏')
})

// ===========================================================================
// 05204/05205 秘社大门（补强：撤退行动 + 禁止生成）
// ===========================================================================
test('TCU 05204/05205 秘社大门：两版都提供撤退且禁止敌人生成', () => {
  const state = boot('05205')
  const inv = state.investigators[0]
  const gates = state.locations.find(location => location.id === LOCATIONS.lodgeGatesMembers)
  inv.location = gates.id
  const move = behavior.actions(state, inv).find(entry => entry.rule === 'resignGates')
  assert.ok(move, '秘社大门提供撤退行动')
  assert.equal(behavior.spawnForbiddenAt(state, '05204', LOCATIONS.lodgeGatesMembers), true)
  assert.equal(behavior.spawnForbiddenAt(state, '05205', LOCATIONS.lodgeGatesWeve), true)
  behavior.performAction(state, inv, move, apiStub(state))
  assert.equal(inv.resigned, true)
})

// ===========================================================================
// 05228 机关盒（补强声明读点）
// ===========================================================================
test('TCU 05228 机关盒：team limit / 幽灵看守人借机攻击豁免 / 被击败转交均有引擎读点', () => {
  const entry = registeredEntry('05228')
  assert.equal(entry.scenarioPlayable, true)
  assert.equal(entry.transferOnControllerDefeat, true)
  assert.deepEqual(entry.abilities[0].noOpportunityAttackFrom, ['05086'])
  assert.equal(entry.abilities[0].limit.scope, 'perGame')
  assert.equal(entry.abilities[0].limit.owner, 'group')
  assert.equal(registeredEntry('05228').code, '05228')
})
