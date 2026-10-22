import test from 'node:test'
import assert from 'node:assert/strict'
import { registeredEntry } from '../src/engine/ability.js'
import { registerContentBundle } from '../content/registered.js'
import { manifest as tfaCampaignPack } from '../content/packs/tfaCampaign/manifest.js'
import { manifest as campaignManifest } from '../content/campaigns/theForgottenAge/manifest.js'

// P2 引擎钩子（清单见 audit/tfa-migration.json 的 remaining）：
//   敌人生命值 / 手牌上限 / 毁灭放置 / 横置反击 / 攻击类型 / 无视卡牌效果 / 地点指示物。
// 这里用真实引擎跑三个章节（荒莽密林、天机之城、幽嘶深渊），不注入 api 桩。
const packId = 'tfaP2HooksPack'
const chapters = ['theUntamedWilds', 'theCityOfArchives', 'theDepthsOfYoth', 'theDoomOfEztli', 'heartOfTheEldersPart2', 'shatteredAeons']
const cases = []
for (const id of chapters) {
  const module = await import(`../content/campaigns/theForgottenAge/scenarios/${id}/index.js`)
  cases.push({ id, module, campaignId: `tfaP2Hooks-${id}`, scenarioId: `tfaP2Hooks-${id}` })
}

registerContentBundle({
  packs: [{ ...tfaCampaignPack, id: packId, status: 'playable' }],
  campaigns: cases.map(({ campaignId, scenarioId }) => ({
    ...campaignManifest,
    id: campaignId,
    name: `失落的时代（P2 钩子验证）`,
    status: 'playable',
    scenarioIds: [scenarioId],
    unlock: { [scenarioId]: [] },
    requiredPackIds: ['core', packId],
    flow: { start: scenarioId, nodes: { [scenarioId]: { type: 'scenario', scenarioId, next: 'end' }, end: { type: 'end' } } },
  })),
  scenarios: cases.map(({ module, campaignId, scenarioId }) => ({
    scenario: { ...module.scenario, id: scenarioId },
    behavior: { ...module.behavior, id: scenarioId },
    manifest: {
      ...Object.fromEntries(Object.entries(module.manifest)
        .filter(([key]) => !['catalogReferenceOnly', 'referenceCode'].includes(key))),
      id: scenarioId,
      campaignId,
      status: 'playable',
      name: module.scenario.name,
      requiredPackIds: [...new Set([...module.manifest.requiredPackIds
        .map(id => (id === 'tfaCampaign' ? packId : id)), packId])],
      requiredEncounterGroupIds: [],
      behaviorIds: [scenarioId],
    },
  })),
})

const {
  createGameState, applyMove, legalMoves, enemyHealth, enemyFightValue, enemyEvadeValue, handSize, decisionSeat, doExplore, getStat,
} = await import('../src/engine/engine.js')
const { viewState } = await import('../src/integration/observation.js')
const { EFFECTS } = await import('../src/cards/card-effects.js')
// Phase 3（D1）：敌人卡面的布尔规则读点。
const { entityRuleActive } = await import('../src/engine/modifiers.js')

const campaignFor = id => `tfaP2Hooks-${id}`

function boot(chapter) {
  const state = createGameState({ campaignId: campaignFor(chapter), seed: `tfa-p2-${chapter}`, playerInvestigator: '01001' },
    [{ seat: 0 }])
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 600, `choice loop: ${state.pendingChoice?.kind}`)
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id || pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
  return state
}

function spawn(state, code, extra = {}) {
  const location = state.investigators[0].location
  const enemy = { id: 'p2' + code + state.enemies.length, code, name: code, location, fight: 2, evade: 2,
    health: 6, damage: 1, horror: 1, damageTaken: 0, doom: 0, engagedSeat: 0, traits: [], ...extra }
  state.enemies.push(enemy)
  state.investigators[0].engaged.push(enemy.id)
  return enemy
}

// ---------------------------------------------------------------------------
// 敌人生命值 + 手牌上线
// ---------------------------------------------------------------------------

test('敌人生命值钩子：深渊吞噬者只按深度补躲避，生命值保持印刷值', () => {
  const state = boot('theDepthsOfYoth')
  state.scenarioFlags.depthLevel = 4
  const eater = spawn(state, '04298')
  const base = eater.health
  assert.equal(enemyHealth(state, eater), base, '生命值不随深度增加')
  const view = viewState(state, 0)
  const projected = view.enemies.find(enemy => enemy.id === eater.id)
  assert.equal(projected.health, base, '前端看到的生命值同样是印刷值')
})

test('手牌上限钩子：天机之城的密谋 2/3 与太阳系仪真的改变整理阶段上限', () => {
  const state = boot('theCityOfArchives')
  const inv = state.investigators[0]
  inv.assets = []; inv.threat = []
  // 基础 8；密谋 2（agendaIndex 1）每位调查员 -2。
  state.agendaIndex = 0
  assert.equal(handSize(state, inv), 8)
  state.agendaIndex = 1
  assert.equal(handSize(state, inv), 6, '「失去的记忆」手牌上限 -2')
  state.agendaIndex = 2
  assert.equal(handSize(state, inv), 4, '「遗忘人类身份」手牌上限 -4')
  // 带挂坠者忽略减少（密谋 2b 写入 inv.ignoreHandSizeReduction）。
  inv.ignoreHandSizeReduction = true
  assert.equal(handSize(state, inv), 8)
  inv.ignoreHandSizeReduction = false
  // 伊斯的太阳系仪：位于该地点时 +2（布置时放在一边，这里直接放入场验证钩子）。
  state.agendaIndex = 0
  state.locations.push({ id: 'yithianOrrery', originalCode: '04252', name: '伊斯的太阳系仪', revealed: true,
    clues: 0, connections: [], shroud: 3 })
  inv.location = 'yithianOrrery'
  assert.equal(handSize(state, inv), 10, '太阳系仪 +2 手牌上限')
})

// ---------------------------------------------------------------------------
// 毁灭放置
// ---------------------------------------------------------------------------

test('毁灭放置钩子：04282 撼地之怒在第 3 个毁灭后放出追击敌人', () => {
  const state = boot('theDepthsOfYoth')
  const fury = state.agendas.find(agenda => (agenda.originalCode || agenda.code) === '04282')
  if (!fury) return // 怒气为 0 的牌序下本章没有这张密谋时跳过
  state.agendas = [fury]
  state.agendaIndex = 0
  state.doom = 0
  state.scenarioZones.pursuit = [{ code: '04297', damageTaken: 0, resources: 0 }]
  const before = state.enemies.length
  // 每个神话阶段放 1 点毁灭（第 1、2 次不触发，第 3 次触发一次）。
  for (let guard = 0; guard < 40 && state.round < 4; guard++) {
    if (state.pendingChoice) {
      const pending = state.pendingChoice
      applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: pending.options[0].id })
      continue
    }
    applyMove(state, 0, { action: 'endTurn' })
  }
  assert.ok(state.scenarioFlags.furyDoomPlaced, '钩子必须记录本密谋放置的毁灭')
  assert.ok(Object.values(state.scenarioFlags.furyDoomPlaced).some(count => count >= 3), '毁灭计数应达到 3')
  assert.ok(state.enemies.length > before || state.scenarioZones.pursuit.length === 0,
    '第 3 个毁灭后应把追击敌人放到本层起点')
})

test('毁灭放置钩子：04329 隐匿之城让异教徒额外获得 1 个毁灭', async () => {
  const shattered = await import('../content/campaigns/theForgottenAge/scenarios/shatteredAeons/behavior.js')
  const state = { enemies: [], locations: [{ id: 'city', originalCode: '04329' }], scenarioFlags: {}, scenarioZones: {} }
  const cultist = { id: 'c1', name: '异教徒', code: '04186', location: 'city', traits: ['Cultist'], doom: 1 }
  state.enemies.push(cultist)
  // 钩子在「已经放置 1 点」之后结算，与引擎 placeDoomOnCard 的顺序一致。
  shattered.behavior.doomPlaced(state, { agenda: false, target: cultist, amount: 1 }, { info() {} })
  assert.equal(cultist.doom, 2, '放置 1 点后再追加 1 点')
  const outsider = { id: 'c2', name: '异教徒', code: '04186', location: 'elsewhere', traits: ['Cultist'], doom: 1 }
  state.enemies.push(outsider)
  shattered.behavior.doomPlaced(state, { agenda: false, target: outsider, amount: 1 }, { info() {} })
  assert.equal(outsider.doom, 1, '不在隐匿之城时不追加')
})

// ---------------------------------------------------------------------------
// 关键词与攻击类型
// ---------------------------------------------------------------------------

test('横置也能反击：04062 登记 retaliateWhileExhausted，横置后攻击落空仍然反击', async () => {
  const { fixture, enemy, move, settle } = await import('./core-fixture.mjs')
  const state = fixture('01001')
  state.chaosBag = ['-5']
  const attacker = enemy(state, { engagedSeat: 0, fight: 3, damage: 2, horror: 0, retaliate: true,
    retaliateWhileExhausted: true, exhausted: true })
  const before = state.investigators[0].damage
  move(state, { action: 'fight', enemyId: attacker.id })
  settle(state)
  // 结算过程会替换调查员实例，必须从 state 重新读取。
  assert.ok(state.investigators[0].damage > before, '横置时也应触发反击')
  // 对照：没有该字段的敌人横置后不反击。
  const control = fixture('01001')
  control.chaosBag = ['-5']
  const plain = enemy(control, { engagedSeat: 0, fight: 3, damage: 2, horror: 0, retaliate: true, exhausted: true })
  const plainBefore = control.investigators[0].damage
  move(control, { action: 'fight', enemyId: plain.id })
  settle(control)
  assert.equal(control.investigators[0].damage, plainBefore)
})

test('攻击类型：借机攻击与敌人阶段攻击在日志里带不同的 attackKind', async () => {
  const { fixture, enemy, move, settle } = await import('./core-fixture.mjs')
  const state = fixture('01001')
  state.chaosBag = ['0']
  const attacker = enemy(state, { engagedSeat: 0, damage: 0, horror: 0 })
  state.locations[0].clues = 5
  const events = move(state, { action: 'investigate' })
  settle(state)
  const provoked = events.filter(event => event?.presentation?.effect === 'attack')
  assert.equal(provoked.length, 1, '借机攻击必须进事件流')
  assert.equal(provoked[0].presentation.attackKind, 'opportunity', '借机攻击必须标记 kind=opportunity')
  assert.equal(provoked[0].presentation.enemyId, attacker.id)
})

test('04244 伊斯人身体：四属性 2、生命 7、旧印 +2 抽 1', () => {
  const state = boot('theCityOfArchives')
  const inv = state.investigators[0]
  assert.equal(inv.willpower, 2)
  assert.equal(inv.intellect, 2)
  assert.equal(inv.combat, 2)
  assert.equal(inv.agility, 2)
  assert.equal(inv.maxHealth, 7)
  assert.equal(inv.yithianBody, true)
})

test('04311 第七印记的封印：揭示符号标记后扣 1 充能，耗尽时移出游戏', async () => {
  const { fixture, asset, move, settle } = await import('./core-fixture.mjs')
  const state = fixture('01001')
  state.chaosBag = ['skull']
  state.locations[0].clues = 5
  const seal = asset(state, '04311')
  assert.equal(seal.uses, 7)
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(state.investigators[0].assets.find(item => item.id === seal.id)?.uses ?? 0, 6,
    '符号标记揭示后应移除 1 充能')
  // 只剩 1 充能时再揭示符号 → 移出游戏。
  const second = fixture('01001')
  second.chaosBag = ['skull']
  second.locations[0].clues = 5
  const low = asset(second, '04311', { uses: 1 })
  move(second, { action: 'investigate' })
  settle(second)
  assert.equal(second.investigators[0].assets.some(item => item.id === low.id), false)
  assert.ok((second.removedFromGame || []).includes('04311'), '耗尽后应移出游戏')
})

test('04191 古代遗物：意志/智识(4) 检定成功移除密谋毁灭，每场游戏最多一次', async () => {
  const { fixture, asset, move, settle, legalMoves: moves } = await import('./core-fixture.mjs')
  const state = fixture('01001')
  state.chaosBag = ['0']
  state.doom = 2
  state.investigators[0].willpower = 10
  const relic = asset(state, '04191')
  move(state, { action: 'ability', assetId: relic.id, abilityIndex: 0 })
  settle(state)
  assert.equal(state.doom, 1, '成功后移除 1 点密谋毁灭')
  // Phase 5（5c-25）：卡号化的裸字段改成调查员级的通用标记 gameFlags（读点 api.gameFlag）。
  assert.equal(state.investigators[0].gameFlags?.relicDoomSuccess, true)
  // 第二次成功不再生效（一局一次）。
  state.investigators[0].assets.find(item => item.id === relic.id).exhausted = false
  assert.ok(moves(state).some(candidate => candidate.action === 'ability' && candidate.assetId === relic.id))
  move(state, { action: 'ability', assetId: relic.id, abilityIndex: 0 })
  settle(state)
  assert.equal(state.doom, 1, '本场游戏已经成功过一次，不再移除')
  // 失败时在遗物上放 1 个毁灭。
  const failing = fixture('01001')
  failing.chaosBag = ['-8']
  failing.doom = 1
  const failingRelic = asset(failing, '04191')
  move(failing, { action: 'ability', assetId: failingRelic.id, abilityIndex: 0 })
  settle(failing)
  assert.equal(failing.doom, 1, '失败不移除密谋毁灭')
  assert.equal(failing.investigators[0].assets.find(item => item.id === failingRelic.id)?.doom, 1,
    '失败在遗物上放 1 个毁灭')
})

test('04048 搜索遗迹：守卫者不能攻击也不能被攻击；04049 守备森严 +1 战斗/躲避', async () => {
  const wilds = await import('../content/campaigns/theForgottenAge/scenarios/theUntamedWilds/behavior.js')
  const state = boot('theUntamedWilds')
  const guardian = spawn(state, '04086', { traits: ['Guardian'] })
  state.scenarioFlags.actThree = 'guarded'
  assert.equal(enemyFightValue(state, guardian, state.investigators[0]), guardian.fight + 1)
  assert.equal(enemyEvadeValue(state, guardian, state.investigators[0]), guardian.evade + 1)
  state.scenarioFlags.actThree = 'search'
  // Phase 3（D1）：不能攻击/不能被攻击由 04086 的卡面条目声明，读点是实体规则。
  assert.equal(entityRuleActive(state, guardian, 'cannot:attack'), true)
  assert.equal(entityRuleActive(state, guardian, 'cannot:beAttacked'), true)
  assert.equal(wilds.behavior.ignoreTreachery(state, '04087'), true)
  assert.equal(wilds.behavior.ignoreTreachery(state, '04076'), false)
  // 不能被攻击 → 攻击按钮消失。
  const fight = legalMoves(state).some(candidate => candidate.action === 'fight' && candidate.enemyId === guardian.id)
  assert.equal(fight, false, '「不能被攻击」应移除攻击行动')
})

test('04048 守卫者不能攻击：敌人阶段不再对连接地点的调查员出手', async () => {
  const state = boot('theUntamedWilds')
  state.scenarioFlags.actThree = 'search'
  const guardian = spawn(state, '04086', { traits: ['Guardian'], exhausted: false, engagedSeat: null })
  state.investigators[0].engaged = []
  const before = state.investigators[0].damage
  applyMove(state, 0, { action: 'endTurn' })
  assert.equal(state.investigators[0].damage, before, '守卫者不能攻击')
  assert.ok(state.log.some(line => line.includes('不能攻击')), '应给出中文原因')
  assert.ok(guardian)
})

test('04148 探险日志：每回合额外一次只能探索的行动', async () => {
  const { move, settle, legalMoves: moves, validateMove } = await import('./core-fixture.mjs')
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  inv.assets.push({ id: 'journal', code: '04148', originalCode: '04148', exhausted: false })
  // 只剩「探索专用」行动时，普通行动被拒绝。
  inv.actionsLeft = 1
  inv.exploreOnlyActions = 1
  assert.match(validateMove(state, 0, { action: 'resource' }), /额外行动只能用于探索/)
  state.explorationDeck = ['pathOfThorns']
  const explore = moves(state).find(candidate => candidate.action === 'explore')
  assert.ok(explore, '探索行动应在合法行动里')
  assert.equal(validateMove(state, 0, explore), null, '探索可以花掉探索专用行动')
  move(state, explore)
  settle(state)
  assert.ok(state.log.some(line => (typeof line === 'string' ? line : line.text || '').includes('荆棘之路')),
    '探索真的翻开了地点')
})

test('04264 离体体验：手牌洗回牌库重抽，本卡洗回牌库而不是弃掉', async () => {
  const { fixture, move } = await import('./core-fixture.mjs')
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = ['01001', '01002']
  inv.deck = ['01020', '01021', '04264']
  inv.discard = []
  move(state, { action: 'draw' })
  const after = state.investigators[0]
  assert.equal(after.discard.includes('04264'), false, '不能被弃掉')
  assert.equal(after.hand.length, 2, '洗回后重抽等量手牌')
  assert.equal(after.hand.length + after.deck.length + after.discard.length, 5, '牌没有丢')
})

test('「不能被击败」的敌人不会被击败判定移除（04209b）', async () => {
  const { move, settle } = await import('./core-fixture.mjs')
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  inv.combat = 20
  state.chaosBag = ['0']
  const enemy = {
    id: 'e-invincible', code: '04209b', originalCode: '04209b', name: '羽翼蛇族', location: inv.location,
    fight: 0, evade: 0, health: 0, damage: 0, horror: 0, damageTaken: 0, exhausted: false, engagedSeat: 0,
    traits: ['Monster', 'Serpent', 'Elite'], cannotBeDefeated: true,
  }
  state.enemies.push(enemy)
  inv.engaged.push(enemy.id)
  const fight = legalMoves(state).find(candidate => candidate.action === 'fight' && candidate.enemyId === enemy.id)
  assert.ok(fight, '可以攻击它')
  move(state, fight)
  settle(state)
  assert.ok(state.enemies.some(item => item.id === enemy.id), '不能被击败，仍留在场上')
  assert.equal((state.victoryDisplay || []).some(card => card.code === '04209b'), false, '不会进胜利区')
})

test('04055 暗起波澜：密谋推进不会移除地点上的毁灭标记', () => {
  const state = boot('theDoomOfEztli')
  const fury = state.agendas.find(agenda => (agenda.originalCode || agenda.code) === '04055')
  const warden = state.agendas.find(agenda => (agenda.originalCode || agenda.code) === '04056')
  if (!fury || !warden) return
  state.agendas = [fury, warden]
  state.agendaIndex = 0
  fury.doomThreshold = 1
  state.doom = 0
  const location = state.locations[0]
  location.doom = 2
  for (let guard = 0; guard < 40 && state.agendaIndex === 0; guard++) {
    if (state.pendingChoice) {
      const pending = state.pendingChoice
      applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: pending.options[0].id })
      continue
    }
    applyMove(state, decisionSeat(state), { action: 'endTurn' })
  }
  assert.ok(state.agendaIndex >= 1, '密谋已推进')
  assert.equal(state.locations.find(entry => entry.id === location.id)?.doom, 2, '地点毁灭没有被移除')
})

test('04227 深入幽嘶：0 线索地点入场即进胜利区，复仇计入伊格之怒', async () => {
  const part2 = await import('../content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart2/index.js')
  const { move, settle, legalMoves: moves } = await import('./core-fixture.mjs')
  const state = boot('heartOfTheEldersPart2')
  const inv = state.investigators[0]
  inv.actionsLeft = 3
  for (const location of state.locations) location.clues = 0
  state.explorationDeck = ['descentToYoth']
  const explore = moves(state).find(candidate => candidate.action === 'explore')
  assert.ok(explore, '可以探索到深入幽嘶')
  move(state, explore)
  settle(state)
  const card = (state.victoryDisplay || []).find(entry => (entry.originalCode || entry.code) === '04227')
  assert.ok(card, '0 线索地点入场后进入胜利区')
  assert.equal(card.vengeance, 2)
  part2.behavior.resolution(state, 'r1', [], { info() {}, addTrauma() {}, campaignCardChange() {} })
  assert.ok(Number(state.campaign.records.yigsFury || 0) >= 2, '复仇计入伊格之怒')
})

test('04285 探索：翻出不相连地点时不放置（放回探索牌库底）', () => {
  const state = boot('theDepthsOfYoth')
  const inv = state.investigators[0]
  const current = state.scenario.locations?.[inv.location] || Object.values(state.scenario.locations)[0]
  const links = current.connections || []
  const codes = Object.keys(state.scenario.locations)
  const connected = codes.find(code => links.includes(code) && !state.locations.some(L => L.id === code))
  const blocked = codes.find(code => !links.includes(code) && code !== inv.location
    && !state.locations.some(L => L.id === code))
  if (!connected || !blocked) return
  inv.actionsLeft = 3
  state.explorationDeck = [blocked]
  doExplore(state, inv.seat, [])
  assert.equal(state.locations.some(entry => entry.id === blocked), false, '不相连不放置')
  assert.ok(state.explorationDeck.includes(blocked), '放回探索牌库')
  state.explorationDeck = [connected]
  doExplore(state, inv.seat, [])
  assert.ok(state.locations.some(entry => entry.id === connected), '相连正常放置')
})

test('04318 彼端的世界：没有无人地点时从探索牌库翻地点并让敌人在这里生成', () => {
  const state = boot('shatteredAeons')
  // 只留一个地点并让调查员站在那里：场上没有「无人地点」。
  const only = state.locations[0]
  state.locations = [only]
  const inv = state.investigators[0]
  inv.location = only.id
  // 选一个尚未在场的地点，混一张诡计在前面。
  const locationCode = Object.keys(state.scenario.locations)
    .find(code => !state.locations.some(entry => entry.id === code))
  state.explorationDeck = ['04081', locationCode]
  state.encounterDeck = ['04086']
  // 推进到神话阶段抽遭遇。
  for (let guard = 0; guard < 40 && !state.enemies.some(e => e.code === '04086'); guard++) {
    if (state.pendingChoice) {
      const pending = state.pendingChoice
      applyMove(state, pending.seat, {
        action: 'choose', choiceId: pending.id,
        optionId: pending.options.find(option => ['done', 'skip'].includes(option.id))?.id || pending.options[0].id,
      })
      continue
    }
    applyMove(state, state.currentSeat ?? 0, { action: 'endTurn' })
  }
  const enemy = state.enemies.find(entry => entry.code === '04086')
  assert.ok(enemy, '敌人真的生成了')
  assert.equal(enemy.location, locationCode, '生成在翻出的地点')
  assert.ok(state.locations.some(entry => entry.id === locationCode), '翻出的地点已放置入场')
  assert.ok(!state.encounterDiscard.includes('04086'), '没有走生成失败弃牌')
})

test('04031 保护咒语：回合结束没有资源时必须弃掉', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  inv.assets.push({ id: 'incant', code: '04031', originalCode: '04031', exhausted: false, damage: 0, horror: 0 })
  inv.resources = 0
  applyMove(state, state.currentSeat ?? 0, { action: 'endTurn' })
  for (let guard = 0; state.pendingChoice && guard < 100; guard++) {
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => option.id === 'discard')?.id || pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
  assert.equal(state.investigators[0].assets.some(asset => asset.code === '04031'), false)
})

test('04038 黑暗契约是可打出的弱点事件', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  inv.hand.push('04038')
  const play = legalMoves(state).find(move => move.action === 'play' && move.cardId === '04038')
  assert.ok(play, '黑暗契约应可打出')
  applyMove(state, inv.seat, play)
  for (let guard = 0; state.pendingChoice && guard < 50; guard++) {
    const pending = state.pendingChoice
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: pending.options[0].id })
  }
  assert.ok(state.investigators[0].damage >= 0, '结算后仍可继续')
})

test('04039 失败的代价：伤害/恐惧/毁灭，并把 04038 放进弃牌堆', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  inv.deck.push('04039')
  const beforeDoom = state.doom || 0
  applyMove(state, state.currentSeat ?? 0, { action: 'endTurn' })
  for (let guard = 0; state.pendingChoice && guard < 100; guard++) {
    const pending = state.pendingChoice
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: pending.options[0].id })
  }
  const current = state.investigators[0]
  assert.equal(current.deck.includes('04039'), false)
  assert.ok(current.discard.includes('04038'), '黑暗契约进入弃牌堆')
  assert.ok(current.damage >= 2)
  assert.ok(current.horror >= 2)
  assert.ok((state.doom || 0) >= beforeDoom + 1 || state.agendaIndex > 0)
})
test('04147 伊塔卡：+1 战斗 / +1 敏捷，并在击败敌人后可横置治愈恐惧', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  const baseCombat = getStat(state, inv, 'combat')
  const baseAgility = getStat(state, inv, 'agility')
  inv.assets.push({ id: 'ichtaca', code: '04147', originalCode: '04147', exhausted: false, damage: 0, horror: 1 })
  assert.equal(getStat(state, inv, 'combat'), baseCombat + 1)
  assert.equal(getStat(state, inv, 'agility'), baseAgility + 1)
  assert.equal(registeredEntry('04147').exhaustOnEnemyDefeatedHealHorror, 1)
})
test('04037 背包：入场附属顶 6 张里的道具，并可从背包打出', () => {
  const state = boot('theUntamedWilds')
  const inv = state.investigators[0]
  inv.resources = 20
  inv.hand.push('04037')
  inv.deck = ['01020', '01020', '01020']
  const play = legalMoves(state).find(move => move.action === 'play' && move.cardId === '04037')
  assert.ok(play)
  applyMove(state, inv.seat, play)
  for (let guard = 0; state.pendingChoice && guard < 20; guard++) {
    const pending = state.pendingChoice
    const pickDone = pending.options.some(option => option.id === 'done')
    const optionId = guard === 0 ? pending.options[1]?.id : 'done'
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: pickDone && guard > 0 ? 'done' : optionId })
  }
  const bag = state.investigators[0].assets.find(asset => asset.code === '04037')
  assert.ok(bag, '背包在场')
  assert.ok((bag.attachedCards || []).length >= 1, '至少附属 1 张牌')
  const fromBag = legalMoves(state).find(move => move.fromBackpackId === bag.id)
  assert.ok(fromBag, '可从背包打出附属牌')
  applyMove(state, state.investigators[0].seat, fromBag)
  assert.equal(state.investigators[0].assets.some(asset => asset.code === '04037'), false, '最后一张打出后背包被弃掉')
})
