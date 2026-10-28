import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, legalMoves, getStat, getMaxHealth, actionPreview } from '../src/engine/engine.js'
import { EFFECTS } from '../src/cards/card-effects.js'
import { registeredEntry } from '../src/engine/ability.js'
import { encounterRules } from '../content/campaigns/theForgottenAge/encounter-rules.js'
import { addLocationShroud } from '../src/engine/location-attachments.js'

// P1 遭遇与威胁区修复：多技能选择、影响引擎读取点的威胁字段、禁止换牌。
// 与 tfa-player-p1 分开：这些是剧本/威胁层的规则，不是玩家卡。
const me = state => state.investigators[0]

function launchTfa(seed = 'tfa-encounter-p1') {
  const state = createGameState({ campaignId: 'theForgottenAge', campaignHub: true, seed }, [{ seat: 0, role: 'human' }])
  const step = move => applyMove(state, 0, move)
  step({ action: 'hubGoSetup' })
  step({ action: 'hubSelectInvestigator', code: '04001' })
  step({ action: 'hubAutoDeck' })
  step({ action: 'hubDoneSeat' })
  step({ action: 'hubBeginScenario' })
  for (let guard = 0; state.pendingChoice && guard < 200; guard++) {
    const pending = state.pendingChoice
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: pending.options[0].id })
  }
  me(state).actionsLeft = 3
  state.chaosBag = ['0']
  return state
}

test('「检定 A 或 B」拆成两个动作，选智识就检定智识', () => {
  const state = launchTfa()
  me(state).threat.push({ id: 't04076', code: '04076', originalCode: '04076' })
  const moves = legalMoves(state).filter(move => move.action === 'encounterAction' && move.rule === 'clearOvergrowth')
  assert.equal(moves.length, 2, '两种技能各给一个动作')
  assert.deepEqual(moves.map(move => move.skill).sort(), ['combat', 'intellect'])
  assert.ok(moves.every(move => move.label.includes('疯狂生长')))
  const intellect = moves.find(move => move.skill === 'intellect')
  applyMove(state, 0, intellect)
  assert.equal(state.skillTest?.skill, 'intellect')
  assert.equal(state.skillTest?.difficulty, 4)
  assert.equal(me(state).actionsLeft, 2)
})

test('力量真言（04097）：与带毁灭的敌人同地点时不能伤害也不能发现线索', () => {
  const state = launchTfa()
  const enemy = { id: 'e1', code: '01166', name: '远古恶魔', location: me(state).location, doom: 1,
    fight: 2, evade: 2, health: 5, damage: 1, horror: 1, engagedSeat: null, traits: ['Monster'] }
  state.enemies.push(enemy)
  me(state).threat.push({ id: 't04097', code: '04097', originalCode: '04097',
    blockDoomEnemyDamage: true, blockCluesHere: true })
  assert.equal(encounterRules.enemyDamageAllowed(state, enemy, 'attack', 0), false)
  assert.equal(encounterRules.canDiscoverClues(state, me(state)), false)
  // 敌人没有毁灭时不阻止伤害。
  enemy.doom = 0
  assert.equal(encounterRules.enemyDamageAllowed(state, enemy, 'attack', 0), true)
})

test('毒蛇灾厄（04099）：非弱点道具的文字视为空白', () => {
  const state = launchTfa()
  // 圣玫瑰珠（01059）：Item，+1 意志。
  const item = { id: 'c1', code: '01059', exhausted: false }
  me(state).assets.push(item)
  const before = getStat(state, me(state), 'willpower')
  me(state).threat.push({ id: 't04099', code: '04099', originalCode: '04099', blankItemAssets: true })
  assert.equal(getStat(state, me(state), 'willpower'), before - 1, '道具的 +1 意志被抹掉')
  // Phase 5：passive.stats 已迁成声明式修正（唯一读点 modifiers.js）。
  assert.deepEqual(registeredEntry('01059').modifiers, [{ target: 'skill:willpower', amount: 1 }])
})

test('半身入土（04089）：不能解除交战，躲避成功也不再解除', () => {
  const state = launchTfa()
  const enemy = { id: 'e2', code: '01166', name: '远古恶魔', location: me(state).location,
    fight: 2, evade: 0, health: 5, damage: 1, horror: 1, engagedSeat: 0, traits: ['Monster'] }
  state.enemies.push(enemy)
  me(state).engaged.push(enemy.id)
  me(state).threat.push({ id: 't04089', code: '04089', originalCode: '04089', noDisengage: true })
  assert.equal(encounterRules.canDisengage(state, me(state), enemy), false)
  applyMove(state, 0, { action: 'evade', enemyId: enemy.id })
  for (let guard = 0; state.pendingChoice && guard < 100; guard++) {
    const pending = state.pendingChoice
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: pending.options[0].id })
  }
  // 事务会重建状态对象，断言要重新取实例。
  const after = state.enemies.find(item => item.id === 'e2')
  assert.equal(after.exhausted, true, '躲避仍然横置敌人')
  assert.equal(after.engagedSeat, 0, '但不能解除交战')
  assert.deepEqual(state.investigators[0].engaged, ['e2'])
})

test('蟒蛇（04079）：下个补给阶段不能重整，之后恢复', () => {
  const state = launchTfa()
  const item = { id: 'c2', code: '01059', exhausted: true }
  me(state).assets.push(item)
  me(state).tfaNoReadyRound = state.round
  me(state).actionsLeft = 0
  applyMove(state, 0, { action: 'endTurn' })
  for (let guard = 0; state.pendingChoice && guard < 100; guard++) {
    const pending = state.pendingChoice
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: pending.options[0].id })
  }
  // 事务会重建状态对象，断言要重新取实例。
  const kept = state.investigators[0].assets.find(asset => asset.id === 'c2')
  assert.equal(kept.exhausted, true, '本轮补给阶段不能重整')
  assert.equal(state.investigators[0].tfaNoReadyRound, undefined, '标记只用一次')
})

test('会替队友触发的快速反应登记了 selfOnly', () => {
  // Phase 5（5c-9）：04028/04034/04202 已迁到能力层，条件写在 criteria 上；旧通道的卡仍读 EFFECTS。
  for (const code of ['04028', '04034', '04202']) {
    const descriptor = registeredEntry(code)?.abilities?.find(item => item.kind === 'played')
    const selfOnly = descriptor ? descriptor.criteria?.selfOnly === true : EFFECTS[code]?.reaction?.selfOnly === true
    assert.equal(selfOnly, true, `${code} 只能在自己的时机触发`)
  }
  // Phase 5（5c-11）：04200 也已迁到能力层（criteria.selfOnly），04111 仍走旧通道。
  for (const code of ['04111', '04200']) {
    const descriptor = registeredEntry(code)?.abilities?.find(item => item.kind === 'played')
    const selfOnly = descriptor ? descriptor.criteria?.selfOnly === true : EFFECTS[code]?.reaction?.selfOnly === true
    assert.equal(selfOnly, true, code)
  }
})

test('攻击能力仍然把额外行动成本算进威胁（kind 不被覆盖）', () => {
  const state = launchTfa()
  // 呆若木鸡（01164）：本回合首次移动/攻击/躲避 +1 行动。攻击类 tfaPlayer 能力必须仍按攻击计费。
  me(state).threat.push({ id: 't01164', code: '01164' })
  const card = { id: 'c3', code: '04305', exhausted: false, uses: 4, usesType: 'ammo' }
  me(state).assets.push(card)
  const move = legalMoves(state).find(item => item.action === 'ability' && item.assetId === card.id && item.abilityIndex === 0)
  assert.ok(move)
  assert.ok(actionPreview(state, 0, move).actions >= 1)
})

// ---- 核心遭遇卡（01xxx）：共享解析器逐条实现，十章共用 ----

function coreHarness(state, inv = state.investigators[0]) {
  const record = { tests: [], threats: [], spawned: [], moved: [], doom: 0, damage: 0, horror: 0, draws: 0, cards: 0, discarded: null }
  const api = {
    info: () => {},
    random: () => 0.5,
    choose: request => request.options[0].id,
    test: (seat, skill, difficulty, resolve) => { record.tests.push({ seat, skill, difficulty }); record.resolve = resolve },
    threat: (seat, code, extra = {}) => {
      record.threats.push(code)
      inv.threat.push({ id: `th-${code}`, code, originalCode: code, ...extra })
    },
    addDoom: n => { record.doom += n },
    damage: (seat, n) => { record.damage += n },
    horror: (seat, n) => { record.horror += n },
    // 声明式检定（treacheryRule.test）的失败分支走 api.applyPenalty。
    applyPenalty: (seat, fail, failedBy) => {
      if (fail.kind === 'horrorByAmount') record.horror += failedBy
      else if (fail.kind === 'damageByAmount') record.damage += failedBy
      else if (fail.kind === 'takeHorror') record.horror += fail.amount
      else if (fail.kind === 'takeDamage') record.damage += fail.amount
    },
    // 01168 朦胧之雾：帷幕/雾写入走引擎原语。
    attachShroud: (locationId, amount, code) => addLocationShroud(state, locationId, amount, code),
    addInvestigatorTrait: (seat, trait) => {
      const owner = state.investigators[seat]
      owner.traits = [...new Set([...(owner.traits || []), trait])]
    },
    discardAsset: (seat, id) => { record.discarded = id },
    spawn: (code, location) => { record.spawned.push({ code, location }) },
    drawEncounter: () => { record.draws += 1 },
    drawCards: (seat, n) => { record.cards += n },
    moveInvestigator: (seat, destination) => { record.moved.push(destination) },
  }
  return { api, record }
}

test('核心遭遇卡：01163 腐烂的尸体按失败差额造成恐惧', () => {
  const state = launchTfa()
  const { api, record } = coreHarness(state)
  const handled = encounterRules.resolveEncounter(state, me(state), { code: '01163', originalCode: '01163' }, api)
  assert.equal(handled, false)
  assert.deepEqual(record.tests[0], { seat: 0, skill: 'willpower', difficulty: 3 })
  record.resolve({ success: false, value: 1 })
  assert.equal(record.horror, 2)
})

test('核心遭遇卡：01164 / 01165 进入威胁区域并带引擎限制数据', () => {
  const state = launchTfa()
  const { api, record } = coreHarness(state)
  assert.equal(encounterRules.resolveEncounter(state, me(state), { code: '01164', originalCode: '01164' }, api), true)
  assert.equal(encounterRules.resolveEncounter(state, me(state), { code: '01165', originalCode: '01165' }, api), true)
  assert.deepEqual(record.threats, ['01164', '01165'])
  assert.deepEqual(state.cards['01164'].threat.extraActionCost, ['move', 'fight', 'evade'])
  assert.deepEqual(state.cards['01165'].threat.cannotPlay, ['asset', 'event'])
  // 同一张不会重复进入威胁区域，而是改为再抽一张遭遇牌。
  encounterRules.resolveEncounter(state, me(state), { code: '01164', originalCode: '01164' }, api)
  assert.equal(record.draws, 1)
})

test('核心遭遇卡：01166 远古恶魔在当前密谋上放 1 点毁灭', () => {
  const state = launchTfa()
  const { api, record } = coreHarness(state)
  encounterRules.resolveEncounter(state, me(state), { code: '01166', originalCode: '01166' }, api)
  assert.equal(record.doom, 1)
})

test('核心遭遇卡：01167 地窖寒风失败没有支援时受 2 点伤害', () => {
  const state = launchTfa()
  me(state).assets = []
  const { api, record } = coreHarness(state)
  encounterRules.resolveEncounter(state, me(state), { code: '01167', originalCode: '01167' }, api)
  record.resolve({ success: false, value: 0 })
  assert.equal(record.damage, 2)
  assert.equal(record.discarded, null)
})

test('核心遭遇卡：01168 朦胧之雾走引擎的 fog 通道，可叠加', () => {
  const state = launchTfa()
  const { api, record } = coreHarness(state)
  const location = state.locations.find(entry => entry.id === me(state).location)
  assert.equal(encounterRules.resolveEncounter(state, me(state), { code: '01168', originalCode: '01168' }, api), true)
  assert.equal(location.fog, 1)
  assert.equal(location.shroudMod, 2)
  assert.equal(location.fogCode, '01168')
  encounterRules.resolveEncounter(state, me(state), { code: '01168', originalCode: '01168' }, api)
  assert.equal(record.draws, 0, '第二张也直接附属，不再白送遭遇')
  assert.equal(location.fog, 2)
  assert.equal(location.shroudMod, 4)
})

test('核心遭遇卡：01170 密会巫师生成在无人地点', () => {
  const state = launchTfa()
  state.locations.push({ id: 'emptySpot', name: '无人空地', connections: [], clues: 0 })
  const { api, record } = coreHarness(state)
  encounterRules.resolveEncounter(state, me(state), { code: '01170', originalCode: '01170' }, api)
  assert.equal(record.spawned.length, 1)
  assert.equal(record.spawned[0].code, '01170')
  assert.equal(record.spawned[0].location, 'emptySpot')
  assert.equal(state.cards['01170'].retaliate, true)
  assert.equal(state.cards['01170'].mythosEndDoom, 1)
})

test('核心遭遇卡：01171 神秘咏唱给最近的异教徒放 2 点毁灭', () => {
  const state = launchTfa()
  const cultist = { id: 'e-cultist', code: '01170', name: '密会巫师', location: me(state).location,
    fight: 4, evade: 2, health: 2, damage: 1, horror: 0, doom: 0, engagedSeat: null, traits: ['Humanoid', 'Cultist'] }
  state.enemies.push(cultist)
  const { api, record } = coreHarness(state)
  encounterRules.resolveEncounter(state, me(state), { code: '01171', originalCode: '01171' }, api)
  assert.equal(cultist.doom, 2)
  assert.deepEqual(record.spawned, [])
})

test('核心遭遇卡：01173 乘着黑暗之翼失败后解交战并退到中心地点', () => {
  const state = launchTfa()
  state.locations.push({ id: 'centralx', name: '中心地点', connections: [], central: true, clues: 0 })
  const enemy = { id: 'e-wing', code: '01166', name: '远古恶魔', location: me(state).location,
    fight: 2, evade: 2, health: 5, damage: 1, horror: 1, engagedSeat: 0, traits: ['Monster'] }
  state.enemies.push(enemy)
  me(state).engaged.push(enemy.id)
  const { api, record } = coreHarness(state)
  encounterRules.resolveEncounter(state, me(state), { code: '01173', originalCode: '01173' }, api)
  assert.equal(record.tests[0].skill, 'agility')
  record.resolve({ success: false, value: 0 })
  assert.equal(record.damage, 1)
  assert.equal(record.horror, 1)
  assert.equal(enemy.engagedSeat, null)
  assert.deepEqual(me(state).engaged, [])
  assert.deepEqual(record.moved, ['centralx'])
})

test('核心遭遇卡：01174 上锁的门锁住线索最多的地点，01178 提供力量二选一', () => {
  const state = launchTfa()
  const second = state.locations.find(entry => entry.id !== me(state).location)
  if (second) second.clues = 3
  const { api } = coreHarness(state)
  assert.equal(encounterRules.resolveEncounter(state, me(state), { code: '01174', originalCode: '01174' }, api), true)
  const locked = state.locations.find(entry => entry.locked)
  assert.ok(locked)
  assert.equal(locked.lockedDoorCode, '01174')
  if (second) assert.equal(locked.id, second.id, '锁在线索最多的地点上')

  const power = coreHarness(state)
  power.api.choose = request => (request.options.find(option => option.id === 'power') || request.options[0]).id
  encounterRules.resolveEncounter(state, me(state), { code: '01178', originalCode: '01178' }, power.api)
  assert.equal(power.record.cards, 2)
  assert.equal(power.record.doom, 2)
})

test('伊格的诅咒（04085）：-1 战斗、-1 生命、获得蛇族特性', () => {
  const state = launchTfa()
  const inv = me(state)
  const { api } = coreHarness(state)
  const combat = getStat(state, inv, 'combat')
  const health = getMaxHealth(inv)
  encounterRules.resolveEncounter(state, inv, { code: '04085', originalCode: '04085' }, api)
  assert.equal(getStat(state, me(state), 'combat'), combat - 1, '-1 战斗')
  assert.equal(getMaxHealth(me(state)), health - 1, '-1 生命')
  assert.ok((me(state).traits || []).includes('Serpent'), '获得蛇族特性')
  // 同一张卡再显现时改为抽 1 张遭遇牌。
  const second = coreHarness(state)
  const again = encounterRules.resolveEncounter(state, me(state), { code: '04085', originalCode: '04085' }, second.api)
  assert.equal(again, false)
  assert.equal(second.record.draws, 1)
})

test('04259 的猎物是手牌最多者，引擎有对应的排序键', async () => {
  const state = launchTfa()
  assert.equal(state.cards['04259']?.prey, 'mostHand')
  // 引擎按 PREY_RANK 排序：手牌最多者优先，且不会落到「无人符合」的兜底。
  const { preySeatForTest } = await import('../src/engine/engine.js')
  assert.equal(typeof preySeatForTest, 'function')
  const inv = me(state)
  state.investigators.push({ ...inv, seat: 1, hand: [...inv.hand, '01059', '01059'] })
  state.enemies.push({ id: 'e-scholar', code: '04259', name: '伊斯学者', location: inv.location,
    fight: 2, evade: 2, health: 4, damage: 1, horror: 1, prey: 'mostHand', engagedSeat: null })
  assert.equal(preySeatForTest(state, state.enemies.at(-1), [0, 1]), 1)
})

test('伊格的獠牙（04098）：与中毒调查员交战时不能打牌也不能投入卡牌', () => {
  const state = launchTfa()
  const inv = me(state)
  const playable = inv.hand.find(code => legalMoves(state).some(move => move.action === 'play' && move.cardId === code))
  assert.ok(playable, '开局手牌里应有可打出的牌')
  const fang = { id: 'e-fang', code: '04098', originalCode: '04098', name: '伊格的獠牙',
    location: inv.location, fight: 3, evade: 3, health: 3, damage: 1, horror: 1, engagedSeat: 0,
    traits: ['Humanoid', 'Monster', 'Serpent'] }
  state.enemies.push(fang)
  inv.engaged.push(fang.id)
  // 没有中毒时不拦。
  assert.equal(encounterRules.canPlayCard(state, inv, { type: 'asset' }), true)
  assert.equal(legalMoves(state).some(move => move.action === 'play' && move.cardId === playable), true)
  inv.threat.push({ id: 't04102', code: '04102', originalCode: '04102' })
  assert.equal(encounterRules.canPlayCard(state, inv, { type: 'asset' }), false)
  assert.equal(encounterRules.canCommitCard(state, inv, playable), false)
  assert.equal(legalMoves(state).some(move => move.action === 'play' && move.cardId === playable), false,
    '中毒且被獠牙交战时不能打出卡牌')
  // 解除交战或解毒后恢复。
  fang.engagedSeat = null
  assert.equal(encounterRules.canPlayCard(state, inv, { type: 'asset' }), true)
  fang.engagedSeat = 0
  inv.threat = []
  assert.equal(encounterRules.canCommitCard(state, inv, playable), true)
})

test('01168 朦胧之雾：可叠加，每张 +2 帷幕', () => {
  const state = launchTfa()
  const inv = me(state)
  const location = state.locations.find(entry => entry.id === inv.location)
  const api = {
    info: () => {}, drawEncounter: () => {}, choose: request => request.options[0].id,
    attachShroud: (locationId, amount, code) => addLocationShroud(state, locationId, amount, code),
  }
  encounterRules.resolveEncounter(state, inv, { code: '01168', originalCode: '01168' }, api)
  encounterRules.resolveEncounter(state, inv, { code: '01168', originalCode: '01168' }, api)
  assert.equal(location.fog, 2, '两张雾都附属上')
  assert.equal(location.shroudMod, 4, '每张 +2 帷幕')
})

test('04093 先祖恐惧：放进胜利区时带 1 点复仇', () => {
  const state = launchTfa()
  const inv = me(state)
  const api = { info: () => {}, drawEncounter: () => {}, choose: () => 'victory' }
  encounterRules.resolveEncounter(state, inv, { code: '04093', originalCode: '04093' }, api)
  const card = state.victoryDisplay.find(entry => entry.code === '04093')
  assert.ok(card)
  assert.equal(card.vengeance, 1)
})

test('04089 半身入土：失败后难度 -1 直到轮末', () => {
  const state = launchTfa()
  const inv = me(state)
  const threat = { id: 'entombed', code: '04089', originalCode: '04089' }
  inv.threat.push(threat)
  let seen = null
  const api = {
    info: () => {},
    test: (seat, skill, difficulty, resolve) => {
      seen = difficulty
      resolve({ success: false, value: 0, difficulty, skill, drawn: [] })
    },
  }
  const move = { rule: 'escapeEntombed', threatId: threat.id, skill: 'agility' }
  encounterRules.performEncounterAction(state, inv, move, api)
  assert.equal(seen, 4)
  assert.equal(threat.difficultyReduction, 1)
  encounterRules.performEncounterAction(state, inv, move, api)
  assert.equal(seen, 3, '第二次检定难度降到 3')
  encounterRules.roundEnded(state, api)
  assert.equal(threat.difficultyReduction, undefined, '轮末清掉') 
})

test('04344 时间倒流困难面：旧神标记不要求失败也放毁灭', async () => {
  const { tfaChaosAfterTest } = await import('../content/campaigns/theForgottenAge/tfa-chaos.js')
  const state = launchTfa()
  state.difficulty = 'hard'
  const inv = me(state)
  const location = state.locations.find(entry => entry.id === inv.location)
  const before = location.doom || 0
  tfaChaosAfterTest('turnBackTime', state, inv,
    { success: true, value: 5, difficulty: 3, skill: 'willpower', drawn: ['elderthing'] },
    { info: () => {}, horror: () => {}, damage: () => {}, poison: () => {}, attack: () => {}, drawEncounter: () => {} })
  assert.equal(location.doom, before + 1)
})

test('04090 时间裂缝：0 行动时仍可选择失去行动（无效果）或受恐惧', () => {
  const state = launchTfa()
  const inv = me(state)
  inv.actionsLeft = 0
  let choices = 0
  const api = {
    info: () => {},
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty, skill }),
    choose: () => { choices += 1; return 'action' },
    horror: (seat, n) => { inv.horror += n },
    loseActions: () => {},
  }
  encounterRules.resolveEncounter(state, inv, { code: '04090', originalCode: '04090' }, api)
  assert.equal(choices, 3, '每点差额都提供二选一')
  assert.equal(inv.horror, 0, '选择失去行动（已经为 0）则不转为恐惧')
})
