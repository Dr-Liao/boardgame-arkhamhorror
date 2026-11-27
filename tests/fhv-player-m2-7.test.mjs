// P6 FHV 玩家卡 M2-7 分片（10079–10088）Node 验收。
// 条目直接 import + registerCardAbilities（不依赖索引），用 core-fixture 驱动真实引擎，
// 断言真实状态变化（费用/目标/窗口/持续/负面路径/随机附属）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, settle } from './core-fixture.mjs'
import { registeredEntry, registerCardAbilities } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { canEquip, enemyAttack, enemyEvadeValue, enemyFightValue, executeDescriptor, scenarioRuntime } from '../src/engine/engine.js'
import entries10079 from '../src/cards/entries/10079.js'
import entries10080 from '../src/cards/entries/10080.js'
import entries10081 from '../src/cards/entries/10081.js'
import entries10082 from '../src/cards/entries/10082.js'
import entries10083 from '../src/cards/entries/10083.js'
import entries10084 from '../src/cards/entries/10084.js'
import entries10085 from '../src/cards/entries/10085.js'
import entries10086 from '../src/cards/entries/10086.js'
import entries10087 from '../src/cards/entries/10087.js'
import entries10088 from '../src/cards/entries/10088.js'

const ALL_ENTRIES = [entries10079, entries10080, entries10081, entries10082, entries10083,
  entries10084, entries10085, entries10086, entries10087, entries10088]
for (const entry of ALL_ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const inv = (s, seat = 0) => s.investigators[seat]
// 规则事务用动态状态克隆重放，跨事务的实例引用会失效；断言前按 id 重新取实体。
const assetById = (s, id) => s.investigators.flatMap(owner => owner.assets || []).find(card => card.id === id)
const enemyById = (s, id) => s.enemies.find(card => card.id === id)
const descriptors = (code, kind) => (registeredEntry(code).abilities || []).filter(descriptor => descriptor.kind === kind)
const labelsOf = pending => (pending?.options || []).map(option => String(option.label || option.id))
const optionIdByLabel = (pending, pattern) => pending.options.find(option => pattern.test(String(option.label || '')))?.id
const defaultChoice = pending => ['done', 'skip', 'self', 'stay'].find(id => pending.options.some(option => option.id === id))
  ?? pending.options[0]?.id
const locationOf = (s, seat = 0) => s.locations.find(location => location.id === inv(s, seat).location)

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
// 在真实规则事务里调用 ctx.api（引擎没有对外的 api 构造入口，用一次性描述子取同一份 abilityApi）。
function viaApi(state, run, seat = 0) {
  let output
  const descriptor = { kind: 'free', code: inv(state, seat).code, cost: {},
    resolve: ctx => { output = run(ctx.api, ctx.state, ctx.inv) } }
  transact(state, draft => {
    executeDescriptor(draft, { inv: draft.investigators[seat], events: [], silent: true, alreadyPaid: true, descriptor })
  })
  return output
}
function link(state, from, id) {
  state.locations.push({ id, name: id, connections: [from], revealed: true, clues: 0, shroud: 1 })
  state.locations.find(location => location.id === from).connections.push(id)
  return id
}
// 把 [[腐烂]] 之外的副本先占掉，让「随机找出一张」只剩下想测的那张（规则上它们已不在场外）。
function occupyRots(state, codes) {
  const occupied = codes.map(() => enemy(state, { engagedSeat: null, fight: 0, evade: 0, health: 3 }))
  viaApi(state, (api, draft) => {
    codes.forEach((code, index) => {
      const foe = draft.enemies.find(card => card.id === occupied[index].id)
      assert.ok(api.bonded.attachToEnemy(0, code, foe))
    })
  })
}
// 让卡纳玛戈斯之杖的 [fast] 能力把指定 [[腐烂]] 附属到目标敌人（其余副本已占掉）。
function rodAttach(state, rod, foe, { curse = true } = {}) {
  state.chaosBag = curse ? ['curse', '0', '0', '0', '0'] : ['0', '0', '0', '0', '0']
  fire(state, '10085', descriptors('10085', 'free')[0], { source: rod }, pending => {
    if (pending.options.some(option => option.id === foe.id)) return foe.id
    return null
  })
}

// ---------------------------------------------------------------------------
// 10079 摄魂抓魄
// ---------------------------------------------------------------------------
test('P6 10079 摄魂抓魄：开局自身查找并附属 3 张不同[[技巧]]卡牌，交战时抽回 1 张', () => {
  const s = fixture('01001')
  const bewitching = asset(s, '10079')
  s.investigators[0].deck = ['01088', '10010', '10026', '10057', '01088']
  const picked = ['10010', '10026', '10057']
  const before = s.investigators[0].deck.length
  fire(s, '10079', descriptors('10079', 'setup')[0], { source: bewitching }, pending => {
    if (pending.options.some(option => option.id === 'done')) {
      return picked.find(code => pending.options.some(option => option.id === code)) ?? 'done'
    }
    return null
  })
  const attached = s.scenarioFlags.mechanics.beneath[0][bewitching.id]
  assert.deepEqual([...attached].sort(), [...picked].sort(), '开局附属 3 张不同的[[技巧]]卡牌')
  assert.equal(s.investigators[0].deck.length, before - 3, '附属的牌离开牌库')

  const foe = enemy(s, { engagedSeat: null, fight: 1, evade: 1, health: 10 })
  move(s, { action: 'engage', enemyId: foe.id })
  settle(s, pending => {
    const ids = pending.options.map(option => option.id)
    if (ids.includes('trigger')) return 'trigger'
    if (ids.includes('draw')) return 'draw'
    if (ids.includes('10010')) return '10010'
    return null
  })
  assert.equal(assetById(s, bewitching.id).exhausted, true, '横置摄魂抓魄')
  assert.ok(s.investigators[0].hand.includes('10010'), '抽回 1 张附属卡牌')
  assert.equal(s.scenarioFlags.mechanics.beneath[0][bewitching.id].length, 2, '附属区少 1 张')
})

test('P6 10079 摄魂抓魄：交战反应也可查找牌库顶 9 张的同名卡牌并抽取', () => {
  const s = fixture('01001')
  const bewitching = asset(s, '10079')
  s.investigators[0].deck = ['01088', '01088', '10010', '10010', '10026']
  viaApi(s, api => {
    api.commitOrigins.store(0, bewitching.id, '10010', { from: 'deck' })
    api.commitOrigins.store(0, bewitching.id, '10026', { from: 'deck' })
  })
  const foe = enemy(s, { engagedSeat: null, fight: 1, evade: 1, health: 10 })
  move(s, { action: 'engage', enemyId: foe.id })
  settle(s, pending => {
    const ids = pending.options.map(option => option.id)
    if (ids.includes('trigger')) return 'trigger'
    if (ids.includes('search')) return 'search'
    if (pending.kind === 'search') return pending.options.find(option => option.cardCode === '10010')?.id
    return null
  })
  assert.ok(s.investigators[0].hand.includes('10010'), '抽出牌库顶 9 张里的同名卡')
  assert.equal(s.investigators[0].deck.includes('10010'), false, '抽出的牌离开牌库')
  assert.equal(s.scenarioFlags.mechanics.beneath[0][bewitching.id].length, 2, '附属区不变')
})

// ---------------------------------------------------------------------------
// 10080 脏活
// ---------------------------------------------------------------------------
test('P6 10080 脏活：额外花费 1 行动检索[[违法]]支援付费打出，并忽略费用结算它的[action]', () => {
  const s = fixture('01001')
  s.investigators[0].hand = ['10080']
  s.investigators[0].deck = [...Array(10).fill('01088'), '10082']
  locationOf(s).clues = 2
  enemy(s, { engagedSeat: null, fight: 1, evade: 1, health: 10 })
  s.chaosBag = ['0']
  const before = { resources: inv(s).resources, actions: inv(s).actionsLeft, clues: inv(s).clues, locationClues: locationOf(s).clues }
  move(s, { action: 'play', cardId: '10080' })
  settle(s, pending => {
    const ids = pending.options.map(option => option.id)
    const search = pending.options.find(option => option.cardCode === '10082')
    if (search) return search.id
    if (ids.includes('10082')) return '10082'
    if (pending.kind === 'target' && ids.some(id => s.enemies.some(foe => foe.id === id))) {
      return s.enemies.find(foe => ids.includes(foe.id))?.id
    }
    return null
  })
  const credentials = inv(s).assets.find(card => card.code === '10082')
  assert.ok(credentials, '[[违法]]支援从牌库打出并入场')
  assert.equal(inv(s).resources, before.resources - 3, '支付脏活 1 资源 + 假证 2 资源')
  assert.equal(inv(s).actionsLeft, before.actions - 2, '打出 1 行动 + [[双重]]额外 1 行动；忽略行动费的能力不扣行动')
  assert.equal(inv(s).clues, before.clues + 1, '忽略费用结算了假证的[action]（发现线索）')
  assert.equal(locationOf(s).clues, before.locationClues - 1, '线索来自假证能力所在的地点')
})

// ---------------------------------------------------------------------------
// 10081 自由表演
// ---------------------------------------------------------------------------
test('P6 10081 自由表演：依次检定所选技能，成功分别移除毁灭/发现线索/造成伤害/自动躲避并移动', () => {
  const s = fixture('01001')
  const foe = enemy(s, { engagedSeat: 0, fight: 1, evade: 1, health: 10, damage: 1, horror: 1, doom: 1 })
  const far = link(s, inv(s).location, 'm27-vamp-target')
  s.locations.find(location => location.id === inv(s).location).clues = 2
  s.chaosBag = ['0']
  const before = { clues: inv(s).clues, locationClues: s.locations.find(l => l.id === inv(s).location).clues }
  fire(s, '10081', descriptors('10081', 'played')[0], {}, pending => {
    const ids = pending.options.map(option => option.id)
    for (const skill of ['willpower', 'intellect', 'combat', 'agility']) {
      if (ids.includes(skill)) return skill
    }
    if (ids.includes('done')) return 'done'
    return null
  })
  const after = enemyById(s, foe.id)
  assert.equal(after.doom, 0, '[willpower] 移除 1 个毁灭标记')
  assert.equal(locationOf(s).clues, 1, '[intellect] 在该敌人所在地点发现 1 个线索')
  assert.equal(inv(s).clues, before.clues + 1, '发现 1 个线索')
  assert.equal(after.damageTaken, 2, '[combat] 造成 2 点伤害')
  assert.equal(after.exhausted, true, '[agility] 自动躲避')
  assert.equal(after.location, far, '[agility] 非精英敌人移动到连接地点')
})

// ---------------------------------------------------------------------------
// 10082 假证
// ---------------------------------------------------------------------------
test('P6 10082 假证：谈判检定难度 = 疑点数，成功发现线索，未超出 2 点则放置疑点', () => {
  const s = fixture('01001')
  const credentials = asset(s, '10082', { uses: 1 })
  const foe = enemy(s, { engagedSeat: null, fight: 1, evade: 1, health: 10 })
  locationOf(s).clues = 2
  s.chaosBag = ['-1']
  const before = { clues: inv(s).clues, locationClues: locationOf(s).clues }
  fire(s, '10082', descriptors('10082', 'action')[0], { source: credentials, context: { targetId: foe.id } })
  assert.equal(s.lastTestResult.skill, 'intellect')
  assert.equal(s.lastTestResult.difficulty, 1, '1 个疑点 → 难度 1')
  assert.equal(inv(s).clues, before.clues + 1, '成功发现 1 个线索')
  assert.equal(locationOf(s).clues, before.locationClues - 1)
  assert.equal(assetById(s, credentials.id).useTokens.suspicion, 2, 'successBy 1 < 2 → 放置 1 个疑点')
})

test('P6 10082 假证：检定失败时假证返回手牌', () => {
  const s = fixture('01001')
  const credentials = asset(s, '10082')
  enemy(s, { engagedSeat: null, fight: 1, evade: 1, health: 10 })
  s.chaosBag = ['autofail']
  fire(s, '10082', descriptors('10082', 'action')[0], { source: credentials, context: { targetId: s.enemies[0].id } })
  assert.equal(s.lastTestResult.success, false)
  assert.equal(inv(s).assets.some(card => card.id === credentials.id), false, '假证离场')
  assert.ok(inv(s).hand.includes('10082'), '返回手牌')
})

// ---------------------------------------------------------------------------
// 10083 把水搅浑
// ---------------------------------------------------------------------------
test('P6 10083 把水搅浑：X = 敌人伤害+恐惧，成功对同地点每个敌人造成 X 伤害并可解除交战移动', () => {
  const s = fixture('01001')
  const target = enemy(s, { engagedSeat: 0, fight: 1, evade: 1, health: 20, damage: 1, horror: 1 })
  const other = enemy(s, { engagedSeat: null, fight: 1, evade: 1, health: 20, damage: 0, horror: 0 })
  const far = link(s, inv(s).location, 'm27-pot-target')
  s.chaosBag = ['0']
  fire(s, '10083', descriptors('10083', 'played')[0], {}, pending => {
    const ids = pending.options.map(option => option.id)
    if (pending.kind === 'target' && ids.includes(target.id)) return target.id
    if (ids.includes('move')) return 'move'
    if (pending.kind === 'location' && ids.includes(far)) return far
    return null
  })
  assert.equal(s.lastTestResult.difficulty, 2, 'X = 1 伤害 + 1 恐惧 = 2')
  assert.equal(enemyById(s, target.id).damageTaken, 2, '对所选敌人造成 X 伤害')
  assert.equal(enemyById(s, other.id).damageTaken, 2, '对同地点每个敌人造成 X 伤害')
  assert.equal(inv(s).engaged.includes(target.id), false, '与每个敌人解除交战')
  assert.equal(inv(s).location, far, '移动到连接地点')
  assert.equal(enemyById(s, target.id).location, s.locations.find(l => l.id === 'm27-pot-target').connections[0])
})

// ---------------------------------------------------------------------------
// 10084 猫面具
// ---------------------------------------------------------------------------
test('P6 10084 猫面具：每位调查员仅限 1 张[[面具]]；[fast] 花 1 贡品 +2；无毁灭卡放毁灭后补满贡品', () => {
  const s = fixture('01001')
  const mask = asset(s, '10084')
  assert.equal(assetById(s, mask.id).uses, 2, '使用 2 贡品')
  assert.equal(canEquip(inv(s), { code: '10084' }), false, '已控制 1 张[[面具]]，不能再装备第 2 张')

  const foe = enemy(s, { engagedSeat: 0, fight: 6, evade: 1, health: 10 })
  s.chaosBag = ['0']
  move(s, { action: 'fight', enemyId: foe.id })
  settle(s, pending => {
    const option = pending.options?.find(item => /猫面具|贡品/.test(String(item.label || '')))
    return option ? option.id : null
  })
  assert.equal(s.lastTestResult.value, inv(s).combat + 2, '[fast] 花 1 贡品本次检定 +2')
  assert.equal(assetById(s, mask.id).uses, 1, '花费 1 贡品')

  const doomed = enemy(s, { engagedSeat: null, fight: 1, evade: 1, health: 5 })
  scenarioRuntime(s, []).placeDoomOnCard(doomed, 1)
  settle(s)
  assert.equal(assetById(s, mask.id).uses, 2, '毁灭放到没有毁灭的卡上后补满 2 贡品')
})

// ---------------------------------------------------------------------------
// 10085 卡纳玛戈斯之杖
// ---------------------------------------------------------------------------
test('P6 10085 卡纳玛戈斯之杖：横置选任意地点非精英敌人，揭示 5 枚标记；有[诅咒]则随机附属一张[[腐烂]]', () => {
  const s = fixture('01001')
  const rod = asset(s, '10085')
  const far = link(s, inv(s).location, 'm27-rod-target')
  const foe = enemy(s, { location: far, engagedSeat: null, fight: 1, evade: 1, health: 6 })
  s.chaosBag = ['curse', '0', '0', '0', '0']
  const deckBefore = [...inv(s).deck]
  fire(s, '10085', descriptors('10085', 'free')[0], { source: rod })
  assert.equal(assetById(s, rod.id).exhausted, true, '横置卡纳玛戈斯之杖')
  const attachments = enemyById(s, foe.id).attachments || []
  assert.equal(attachments.length, 1, '揭示[诅咒]后附属 1 张[[腐烂]]')
  assert.deepEqual(inv(s).deck, deckBefore, '绑定检索没有洗牌')
  assert.ok(['10086', '10087', '10088', '10089', '10090'].includes(attachments[0].code))
  assert.equal(s.chaosBag.filter(token => token === 'curse').length, 1, '非检定揭示的[诅咒]标记放回混乱袋')

  const s2 = fixture('01001')
  const rod2 = asset(s2, '10085')
  const foe2 = enemy(s2, { engagedSeat: null, fight: 1, evade: 1, health: 6 })
  s2.chaosBag = ['0', '0', '0', '0', '0']
  fire(s2, '10085', descriptors('10085', 'free')[0], { source: rod2 })
  assert.equal((enemyById(s2, foe2.id).attachments || []).length, 0, '没有[诅咒]标记则不附属')
  assert.equal(assetById(s2, rod2.id).exhausted, true, '无论结果都支付横置')
})

// ---------------------------------------------------------------------------
// 10086 深渊腐烂
// ---------------------------------------------------------------------------
test('P6 10086 深渊腐烂：经杖附属后，所附属的敌人不能攻击', () => {
  const s = fixture('01001', 2)
  const rod = asset(s, '10085')
  occupyRots(s, ['10087', '10088', '10089', '10090'])
  const foe = enemy(s, { engagedSeat: 0, fight: 1, evade: 1, health: 6, damage: 2, horror: 2 })
  rodAttach(s, rod, foe)
  assert.ok((enemyById(s, foe.id).attachments || []).some(card => card.code === '10086'), '随机找到的唯一[[腐烂]]是深渊腐烂')
  assert.equal(scenarioRuntime(s, []).discardAsset(0, rod.id), '10085')
  const victim = s.investigators[1]
  const before = { damage: victim.damage, horror: victim.horror }
  const attacked = enemyAttack(s, enemyById(s, foe.id), victim, [])
  settle(s)
  assert.equal(attacked, false, '攻击被取消')
  assert.equal(s.investigators[1].damage, before.damage, '没有受到伤害')
  assert.equal(s.investigators[1].horror, before.horror, '没有受到恐惧')
})

// ---------------------------------------------------------------------------
// 10087 琥珀腐烂
// ---------------------------------------------------------------------------
test('P6 10087 琥珀腐烂：附属敌人被击败时按印刷生命值获得资源（最多 5），并放到一边', () => {
  const s = fixture('01001')
  const rod = asset(s, '10085')
  occupyRots(s, ['10086', '10088', '10089', '10090'])
  const foe = enemy(s, { engagedSeat: null, fight: 1, evade: 1, health: 4 })
  rodAttach(s, rod, foe)
  assert.ok((enemyById(s, foe.id).attachments || []).some(card => card.code === '10087'), '附属的是琥珀腐烂')
  const before = inv(s).resources
  // 击败结算会打开「被击败时/后」窗口（罗兰的反应），必须放在规则事务里。
  transact(s, draft => { scenarioRuntime(draft, []).damageEnemy(foe.id, 4, 0) })
  settle(s)
  assert.equal(s.enemies.some(card => card.id === foe.id), false, '敌人被击败')
  assert.equal(inv(s).resources, before + 4, '获得等于印刷生命值的资源')
  assert.ok((s.bondedSets?.['10085']?.cards || []).includes('10087'), '离场时放到一边（场外绑定集合）')
  assert.equal(inv(s).discard.includes('10087'), false, '不进入弃牌堆')
})

// ---------------------------------------------------------------------------
// 10088 流脓腐烂
// ---------------------------------------------------------------------------
test('P6 10088 流脓腐烂：附属敌人得到 -1 攻击值和 -1 躲避值', () => {
  const s = fixture('01001')
  const rod = asset(s, '10085')
  occupyRots(s, ['10086', '10087', '10089', '10090'])
  const foe = enemy(s, { engagedSeat: null, fight: 4, evade: 3, health: 6 })
  rodAttach(s, rod, foe)
  const target = enemyById(s, foe.id)
  assert.ok((target.attachments || []).some(card => card.code === '10088'), '附属的是流脓腐烂')
  assert.equal(enemyFightValue(s, target, inv(s)), 3, '攻击值 -1')
  assert.equal(enemyEvadeValue(s, target, inv(s)), 2, '躲避值 -1')
})
