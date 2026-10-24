// 万象无终（第四循环）M2 玩家卡 · M2-3 分片逐卡验收 —— P7。
//
// 分片：05186–05196、05229–05237、05273–05274（22 张）。
// 约定：本文件只测「行为」——在 core-fixture 对局态里真的打出/使用/触发该卡并断言状态变化，
// 不以「条目存在 / 卡号在目录里 / 文本非空」作为证据。
//
// 测试小工具：playCard / useAbility / run（事务包装，处理窗口与选择链）/ runTest（技能检定）。
// 引擎每次事务提交后替换调查员对象，因此断言前都重新读 state.investigators[0]。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, enemy, asset, move, settle, legalMoves, validateMove } from './core-fixture.mjs'
import { resolveTransaction } from '../src/engine/resolution.js'
import { performTest, applyHorror, applyDamage, getStat } from '../src/engine/engine.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registeredEntry } from '../src/engine/ability.js'

const SHARD_CODES = [
  '05186', '05187', '05188', '05189', '05190', '05191', '05192', '05193', '05194', '05195', '05196',
  '05229', '05230', '05231', '05232', '05233', '05234', '05235', '05236', '05237', '05273', '05274',
]
// 静态完整性（22 张/22 条）：文件级断言，任何一个卡号漏写都会让本文件加载失败。
assert.equal(SHARD_CODES.length, 22)

const me = state => state.investigators[0]
const cardName = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code
const cardOf = (state, code) => me(state).assets.find(entry => entry.code === code)
const enemyById = (state, id) => state.enemies.find(entry => entry.id === id)

function playCard(state, code, choose) {
  me(state).hand.push(code)
  move(state, { action: 'play', cardId: code })
  settle(state, choose)
}

function abilityMoves(state, code, index = 0) {
  const card = cardOf(state, code)
  assert.ok(card, `缺少支援 ${code}`)
  return legalMoves(state).filter(item => item.action === 'ability'
    && item.assetId === card.id && item.abilityIndex === index)
}

function useAbility(state, code, index = 0, targetId = null, choose) {
  const moves = abilityMoves(state, code, index)
  const picked = targetId == null ? moves[0] : moves.find(item => item.targetId === targetId)
  assert.ok(picked, `没有合法能力 ${code}#${index}`)
  move(state, picked)
  settle(state, choose)
  return picked
}

// 把一个会弹选择的结算跑完（choose 返回 null 时用默认选项）。
function run(state, execute, choose) {
  resolveTransaction(state, 0, { action: 'tcuPlayerM23Test' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 150, `Choice loop: ${state.pendingChoice.kind}`)
    const pending = state.pendingChoice
    const optionId = choose?.(pending, state)
      ?? ['done', 'skip', 'self', 'normal'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

// 跑一次技能检定（choose 负责回答窗口/投入/标记等选择）。
function runTest(state, spec, choose) {
  let outcome = null
  run(state, current => {
    outcome = performTest(current, spec.seat ?? 0, spec.skill, spec.difficulty, {
      source: spec.source || { code: '01001', label: '测试检定' },
      resolve: result => { outcome = result },
    })
  }, choose)
  return outcome
}

const pickWindowAbility = (pending, assetId, index = 0) => pending.kind === 'playerWindow'
  ? pending.options.find(option => option.assetId === assetId && option.abilityIndex === index)?.id ?? null
  : null

const pickCommit = (pending, code) => pending.kind === 'commit'
  ? pending.options.find(option => (option.label || '') === `投入：${cardName(code)}`)?.id ?? null
  : null

// 简易地点图：把 fixture 的单个地点扩成「书房 — 走廊 — 阁楼/地下室」。
function withLocationGraph(state) {
  const here = state.locations.find(location => location.id === me(state).location)
  here.connections = ['hall']
  const hall = { ...structuredClone(here), id: 'hall', name: '走廊', connections: [here.id, 'attic', 'cellar'], revealed: true }
  const attic = { ...structuredClone(here), id: 'attic', name: '阁楼', connections: ['hall'], revealed: true, clues: 0 }
  const cellar = { ...structuredClone(here), id: 'cellar', name: '地下室', connections: ['hall'], revealed: false, clues: 0 }
  state.locations.push(hall, attic, cellar)
  return { here, hall, attic, cellar }
}

// ---------------------------------------------------------------------------
// 05186 .45汤姆逊冲锋枪（守护者）
// ---------------------------------------------------------------------------

test('TCU 05186 .45汤姆逊冲锋枪 花 1 子弹攻击 +2 战斗 +1 伤害，子弹换成资源', () => {
  const state = fixture('01001')
  playCard(state, '05186')
  const entry = registeredEntry('05186')
  assert.equal(entry.uses, 5, '使用(5子弹)')
  assert.equal(entry.usesType, 'ammo')
  assert.equal(me(state).resources, 24, '打出花费 6 资源')
  const target = enemy(state, { id: 'thompson-target', fight: 0, evade: 0, health: 10 })
  state.chaosBag = ['0']
  useAbility(state, '05186', 0, target.id)
  assert.equal(enemyById(state, 'thompson-target').damageTaken, 2, '基础 1 + 卡面 +1 伤害')
  assert.equal(cardOf(state, '05186').uses, 4, '花掉 1 子弹')
  assert.equal(me(state).resources, 25, '花费的子弹进入资源池')
})

// ---------------------------------------------------------------------------
// 05187 .45汤姆逊冲锋枪（潜袭者）
// ---------------------------------------------------------------------------

test('TCU 05187 .45汤姆逊冲锋枪 命中超出另一敌人攻击值时可花 1 子弹转伤', () => {
  const state = fixture('01001')
  playCard(state, '05187')
  const first = enemy(state, { id: 'rogue-thompson-a', fight: 0, evade: 0, health: 12 })
  const second = enemy(state, { id: 'rogue-thompson-b', fight: 2, evade: 0, health: 8 })
  state.chaosBag = ['0']
  let offered = null
  useAbility(state, '05187', 0, first.id, pending => {
    if (pending.kind !== 'target') return null
    offered = pending.options.map(option => option.id)
    return 'rogue-thompson-b'
  })
  assert.ok(offered.includes('rogue-thompson-b'), '成功点数 6 ≥ 另一敌人攻击值 2，提供转伤选项')
  assert.equal(enemyById(state, 'rogue-thompson-a').damageTaken, 2, '本次攻击伤害 2 → 被攻击敌人')
  assert.equal(enemyById(state, 'rogue-thompson-b').damageTaken, 2, '额外花 1 子弹把攻击伤害转给另一个敌人')
  assert.equal(cardOf(state, '05187').uses, 3, '攻击 1 子弹 + 转伤 1 子弹')
})

// ---------------------------------------------------------------------------
// 05188 秘密卷轴（探求者）
// ---------------------------------------------------------------------------

test('TCU 05188 秘密卷轴 查看牌库底 3 张：可弃 1、可拿 1、其余放顶或底', () => {
  const state = fixture('01001')
  playCard(state, '05188')
  me(state).deck = ['01088', '01022', '01025', '01030']
  me(state).discard = []
  let cardPicks = 0
  useAbility(state, '05188', 0, null, pending => {
    if (pending.kind === 'deck') return 'seat:0'
    if (pending.kind === 'card') {
      cardPicks += 1
      return cardPicks === 1 ? '0' : 'skip' // 第 1 次：弃掉最底下那张；第 2 次：不拿
    }
    if (pending.kind === 'effect') return 'bottom'
    return null
  })
  assert.equal(cardOf(state, '05188').uses, 2, '花 1 秘密')
  assert.ok(me(state).discard.includes('01088'), '弃掉牌库底第 1 张')
  assert.deepEqual(me(state).deck, ['01022', '01025', '01030'], '其余按顺序放回牌库底')
})

// ---------------------------------------------------------------------------
// 05189 秘密卷轴（神秘学家）
// ---------------------------------------------------------------------------

test('TCU 05189 秘密卷轴 查看任意牌库顶或底 1 张，然后弃/拿/放顶/放底', () => {
  const state = fixture('01001')
  playCard(state, '05189')
  me(state).deck = ['01030', '01088']
  let effectPicks = 0
  useAbility(state, '05189', 0, null, pending => {
    if (pending.kind === 'deck') return 'seat:0'
    if (pending.kind === 'effect') {
      effectPicks += 1
      return effectPicks === 1 ? 'bottom' : 'hand' // 看牌库底 → 加入手牌
    }
    return null
  })
  assert.ok(me(state).hand.includes('01030'), '牌库底那张加入手牌')
  assert.deepEqual(me(state).deck, ['01088'], '牌库只剩 1 张')
  assert.equal(cardOf(state, '05189').uses, 3)
})

// ---------------------------------------------------------------------------
// 05190 田纳西酸麦芽威士忌（潜袭者）
// ---------------------------------------------------------------------------

test('TCU 05190 田纳西酸麦芽威士忌 弃掉：攻击 +3 战斗 +1 伤害', () => {
  const state = fixture('01001')
  playCard(state, '05190')
  const target = enemy(state, { id: 'sour-mash-rogue', fight: 0, evade: 0, health: 12 })
  state.chaosBag = ['0']
  useAbility(state, '05190', 1, target.id)
  assert.equal(enemyById(state, 'sour-mash-rogue').damageTaken, 2)
  assert.equal(cardOf(state, '05190'), undefined, '代价：弃掉自身')
  assert.ok(me(state).discard.includes('05190'))
})

test('TCU 05190 田纳西酸麦芽威士忌 诡计卡牌检定 +3 意志（横置并花 1 补给）', () => {
  const state = fixture('01001')
  playCard(state, '05190')
  const mash = cardOf(state, '05190')
  let used = false
  const outcome = runTest(state, {
    skill: 'willpower', difficulty: 6, // 意志 3 + 3 = 6 → 成功
    source: { code: '01096', label: '显现', name: '失忆' },
  }, pending => {
    const ability = pickWindowAbility(pending, mash.id, 0)
    if (ability) { used = true; return ability }
    return null
  })
  assert.equal(used, true, '诡计检定窗口提供 +3 意志能力')
  assert.equal(outcome?.success, true)
  assert.equal(cardOf(state, '05190').uses, 1, '花 1 补给')
  assert.equal(cardOf(state, '05190').exhausted, true)
})

// ---------------------------------------------------------------------------
// 05191 田纳西酸麦芽威士忌（幸存者）
// ---------------------------------------------------------------------------

test('TCU 05191 田纳西酸麦芽威士忌 弃掉：攻击 +3 战斗，命中非精英敌人后自动躲避', () => {
  const state = fixture('01001')
  playCard(state, '05191')
  const target = enemy(state, { id: 'sour-mash-survivor', fight: 0, evade: 0, health: 12 })
  state.chaosBag = ['0']
  useAbility(state, '05191', 1, target.id)
  const hit = enemyById(state, 'sour-mash-survivor')
  assert.equal(hit.damageTaken, 1, '标准伤害 1（本卡没有 +伤害）')
  assert.equal(hit.exhausted, true, '非精英敌人被自动躲避')
  assert.equal(cardOf(state, '05191'), undefined, '代价：弃掉自身')
})

// ---------------------------------------------------------------------------
// 05192 附魔剑（守护者）
// ---------------------------------------------------------------------------

test('TCU 05192 附魔剑 成功花 1 充能附魔 +1 伤害，附魔击杀后抽 1 治愈 1 恐惧', () => {
  const state = fixture('01001')
  playCard(state, '05192')
  me(state).deck = ['01088', '01088']
  me(state).horror = 1
  me(state).hand = []
  enemy(state, { id: 'blade-guardian', fight: 0, evade: 0, health: 1 })
  state.chaosBag = ['0']
  useAbility(state, '05192', 0, 'blade-guardian', pending => (
    pending.kind === 'reaction' && pending.options.some(option => option.id === 'empower') ? 'empower' : null))
  assert.equal(enemyById(state, 'blade-guardian'), undefined, '2 点伤害击败 1 生命敌人')
  assert.equal(cardOf(state, '05192').uses, 2, '附魔花 1 充能')
  assert.equal(me(state).hand.length, 1, '击杀后抽 1 张')
  assert.equal(me(state).horror, 0, '击杀后治愈 1 点恐惧')
})

// ---------------------------------------------------------------------------
// 05193 附魔剑（神秘学家）
// ---------------------------------------------------------------------------

test('TCU 05193 附魔剑 额外花 2 充能：+2 战斗 +2 伤害', () => {
  const state = fixture('01001')
  playCard(state, '05193')
  enemy(state, { id: 'blade-mystic', fight: 0, evade: 0, health: 12 })
  state.chaosBag = ['0']
  useAbility(state, '05193', 0, 'blade-mystic', pending => pending.kind === 'resource' ? '2' : null)
  assert.equal(enemyById(state, 'blade-mystic').damageTaken, 3, '标准 1 + 附魔 2 伤害')
  assert.equal(cardOf(state, '05193').uses, 2, '花 2 充能')
})

// ---------------------------------------------------------------------------
// 05194 / 05195 恐怖图腾
// ---------------------------------------------------------------------------

test('TCU 05194 恐怖图腾 投入后横置：投入卡再获得 1 个图标，检定成功抽 1 张', () => {
  const state = fixture('01001')
  playCard(state, '05194')
  const totem = cardOf(state, '05194')
  me(state).hand = ['01025']
  me(state).deck = ['01022', '01088']
  state.chaosBag = ['0']
  let selected = false
  const outcome = runTest(state, { skill: 'combat', difficulty: 6 }, pending => {
    const commit = pickCommit(pending, '01025')
    if (commit) return commit
    const ability = pickWindowAbility(pending, totem.id, 0)
    if (ability) { selected = true; return ability }
    return null
  })
  assert.equal(selected, true, '投入后窗口提供恐怖图腾能力')
  // 战斗 4 + 投入 1 图标 + 图腾 +1 = 6 vs 6 → 成功。
  assert.equal(outcome?.success, true)
  assert.equal(cardOf(state, '05194').exhausted, true)
  assert.ok(me(state).hand.includes('01088'), '检定成功：执行者从牌库顶抽 1 张')
})

test('TCU 05195 恐怖图腾 投入后横置：检定失败时把投入的卡牌返回手牌', () => {
  const state = fixture('01001')
  playCard(state, '05195')
  const totem = cardOf(state, '05195')
  me(state).hand = ['01025']
  me(state).discard = []
  state.chaosBag = ['autofail']
  let selected = false
  const outcome = runTest(state, { skill: 'combat', difficulty: 4 }, pending => {
    const commit = pickCommit(pending, '01025')
    if (commit) return commit
    const ability = pickWindowAbility(pending, totem.id, 0)
    if (ability) { selected = true; return ability }
    return null
  })
  assert.equal(selected, true, '投入后窗口提供恐怖图腾能力')
  assert.equal(outcome?.success, false)
  assert.ok(me(state).hand.includes('01025'), '检定失败：投入的卡牌返回手牌')
  assert.ok(!me(state).discard.includes('01025'), '返回手牌而不是进弃牌堆')
})

// ---------------------------------------------------------------------------
// 05196 委员会的保险箱（中立）
// ---------------------------------------------------------------------------

test('TCU 05196 委员会的保险箱 双行动检定任意技能移除锁头，无锁时全队免费打出并放逐', () => {
  const state = fixture('01001')
  playCard(state, '05196')
  const coffer = cardOf(state, '05196')
  assert.equal(coffer.uses, 1, '使用(1[per_investigator]锁头)')
  me(state).willpower = 6
  me(state).deck = []
  me(state).discard = ['01018']
  state.chaosBag = ['0']
  // 只有 1 个行动点时启动 [行动][行动] 能力：不扣行动、不减少锁头（refund 路径）。
  me(state).actionsLeft = 1
  useAbility(state, '05196', 0, null, pending => (pending.kind === 'skill' ? 'willpower' : null))
  assert.equal(me(state).actionsLeft, 1, '行动点不足时不扣行动')
  assert.equal(cardOf(state, '05196').uses, 1, '行动点不足时锁头不减')
  // 2 个行动点：检定成功移除唯一锁头 → 全队免费打出 1 张牌并放逐保险箱。
  me(state).actionsLeft = 3
  useAbility(state, '05196', 0, null, pending => (pending.kind === 'skill' ? 'willpower' : null))
  assert.equal(me(state).actionsLeft, 1, '能力消耗 2 个行动点')
  assert.equal(cardOf(state, '05196'), undefined, '无锁头后保险箱离场')
  assert.ok(me(state).assets.some(entry => entry.code === '01018'), '免费打出弃牌堆里的巡警')
  assert.equal(me(state).resources, 30, '免费打出（巡警 4 费不付）')
  assert.ok(state.exiled.includes('05196'), '放逐委员会的保险箱')
})

// ---------------------------------------------------------------------------
// 05229 鸣枪示警
// ---------------------------------------------------------------------------

test('TCU 05229 鸣枪示警 花 1 子弹把所在地点所有非精英敌人赶去连接地点', () => {
  const state = fixture('01001')
  asset(state, '05186')
  const graph = withLocationGraph(state)
  enemy(state, { id: 'warning-runner', fight: 1, evade: 1, health: 5 })
  enemy(state, { id: 'warning-elite', fight: 1, evade: 1, health: 5, elite: true })
  playCard(state, '05229')
  assert.equal(cardOf(state, '05186').uses, 4, '额外费用：枪械花 1 子弹')
  assert.equal(enemyById(state, 'warning-runner').location, graph.hall.id, '非精英敌人被移动到连接地点')
  assert.equal(enemyById(state, 'warning-elite').location, graph.here.id, '精英敌人不移动')
  assert.equal(me(state).resources, 28, '打出费用 2')
  // 没有带子弹的[[枪械]]支援时打不出去。
  const bare = fixture('01001')
  me(bare).hand.push('05229')
  assert.match(validateMove(bare, 0, { action: 'play', cardId: '05229' }) || '', /没有可以花费 1 子弹/)
})

// ---------------------------------------------------------------------------
// 05230 瞄准镜（升级 · 显式简化）
// ---------------------------------------------------------------------------

test('TCU 05230 瞄准镜 快速附属到[[枪械]]支援（简化：附属期能力见条目 note）', () => {
  const state = fixture('01001')
  asset(state, '05186')
  playCard(state, '05230')
  const host = cardOf(state, '05186')
  assert.ok((host.attachments || []).some(entry => entry.code === '05230'), '附属到枪械支援')
  assert.equal(cardOf(state, '05230'), undefined, '升级事件不作为独立支援留在场上')
  assert.ok(!me(state).discard.includes('05230'), '附属后不进入弃牌堆')
  // 没有枪械支援时没有合法宿主：卡牌留在手牌。
  const bare = fixture('01001')
  me(bare).hand.push('05230')
  const error = validateMove(bare, 0, { action: 'play', cardId: '05230' })
  if (error == null) {
    move(bare, { action: 'play', cardId: '05230' })
    settle(bare)
    assert.ok(me(bare).hand.includes('05230'), '没有合法宿主时留在手牌')
  } else {
    assert.match(error, /没有可以附属/)
  }
})

// ---------------------------------------------------------------------------
// 05231 知识就是力量（显式简化）
// ---------------------------------------------------------------------------

test('TCU 05231 知识就是力量 结算所选[[书籍]]支援的[行动]能力（忽略费用）', () => {
  const state = fixture('01001')
  withLocationGraph(state)
  playCard(state, '05232') // 书籍支援：绝密地图集
  const atlas = cardOf(state, '05232')
  assert.equal(atlas.uses, 4)
  me(state).actionsLeft = 5
  playCard(state, '05231')
  assert.equal(me(state).location, 'attic', '结算了绝密地图集的行动能力：移动到距离 2 的已揭示地点')
  assert.equal(cardOf(state, '05232').uses, 4, '忽略费用：秘密没有被花费')
  assert.equal(cardOf(state, '05232').exhausted, false, '忽略费用：支援没有横置')
})

// ---------------------------------------------------------------------------
// 05232 绝密地图集
// ---------------------------------------------------------------------------

test('TCU 05232 绝密地图集 花秘密横置移动到距离正好为 2 的已揭示地点', () => {
  const state = fixture('01001')
  const graph = withLocationGraph(state)
  playCard(state, '05232')
  assert.equal(me(state).location, graph.here.id)
  state.chaosBag = ['0']
  // 距离 2：阁楼（已揭示）与地下室（未揭示，不可选）→ 唯一候选，直接移动。
  useAbility(state, '05232', 0)
  assert.equal(me(state).location, 'attic', '移动到距离 2 的已揭示地点')
  assert.equal(cardOf(state, '05232').uses, 3, '花 1 秘密')
  assert.equal(cardOf(state, '05232').exhausted, true, '横置地图集')
  // 未揭示的地下室不在候选里：移回书房后，把阁楼也藏起来 → 没有合法地点，能力不出现。
  me(state).location = graph.here.id
  graph.attic.revealed = false
  assert.equal(abilityMoves(state, '05232', 0).length, 0, '没有「正好 2 次连接且已揭示」的地点')
})

// ---------------------------------------------------------------------------
// 05233 投资
// ---------------------------------------------------------------------------

test('TCU 05233 投资 横置放置补给（上限 10），兑现时把全部补给换成资源', () => {
  const state = fixture('01001')
  playCard(state, '05233')
  const investment = cardOf(state, '05233')
  assert.equal(investment.uses, 0, '使用(0补给)')
  for (let index = 0; index < 3; index++) {
    cardOf(state, '05233').exhausted = false
    useAbility(state, '05233', 0)
  }
  assert.equal(cardOf(state, '05233').uses, 3, '横置 3 次 → 3 补给')
  // 上限 10：手动推到 10 后不能再放置。
  cardOf(state, '05233').uses = 10
  cardOf(state, '05233').exhausted = false
  assert.equal(abilityMoves(state, '05233', 0).length, 0, '投资上仅限 10 补给')
  cardOf(state, '05233').uses = 3
  const resources = me(state).resources
  cardOf(state, '05233').exhausted = false
  useAbility(state, '05233', 1)
  assert.equal(me(state).resources, resources + 3, '兑现 3 补给 → 3 资源')
  assert.equal(cardOf(state, '05233'), undefined, '兑现时弃掉投资')
  assert.ok(me(state).discard.includes('05233'))
})

// ---------------------------------------------------------------------------
// 05234 诱敌
// ---------------------------------------------------------------------------

test('TCU 05234 诱敌 自动躲避非精英敌人；可支付 +2 资源改为最多 2 个', () => {
  const state = fixture('01001')
  enemy(state, { id: 'decoy-a', fight: 1, evade: 1, health: 5 })
  enemy(state, { id: 'decoy-b', fight: 1, evade: 1, health: 5 })
  playCard(state, '05234', pending => {
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'pair')) return 'pair'
    if (pending.kind === 'target') {
      const candidates = pending.options.filter(option => option.id.startsWith('decoy-'))
      return candidates[0]?.id ?? null
    }
    return null
  })
  assert.equal(enemyById(state, 'decoy-a').exhausted, true, '第 1 个敌人被自动躲避')
  assert.equal(enemyById(state, 'decoy-b').exhausted, true, '第 2 个敌人被自动躲避（+2 资源的版本）')
  assert.equal(me(state).resources, 26, '打出费用 2 + 提升费用 2')
})

// ---------------------------------------------------------------------------
// 05235 蠕虫的秘密
// ---------------------------------------------------------------------------

test('TCU 05235 蠕虫的秘密 横置并放 1 毁灭：从弃牌堆免费-1 费打出法术/洞察事件，之后移出游戏', () => {
  const state = fixture('01001')
  playCard(state, '05235')
  me(state).discard = ['01037'] // 专业的直觉（洞察事件，1 线索）
  const location = state.locations.find(entry => entry.id === me(state).location)
  location.clues = 2
  me(state).clues = 0
  const resources = me(state).resources
  useAbility(state, '05235', 0)
  assert.equal(me(state).clues, 1, '打出的「专业的直觉」发现 1 个线索')
  assert.equal(me(state).resources, resources - 1, '费用 2 - 1 = 1')
  assert.ok((state.removedFromGame || []).includes('01037'), '事件结算后移出游戏')
  assert.equal(cardOf(state, '05235').doom, 1, '在蠕虫的秘密上放置 1 毁灭')
  assert.equal(cardOf(state, '05235').exhausted, true)
})

// ---------------------------------------------------------------------------
// 05236 指路鬼魂（显式简化）
// ---------------------------------------------------------------------------

test('TCU 05236 指路鬼魂 +1 智慧；非直接恐惧必须先分给它，因恐惧离场时移出游戏', () => {
  const state = fixture('01001')
  const base = getStat(state, me(state), 'intellect')
  asset(state, '05236')
  assert.equal(getStat(state, me(state), 'intellect'), base + 1, '你得到 +1 智慧')
  const ghost = cardOf(state, '05236')
  // 2 点非直接恐惧：必须分配给指路鬼魂（沉静），不能落到调查员身上。
  run(state, current => applyHorror(current, current.investigators[0], 2, []),
    pending => (pending.kind === 'assign-horror' ? ghost.id : null))
  assert.equal(cardOf(state, '05236').horror, 2)
  assert.equal(me(state).horror, 0)
  // 第 3 点恐惧把它击败：离场时移出游戏（简化：removedFromGame 而不是战役放逐账本）。
  run(state, current => applyHorror(current, current.investigators[0], 1, []),
    pending => (pending.kind === 'assign-horror' ? ghost.id : null))
  assert.equal(cardOf(state, '05236'), undefined, '3 神智耗尽后被击败')
  assert.ok((state.removedFromGame || []).includes('05236'), '离场后移出游戏')
  assert.ok(!me(state).discard.includes('05236'), '不进普通弃牌堆')
})

// ---------------------------------------------------------------------------
// 05237 幸运或是注定（显式简化）
// ---------------------------------------------------------------------------

test('TCU 05237 幸运或是注定 取消密谋上 1 点毁灭、放逐自身；每场游戏最多 1 张', () => {
  const state = fixture('01001')
  state.doom = 2
  playCard(state, '05237')
  assert.equal(state.doom, 1, '取消当前密谋上的 1 点毁灭')
  assert.ok(state.exiled.includes('05237'), '放逐自身')
  assert.equal(me(state).gameFlags?.fortuneOrFate, true, '记录每场游戏 1 张')
  me(state).hand.push('05237')
  assert.match(validateMove(state, 0, { action: 'play', cardId: '05237' }) || '', /每场游戏最多/)
})

// ---------------------------------------------------------------------------
// 05273 MK1手榴弹
// ---------------------------------------------------------------------------

test('TCU 05273 MK1手榴弹 命中后对所在地点每个敌人造成 2 点伤害，补给耗尽后弃置', () => {
  const state = fixture('01001')
  playCard(state, '05273')
  enemy(state, { id: 'grenade-a', fight: 0, evade: 0, health: 12 })
  enemy(state, { id: 'grenade-b', fight: 0, evade: 0, health: 12 })
  state.chaosBag = ['0']
  useAbility(state, '05273', 0, 'grenade-a')
  assert.equal(enemyById(state, 'grenade-a').damageTaken, 2, '被攻击敌人 2 点')
  assert.equal(enemyById(state, 'grenade-b').damageTaken, 2, '同地点其他敌人 2 点')
  assert.equal(cardOf(state, '05273').uses, 2)
  // 只剩 1 补给时再投一次 → 补给归零，手榴弹被弃掉。
  cardOf(state, '05273').uses = 1
  enemy(state, { id: 'grenade-c', fight: 0, evade: 0, health: 12 })
  useAbility(state, '05273', 0, 'grenade-c')
  assert.equal(cardOf(state, '05273'), undefined, '没有补给时弃掉')
  assert.ok(me(state).discard.includes('05273'))
})

// ---------------------------------------------------------------------------
// 05274 特工支援
// ---------------------------------------------------------------------------

test('TCU 05274 特工支援 两条[快速]能力：对敌人 1 伤害 / 发现 1 线索', () => {
  const state = fixture('01001')
  asset(state, '05274')
  enemy(state, { id: 'backup-enemy', fight: 0, evade: 0, health: 10 })
  const location = state.locations.find(entry => entry.id === me(state).location)
  location.clues = 2
  me(state).actionsLeft = 5
  useAbility(state, '05274', 0, 'backup-enemy')
  assert.equal(enemyById(state, 'backup-enemy').damageTaken, 1, '对敌人造成 1 点伤害')
  assert.equal(cardOf(state, '05274').damage, 1, '对自身造成 1 点伤害作为代价')
  assert.equal(cardOf(state, '05274').exhausted, true)
  // 重整后：对自身 1 恐惧 → 发现 1 线索。
  cardOf(state, '05274').exhausted = false
  const clues = me(state).clues
  useAbility(state, '05274', 1)
  assert.equal(me(state).clues, clues + 1, '发现所在地点 1 个线索')
  assert.equal(cardOf(state, '05274').horror, 1, '对自身造成 1 点恐惧作为代价')
})

test('TCU 05274 特工支援 可以替同地点其他调查员承伤', () => {
  const state = fixture('01001', 2)
  asset(state, '05274', {}, 0)
  state.investigators[1].location = state.investigators[0].location
  run(state, current => applyDamage(current, current.investigators[1], 1, []),
    pending => (pending.kind === 'assign-damage'
      ? pending.options.find(option => option.label.includes('特工支援'))?.id ?? null
      : null))
  assert.equal(cardOf(state, '05274').damage, 1, '同地点其他调查员受到的伤害分配给特工支援')
  assert.equal(state.investigators[1].damage, 0)
})
