// P6 FHV 玩家卡 M2-3 分片（10039–10048）Node 验收。
// 条目直接 import + registerCardAbilities（不依赖生成索引），用 core-fixture 驱动真实引擎，
// 断言真实状态变化（费用 / 槽位 / 使用次数 / 目标 / 窗口 / 持续 / 负面路径）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, settle } from './core-fixture.mjs'
import { registeredEntry, registerCardAbilities } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { canEquip, descriptorUsable, executeDescriptor, getStat, legalMoves, reactionWindow, scenarioRuntime } from '../src/engine/engine.js'
import entries10039 from '../src/cards/entries/10039.js'
import entries10040 from '../src/cards/entries/10040.js'
import entries10041 from '../src/cards/entries/10041.js'
import entries10042 from '../src/cards/entries/10042.js'
import entries10043 from '../src/cards/entries/10043.js'
import entries10044 from '../src/cards/entries/10044.js'
import entries10045 from '../src/cards/entries/10045.js'
import entries10046 from '../src/cards/entries/10046.js'
import entries10047 from '../src/cards/entries/10047.js'
import entries10048 from '../src/cards/entries/10048.js'

const ALL_ENTRIES = [entries10039, entries10040, entries10041, entries10042, entries10043, entries10044,
  entries10045, entries10046, entries10047, entries10048]
for (const entry of ALL_ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const inv = (s, seat = 0) => s.investigators[seat]
const me = s => s.investigators[0]
// 规则事务用动态状态克隆重放，跨事务的实例引用会失效；断言前按 id 重新取实体。
const assetById = (s, id) => s.investigators.flatMap(owner => owner.assets || []).find(card => card.id === id)
const enemyById = (s, id) => s.enemies.find(card => card.id === id)
const descriptors = (code, kind) => (registeredEntry(code).abilities || []).filter(descriptor => descriptor.kind === kind)
const labelsOf = pending => (pending?.options || []).map(option => String(option.label || option.id))
const optionIdByLabel = (pending, pattern) => pending.options.find(option => pattern.test(String(option.label || '')))?.id
const defaultChoice = pending => ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
  ?? pending.options[0]?.id
const locationOf = (s, seat = 0) => s.locations.find(location => location.id === inv(s, seat).location)

function withApi(state, run) {
  let output
  executeDescriptor(state, {
    inv: me(state), events: [], alreadyPaid: true, silent: true,
    descriptor: { kind: 'free', cost: {}, resolve: ({ api }) => { output = run(api) } },
  })
  return output
}

function transact(state, run, select = () => null) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'fhvPlayerTest' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 160, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    const pending = state.pendingChoice
    const id = select(pending) ?? defaultChoice(pending)
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: id }, execute)
  }
}

function fire(state, code, descriptor, { context = {}, source = null, seat = 0 } = {}, select = () => null) {
  const sourceId = source?.id ?? null
  const alreadyPaid = ['played', 'entersPlay', 'elderSign'].includes(descriptor.kind)
  transact(state, draft => {
    const holder = draft.investigators[seat]
    const resolved = sourceId
      ? holder.assets.find(card => card.id === sourceId)
      : holder.assets.find(card => card.code === code) ?? { code }
    executeDescriptor(draft, { inv: holder, source: resolved, descriptor, alreadyPaid, events: [], context })
  }, select)
}

// ---------------------------------------------------------------------------
// 10039 转瞬为神
// ---------------------------------------------------------------------------
test('P6 10039 转瞬为神：花费 1 祝愿并横置结算旧印数值，祝愿用尽后放在场外', () => {
  const s = fixture('01001')
  // 正规获取路径：10038「奇迹祝愿」的绑定检索把本卡从场外集合取进手牌。
  withApi(s, api => api.bonded.retrieve(0, '10038'))
  assert.ok(me(s).hand.includes('10039'), '绑定检索：转瞬为神进入手牌')
  me(s).hand = []
  const card = asset(s, '10039', { uses: 1 })
  locationOf(s).clues = 2 // 01001 旧印：每个线索 +1
  const context = {
    when: 'testWouldFail', seat: 0, location: me(s).location,
    skill: 'intellect', difficulty: 5, testValue: 3,
  }
  fire(s, '10039', descriptors('10039', 'reaction')[0], { source: card, context })
  assert.equal(context.testBonus, 2, '按旧印数据（地点 2 个线索）并入本次检定')
  assert.equal(me(s).assets.some(item => item.code === '10039'), false, '没有祝愿：离开场上')
  assert.deepEqual(s.bondedSets['10038'].cards, ['10039'], '放在一旁（场外绑定集合）')

  // 负面路径：手上没有祝愿时费用付不起，能力不结算（引擎的费用校验读点）。
  const blocked = fixture('01001')
  const empty = asset(blocked, '10039', { uses: 0 })
  const usable = descriptorUsable(blocked, me(blocked), empty,
    registeredEntry('10039').abilities.find(item => item.trigger.includes('testWouldFail')),
    { windowId: 'testWouldFail', context: { seat: 0 } })
  assert.equal(usable, false, '没有祝愿时不能支付 cost.uses')
})

// ---------------------------------------------------------------------------
// 10040 化学品套装
// ---------------------------------------------------------------------------
test('P6 10040 化学品套装：横置调查，成功差值 2 抽 1 张；失败差值 2 弃掉本卡', () => {
  const success = fixture('01001')
  locationOf(success).shroud = getStat(success, me(success), 'intellect')
  locationOf(success).clues = 2
  success.chaosBag = ['+2']
  const kit = asset(success, '10040')
  const handBefore = me(success).hand.length
  fire(success, '10040', descriptors('10040', 'action')[0], { source: kit })
  assert.equal(me(success).hand.length, handBefore + 1, '成功差值 2：抽取 1 张卡牌')
  assert.equal(me(success).clues, 1, '基础调查同时发现 1 个线索')
  assert.equal(assetById(success, kit.id).exhausted, true, '横置')

  const failed = fixture('01001')
  locationOf(failed).shroud = getStat(failed, me(failed), 'intellect')
  locationOf(failed).clues = 1
  failed.chaosBag = ['-2']
  const broken = asset(failed, '10040')
  fire(failed, '10040', descriptors('10040', 'action')[0], { source: broken })
  assert.equal(me(failed).assets.some(item => item.code === '10040'), false, '失败差值 2：弃掉本卡')
  assert.ok(me(failed).discard.includes('10040'))
  assert.equal(me(failed).clues, 0, '失败的调查不发现线索')
})

// ---------------------------------------------------------------------------
// 10041 查尔斯·威斯特三世博士
// ---------------------------------------------------------------------------
test('P6 10041 查尔斯·威斯特三世博士：额外手槽只放[[工具]]；成功调查差值 1/3 后横置造成 1 点伤害', () => {
  const s = fixture('01001')
  const doctor = asset(s, '10041')
  asset(s, '12033') // 手部[[道具]]（地图，不是工具）
  asset(s, '12033')
  const toolProbe = { code: '01030', slots: ['hand'], traits: ['Tool'] }
  assert.equal(canEquip(me(s), toolProbe), true, '第三条手部槽只放[[工具]]')
  assert.equal(canEquip({ ...me(s), assets: me(s).assets.filter(item => item.id !== doctor.id) }, toolProbe),
    false, '没有博士时同配置放不下第三件手部支援')

  const foe = enemy(s, { health: 5, fight: 0, evade: 0 })
  fire(s, '10041', descriptors('10041', 'reaction')[0], {
    source: doctor,
    context: { when: 'investigateSuccess', seat: 0, location: me(s).location, successBy: 3 },
  })
  assert.equal(enemyById(s, foe.id).damageTaken, 1, '成功差值 3：对同地点敌人造成 1 点伤害')
  assert.equal(assetById(s, doctor.id).exhausted, true, '横置')

  // 触发条件只认差值 1 与 3（引擎的条件读点）。
  const probe = fixture('01001')
  const ready = asset(probe, '10041')
  enemy(probe, { health: 5 })
  const descriptor = registeredEntry('10041').abilities.find(item => item.trigger.includes('investigateSuccess'))
  const usableBy = successBy => descriptorUsable(probe, me(probe), ready, descriptor,
    { windowId: 'investigateSuccess', context: { seat: 0, location: me(probe).location, successBy } })
  assert.equal(usableBy(1), true, '差值 1 可触发')
  assert.equal(usableBy(2), false, '差值 2 不触发')
})

// ---------------------------------------------------------------------------
// 10042 显微镜
// ---------------------------------------------------------------------------
test('P6 10042 显微镜：敌人被击败后放证据；[action][action] 调查按证据 +智识，成功后花证据换额外线索', () => {
  const s = fixture('01001')
  const scope = asset(s, '10042', { uses: 2 })
  const foe = enemy(s, { health: 10 })
  fire(s, '10042', descriptors('10042', 'reaction')[0], {
    source: scope,
    context: { when: 'defeatEnemy', seat: 0, location: me(s).location, enemy: foe },
  })
  assert.equal(assetById(s, scope.id).uses, 3, '击败敌人后放置 1 资源作为证据')
  assert.equal(assetById(s, scope.id).exhausted, true)

  // 真实能力路径：[action][action] 调查，花费 2 行动。
  assetById(s, scope.id).exhausted = false
  const location = locationOf(s)
  location.clues = 4
  location.shroud = getStat(s, me(s), 'intellect')
  s.chaosBag = ['0']
  const option = legalMoves(s, 0).find(row => row.action === 'ability' && row.assetId === scope.id)
  assert.ok(option, '显微镜的调查能力出现在合法行动里')
  const actionsBefore = me(s).actionsLeft
  move(s, option)
  settle(s, pending => (pending.options.some(item => item.id === '2') ? '2' : null))
  assert.equal(me(s).actionsLeft, actionsBefore - 2, '两个行动')
  assert.equal(me(s).clues, 3, '基础 1 个 + 花费 2 证据额外 2 个线索')
  assert.equal(locationOf(s).clues, 1, '地点剩 1 个线索')
  assert.equal(assetById(s, scope.id).uses, 1, '花费 2 证据')
})

// ---------------------------------------------------------------------------
// 10043 鼠面具
// ---------------------------------------------------------------------------
test('P6 10043 鼠面具：[[面具]]上限 1；新地点入场补满 1 贡品；[fast] 花 1 贡品本次检定 +2', () => {
  const s = fixture('01001')
  const mask = asset(s, '10043')
  assert.equal(canEquip(me(s), { code: '10043', traits: ['Mask'] }), false, '每位调查员仅限 1 张[[面具]]')

  // 新地点放置入场 → 补满 1 个贡品（locationPlaced 窗口）。
  mask.uses = 1
  s.scenario.locations.fixtureAnnex = { id: 'fixtureAnnex', name: '附楼', connections: [], shroud: 1, clues: 0 }
  scenarioRuntime(s, []).place('fixtureAnnex', 0)
  assert.equal(assetById(s, mask.id).uses, 2, '新地点入场后补满 1 个贡品')

  // [fast] 花费 1 贡品：真实调查检定窗口里 +2。
  locationOf(s).shroud = getStat(s, me(s), 'intellect') + 1
  locationOf(s).clues = 1
  s.chaosBag = ['0']
  const usesBefore = assetById(s, mask.id).uses
  move(s, { action: 'investigate' })
  settle(s, pending => {
    if (pending.kind === 'playerWindow' && labelsOf(pending).some(label => /鼠面具/.test(label))) {
      return optionIdByLabel(pending, /鼠面具/)
    }
    return null
  })
  assert.equal(s.lastTestResult.value, getStat(s, me(s), 'intellect') + 2, '本次检定 +2')
  assert.equal(assetById(s, mask.id).uses, usesBefore - 1, '花费 1 贡品')
  assert.equal(me(s).clues, 1, '调查成功发现线索')
})

// ---------------------------------------------------------------------------
// 10044 饥饿霉菌
// ---------------------------------------------------------------------------
test('P6 10044 饥饿霉菌：查找绑定卡加入手牌；3 个生长换成资源并记录「识别了新物种」', () => {
  const s = fixture('01001')
  const fungus = asset(s, '10044')
  const search = registeredEntry('10044').abilities.find(item => item.label.includes('诡异疯长'))
  assert.equal(descriptorUsable(s, me(s), fungus, search, { mode: 'action' }), true,
    '绑定副本还在场外时可检索')
  fire(s, '10044', descriptors('10044', 'action')[0], { source: fungus })
  assert.deepEqual(me(s).hand, ['10045'], '把「诡异疯长」加入手牌')
  assert.equal(descriptorUsable(s, me(s), assetById(s, fungus.id), search, { mode: 'action' }), false,
    '副本已经不在场外时不能检索（负面路径）')

  withApi(s, api => api.addUses(assetById(s, fungus.id), 3))
  assert.equal(assetById(s, fungus.id).uses, 3, '3 个生长')
  const resourcesBefore = me(s).resources
  fire(s, '10044', descriptors('10044', 'action')[1], { source: assetById(s, fungus.id) })
  assert.equal(me(s).resources, resourcesBefore + 3, '每个生长变成 1 资源')
  assert.equal(assetById(s, fungus.id).uses, 0, '生长全部移走')
  assert.equal(s.campaign.records.classifiedNewSpecies, true, '战役日志记录')
  assert.equal(s.campaign.investigators[0].research.classifiedNewSpecies, true, '研究记录（升级前置读点）')
})

// ---------------------------------------------------------------------------
// 10045 诡异疯长
// ---------------------------------------------------------------------------
test('P6 10045 诡异疯长：成功后按差值在饥饿霉菌上放生长并放在场外，失败返回手牌', () => {
  const s = fixture('01001')
  const fungus = asset(s, '10044')
  locationOf(s).shroud = Math.max(0, getStat(s, me(s), 'intellect') - 1)
  locationOf(s).clues = 0
  s.chaosBag = ['+2']
  fire(s, '10045', descriptors('10045', 'played')[0])
  assert.equal(assetById(s, fungus.id).uses, 3, '成功差值 3：放置 3 个生长')
  assert.deepEqual(s.bondedSets['10044'].cards, ['10045'], '放在一旁（场外绑定集合）')
  assert.equal(me(s).hand.includes('10045'), false, '不留在手牌')
  assert.equal(me(s).discard.includes('10045'), false, '也不进弃牌堆')

  const fail = fixture('01001')
  asset(fail, '10044')
  locationOf(fail).shroud = getStat(fail, me(fail), 'intellect') + 5
  locationOf(fail).clues = 0
  fail.chaosBag = ['0']
  fire(fail, '10045', descriptors('10045', 'played')[0])
  assert.ok(me(fail).hand.includes('10045'), '检定失败：返回手牌')
})

// ---------------------------------------------------------------------------
// 10046 控制变量
// ---------------------------------------------------------------------------
test('P6 10046 控制变量：技能检定揭示[诅咒]标记后快速打出，发现 1 个线索', () => {
  const s = fixture('01001')
  me(s).hand = ['10046']
  me(s).resources = 10
  locationOf(s).clues = 2
  const cluesBefore = me(s).clues
  const locationId = me(s).location
  // 走引擎自己的窗口入口（tests.js 在每次揭示标记后用同一个窗口与 context 形状），
  // 验证手牌快速事件的候选枚举与执行器（reactionWindow → playReactionCard）。
  transact(s, draft => {
    reactionWindow(draft, 'chaosTokenRevealed', {
      when: 'chaosTokenRevealed', seat: 0, location: locationId, token: 'curse', tokenIndex: 0,
    }, [], { allowNested: true })
  }, pending => (labelsOf(pending).some(label => /控制变量/.test(label))
    ? optionIdByLabel(pending, /控制变量/) : null))
  assert.equal(me(s).clues, cluesBefore + 1, '发现你所在地点的 1 个线索')
  assert.equal(me(s).resources, 9, '打出费用 1 资源')
  assert.ok(me(s).discard.includes('10046'), '事件结算后进弃牌堆')

  // 负面路径：非 [curse] 标记不满足打出条件。
  const other = fixture('01001')
  other.investigators[0].hand = ['10046']
  other.investigators[0].resources = 10
  transact(other, draft => {
    reactionWindow(draft, 'chaosTokenRevealed', {
      when: 'chaosTokenRevealed', seat: 0, location: draft.investigators[0].location, token: 'skull', tokenIndex: 0,
    }, [], { allowNested: true })
  })
  assert.deepEqual(other.investigators[0].hand, ['10046'], '骷髅标记不能打出')
})

// ---------------------------------------------------------------------------
// 10047 冲刺实验
// ---------------------------------------------------------------------------
test('P6 10047 冲刺实验：额外花 1 行动，按隐藏值升序调查并在地点调查失败后停止', () => {
  const s = fixture('01001')
  me(s).hand = ['10047']
  me(s).resources = 10
  const here = locationOf(s)
  here.revealed = true
  here.shroud = 1
  here.clues = 2
  const base = getStat(s, me(s), 'intellect')
  const low = { id: 'sprint-low', name: '低隐蔽', revealed: true, clues: 2, shroud: 0, connections: [here.id] }
  const high = { id: 'sprint-high', name: '高隐蔽', revealed: true, clues: 2, shroud: base + 5, connections: [here.id] }
  s.locations.push(low, high)
  here.connections = [low.id, high.id]
  s.debugNextTokens = ['0', '0', '0']
  const actionsBefore = me(s).actionsLeft
  move(s, { action: 'play', cardId: '10047' })
  settle(s)
  assert.equal(me(s).actionsLeft, actionsBefore - 2, '基础 1 行动 + [[双重]] 额外 1 行动')
  assert.equal(s.locations.find(item => item.id === low.id).clues, 1, '先调查隐藏值最低的地点')
  assert.equal(s.locations.find(item => item.id === here.id).clues, 1, '再调查你所在地点')
  assert.equal(s.locations.find(item => item.id === high.id).clues, 2, '失败后停止，高隐蔽地点未被调查')
  assert.ok(me(s).discard.includes('10047'), '事件结算后进弃牌堆')
})

// ---------------------------------------------------------------------------
// 10048 刨根问底
// ---------------------------------------------------------------------------
test('P6 10048 刨根问底：额外花 1 行动，同地点调查员共抽 5 张（由你分配）', () => {
  const s = fixture('01001', 2)
  assert.equal(inv(s, 0).location, inv(s, 1).location, '两位调查员同地点')
  inv(s, 0).hand = ['10048']
  inv(s, 0).resources = 10
  const secondHandBefore = inv(s, 1).hand.length
  const actionsBefore = inv(s, 0).actionsLeft
  move(s, { action: 'play', cardId: '10048' })
  settle(s, pending => (pending.options.some(option => option.id === '2') ? '2' : null))
  assert.equal(inv(s, 0).hand.length, 2, '第一位抽 2 张（打出后手牌清空）')
  assert.equal(inv(s, 1).hand.length, secondHandBefore + 3, '第二位抽剩下 3 张')
  assert.equal(inv(s, 0).actionsLeft, actionsBefore - 2, '基础 1 行动 + [[双重]] 额外 1 行动')
  assert.ok(inv(s, 0).discard.includes('10048'))
})
