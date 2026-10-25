// 万象无终（TCU）第 2 步 P2.1 原语验收：闹鬼（Haunted）。
//
// 覆盖路线图 §4.1 的必测项：调查失败触发、复数能力的顺序、取消、两次、无能力、
// 无合法目标、存档往返；外加注册期校验（未知子句/未知字段在加载时失败）。
//
// 两段测试：
//   · 单元段：直接调用 haunted.js 的原语，用 stub 的窗口/询问观察顺序与取消；
//   · 集成段：从 core-fixture 建局，走真实 legalMoves/applyMove，证明
//     「调查检定失败 → 结算该地点闹鬼能力」这条接线真的在引擎里。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, answer } from './core-fixture.mjs'
import {
  HAUNTED_CLAUSES, createHaunted, hauntGrant, hauntedAbilitiesAt, isLocationHaunted,
  normalizeHauntedAbility, normalizeScenarioHaunted,
} from '../src/engine/haunted.js'
import { registerCardAbilities } from '../src/engine/ability.js'

// ---------------------------------------------------------------------------
// 单元段：原语本身的契约
// ---------------------------------------------------------------------------

function harness(options = {}) {
  const state = {
    round: 1,
    phase: 'investigation',
    log: [],
    investigators: [{
      seat: 0, name: '测试调查员', location: 'loc-a', clues: options.clues ?? 2,
      resources: options.resources ?? 3, hand: options.hand ?? ['01088'], assets: options.assets ?? [], engaged: [],
      damage: 0, horror: 0, actionsLeft: 3,
    }],
    locations: [{ id: 'loc-a', name: '测试地点', connections: ['loc-b'], clues: 0, haunted: options.haunted || [] },
      { id: 'loc-b', name: '邻街', connections: ['loc-a'] }],
    enemies: options.enemies || [],
    scenario: options.scenario || {},
  }
  const stub = {
    state,
    answers: [...(options.answers || [])],
    cancel: options.cancel === true,
    behavior: options.behavior || {},
    windows: [],
    cardDef: code => (code === 'withHealth' ? { health: 2 } : {}),
  }
  const api = {
    info: text => state.log.push(text),
    cardName: code => code,
    damage: (seat, n) => { state.investigators[seat].damage += n },
    horror: (seat, n) => { state.investigators[seat].horror += n },
    directDamage: (seat, n) => { state.investigators[seat].damage += n },
    directHorror: (seat, n) => { state.investigators[seat].horror += n },
    damageAsset: (seat, assetId, n) => { api.damaged ||= []; api.damaged.push([assetId, n]) },
    loseActions: (seat, n) => { state.investigators[seat].actionsLeft -= n },
    discardRandom: (seat, n) => { state.investigators[seat].hand.splice(0, n) },
    discardChosen: (seat, n) => { state.investigators[seat].hand.splice(0, n) },
    discardAsset: (seat, assetId) => { api.discarded ||= []; api.discarded.push(assetId) },
    spendClues: (seat, n) => { state.investigators[seat].clues -= n },
    doomOn: (card, n) => { card.doom = (card.doom || 0) + n },
    addDoom: n => { state.doom = (state.doom || 0) + n },
    spawn: (code, location) => { state.spawned ||= []; state.spawned.push([code, location]) },
    attack: (enemy, inv) => { state.attacked ||= []; state.attacked.push(enemy.id) },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
  }
  const primitive = createHaunted({
    reactionWindow: (target, when, context) => {
      stub.windows.push(when)
      if (stub.cancel) context.cancelled = true
      return context
    },
    requestChoice: (target, request) => {
      stub.requests ||= []
      stub.requests.push(request)
      return stub.answers.length ? stub.answers.shift() : request.options[0].id
    },
    scenarioBehavior: () => stub.behavior,
    cardDef: stub.cardDef,
  })
  return { state, stub, api, primitive }
}

const ability = (text, effect) => ({ text, effect })

test('P2.1 注册期校验：未知子句/未知字段/非法 amount 直接失败', () => {
  const ok = normalizeHauntedAbility({ text: '闹鬼 - 受到 1 点恐惧。', effect: [{ kind: 'horror', amount: 1 }] })
  assert.equal(ok.text, '闹鬼 - 受到 1 点恐惧。')
  assert.ok(Object.isFrozen(ok))
  assert.deepEqual(ok.effect.map(clause => clause.kind), ['horror'])

  assert.throws(() => normalizeHauntedAbility({ text: 'x', effect: [{ kind: 'teleport' }] }), /未知子句/)
  assert.throws(() => normalizeHauntedAbility({ text: 'x', effect: [{ kind: 'horror', amount: -1 }] }), /非负整数/)
  assert.throws(() => normalizeHauntedAbility({ text: 'x', effect: [{ kind: 'horror', sanity: 1 }] }), /未知子句字段/)
  assert.throws(() => normalizeHauntedAbility({ text: '', effect: [{ kind: 'horror', amount: 1 }] }), /卡面文本/)
  assert.throws(() => normalizeHauntedAbility({ text: 'x', effect: [{ kind: 'choice', options: [] }] }), /至少一个 option/)
  assert.throws(() => normalizeHauntedAbility({ text: 'x', effect: [{ kind: 'script' }] }), /script 需要 id/)
  assert.ok(HAUNTED_CLAUSES.includes('choice'))
})

test('P2.1 剧本加载期校验：地点 haunted 数组写错时报出具体位置', () => {
  const normalized = normalizeScenarioHaunted({
    'loc-a': { haunted: [{ text: '闹鬼 - 受到 1 点恐惧。', effect: [{ kind: 'horror', amount: 1 }] }] },
    'loc-b': {},
  })
  assert.deepEqual(Object.keys(normalized), ['loc-a'])
  assert.equal(normalized['loc-a'].length, 1)
  assert.throws(() => normalizeScenarioHaunted({ 'loc-a': { haunted: [{ text: 'x', effect: [{ kind: 'nope' }] }] } }),
    /scenario\.locations\[loc-a\]\.haunted\[0\]/)
  assert.throws(() => normalizeScenarioHaunted({ 'loc-a': { haunted: { text: 'x' } } }), /必须是数组/)
})

test('P2.1 读取点：印刷能力 + 授予能力（all / 指定地点），isLocationHaunted 同源', () => {
  const { state, primitive } = harness({
    haunted: [ability('闹鬼 - 失去 1 个行动。', [{ kind: 'loseAction', amount: 1 }])],
  })
  assert.equal(isLocationHaunted(state, 'loc-a'), true)
  assert.equal(isLocationHaunted(state, 'loc-b'), false)
  primitive.grantHaunted(state, { locationId: 'all', ability: { text: '闹鬼 - 受到 1 点恐惧。', effect: [{ kind: 'horror', amount: 1 }] } })
  primitive.grantHaunted(state, { locationId: 'loc-b', ability: { text: '闹鬼 - 失去 1 点资源。', effect: [{ kind: 'loseResource', amount: 1 }] } })
  assert.equal(hauntedAbilitiesAt(state, 'loc-a').length, 2)
  assert.equal(hauntedAbilitiesAt(state, 'loc-b').length, 2)
  assert.equal(isLocationHaunted(state, 'loc-b'), true)
  // 授予是纯 JSON：存档往返后仍在。
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(hauntedAbilitiesAt(restored, 'loc-b').length, 2)
  assert.equal(primitive.clearHauntedGrants(restored, grant => grant.locationId === 'loc-b'), 1)
  assert.equal(hauntedAbilitiesAt(restored, 'loc-b').length, 1)
})

test('P2.1 结算：times=2 会把整轮能力结算两次', () => {
  const { state, primitive, stub, api } = harness({
    haunted: [ability('闹鬼 - 受到 1 点恐惧。', [{ kind: 'horror', amount: 1 }])],
  })
  const result = primitive.resolveHaunted(state, 0, { times: 2 }, api)
  assert.equal(result.resolved, 2)
  assert.equal(state.investigators[0].horror, 2)
  assert.deepEqual(stub.windows, ['haunted'])
})

test('P2.1 结算：复数能力由玩家决定顺序，逐条结算', () => {
  const { state, primitive, api, stub } = harness({
    haunted: [
      ability('闹鬼 - 失去 1 个行动。', [{ kind: 'loseAction', amount: 1 }]),
      ability('闹鬼 - 失去 2 个行动。', [{ kind: 'loseAction', amount: 2 }]),
    ],
    answers: ['loc-a#1'],
  })
  const result = primitive.resolveHaunted(state, 0, {}, api)
  assert.equal(result.resolved, 2)
  assert.equal(state.investigators[0].actionsLeft, 3 - 1 - 2)
  // 顺序按玩家选择：先结算 #1（失去 2）再结算剩下的 #0（失去 1）。
  const order = state.log.filter(line => line.includes('闹鬼：')).map(line => line.includes('失去 2') ? 'two' : 'one')
  assert.deepEqual(order, ['two', 'one'])
  // 只剩一条能力时不再询问。
  assert.equal(stub.requests.length, 1)
})

test('P2.1 结算：haunted 窗口可以取消整次结算', () => {
  const { state, primitive, api } = harness({
    haunted: [ability('闹鬼 - 受到 1 点恐惧。', [{ kind: 'horror', amount: 1 }])],
    cancel: true,
  })
  const result = primitive.resolveHaunted(state, 0, {}, api)
  assert.equal(result.cancelled, true)
  assert.equal(result.resolved, 0)
  assert.equal(state.investigators[0].horror, 0)
  assert.ok(state.log.some(line => line.includes('被取消')))
})

test('P2.1 结算：没有闹鬼能力时是空操作，不写日志也不询问', () => {
  const { state, primitive, api, stub } = harness({})
  const result = primitive.resolveHaunted(state, 0, {}, api)
  assert.equal(result.reason, 'not-haunted')
  assert.equal(state.log.length, 0)
  assert.equal(stub.windows.length, 0)
})

test('P2.1 结算：没有合法目标的能力被跳过（弃手牌但手牌为空）', () => {
  const { state, primitive, api } = harness({
    hand: [],
    haunted: [ability('闹鬼 - 选择并弃掉一张手牌。', [{ kind: 'discardChosen', amount: 1 }])],
  })
  const result = primitive.resolveHaunted(state, 0, {}, api)
  assert.equal(result.resolved, 0)
  assert.ok(state.log.some(line => line.includes('没有合法目标')))
})

test('P2.1 结算：choice 子句只结算选中的一支', () => {
  const { state, primitive, api } = harness({
    haunted: [ability('闹鬼 - 你必须失去 1 次行动或失去 2 点资源。', [{
      kind: 'choice',
      options: [
        { id: 'action', label: '失去 1 次行动', effect: [{ kind: 'loseAction', amount: 1 }] },
        { id: 'resource', label: '失去 2 点资源', effect: [{ kind: 'loseResource', amount: 2 }] },
      ],
    }])],
    answers: ['resource'],
  })
  primitive.resolveHaunted(state, 0, {}, api)
  assert.equal(state.investigators[0].resources, 1)
  assert.equal(state.investigators[0].actionsLeft, 3)
})

test('P2.1 结算：资源不足按卡面转为恐惧（loseResource.overflowHorror）', () => {
  const { state, primitive, api } = harness({
    resources: 1,
    haunted: [ability('闹鬼 - 失去 2 资源；每有 1 个无法失去的资源受到 1 点恐惧。', [{ kind: 'loseResource', amount: 2, overflowHorror: true }])],
  })
  primitive.resolveHaunted(state, 0, {}, api)
  assert.equal(state.investigators[0].resources, 0)
  assert.equal(state.investigators[0].horror, 1)
})

// 第四轮 haunted-choice-option-validation（05081 / 05130 同形）：choice 只列可结算选项。
test('第四轮修复：无支援时「弃掉一个支援」选项被过滤，自动结算「受到 1 点恐惧」（05130/05081 同形）', () => {
  const data = [{
    text: '闹鬼 - 你必须受到 1 点恐惧，或选择并弃掉 1 个你控制的支援。',
    effect: [{
      kind: 'choice',
      options: [
        { id: 'horror', label: '受到 1 点恐惧', effect: [{ kind: 'horror', amount: 1 }] },
        { id: 'discardAsset', label: '弃掉一个你控制的支援', effect: [{ kind: 'discardAsset', amount: 1 }] },
      ],
    }],
  }]
  const noAsset = harness({ haunted: data, assets: [] })
  noAsset.primitive.resolveHaunted(noAsset.state, 0, {}, noAsset.api)
  assert.equal(noAsset.state.investigators[0].horror, 1, '唯一可结算选项自动结算')
  assert.equal((noAsset.stub.requests || []).length, 0, '只有 1 个可结算选项时不再询问（弃支援已过滤）')
  assert.equal(noAsset.api.discarded, undefined, '没有执行弃支援')
  // 有支援时两个选项都应出现，且选择弃支援会真正弃掉它。
  const withAsset = harness({ haunted: data, assets: [{ id: 'asset-1', code: '01088' }], answers: ['discardAsset'] })
  withAsset.primitive.resolveHaunted(withAsset.state, 0, {}, withAsset.api)
  assert.equal(withAsset.stub.requests.length, 1, '有支援时出现二选一')
  assert.deepEqual(withAsset.stub.requests[0].options.map(option => option.id), ['horror', 'discardAsset'])
  assert.deepEqual(withAsset.api.discarded, ['asset-1'])
  assert.equal(withAsset.state.investigators[0].horror, 0)
})

// 第四轮 haunted-choice-option-validation（05131 同形）：0 线索时「放线索」选项被过滤。
test('第四轮修复：0 线索时「将 1 个线索放在此地点」选项被过滤，自动放毁灭（05131 同形）', () => {
  const data = [{
    text: '闹鬼 - 你必须将你的 1 个线索放在此地点，或在当前密谋上放置 1 个毁灭标记。',
    effect: [{
      kind: 'choice',
      options: [
        { id: 'placeClue', label: '将 1 个线索放在此地点', effect: [{ kind: 'placeClue', amount: 1 }] },
        { id: 'agendaDoom', label: '在当前密谋上放置 1 个毁灭标记', effect: [{ kind: 'doom', target: 'agenda', amount: 1 }] },
      ],
    }],
  }]
  const noClue = harness({ haunted: data, clues: 0 })
  noClue.primitive.resolveHaunted(noClue.state, 0, {}, noClue.api)
  assert.equal(noClue.state.doom, 1, '唯一可结算选项（放毁灭）自动结算')
  assert.equal((noClue.stub.requests || []).length, 0, '0 线索时不再询问')
  assert.equal(noClue.state.investigators[0].clues, 0)
  // 有线索时两个选项都出现，选择放线索走 spendClues + 地点线索。
  const withClue = harness({ haunted: data, clues: 2, answers: ['placeClue'] })
  withClue.primitive.resolveHaunted(withClue.state, 0, {}, withClue.api)
  assert.deepEqual(withClue.stub.requests[0].options.map(option => option.id), ['placeClue', 'agendaDoom'])
  assert.equal(withClue.state.investigators[0].clues, 1)
  assert.equal(withClue.state.locations[0].clues, 1)
  assert.equal(withClue.state.doom, undefined)
})

// 第四轮 damageAssets-investigator（05083 露台）：调查员本人也受直接伤害，带 health 的支援各受 1 点。
test('第四轮修复：damageAssets 含调查员本人 + 带生命值支援各受 1 点直接伤害（05083 同形）', () => {
  const data = [{
    text: '闹鬼 - 你每张带有生命值的卡牌受到 1 点直接伤害。',
    effect: [{ kind: 'damageAssets', amount: 1 }],
  }]
  const withAssets = harness({
    haunted: data,
    assets: [{ id: 'health-1', code: 'withHealth' }, { id: 'no-health', code: 'noHealth' }],
  })
  withAssets.primitive.resolveHaunted(withAssets.state, 0, {}, withAssets.api)
  assert.equal(withAssets.state.investigators[0].damage, 1, '调查员本人受到 1 点直接伤害')
  assert.deepEqual(withAssets.api.damaged, [['health-1', 1]], '只有带 health 的支援各受 1 点')
  // 没有任何支援时调查员仍然要受 1 点（clauseAvailable 恒真）。
  const noAssets = harness({ haunted: data, assets: [] })
  noAssets.primitive.resolveHaunted(noAssets.state, 0, {}, noAssets.api)
  assert.equal(noAssets.state.investigators[0].damage, 1)
  assert.equal(noAssets.api.damaged, undefined)
})

test('P2.1 结算：script 子句缺少章节实现时记账，不静默通过', () => {
  const { state, primitive, api } = harness({
    haunted: [ability('闹鬼 - 查找遭遇牌库，找出一张鼠群。', [{ kind: 'script', id: 'findSwarmOfRats' }])],
  })
  const result = primitive.resolveHaunted(state, 0, {}, api)
  assert.equal(result.resolved, 0)
  assert.equal(state.hauntedGaps.length, 1)
  assert.equal(state.hauntedGaps[0].scriptId, 'findSwarmOfRats')
  assert.ok(state.log.some(line => line.includes('缺少章节脚本')))

  // 章节注册了 hauntedScript 之后，同一个子句就能结算。
  const handled = harness({
    haunted: [ability('闹鬼 - 查找遭遇牌库，找出一张鼠群。', [{ kind: 'script', id: 'findSwarmOfRats' }])],
    behavior: { hauntedScript: (target, payload) => { target.scriptRan = payload.scriptId; return true } },
  })
  const outcome = handled.primitive.resolveHaunted(handled.state, 0, {}, handled.api)
  assert.equal(outcome.resolved, 1)
  assert.equal(handled.state.scriptRan, 'findSwarmOfRats')
  assert.equal(handled.state.hauntedGaps, undefined)
})

test('P2.1 失败窗口：默认只认调查失败，剧本可扩到攻击/躲避', () => {
  const investigate = harness({ haunted: [ability('闹鬼 - 受到 1 点恐惧。', [{ kind: 'horror', amount: 1 }])] })
  assert.equal(investigate.primitive.resolveAfterFailedAction(investigate.state, 0, 'investigate', investigate.api).resolved, 1)
  assert.equal(investigate.state.investigators[0].horror, 1)

  const fight = harness({ haunted: [ability('闹鬼 - 受到 1 点恐惧。', [{ kind: 'horror', amount: 1 }])] })
  assert.equal(fight.primitive.resolveAfterFailedAction(fight.state, 0, 'fight', fight.api).reason, 'not-configured')
  assert.equal(fight.state.investigators[0].horror, 0)

  const widened = harness({
    haunted: [ability('闹鬼 - 受到 1 点恐惧。', [{ kind: 'horror', amount: 1 }])],
    scenario: { hauntedOn: ['investigate', 'fight', 'evade'] },
  })
  assert.equal(widened.primitive.resolveAfterFailedAction(widened.state, 0, 'evade', widened.api).resolved, 1)
  assert.equal(widened.state.investigators[0].horror, 1)
})

test('P2.1 授予：hauntGrant 校验形状并默认 all', () => {
  const grant = hauntGrant({ ability: { text: '闹鬼 - 受到 1 点恐惧。', effect: [{ kind: 'horror', amount: 1 }] } })
  assert.equal(grant.locationId, 'all')
  assert.equal(grant.ability.text, '闹鬼 - 受到 1 点恐惧。')
  assert.throws(() => hauntGrant({ ability: { text: 'x', effect: [{ kind: 'nope' }] } }), /闹鬼能力无效/)
})

// ---------------------------------------------------------------------------
// 集成段：真实引擎里的接线（调查失败 → 闹鬼）
// ---------------------------------------------------------------------------

// 测试用条目：在 haunted 窗口取消结算（模拟「即使被封印在卡上」这类中断）。
registerCardAbilities([{
  code: '01998',
  abilities: [{
    kind: 'forced',
    trigger: 'window:haunted',
    label: '测试：取消本次闹鬼',
    resolve: ({ context }) => { if (context) context.cancelled = true },
  }],
}])

// 调查是一整条技能检定：先有「投入手牌」窗口（可以选「开始检定」），
// 失败之后才有闹鬼询问。这个驱动器把沿途的常规窗口答掉，停在闹鬼询问（如果有）。
function driveInvestigate(state, onHaunted = null) {
  move(state, { action: 'investigate' })
  for (let guard = 0; state.pendingChoice && guard < 40; guard++) {
    if (state.pendingChoice.kind === 'haunted') {
      if (!onHaunted) throw new Error('unexpected haunted choice')
      onHaunted(state.pendingChoice, state)
      return
    }
    const choice = state.pendingChoice
    const id = ['done', 'skip', 'self'].find(candidate => choice.options.some(option => option.id === candidate))
      ?? choice.options[0]?.id
    answer(state, id)
  }
}

function hauntedFixture(haunted, count = 1) {
  const state = fixture('01001', count)
  const inv = state.investigators[0]
  const loc = state.locations.find(location => location.id === inv.location)
  loc.clues = 2
  loc.haunted = haunted
  state.chaosBag = ['-8']
  return { state, inv, loc }
}

test('P2.1 集成：调查检定失败后自动结算该地点的闹鬼能力', () => {
  const { state, inv } = hauntedFixture([
    { text: '闹鬼 - 受到 1 点恐惧。', effect: [{ kind: 'horror', amount: 1 }] },
  ])
  const before = inv.horror
  driveInvestigate(state)
  // 事务提交会替换 state 上的调查员对象，断言前重新读取。
  assert.equal(state.investigators[0].horror, before + 1)
  assert.ok(state.log.some(line => line.includes('结算「')))
})

test('P2.1 集成：调查成功不触发闹鬼', () => {
  const { state, inv } = hauntedFixture([
    { text: '闹鬼 - 受到 1 点恐惧。', effect: [{ kind: 'horror', amount: 1 }] },
  ], 1)
  state.chaosBag = ['+1']
  const before = inv.horror
  driveInvestigate(state)
  assert.equal(state.investigators[0].horror, before)
  assert.ok(!state.log.some(line => line.includes('结算「')))
})

test('P2.1 集成：复数能力走真实待决选择，回答后全部结算', () => {
  const { state } = hauntedFixture([
    { text: '闹鬼 - 失去 1 个行动。', effect: [{ kind: 'loseAction', amount: 1 }] },
    { text: '闹鬼 - 受到 1 点伤害。', effect: [{ kind: 'damage', amount: 1 }] },
  ])
  let options = null
  driveInvestigate(state, choice => {
    options = choice.options
    answer(state, choice.options[0].id)
  })
  assert.equal(options?.length, 2)
  // 两条能力最终都结算：一条失去 1 行动，一条受到 1 伤害。
  const after = state.investigators[0]
  assert.equal((after.damage || 0) + (after.horror || 0), 1)
  assert.equal(after.actionsLeft, 18) // 调查花 1 个行动，闹鬼再失去 1 个
})

test('P2.1 集成：注册的 forced 能力可以在 haunted 窗口取消结算', () => {
  const { state, inv } = hauntedFixture([
    { text: '闹鬼 - 受到 1 点恐惧。', effect: [{ kind: 'horror', amount: 1 }] },
  ])
  // 放一张带取消能力的支援入场（forced 描述子在窗口内无条件结算）。
  state.investigators[0].assets.push({ id: 'c999', code: '01998', exhausted: false })
  const before = inv.horror
  driveInvestigate(state)
  assert.equal(state.investigators[0].horror, before)
  assert.ok(state.log.some(line => line.includes('被取消')), '取消窗口应记录在日志里')
})

test('P2.1 集成：存档往返后授予的闹鬼能力仍然生效', () => {
  const { state } = hauntedFixture([])
  state.hauntedGrants = [{
    locationId: 'all',
    ability: normalizeHauntedAbility({ text: '闹鬼 - 受到 1 点恐惧。', effect: [{ kind: 'horror', amount: 1 }] }),
  }]
  const restored = JSON.parse(JSON.stringify(state))
  restored.pendingChoice = null
  const before = restored.investigators[0].horror
  driveInvestigate(restored)
  assert.equal(restored.investigators[0].horror, before + 1)
})
