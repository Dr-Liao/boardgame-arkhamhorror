// 能力层（P0-A）回归：声明式描述子、窗口注册表、Matcher、修正管线，
// 以及 20 张经能力层实装的新卡与 21 位调查员的旧印迁移。
//
// 这些测试有两个目的：
//   1. 证明「新增一张卡 = 在 card-abilities.js 加一个描述子」，不需要动 engine.js；
//   2. 把描述子的语义钉死，避免后续重构悄悄改变行为。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, answer, settle, use, decisionSeat, legalMoves, validateMove } from './core-fixture.mjs'
import { applyMove, getStat } from '../src/engine/engine.js'
import {
  registerCardAbilities, describeRegistry, abilityShim, descriptorsForWindow, elderSignDescriptor,
  declaredAbilityCount, allDescriptors,
} from '../src/engine/ability.js'
import { windowLabel, playerWindowLabel, normalizeTrigger, unknownWindows, isKnownWindow } from '../src/engine/windows.js'
import { all, any, none, ownSeat, atTrait, contextEnemy } from '../src/engine/matcher.js'
import { slotBonus, playCostDelta, declaredModifiers } from '../src/engine/modifiers.js'
import { CARD_ABILITY_ENTRIES } from '../src/cards/card-abilities.js'

// 反应窗口用「【能力】」前缀区分；玩家窗口（免费触发）用 assetId/abilityIndex 标记。
const abilityOption = choice => (choice?.options || []).find(option =>
  String(option.label).includes('【能力】') || (option.assetId != null && option.abilityIndex != null))
const hasAbilityOption = choice => Boolean(abilityOption(choice))

// 把当前待决选择逐个点掉（优先 skip，否则最后一项），直到没有待决选择。
function passAll(state, limit = 40) {
  for (let i = 0; state.pendingChoice && i < limit; i++) {
    const choice = state.pendingChoice
    const option = choice.options.find(item => item.id === 'skip') || choice.options.at(-1)
    assert.ok(option, `选择没有可点击项：${JSON.stringify(choice)}`)
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id })
  }
}

// 一路点掉，直到出现带能力层选项的选择（或超时）。
function passUntilAbility(state, limit = 12) {
  for (let i = 0; i < limit; i++) {
    if (state.pendingChoice && hasAbilityOption(state.pendingChoice)) return true
    if (!state.pendingChoice) return false
    const choice = state.pendingChoice
    const option = choice.options.find(item => item.id === 'skip') || choice.options.at(-1)
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id })
  }
  return false
}

function chooseAbility(state, labelPart = '') {
  const choice = state.pendingChoice
  const option = abilityOption(choice)
  assert.ok(option, `没有能力层选项：${JSON.stringify(choice?.options)}`)
  if (labelPart) assert.match(option.label, new RegExp(labelPart))
  applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id })
}

function twoLocations(state) {
  state.locations[0].connections = ['attic']
  state.locations.push({ id: 'attic', name: '阁楼', clues: 2, shroud: 1, connections: ['study'], revealed: true })
  return state.locations
}

// ---------------------------------------------------------------------------
// 1. 注册表与窗口
// ---------------------------------------------------------------------------

test('P0-A 能力层注册：20 张新卡与 21 位调查员旧印都能被枚举', () => {
  const registry = describeRegistry()
  const codes = new Set(registry.map(entry => entry.code))
  const newCards = ['02080', '02218', '02140', '04051', '05115', '07025', '07017', '01518', '01527',
    '01522', '01523', '05028', '05112', '07027', '02040', '02061', '01533', '03142', '05025', '05023']
  for (const code of newCards) assert.ok(codes.has(code), `未注册的新卡：${code}`)
  const investigators = ['01001', '01002', '01003', '01004', '01005', '02001', '02002', '02003', '02004', '02005',
    '03001', '03002', '03003', '03004', '03005', '03006', '04001', '04002', '04003', '04004', '04005']
  for (const code of investigators) {
    assert.ok(codes.has(code), `未注册旧印的调查员：${code}`)
    assert.ok(elderSignDescriptor(code), `缺少旧印描述子：${code}`)
  }
  assert.ok(declaredAbilityCount() >= 18)
  // 同一张卡可以同时声明修正与能力（02080 是 +1 战斗 + 击败反应）。
  assert.equal(descriptorsForWindow('02080', 'defeatEnemy', 'reaction').length, 1)
  assert.equal(abilityShim('02140').length, 1)
  assert.equal(abilityShim('01533').length, 0, '纯反应卡不应出现在主动能力列表里')
})

test('P0-A 窗口注册表：标签、触发写法与未知窗口', () => {
  assert.equal(windowLabel('enemyAttack'), '敌人攻击时')
  assert.equal(windowLabel('cardDrawn'), '抽取卡牌后')
  assert.equal(playerWindowLabel('test.beforeCommit'), '检定开始、投入前')
  assert.deepEqual(normalizeTrigger('window:cardDrawn'), ['cardDrawn'])
  assert.deepEqual(normalizeTrigger(['enemyAttack', 'defeatEnemy']), ['enemyAttack', 'defeatEnemy'])
  assert.ok(isKnownWindow('scenarioStarts'))
  assert.deepEqual(unknownWindows(), [], '引擎开过的窗口都应已在注册表里')
})

test('P0-A 描述子校验：内容错误在注册时失败而不是对局中途静默失效', () => {
  assert.throws(() => registerCardAbilities({ code: 'test-bad-kind', abilities: [{ kind: 'bogus' }] }), /未知 kind/)
  assert.throws(() => registerCardAbilities({ code: 'test-no-trigger', abilities: [{ kind: 'reaction', resolve() {} }] }), /必须声明 trigger/)
  assert.throws(() => registerCardAbilities({ code: 'test-no-resolve', abilities: [{ kind: 'forced', trigger: 'enemyAttack' }] }), /必须提供 resolve/)
  assert.throws(() => registerCardAbilities({ code: 'test-unknown-field', abilities: [{ kind: 'action', oops: 1 }] }), /未知字段 oops/)
  assert.throws(() => registerCardAbilities({ code: '02140', abilities: [] }), /重复注册/)
  // 注册成功的条目可以立刻被枚举。
  registerCardAbilities({ code: 'test-ok', abilities: [{ kind: 'action', label: '测试能力', resolve() {} }] })
  assert.equal(abilityShim('test-ok')[0].label, '测试能力')
})

test('P0-A Matcher：组合子按预期短路', () => {
  const ctx = { state: {}, inv: { seat: 0, location: 'study' }, context: { seat: 0, enemy: { id: 'e1', engagedSeat: 0, location: 'study' } } }
  assert.equal(all(ownSeat(), contextEnemy({ here: true }))(ctx), true)
  assert.equal(all(ownSeat(), contextEnemy({ engagedWithMe: true }))(ctx), true)
  assert.equal(any(atTrait('ancient'))(ctx), false)
  assert.equal(none(ownSeat())(ctx), false)
  assert.equal(all(() => { throw new Error('boom') })(ctx), false, '异常条件视为不满足')
})

// ---------------------------------------------------------------------------
// 2. 修正管线
// ---------------------------------------------------------------------------

test('P0-A 修正管线：声明式修正、条件、槽位与打出费用', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  const base = getStat(state, inv, 'combat')

  asset(state, '02080') // +1 战斗
  assert.equal(getStat(state, inv, 'combat'), base + 1)

  asset(state, '03009') // 伤害 ≥5 时全属性 -1
  assert.equal(getStat(state, inv, 'intellect'), getStat(state, inv, 'intellect'))
  inv.damage = 5
  assert.equal(getStat(state, inv, 'combat'), base, '02080 +1 与 03009 -1 应互相抵消')
  inv.damage = 0

  // 04051：位于[[古代]]地点时全部技能 +1。
  const ancientBase = getStat(state, inv, 'agility')
  state.locations[0].traits = ['Ancient']
  asset(state, '04051')
  assert.equal(getStat(state, inv, 'agility'), ancientBase + 1)
  state.locations[0].traits = []
  assert.equal(getStat(state, inv, 'agility'), ancientBase)

  // 05112 额外法术槽位；03142 在手牌中时其他手牌费用 +1。
  asset(state, '05112')
  assert.equal(slotBonus(inv, 'arcane'), 1)
  inv.hand = ['03142', '01086']
  assert.equal(playCostDelta(state, inv, '01086'), 1)
  assert.deepEqual(declaredModifiers('05112').map(entry => entry.target), ['slot:arcane'])
})

// ---------------------------------------------------------------------------
// 3. 新卡：反应 / 强制 / 免费 / 主动
// ---------------------------------------------------------------------------

test('P0-A 02080 击败敌人后横置抽牌', () => {
  const state = fixture('01001')
  const ally = asset(state, '02080')
  const target = enemy(state, { fight: 0, evade: 0, health: 1 })
  state.chaosBag = ['0']
  move(state, { action: 'fight', enemyId: target.id })
  assert.ok(passUntilAbility(state), '击败敌人后应出现能力层反应窗口')
  chooseAbility(state, '抽 1 张牌')
  passAll(state)
  const fresh = state.investigators[0].assets.find(item => item.code === '02080')
  assert.equal(fresh.exhausted, true)
  assert.equal(state.investigators[0].hand.length, 1)
  void ally
})

test('P0-A 02040 抽牌后弃掉该牌并换 3 资源', () => {
  const state = fixture('01001')
  asset(state, '02040')
  state.investigators[0].deck = ['01086', '01086']
  state.investigators[0].hand = []
  const before = state.investigators[0].resources
  move(state, { action: 'draw' })
  assert.ok(passUntilAbility(state), '抽牌后应出现 02040 的反应窗口')
  chooseAbility(state, '获得 3 资源')
  passAll(state)
  assert.equal(state.investigators[0].resources, before + 3)
  assert.deepEqual(state.investigators[0].hand, [], '刚抽到的牌应被弃掉')
  assert.ok(state.investigators[0].discard.includes('01086'))
})

test('P0-A 01523 闪躲取消敌人攻击；01522 证据！击败敌人后发现线索', () => {
  // 闪躲：敌人阶段攻击同地点调查员时取消。
  const dodge = fixture('01001')
  dodge.investigators[0].hand = ['01523']
  enemy(dodge, { fight: 1, evade: 1, health: 5, damage: 3, horror: 3, engagedSeat: 0 })
  move(dodge, { action: 'endTurn' })
  assert.ok(passUntilAbility(dodge), '敌人攻击时应出现 01523 的反应窗口')
  chooseAbility(dodge, '取消该次攻击')
  passAll(dodge)
  assert.equal(dodge.investigators[0].damage, 0)
  assert.equal(dodge.investigators[0].horror, 0)
  assert.ok(dodge.investigators[0].discard.includes('01523'))

  // 证据！：击败敌人后发现同地点 1 个线索。
  const evidence = fixture('01001')
  evidence.investigators[0].hand = ['01522']
  evidence.locations[0].clues = 2
  const target = enemy(evidence, { fight: 0, evade: 0, health: 1 })
  evidence.chaosBag = ['0']
  move(evidence, { action: 'fight', enemyId: target.id })
  assert.ok(passUntilAbility(evidence), '击败敌人后应出现 01522 的反应窗口')
  chooseAbility(evidence, '发现同地点 1 个线索')
  passAll(evidence)
  assert.equal(evidence.investigators[0].clues, 1)
  assert.equal(evidence.locations[0].clues, 1)
})

test('P0-A 07027 眼花缭乱花充能取消趁乱攻击', () => {
  const state = fixture('01001')
  asset(state, '07027')
  twoLocations(state)
  const target = enemy(state, { fight: 1, evade: 1, health: 5, damage: 3, horror: 3, engagedSeat: 0 })
  state.investigators[0].engaged = [target.id]
  move(state, { action: 'move', locationId: 'attic' })
  assert.ok(passUntilAbility(state), '趁乱攻击时应出现 07027 的反应窗口')
  chooseAbility(state, '取消该次攻击')
  passAll(state)
  assert.equal(state.investigators[0].damage, 0)
  const charm = state.investigators[0].assets.find(item => item.code === '07027')
  assert.equal(charm.uses, 2, '取消一次攻击应花掉 1 充能')
})

test('P0-A 05028 良好人脉只在检定窗口内可用并横置', () => {
  const state = fixture('01001')
  asset(state, '05028')
  state.investigators[0].resources = 12
  move(state, { action: 'investigate' })
  assert.ok(passUntilAbility(state), '检定开始时应出现 05028 的免费能力窗口')
  chooseAbility(state, '每 5 资源')
  passAll(state)
  assert.equal(state.investigators[0].assets.find(item => item.code === '05028').exhausted, true)
})

test('P0-A 被动与槽位卡：05112 提供额外法术槽位', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  // 两个法术槽默认占满后，第三个法术支援应当因为 05112 而可以入场。
  asset(state, '01060')
  asset(state, '01061')
  inv.assets[0].slot = 'arcane'
  inv.assets[1].slot = 'arcane'
  inv.assets.push({ id: 'spell-1', code: '01060', exhausted: false })
  // canEquip 是内部函数，这里用槽位修正的读点间接验证。
  assert.equal(slotBonus(inv, 'arcane'), 0)
  asset(state, '05112')
  assert.equal(slotBonus(inv, 'arcane'), 1)
})

test('P0-A 主动能力：02140 资源、05115 子弹、07017 治愈与赐福', () => {
  const state = fixture('01001')
  const book = asset(state, '02140')
  const before = state.investigators[0].resources
  use(state, book)
  assert.equal(state.investigators[0].resources, before + 2)

  const tommy = asset(state, '05115')
  assert.equal(tommy.uses, 5, '能力层声明的 uses 应在入场时写入实例')
  assert.equal(tommy.usesType, 'ammo')
  const target = enemy(state, { fight: 0, evade: 0, health: 5, engagedSeat: null })
  state.chaosBag = ['0']
  use(state, tommy, { targetId: target.id })
  passAll(state)
  assert.equal(state.investigators[0].assets.find(item => item.code === '05115').uses, 4)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2, '本次攻击造成 +1 伤害')

  const psalm = asset(state, '07017')
  assert.equal(psalm.uses, 4)
  assert.equal(psalm.usesType, 'secrets')
  state.investigators[0].horror = 2
  use(state, psalm)
  passAll(state)
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.chaosBag.filter(token => token === 'bless').length, 2)
})

test('P0-A 免费能力：01518 巡警、01527 警徽、07025 手枪', () => {
  const state = fixture('01001')
  const cop = asset(state, '01518')
  const target = enemy(state, { fight: 1, evade: 1, health: 4, engagedSeat: null })
  const actionsBefore = state.investigators[0].actionsLeft
  // Phase 1（B1）：目标由描述子声明，行动里直接带 targetId（不再由 resolve 询问）。
  use(state, cop, { targetId: target.id })
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 1)
  assert.ok(!state.investigators[0].assets.some(item => item.id === cop.id), '弃掉自身是能力费用')
  assert.equal(state.investigators[0].actionsLeft, actionsBefore, '免费能力不消耗行动点')

  const badge = asset(state, '01527')
  use(state, badge)
  assert.equal(state.investigators[0].actionsLeft, actionsBefore + 2)

  const pistol = asset(state, '07025')
  assert.equal(pistol.uses, 4)
  const pistolTargetId = enemy(state, { fight: 0, evade: 0, health: 5, exhausted: true, engagedSeat: null }).id
  state.chaosBag = ['0']
  use(state, pistol, { targetId: pistolTargetId })
  passAll(state)
  // applyMove 会重建整个 state，断言必须重新读取（旧引用已失效）。
  assert.equal(state.enemies.find(item => item.id === pistolTargetId).damageTaken, 2, '目标横置时 +1 伤害')
})

test('P0-A 事件卡从手牌反应：05025 串联线索在发现最后线索后生效', () => {
  const state = fixture('01001')
  const [study, attic] = twoLocations(state)
  study.clues = 1
  attic.shroud = 0
  attic.clues = 2
  state.investigators[0].hand = ['05025']
  state.chaosBag = ['0']
  move(state, { action: 'investigate' })
  assert.ok(passUntilAbility(state), '发现最后一条线索后应出现 05025 的反应窗口')
  chooseAbility(state, '隐藏值更低')
  passAll(state)
  assert.equal(state.investigators[0].clues, 3, '自己 1 个 + 阁楼 2 个')
  assert.equal(state.locations.find(location => location.id === 'attic').clues, 0)
  assert.ok(state.investigators[0].discard.includes('05025'))
})

// ---------------------------------------------------------------------------
// 4. 旧印迁移
// ---------------------------------------------------------------------------

test('P0-A 旧印迁移：21 位调查员的结算值与迁移前一致', () => {
  const fake = (state, overrides = {}) => ({
    state, seat: 0, inv: overrides.inv || state.investigators[0], context: {}, window: 'eldersign',
    api: {
      choice: () => 'skip', searchTop() {}, putIntoPlay() {}, countControlled: () => [],
      assetsCannotReady: () => false, directDamage() {}, directHorror() {}, info() {},
      ...overrides.api,
    },
  })
  const base = { rngState: 1, round: 1, phase: 'investigation', numInvestigators: 1, enemies: [],
    locations: [{ id: 'study', clues: 2 }], investigators: [{ seat: 0, code: '01001', location: 'study', horror: 3, damage: 2, resources: 7, assets: [] }] }
  const ctx = fake({ ...base })
  assert.equal(elderSignDescriptor('01001').resolve(ctx).delta, 2, '罗兰：每线索 +1')
  assert.equal(elderSignDescriptor('01004').resolve(ctx).delta, 3, '艾格尼丝：每恐惧 +1')
  assert.equal(elderSignDescriptor('02003').resolve(ctx).delta, 7, '阿什坎：等于资源数')
  assert.equal(elderSignDescriptor('03001').resolve(ctx).delta, 2, '马克：等于伤害值')
  assert.equal(elderSignDescriptor('03002').resolve(ctx).returnCommittedSkill, true)
  assert.equal(elderSignDescriptor('04003').resolve({ ...ctx, state: { ...base, enemies: [{ exhausted: true }, { exhausted: true }] } }).delta, 2)
  assert.equal(elderSignDescriptor('04004').resolve(ctx).autoSuccess, true)
  assert.equal(elderSignDescriptor('01005').resolve(ctx).autoSuccess, false)
  assert.equal(elderSignDescriptor('01003').resolve(ctx).delta, 2)
  assert.equal(elderSignDescriptor('01002').resolve(ctx).optionalDraw, 0)
})

test('P0-A 04051 亚历山卓·维拉：在[[古代]]地点横置抽 2', () => {
  const state = fixture('01001')
  const ally = asset(state, '04051')
  state.locations[0].traits = ['Ancient']
  const deckBefore = state.investigators[0].deck.length
  use(state, ally)
  assert.equal(state.investigators[0].deck.length, deckBefore - 2)
  assert.equal(state.investigators[0].assets.find(item => item.code === '04051').exhausted, true)
})

test('P0-A 反应卡：01533 调查成功获资源、02061 最后线索抽牌、02218 躲避成功抽牌', () => {
  // 01533 米兰·克里斯托弗博士：成功调查后获得 1 资源（无横置费用）。
  const milan = fixture('01001')
  asset(milan, '01533')
  milan.locations[0].clues = 2
  milan.chaosBag = ['0']
  const resourcesBefore = milan.investigators[0].resources
  move(milan, { action: 'investigate' })
  assert.ok(passUntilAbility(milan), '成功调查后应出现 01533 的反应窗口')
  chooseAbility(milan, '获得 1 资源')
  passAll(milan)
  assert.equal(milan.investigators[0].resources, resourcesBefore + 1)

  // 02061 沃伦·莱斯教授：发现所在地点最后 1 个线索后横置抽 1。
  const rice = fixture('01001')
  asset(rice, '02061')
  rice.locations[0].clues = 1
  rice.chaosBag = ['0']
  const handBefore = rice.investigators[0].hand.length
  move(rice, { action: 'investigate' })
  assert.ok(passUntilAbility(rice), '发现最后线索后应出现 02061 的反应窗口')
  chooseAbility(rice, '抽 1 张牌')
  passAll(rice)
  assert.equal(rice.investigators[0].hand.length, handBefore + 1)

  // 02218 厄尔·索耶：躲避成功后横置抽 1。
  const earl = fixture('01001')
  asset(earl, '02218')
  const target = enemy(earl, { fight: 1, evade: 0, health: 5, engagedSeat: 0 })
  earl.investigators[0].engaged = [target.id]
  earl.chaosBag = ['0']
  const earlHand = earl.investigators[0].hand.length
  move(earl, { action: 'evade', enemyId: target.id })
  assert.ok(passUntilAbility(earl), '躲避成功后应出现 02218 的反应窗口')
  chooseAbility(earl, '抽 1 张牌')
  passAll(earl)
  assert.equal(earl.investigators[0].hand.length, earlHand + 1)
})

test('P0-A 上限按实例记账：同名的两份支援各能用一次', () => {
  // 用一张只存在于能力层的测试卡（没有目录数据），避免影响真实卡牌。
  registerCardAbilities({
    code: 'test-limit-once',
    abilities: [{
      kind: 'action', label: '每阶段一次', limit: 'oncePerPhase',
      resolve: ({ inv, api }) => api.gainResources(inv.seat, 1),
    }],
  })
  const state = fixture('01001')
  const first = asset(state, 'test-limit-once')
  const second = asset(state, 'test-limit-once')
  const before = state.investigators[0].resources
  use(state, first)
  use(state, second)
  assert.equal(state.investigators[0].resources, before + 2, '两个实例各自的上限互不影响')
  const moves = legalMoves(state, decisionSeat(state)).filter(move => move.action === 'ability' && move.assetId)
  assert.ok(!moves.some(move => move.assetId === first.id), '第一个实例本阶段已用过')
  assert.ok(!moves.some(move => move.assetId === second.id), '第二个实例本阶段也已用过')
  assert.match(String(validateMove(state, 0, { action: 'ability', assetId: first.id, abilityIndex: 0 })),
    /次数已用完/, '校验层给出明确原因，而不是静默无操作')
})

test('P0-A 05023 宝剑王牌在冒险开始时放置入场', () => {
  const descriptor = allDescriptors('05023').find(item => item.trigger.includes('scenarioStarts'))
  assert.ok(descriptor, '05023 应声明 scenarioStarts 反应')
  const inv = { seat: 0, code: '01001', hand: ['05023'] }
  let placed = null
  descriptor.resolve({
    state: {}, inv, seat: 0, descriptor, window: 'scenarioStarts', context: {}, events: [],
    api: { putIntoPlay: (seat, code) => { placed = { seat, code }; inv.hand = inv.hand.filter(item => item !== code) } },
  })
  assert.deepEqual(placed, { seat: 0, code: '05023' })
  assert.deepEqual(inv.hand, [])
})

test('P0-A 能力层不改变既有校验边界：非法成本仍被拒绝', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  const pistol = asset(state, '05115')
  pistol.uses = 0
  const error = validateMove(state, 0, { action: 'ability', assetId: pistol.id, abilityIndex: 0 })
  assert.match(String(error), /成本不足/)
  inv.resources = 0
  const book = asset(state, '02140')
  const move0 = { action: 'ability', assetId: book.id, abilityIndex: 0 }
  // 02140 的能力只花行动，不花资源，因此资源为 0 也应合法。
  assert.equal(validateMove(state, 0, move0), null)
})
