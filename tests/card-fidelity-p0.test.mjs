// 卡牌保真度审计（card-fidelity-todo.md）P0 高严重度回归。
//
// 每条用例对应 TODO 里一条 P0 缺口，断言的是**卡面规则的实际结果**（不是"有条目/有字段"）：
//   02012 吉姆的小号多目标治愈、03047a/b/c 陌生人背面、03087 拜亚基的猎杀、03102 锈蚀、
//   03108 解剖图表、03121/03122/03123 跳过神话毁灭、03182a 丹尼尔两条强制、
//   03200/03240 混乱标记表、03221/03221b 风琴手、03234 .41 短口手枪、03241b 死亡鬼灵、
//   03268 建议取消攻击、03317 疯狂漩涡四选一、03332/03334 哈斯塔。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset, enemy, move, settle, legalMoves, validateMove } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { applyHarm, damageEnemy, enemyAttack, getMaxSanity, preyTarget, performTest, runMythos } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { nonPlayerEntryFor } from '../src/cards/encounter-abilities.js'
import { carcosaChaosToken, carcosaChaosAfterTest } from '../content/campaigns/thePathToCarcosa/carcosa-chaos.js'
import * as curtain from '../content/campaigns/thePathToCarcosa/scenarios/curtainCall/index.js'
import * as phantom from '../content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/index.js'
import * as dim from '../content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/index.js'

const clone = value => structuredClone(value)
const itemCard = cost => Object.values(ALL_CARDS).find(card =>
  card.type === 'asset' && (card.traits || []).includes('Item')
  && !card.permanent && (card.cost || 0) === cost)

// ---------------------------------------------------------------------------
// 04104 枪法如神：没有同地点敌人时也能激活枪械攻击（窗口里指向连接地点）。
// ---------------------------------------------------------------------------
test('04104 枪法如神：没有同地点敌人时可激活枪械攻击并改指连接地点的敌人', () => {
  const state = fixture('01001')
  const gun = asset(state, '01016')
  const inv = state.investigators[0]
  inv.hand = ['04104']
  inv.resources = 10
  const here = state.locations.find(location => location.id === inv.location)
  state.locations.push({ id: 'next-door', name: '隔壁', revealed: true, clues: 0, maxClues: 0, shroud: 1, connections: [here.id] })
  here.connections.push('next-door')
  const faraway = enemy(state, { id: 'faraway', fight: 0, evade: 0, health: 8, engagedSeat: null, location: 'next-door' })
  state.chaosBag = ['0']
  const attack = legalMoves(state, 0).find(item => item.action === 'ability' && item.assetId === gun.id)
  assert.ok(attack, '没有同地点敌人也可以激活枪械攻击')
  assert.equal(attack.targetId, undefined)
  move(state, attack)
  const pending = state.pendingChoice
  const option = pending?.options.find(item => item.cardCode === '04104')
  assert.ok(option, '激活时提供枪法如神')
  move(state, { action: 'choose', choiceId: pending.id, optionId: option.id })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === faraway.id).damageTaken, 3,
    '.45 自动手枪 2 点 + 枪法如神未交战 +1')
})

// ---------------------------------------------------------------------------
// 冷漠（aloof）：未交战的冷漠敌人不能被攻击；04104 的「忽略冷漠」可以把它选为目标。
// ---------------------------------------------------------------------------
test('04104 枪法如神：忽略冷漠，未交战的冷漠敌人可以成为本次攻击目标', () => {
  const state = fixture('01001')
  const gun = asset(state, '01016')
  const inv = state.investigators[0]
  inv.resources = 10
  const whippoorwill = enemy(state, { id: 'whippoorwill', code: '02090', name: '夜鹰',
    fight: 0, evade: 0, health: 8, engagedSeat: null, aloof: true, printedAloof: true })
  state.chaosBag = ['0']
  assert.ok(!legalMoves(state, 0).some(item => item.action === 'fight' && item.enemyId === whippoorwill.id),
    '未交战的冷漠敌人不能被普通攻击')
  assert.ok(!legalMoves(state, 0).some(item => item.action === 'ability' && item.assetId === gun.id),
    '不忽略冷漠的武器攻击不能选中未交战的冷漠敌人')
  inv.hand = ['04104']
  const attack = legalMoves(state, 0).find(item => item.action === 'ability' && item.assetId === gun.id)
  assert.ok(attack, '枪法如神让枪械攻击可以激活')
  assert.equal(attack.targetId, undefined)
  move(state, attack)
  const pending = state.pendingChoice
  const option = pending?.options.find(item => item.cardCode === '04104')
  assert.ok(option, '激活时提供枪法如神')
  move(state, { action: 'choose', choiceId: pending.id, optionId: option.id })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === whippoorwill.id)?.damageTaken, 3,
    '.45 自动手枪 2 点 + 枪法如神未交战 +1')
})

// ---------------------------------------------------------------------------
// 02012 吉姆的小号：多目标时必须让玩家选择治愈对象，而不是抛错或跳过。
// ---------------------------------------------------------------------------
test('02012 吉姆的小号：2 名候选人时选择其中一名治愈 1 点恐惧', () => {
  const state = fixture('02004', 2)
  const inv = state.investigators[0]
  inv.assets = [{ id: 'trumpet', code: '02012', exhausted: false }]
  inv.horror = 2
  state.investigators[1].horror = 2
  state.chaosBag = ['skull']
  const execute = current => performTest(current, 0, 'willpower', 1, { resolve: result => { current.testResult = result } })
  resolveTransaction(state, 0, { action: 'p012' }, execute)
  let choseTarget = false
  while (state.pendingChoice) {
    const pending = state.pendingChoice
    let optionId
    if (pending.source === 'jimsTrumpet') optionId = 'trigger'
    else if (pending.kind === 'target') { choseTarget = true; optionId = pending.options[0].id }
    else optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
  assert.equal(choseTarget, true, '两名候选时必须询问治愈对象')
  const total = state.investigators.reduce((sum, investigator) => sum + investigator.horror, 0)
  assert.equal(total, 3, '只治愈 1 点恐惧')
  assert.equal(state.investigators[0].assets.find(item => item.code === '02012').exhausted, true)
})

// ---------------------------------------------------------------------------
// 03047a/b/c 陌生人：把苍白面具下的男子移动到前厅并留在场上（击败/弃掉两条路径）。
// ---------------------------------------------------------------------------
function strangerState(code) {
  return {
    acts: [{ originalCode: code }], actIndex: 0, enemies: [],
    locations: [
      { id: 'theatre', name: '剧院', connections: [], horror: 0 },
      { id: 'lobby', name: '前厅', connections: [] },
      { id: 'privateRoom', name: '私密房间', connections: [], traits: ['Private'], horror: 0 },
    ],
    chaosBag: [], campaign: { chaosBag: [], records: {}, leadSeat: 0 },
    investigators: [{ seat: 0, name: '一号', engaged: [], location: 'theatre' }],
    scenarioFlags: {}, encounterDiscard: [], round: 1, phase: 'investigation',
  }
}
for (const [code, token] of [['03047a', 'cultist'], ['03047b', 'tablet'], ['03047c', 'elderthing']]) {
  test(`${code} 陌生人背面：击败男子后改为移动他到前厅并留在场上`, () => {
    const state = strangerState(code)
    const man = { id: 'man', code: '03059', originalCode: '03059', name: '苍白面具下的男子',
      location: 'theatre', engagedSeat: 0, damageTaken: 3, exhausted: true }
    let advanced = 0
    const api = { advanceAct: () => { advanced++ }, info() {} }
    assert.equal(curtain.behavior.enemyDefeated(state, man, api), true)
    assert.equal(state.enemies.includes(man), true, '男子重新进入 state.enemies')
    assert.equal(man.location, 'lobby')
    assert.equal(man.damageTaken, 0)
    assert.equal(advanced, 1, '推进到场景 3a')
    assert.equal(state.chaosBag.filter(value => value === token).length, 2, '混乱袋加入 2 个标记')
    assert.equal(state.scenarioFlags.hazard, { cultist: 'flames', tablet: 'ooze', elderthing: 'flood' }[token])
    if (code === '03047b') assert.equal(state.locations.find(location => location.id === 'theatre').horror, 1)
    if (code === '03047c') assert.equal(state.locations.find(location => location.id === 'privateRoom').horror, 1)
  })

  test(`${code} 陌生人背面：男子被弃掉（非击败）时同样移动并结算其余效果`, () => {
    const state = strangerState(code)
    const man = { id: 'man', code: '03059', originalCode: '03059', name: '苍白面具下的男子',
      location: 'privateRoom', engagedSeat: null, damageTaken: 0, exhausted: false }
    state.encounterDiscard.push('03059')
    let advanced = 0
    const api = { advanceAct: () => { advanced++ }, info() {} }
    curtain.behavior.enemyDiscarded(state, man, api)
    assert.equal(state.enemies.includes(man), true)
    assert.equal(man.location, 'lobby')
    assert.equal(state.encounterDiscard.includes('03059'), false, '不再留在遭遇弃牌堆')
    assert.equal(advanced, 1)
    assert.equal(state.chaosBag.filter(value => value === token).length, 2)
  })
}

// ---------------------------------------------------------------------------
// 03087 拜亚基的猎杀：揭示、选择并真正抽取（生成）1 张拜亚基；征兆 → 1 恐惧。
// ---------------------------------------------------------------------------
test('03087 拜亚基的猎杀：从揭示的拜亚基中选择并抽取，征兆诡计造成 1 恐惧', () => {
  const byakhee = Object.values(ALL_CARDS).find(card => card.type === 'enemy'
    && (card.traits || []).includes('Byakhee'))
  const omen = Object.values(ALL_CARDS).find(card => card.type === 'treachery'
    && (card.traits || []).includes('Omen'))
  assert.ok(byakhee && omen, '目录里必须有拜亚基与征兆卡')
  const state = {
    locations: [{ id: 'here', name: '此处', connections: [] }],
    investigators: [{ seat: 0, name: '一号', location: 'here', defeated: false, resigned: false }],
    encounterDeck: [omen.code, byakhee.code], encounterDiscard: [],
  }
  const drawn = []
  const horrors = []
  const api = {
    test(seat, skill, difficulty, resolve) { resolve({ success: false, difficulty, value: difficulty - 2 }) },
    choose: request => request.options[0].id,
    info() {},
    horror(seat, amount) { horrors.push(amount) },
    shuffleEncounterDeck() {},
    drawEncounter(seat) { drawn.push(state.encounterDeck.pop()) },
  }
  nonPlayerEntryFor('03087').encounterResolve(state, state.investigators[0], { code: '03087' }, api)
  assert.deepEqual(horrors, [1], '揭示征兆诡计受到 1 点恐惧')
  assert.deepEqual(drawn, [byakhee.code], '被选择的拜亚基被抽取（而不是洗回牌库）')
  assert.deepEqual(state.encounterDeck, [omen.code], '未选择的卡牌洗回遭遇牌库')
})

// ---------------------------------------------------------------------------
// 03102 锈蚀：X = 地点隐藏值；按印刷费用合计弃多张；不够时涌动。
// ---------------------------------------------------------------------------
test('03102 锈蚀：按隐藏值合计弃掉多张道具，弃够即停', () => {
  const item = itemCard(2)
  const state = { locations: [{ id: 'here', shroud: 4 }] }
  const inv = {
    seat: 0, location: 'here', hand: [], discard: [],
    assets: [{ id: 'a1', code: item.code, cost: item.cost }, { id: 'a2', code: item.code, cost: item.cost }],
  }
  state.investigators = [inv]
  let surges = 0
  const api = {
    info() {}, choose: request => request.options[0].id,
    discardAsset(seat, assetId) { inv.assets = inv.assets.filter(asset => asset.id !== assetId) },
    drawEncounter() { surges++ },
  }
  nonPlayerEntryFor('03102').encounterResolve(state, inv, { code: '03102' }, api)
  assert.equal(inv.assets.length, 0, '两张 2 费道具都弃掉（合计 4 ≥ X=4）')
  assert.equal(surges, 0, '弃够了就不涌动')
})

test('03102 锈蚀：道具费用合计不足 X 时一张也不弃并涌动', () => {
  const item = itemCard(2)
  const state = { locations: [{ id: 'here', shroud: 5 }] }
  const inv = { seat: 0, location: 'here', hand: [], discard: [],
    assets: [{ id: 'a1', code: item.code, cost: item.cost }] }
  state.investigators = [inv]
  let surges = 0
  const api = { info() {}, choose: request => request.options[0].id,
    discardAsset() { throw new Error('不应弃牌') }, drawEncounter() { surges++ } }
  nonPlayerEntryFor('03102').encounterResolve(state, inv, { code: '03102' }, api)
  assert.equal(inv.assets.length, 1, '弃不够时不应弃掉部分卡牌')
  assert.equal(surges, 1, '没有弃掉任何卡牌 → 涌动')
})

// ---------------------------------------------------------------------------
// 03108 解剖图表：快速事件、剩余神智 ≥5、非精英敌人 -2/-2。
// ---------------------------------------------------------------------------
test('03108 解剖图表：快速打出，非精英敌人本回合战斗/躲避 -2，且不消耗行动', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = ['03108']
  inv.resources = 5
  const target = enemy(state, { engagedSeat: null, fight: 4, evade: 4, health: 8 })
  const actions = inv.actionsLeft
  move(state, { action: 'play', cardId: '03108' })
  settle(state)
  assert.equal(state.investigators[0].actionsLeft, actions, '快速事件不消耗行动')
  const current = state.enemies.find(item => item.id === target.id)
  assert.deepEqual(
    { fight: current.carcosaDifficultyModifier.fight, evade: current.carcosaDifficultyModifier.evade },
    { fight: -2, evade: -2 })
  assert.ok(state.investigators[0].discard.includes('03108'), '事件结算后进入弃牌堆')
})

test('03108 解剖图表：剩余神智不足 5 时不能打出', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = ['03108']
  inv.resources = 5
  inv.horror = getMaxSanity(inv) - 4
  enemy(state, { engagedSeat: null, fight: 4, health: 8 })
  assert.match(validateMove(state, 0, { action: 'play', cardId: '03108' }) || '', /神智/)
})

// ---------------------------------------------------------------------------
// 03121/03122/03123：神话阶段跳过「在当前密谋放置 1 个毁灭」。
// ---------------------------------------------------------------------------
for (const code of ['03121', '03122', '03123']) {
  test(`${code}：神话阶段跳过密谋毁灭`, () => {
    const state = fixture('01001')
    state.agendas = [{ originalCode: code, code, name: '测试密谋', doomThreshold: 99, stage: '1a' }]
    state.agendaIndex = 0
    state.doom = 2
    state.encounterDeck = []
    state.encounterDiscard = []
    runMythos(state)
    settle(state)
    assert.equal(state.doom, 2, '不增加密谋毁灭')
  })
}

// ---------------------------------------------------------------------------
// 03182a 丹尼尔·契斯特菲尔德：恐惧未全分给他 → 1 伤害；离场 → 移出游戏。
// ---------------------------------------------------------------------------
function runHarm(state, damage, horror, select) {
  const execute = current => applyHarm(current, current.investigators[0], damage, horror, [], false)
  resolveTransaction(state, 0, { action: 'harmProbe' }, execute)
  let guard = 0
  while (state.pendingChoice && guard++ < 20) {
    const pending = state.pendingChoice
    const optionId = select(pending) ?? pending.options.find(option => ['done', 'skip', 'self'].includes(option.id))?.id
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

test('03182a 丹尼尔：恐惧全部由他承受时不受伤害', () => {
  const state = fixture('01001')
  const daniel = asset(state, '03182a')
  runHarm(state, 0, 2, pending => pending.kind === 'assign-horror' ? daniel.id : null)
  const current = state.investigators[0].assets.find(item => item.code === '03182a')
  assert.equal(current.horror, 2)
  assert.equal(state.investigators[0].damage, 0)
})

test('03182a 丹尼尔：至少有 1 点恐惧没有分配给他时受到 1 点伤害', () => {
  const state = fixture('01001')
  const daniel = asset(state, '03182a')
  runHarm(state, 0, 2, pending => {
    if (pending.kind !== 'assign-horror') return null
    // 第 1 点分给自己，第 2 点分给丹尼尔（按提示里的「剩余」判断，事务重放时也稳定）。
    return String(pending.prompt).includes('剩余 2') ? 'self' : daniel.id
  })
  assert.equal(state.investigators[0].damage, 1)
})

test('03182a 丹尼尔：离场时从游戏中移除（不进弃牌堆）', () => {
  const state = fixture('01001')
  const daniel = asset(state, '03182a')
  runHarm(state, 1, 0, pending => pending.kind === 'assign-damage' ? daniel.id : null)
  assert.equal(state.investigators[0].assets.some(item => item.code === '03182a'), false)
  assert.ok((state.removedFromGame || []).includes('03182a'), '被移出游戏')
  assert.equal(state.investigators[0].discard.includes('03182a'), false)
})

// ---------------------------------------------------------------------------
// 03200 真相幻影混乱标记表。
// ---------------------------------------------------------------------------
test('03200 skull：-X，X 为场上毁灭总数，普通封顶 5', () => {
  const state = {
    difficulty: 'standard', doom: 2, enemies: [{ doom: 2 }], locations: [{ doom: 1 }],
    investigators: [{ seat: 0, location: 'a', assets: [{ doom: 1 }], threat: [] }],
  }
  assert.equal(carcosaChaosToken('aPhantomOfTruth', state, state.investigators[0], 'skull').delta, -5)
  state.investigators[0].assets[0].doom = 3
  assert.equal(carcosaChaosToken('aPhantomOfTruth', state, state.investigators[0], 'skull').delta, -5, '普通封顶 5')
  state.difficulty = 'hard'
  assert.equal(carcosaChaosToken('aPhantomOfTruth', state, state.investigators[0], 'skull').delta, -8, '困难不封顶')
})

test('03200 tablet：取消投入本次检定的技能卡牌效果与图标（-3/-4）', () => {
  const state = { difficulty: 'standard', investigators: [{ seat: 0, location: 'a', assets: [], threat: [] }] }
  const fx = carcosaChaosToken('aPhantomOfTruth', state, state.investigators[0], 'tablet')
  assert.equal(fx.delta, -3)
  assert.equal(fx.cancelCommitted, true)
  state.difficulty = 'hard'
  assert.equal(carcosaChaosToken('aPhantomOfTruth', state, state.investigators[0], 'tablet').delta, -4)
})

test('03200 cultist：失败时每个未交战的拜亚基朝最近调查员移动一次', () => {
  const state = {
    difficulty: 'standard',
    locations: [
      { id: 'a', connections: ['b'] }, { id: 'b', connections: ['a', 'c'] }, { id: 'c', connections: ['b'] },
    ],
    enemies: [{ id: 'by', code: '03086', traits: ['Byakhee'], location: 'a', engagedSeat: null }],
    investigators: [{ seat: 0, location: 'c', defeated: false, resigned: false }],
  }
  const moved = []
  const api = { moveEnemy(enemy, destination) { moved.push([enemy.id, destination]) }, info() {} }
  carcosaChaosAfterTest('aPhantomOfTruth', state, state.investigators[0],
    { success: false, drawn: ['cultist'], difficulty: 6, value: 4, source: null }, api)
  assert.deepEqual(moved, [['by', 'b']], '拜亚基朝调查员方向移动一个地点')
})

test('03200 elder_thing：失败时每低于难度 1 点失去 1 资源', () => {
  const state = { difficulty: 'standard', investigators: [{ seat: 0, location: 'a', resources: 5, assets: [], threat: [] }] }
  carcosaChaosAfterTest('aPhantomOfTruth', state, state.investigators[0],
    { success: false, drawn: ['elderthing'], difficulty: 6, value: 3, source: null }, { info() {} })
  assert.equal(state.investigators[0].resources, 2)
})

// ---------------------------------------------------------------------------
// 03240 苍白面具混乱标记表。
// ---------------------------------------------------------------------------
test('03240 skull：-X，X 为到起始地点的地点数，普通封顶 5', () => {
  const state = {
    difficulty: 'standard', scenarioFlags: { startLocationId: 'a' },
    locations: [
      { id: 'a', connections: ['b'] }, { id: 'b', connections: ['a', 'c'] }, { id: 'c', connections: ['b'] },
    ],
    investigators: [{ seat: 0, location: 'c', assets: [], threat: [] }],
  }
  assert.equal(carcosaChaosToken('thePallidMask', state, state.investigators[0], 'skull').delta, -2)
  state.difficulty = 'hard'
  assert.equal(carcosaChaosToken('thePallidMask', state, state.investigators[0], 'skull').delta, -2)
})

test('03240 cultist：攻击期间成功的检定使该攻击伤害 -1（困难不造成伤害）', () => {
  const state = { difficulty: 'standard', skillTest: { source: { label: '攻击' } },
    investigators: [{ seat: 0, location: 'a', assets: [], threat: [] }] }
  const fx = carcosaChaosToken('thePallidMask', state, state.investigators[0], 'cultist')
  assert.equal(fx.delta, -2)
  assert.equal(state.skillTest.attackDamageReduction, 1)
  state.difficulty = 'hard'
  carcosaChaosToken('thePallidMask', state, state.investigators[0], 'cultist')
  assert.equal(state.skillTest.attackDamageReduction, 999, '困难侧攻击不造成伤害')
})

test('03240 tablet：重整中的食尸鬼攻击你；困难侧先重整再攻击', () => {
  const ghoul = { id: 'g', name: '食尸鬼', traits: ['Ghoul'], location: 'a', exhausted: true, damage: 1 }
  const state = {
    difficulty: 'standard', investigators: [{ seat: 0, location: 'a', assets: [], threat: [] }],
    enemies: [ghoul],
  }
  const attacks = []
  carcosaChaosToken('thePallidMask', state, state.investigators[0], 'tablet',
    { attack(enemy, inv) { attacks.push(enemy.id); this._ = inv }, choose: request => request.options[0].id })
  assert.deepEqual(attacks, [], '普通侧横置的敌人不攻击')
  state.difficulty = 'hard'
  carcosaChaosToken('thePallidMask', state, state.investigators[0], 'tablet',
    { attack(enemy) { attacks.push(enemy.id) }, choose: request => request.options[0].id })
  assert.deepEqual(attacks, ['g'], '困难侧重整并攻击')
})

test('03240 elder_thing：失败时从遭遇牌库/弃牌堆查找并抽取食尸鬼或灵怪', () => {
  const ghoul = Object.values(ALL_CARDS).find(card => card.type === 'enemy'
    && (card.traits || []).includes('Ghoul'))
  const state = {
    difficulty: 'standard', investigators: [{ seat: 0, location: 'a', assets: [], threat: [] }],
    encounterDeck: [ghoul.code], encounterDiscard: [], enemies: [], locations: [],
  }
  const drawn = []
  carcosaChaosAfterTest('thePallidMask', state, state.investigators[0],
    { success: false, drawn: ['elderthing'], difficulty: 5, value: 2, source: null },
    { choose: request => request.options[0].id, info() {},
      drawEncounter() { drawn.push(state.encounterDeck.pop()) } })
  assert.deepEqual(drawn, [ghoul.code], '找到的敌人被抽取')
  assert.equal(state.encounterDeck.length, 0)
})

// ---------------------------------------------------------------------------
// 03221/03221b 风琴手：不能受到伤害；猎手再移动；敌军阶段结束移动/解除交战。
// ---------------------------------------------------------------------------
test('03221 风琴手：不能受到伤害', () => {
  const state = fixture('01001')
  const organist = enemy(state, { code: '03221', originalCode: '03221', health: 20, fight: 5, engagedSeat: null })
  assert.equal(damageEnemy(state, organist, 3, 0, []), false)
  assert.equal(organist.damageTaken, 0)
})

test('03221 风琴手：猎手移动后未交战则再次结算猎手（每轮一次），且本阶段不能攻击', () => {
  const state = {
    round: 4, scenarioFlags: {}, phase: 'enemy',
    locations: [{ id: 'a', connections: ['b'] }, { id: 'b', connections: ['a', 'c'] }, { id: 'c', connections: ['b'] }],
    investigators: [{ seat: 0, location: 'c', defeated: false, resigned: false }],
  }
  const organist = { id: 'o', code: '03221', originalCode: '03221', location: 'a', engagedSeat: null }
  state.enemies = [organist]
  const steps = ['b', 'c']
  const api = { hunterStep: () => steps.shift(), moveEnemy(enemy, destination) { enemy.location = destination }, info() {} }
  assert.equal(phantom.behavior.hunterMove(state, organist, api), true)
  assert.equal(organist.location, 'c')
  assert.equal(organist.skipAttackRound, 4)
  // 每轮仅一次：下一回合（同一轮）不再额外移动。
  organist.location = 'a'
  const api2 = { hunterStep: () => 'b', moveEnemy(enemy, destination) { enemy.location = destination }, info() {} }
  phantom.behavior.hunterMove(state, organist, api2)
  assert.equal(organist.location, 'b')
})

test('03221b 风琴手：敌军阶段结束时远离最近调查员移动，交战时改为解除交战', () => {
  const state = {
    round: 1, scenarioFlags: {}, phase: 'enemy', campaign: { leadSeat: 0 },
    locations: [
      { id: 'a', connections: ['b', 'd'] }, { id: 'b', connections: ['a', 'c'] },
      { id: 'c', connections: ['b'] }, { id: 'd', connections: ['a'] },
    ],
    investigators: [
      { seat: 0, location: 'c', defeated: false, resigned: false, engaged: ['o'] },
      { seat: 1, location: 'c', defeated: false, resigned: false, engaged: [] },
    ],
  }
  const organist = { id: 'o', code: '03221b', originalCode: '03221b', location: 'a', engagedSeat: null }
  state.enemies = [organist]
  const api = { info() {}, choose: request => request.options[0].id, moveEnemy(enemy, destination) { enemy.location = destination } }
  phantom.behavior.enemyPhaseEnd(state, api)
  assert.equal(organist.location, 'd', '优先移动到没有调查员的地点')
  organist.engagedSeat = 0
  organist.location = 'a'
  phantom.behavior.enemyPhaseEnd(state, api)
  assert.equal(organist.engagedSeat, null)
  assert.deepEqual(state.investigators[0].engaged, [])
})

// ---------------------------------------------------------------------------
// 03234 .41 短口手枪：成功且超过难度 ≥1 → 本次攻击 +1 伤害。
// ---------------------------------------------------------------------------
test('03234 .41短口手枪：成功且超过难度至少 1 点造成 +1 伤害', () => {
  const state = fixture('01001')
  const gun = asset(state, '03234')
  const target = enemy(state, { engagedSeat: 0, fight: 1, health: 10 })
  state.chaosBag = ['0']
  const attack = legalMoves(state, 0).find(item => item.action === 'ability'
    && item.assetId === gun.id && item.targetId === target.id)
  move(state, attack)
  settle(state)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2, '基础 1 + 超过难度 +1')
  assert.equal(state.investigators[0].assets.find(item => item.id === gun.id).uses, 2)
})

// ---------------------------------------------------------------------------
// 03241b 死亡鬼灵：横置时攻击伤害 -1；躲避失败后它攻击你。
// ---------------------------------------------------------------------------
test('03241b 死亡鬼灵：横置时每次攻击伤害 -1', () => {
  const state = fixture('01001')
  const gun = asset(state, '01016')
  const specter = enemy(state, { code: '03241b', originalCode: '03241b', engagedSeat: 0,
    fight: 1, health: 10, exhausted: true, damage: 2, horror: 2 })
  state.chaosBag = ['0']
  const attack = legalMoves(state, 0).find(item => item.action === 'ability'
    && item.assetId === gun.id && item.targetId === specter.id)
  move(state, attack)
  settle(state)
  assert.equal(state.enemies.find(item => item.id === specter.id).damageTaken, 1, '.45 自动手枪 2 点伤害被减为 1')
})

test('03241b 死亡鬼灵：躲避检定失败后它攻击你', () => {
  const state = fixture('01001')
  const specter = enemy(state, { code: '03241b', originalCode: '03241b', engagedSeat: 0,
    fight: 1, evade: 1, health: 10, damage: 2, horror: 2 })
  state.chaosBag = ['autofail']
  move(state, { action: 'evade', enemyId: specter.id })
  settle(state)
  assert.equal(state.investigators[0].damage, 2, '躲避失败后受到它的攻击伤害')
})

// ---------------------------------------------------------------------------
// 03268 建议：[reaction] 花费 1 充能取消非精英敌人的攻击。
// ---------------------------------------------------------------------------
test('03268 建议：花费 1 充能取消非精英敌人的攻击', () => {
  const state = fixture('01001')
  const suggestion = asset(state, '03268')
  const attacker = enemy(state, { engagedSeat: 0, damage: 2, horror: 1, exhausted: false })
  state.chaosBag = ['0']
  move(state, { action: 'endTurn' })
  settle(state, pending => {
    if (pending.kind !== 'reaction') return null
    const option = pending.options.find(item => item.cardCode === '03268')
    return option ? option.id : null
  })
  assert.equal(state.investigators[0].damage, 0, '攻击被取消')
  assert.equal(state.investigators[0].horror, 0)
  assert.equal(state.investigators[0].assets.find(item => item.code === '03268').uses, 2, '花费 1 充能')
  assert.ok(attacker.id)
})

// ---------------------------------------------------------------------------
// 03317 疯狂漩涡：背面四选一；检定失败必须改选尚未选过的选项。
// ---------------------------------------------------------------------------
test('03317 疯狂漩涡：检定失败后改选另一项，第三项让每位调查员受到 2 点恐惧', () => {
  const entry = nonPlayerEntryFor('03317')
  const state = {
    investigators: [{ seat: 0, name: '一号', defeated: false, resigned: false }],
    campaign: { leadSeat: 0 }, scenarioFlags: {}, doom: 0,
  }
  const choices = ['willpower', 'horror']
  const horrors = []
  const info = []
  const api = {
    choose: () => choices.shift(),
    test(seat, skill, difficulty, resolve) { resolve({ success: false }) },
    horror(seat, amount) { horrors.push(amount) },
    addDoom(amount) { info.push(['doom', amount]) },
    info: text => info.push(text),
  }
  entry.agendaRule.onReveal(state, { originalCode: '03317' }, api)
  assert.deepEqual(horrors, [2], '选择第三项：每位调查员受到 2 点恐惧')
})

test('03317 疯狂漩涡：选择昏倒时在新密谋放置 1 个毁灭', () => {
  const entry = nonPlayerEntryFor('03317')
  const state = { investigators: [{ seat: 0, name: '一号', defeated: false, resigned: false }],
    campaign: { leadSeat: 0 }, scenarioFlags: {}, doom: 0 }
  const calls = []
  const api = { choose: () => 'faint', test() { throw new Error('不应检定') },
    horror() {}, addDoom: amount => calls.push(amount), info() {} }
  entry.agendaRule.onReveal(state, { originalCode: '03317' }, api)
  assert.deepEqual(calls, [1])
})

// ---------------------------------------------------------------------------
// 03332 哈斯塔（黄衣之王）：仅剧情效果可伤害；敌军阶段开始攻击所有调查员；恐惧溢出 +1 伤害。
// ---------------------------------------------------------------------------
test('03332 哈斯塔：除剧情卡牌效果（source=encounter）外不能受到伤害', () => {
  const state = fixture('01001')
  const hastur = enemy(state, { code: '03332', originalCode: '03332', health: 30, fight: 4 })
  assert.equal(damageEnemy(state, hastur, 2, 0, [], null), false)
  assert.equal(hastur.damageTaken, 0)
  assert.equal(damageEnemy(state, hastur, 2, 0, [], 'encounter'), true)
  assert.equal(hastur.damageTaken, 2)
})

test('03332 哈斯塔：敌军阶段开始时按玩家顺序攻击每位调查员（无视地点）', () => {
  const state = { numInvestigators: 2, campaign: { leadSeat: 0 },
    investigators: [
      { seat: 0, name: '一号', location: 'a', defeated: false, resigned: false },
      { seat: 1, name: '二号', location: 'b', defeated: false, resigned: false },
    ],
    enemies: [{ id: 'h', code: '03332', originalCode: '03332', exhausted: false, location: 'c' }],
  }
  const attacks = []
  dim.behavior.enemyPhaseStart(state, { attack(enemy, inv) { attacks.push(inv.seat) }, info() {} })
  assert.deepEqual(attacks, [0, 1])
})

test('03332 哈斯塔：攻击造成的恐惧超过神智值时额外受到 1 点伤害', () => {
  const state = fixture('01001')
  state.scenario = { ...state.scenario, id: 'dimCarcosa' }
  const inv = state.investigators[0]
  inv.horror = getMaxSanity(inv) - 1
  inv.damage = 0
  const hastur = enemy(state, { code: '03332', originalCode: '03332', health: 30, damage: 0, horror: 2, engagedSeat: 0 })
  enemyAttack(state, hastur, inv, [])
  assert.equal(inv.damage, 1, '恐惧溢出额外 1 点伤害')
})

// ---------------------------------------------------------------------------
// 03334 哈斯塔（褴褛之王）：猎物＝剩余神智最高；无剩余神智者把 +1/0/-1/旧印视为自动失败。
// ---------------------------------------------------------------------------
test('03334 哈斯塔：猎物为剩余神智值最高的调查员', () => {
  const state = fixture('01004', 2)
  state.investigators[0].horror = 0
  state.investigators[1].horror = getMaxSanity(state.investigators[1]) - 1
  const hastur = { id: 'h', code: '03334', originalCode: '03334', prey: 'mostRemainingSanity' }
  const seat = preyTarget(state, hastur, [0, 1])
  assert.equal(seat, state.investigators[0].seat)
})

test('03334 哈斯塔：没有剩余神智的调查员攻击他时把 +1 视为自动失败', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.horror = getMaxSanity(inv)
  const hastur = enemy(state, { code: '03334', originalCode: '03334', fight: 1, health: 20 })
  state.chaosBag = ['+1']
  const execute = current => performTest(current, 0, 'combat', 1,
    { source: { label: '攻击', enemyId: hastur.id }, resolve: result => { current.testResult = result } })
  resolveTransaction(state, 0, { action: 'hasturProbe' }, execute)
  while (state.pendingChoice) {
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
  assert.equal(state.testResult.success, false)
  assert.equal(state.testResult.autoFail, true)
})
