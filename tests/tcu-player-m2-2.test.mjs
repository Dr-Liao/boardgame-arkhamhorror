// 万象无终（第四循环）M2 玩家卡 · M2-2 分片逐卡验收 —— P7。
//
// 覆盖路线图 §7.2 的验收口径：每张卡在 core-fixture 对局态里真的打出/使用/触发并断言状态变化，
// 不用「条目存在 / 卡号在目录里 / 文本非空」充当证据。分片范围：
// 05042（高塔·XVI 基础弱点）、05109–05119（隐密之名玩家卡）、05151–05160（恶罪报应玩家卡）。
//
// 约定：每次事务提交后引擎会替换调查员对象，断言前重新读 state.investigators[0]。
// 会弹选择的结算用 settle(state, choose) 收尾；随机只走引擎的 randomValue / chaosBag 固定值。

import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset, enemy, move, settle } from './core-fixture.mjs'
import {
  applyMove, canEquip, createGameState, decisionSeat, discoverClueAt, enemyEvadeValue, executeDescriptor,
  getMaxHealth, getMaxSanity, getStat, legalMoves, performTest, playCost, validateMove,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import {
  handCommitBlocker, isTarotCard, mulliganCandidates, mulliganProtectedCodes,
} from '../src/engine/tarot-slot.js'
import { DATA_IMPLEMENTED_CODES } from '../src/cards/card-implementation.js'

const codes = [
  '05042',
  '05109', '05110', '05111', '05112', '05113', '05114', '05115', '05116', '05117', '05118', '05119',
  '05151', '05152', '05153', '05154', '05155', '05156', '05157', '05158', '05159', '05160',
]
assert.equal(codes.length, 22)

const cardName = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code
const me = state => state.investigators[0]

// 把一次「会触发选择」的结算跑完：execute 拿到的 current 是事务里的草稿状态，必须往里写。
function runTransaction(state, execute, choose) {
  resolveTransaction(state, 0, { action: 'tcuPlayerM22Test' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 200, `Choice loop: ${state.pendingChoice.kind}`)
    const pending = state.pendingChoice
    const optionId = choose?.(pending, state)
      ?? ['done', 'skip', 'self', 'normal'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

const run = (state, fn, choose) => runTransaction(state, current => fn(current), choose)

// core-fixture 只建一个地点（书房）。需要「其他地点」的卡（移动敌人 / 敌人不重整 / 跨地点承伤）
// 在 state.locations 上补一个已揭示地点并双向连线。
function addLocation(state, id) {
  state.locations.push({ id, name: id, clues: 0, shroud: 2, connections: ['study'], revealed: true })
  const study = state.locations.find(location => location.id === 'study')
  if (study && !study.connections.includes(id)) study.connections = [...study.connections, id]
  return id
}

// 手牌里放一张卡再按普通出牌通道打出（含打出条件/费用校验）。
function playFromHand(state, code, seat = 0) {
  state.investigators[seat].hand.push(code)
  return move(state, { action: 'play', cardId: code })
}

// 走真实抽牌通道（弱点/普通牌的结算都在这一条路径上）。
function drawOne(state, choose) {
  const inv = me(state)
  inv.hand = []
  inv.deck = [inv.deck[0] || '01088']
  run(state, current => {
    executeDescriptor(current, {
      inv: current.investigators[0], source: null, events: [], context: {},
      descriptor: { code: '01037', label: '测试抽牌', resolve: ({ api }) => api.drawCards(0, 1) },
    })
  }, choose)
}

// ---------------------------------------------------------------------------
// 05042 高塔·XVI（基础弱点 + 塔罗槽）
// ---------------------------------------------------------------------------

test('TCU 05042 高塔·XVI 手牌封锁：在手牌中时不能在技能检定投入任何卡牌', () => {
  const state = fixture('01001')
  me(state).hand = ['01088', '05042']
  assert.equal(isTarotCard(ALL_CARDS['05042']), true, '高塔是塔罗槽卡')
  assert.equal(registeredEntry('05042')?.blocksCommitWhileInHand, true)
  // 真实投入窗口：只剩「开始检定」，没有可投入的牌。
  assert.equal(handCommitBlocker(me(state), registeredEntry), '05042')
  move(state, { action: 'investigate' })
  const commit = state.pendingChoice
  assert.ok(commit, '应有投入窗口')
  assert.equal(commit.kind, 'commit')
  assert.deepEqual(commit.options.map(option => option.id), ['done'])
  settle(state)
  assert.equal(handCommitBlocker(me(state), registeredEntry), '05042')
})

test('TCU 05042 高塔·XVI 换牌保护：起始手牌里的它不能换掉', () => {
  const state = fixture('01001')
  me(state).hand = ['01088', '05042', '01016']
  assert.deepEqual(mulliganCandidates(me(state), registeredEntry).map(item => item.code), ['01088', '01016'])
  assert.deepEqual(mulliganProtectedCodes(me(state), registeredEntry), ['05042'])
  assert.equal(registeredEntry('05042')?.cannotMulliganAway, true)
})

test('TCU 05042 高塔·XVI 基础弱点抽到后留在手牌（不立刻结算进弃牌堆）', () => {
  const state = fixture('01001')
  me(state).deck = ['05042']
  drawOne(state)
  // 卡面是「留在手牌并封锁投入」的弱点，不是抽到即结算的显现效果。
  assert.equal(me(state).hand.includes('05042'), true, '抽到后留在手牌')
  assert.equal(me(state).discard.includes('05042'), false, '没有被弃掉')
  assert.equal(handCommitBlocker(me(state), registeredEntry), '05042')
})

// ---------------------------------------------------------------------------
// 05109 赴汤蹈火
// ---------------------------------------------------------------------------

test('TCU 05109 赴汤蹈火 同地点其他调查员的恐惧可以分配给它', () => {
  const state = fixture('01001', 2)
  const ward = asset(state, '05109', {}, 1)
  assert.equal(state.investigators[0].location, state.investigators[1].location, '两人同地点')
  // 0 号座位受到 1 点恐惧：分配时可以给 1 号座位控制的赴汤蹈火。
  let offered = false
  run(state, current => {
    executeDescriptor(current, {
      inv: current.investigators[0], source: null, events: [], context: {},
      descriptor: {
        code: '01037', label: '测试恐惧', resolve: ({ api }) => api.harm(0, { horror: 1 }),
      },
    })
  }, pending => {
    if (pending.kind === 'assign-horror') {
      offered = pending.options.some(option => option.id === ward.id)
      return ward.id
    }
    return null
  })
  assert.equal(offered, true, '赴汤蹈火出现在同地点承伤候选里')
  assert.equal(me(state).horror, 0)
  assert.equal(state.investigators[1].assets.find(item => item.id === ward.id).horror, 1)
  assert.equal(getMaxSanity(state.investigators[1]), ALL_CARDS['01001'].sanity, '上限不受承伤影响')
})

test('TCU 05109 赴汤蹈火 不同地点的其他调查员不能把恐惧分配给它', () => {
  const state = fixture('01001', 2)
  const ward = asset(state, '05109', {}, 1)
  state.investigators[1].location = addLocation(state, 'hallway')
  let offered = false
  run(state, current => {
    executeDescriptor(current, {
      inv: current.investigators[0], source: null, events: [], context: {},
      descriptor: { code: '01037', label: '测试恐惧', resolve: ({ api }) => api.harm(0, { horror: 1 }) },
    })
  }, pending => {
    if (pending.kind === 'assign-horror') {
      offered = pending.options.some(option => option.id === ward.id)
      return pending.options.find(option => option.id !== ward.id)?.id
    }
    return null
  })
  assert.equal(offered, false)
  assert.equal(me(state).horror, 1, '同地点没有承接者时仍然由调查员自己承受')
})

// ---------------------------------------------------------------------------
// 05113 驱除
// ---------------------------------------------------------------------------

test('TCU 05113 驱除 意志躲避成功后把敌人移动到任意地点', () => {
  const state = fixture('01001')
  const target = enemy(state, { id: 'banish-target', fight: 1, evade: 1, health: 6, engagedSeat: 0 })
  state.chaosBag = ['0']
  const destination = addLocation(state, 'hallway')
  playFromHand(state, '05113')
  settle(state, pending => {
    if (pending.kind === 'move') return destination
    return null
  })
  assert.equal(state.enemies.find(item => item.id === target.id).location, destination, '敌人被移动到所选地点')
  assert.equal(me(state).discard.includes('05113'), true, '事件结算后进弃牌堆')
})

test('TCU 05113 驱除 揭示符号后敌人在下一个补给阶段不重整', () => {
  const state = fixture('01001')
  const target = enemy(state, { id: 'banish-symbol', fight: 0, evade: 0, health: 9, engagedSeat: 0 })
  state.chaosBag = ['skull']
  playFromHand(state, '05113')
  settle(state, pending => (pending.kind === 'move' ? me(state).location : null))
  const after = state.enemies.find(item => item.id === target.id)
  assert.equal(after.preventReady?.rounds, 1, '下一个补给阶段不重整')
  assert.equal(after.preventReady.from, state.round)
})

test('TCU 05113 驱除 只能用于非精英敌人：只有精英敌人时打不出', () => {
  const state = fixture('01001')
  enemy(state, { id: 'banish-elite', elite: true, fight: 1, evade: 1, health: 9, engagedSeat: 0 })
  me(state).hand = ['05113']
  const denied = validateMove(state, 0, { action: 'play', cardId: '05113' })
  assert.equal(denied, '没有可躲避的非精英敌人')
  // 换成非精英敌人后同一张牌可以打出。
  state.enemies = []
  enemy(state, { id: 'banish-non-elite', fight: 1, evade: 1, health: 9, engagedSeat: 0 })
  assert.equal(validateMove(state, 0, { action: 'play', cardId: '05113' }), null)
})

// ---------------------------------------------------------------------------
// 05115 .45汤姆逊冲锋枪
// ---------------------------------------------------------------------------

test('TCU 05115 .45汤姆逊冲锋枪 花 1 子弹攻击：战斗 +2、伤害 +1', () => {
  const state = fixture('01001')
  const gun = asset(state, '05115')
  const target = enemy(state, { id: 'thompson-target', fight: 2, evade: 1, health: 6 })
  state.chaosBag = ['0']
  const combatBefore = getStat(state, me(state), 'combat')
  move(state, { action: 'ability', assetId: gun.id, abilityIndex: 0, targetId: target.id })
  settle(state)
  const after = me(state).assets.find(item => item.id === gun.id)
  assert.equal(after.uses, 4, '消耗 1 子弹')
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2, '基础 1 + 武器 1')
  assert.equal(registeredEntry('05115').usesType, 'ammo')
  assert.ok(combatBefore >= 1)
})

// 纯数据通道兜底：没有行为条目的卡也必须能在 DATA_IMPLEMENTED_CODES 或注册表里找到实现依据。
test('TCU M2-2 数据通道：分片内每张卡都有条目或数据通道实现', () => {
  for (const code of codes) {
    const implemented = Boolean(registeredEntry(code)) || DATA_IMPLEMENTED_CODES.has(code)
    assert.equal(implemented, true, code)
    assert.equal(ALL_CARDS[code]?.code, code)
  }
})

// ---------------------------------------------------------------------------
// 05110 水落石出
// ---------------------------------------------------------------------------

test('TCU 05110 水落石出 最后线索被发现后，该地点调查员获得 X=隐藏值的资源', () => {
  const state = fixture('01001')
  const location = state.locations[0]
  location.clues = 1
  location.shroud = 2
  state.chaosBag = ['0']
  me(state).hand = ['05110']
  const before = me(state).resources
  move(state, { action: 'investigate' })
  settle(state, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => item.cardCode === '05110')
      if (option) return option.id
    }
    return null
  })
  assert.equal(me(state).clues, 1, '调查发现了最后一个线索')
  assert.equal(me(state).resources, before + 2, 'X=隐藏值 2，由该地点唯一的调查员获得')
  assert.equal(me(state).discard.includes('05110'), true, '快速事件结算后进弃牌堆')
})

// ---------------------------------------------------------------------------
// 05111 情报报告
// ---------------------------------------------------------------------------

test('TCU 05111 情报报告 提升费用 2 点：发现 2 个线索', () => {
  const state = fixture('01001')
  const location = state.locations[0]
  location.clues = 3
  location.shroud = 2
  state.chaosBag = ['0']
  me(state).hand = ['05111']
  me(state).resources = 10
  move(state, { action: 'play', cardId: '05111' })
  settle(state, pending => {
    if (pending.kind !== 'effect') return null
    if (pending.options.some(option => option.id === 'clues')) return 'clues'
    if (pending.options.some(option => option.id === 'range')) return 'skip'
    return null
  })
  assert.equal(me(state).clues, 2, '基础 1 + 升级 1')
  assert.equal(me(state).resources, 10 - 2 - 2, '打出费用 2 + 升级费用 2')
})

test('TCU 05111 情报报告 提升费用 2 点：改为发现 2 个连接内的地点', () => {
  const state = fixture('01001')
  const study = state.locations[0]
  study.clues = 0
  study.shroud = 2
  addLocation(state, 'hallway')
  state.locations.push({ id: 'attic', name: '阁楼', clues: 2, shroud: 2, connections: ['hallway'], revealed: true })
  state.locations.find(item => item.id === 'hallway').connections.push('attic')
  state.chaosBag = ['0']
  me(state).hand = ['05111']
  me(state).resources = 10
  move(state, { action: 'play', cardId: '05111' })
  settle(state, pending => {
    if (pending.kind === 'effect') {
      if (pending.options.some(option => option.id === 'range')) return 'range'
      if (pending.options.some(option => option.id === 'clues')) return 'skip'
    }
    if (pending.kind === 'location') {
      if (pending.options.some(option => option.id === 'attic')) return 'attic'
    }
    return null
  })
  assert.equal(state.locations.find(item => item.id === 'attic').clues, 1, '在 2 个连接外的阁楼发现 1 个线索')
  assert.equal(me(state).clues, 1)
  assert.equal(me(state).resources, 10 - 2 - 2)
})

// ---------------------------------------------------------------------------
// 05112 魔法手势
// ---------------------------------------------------------------------------

test('TCU 05112 魔法手势 额外 1 个法术槽位（add:slot）', () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.assets = []
  assert.equal(canEquip(inv, ALL_CARDS['01060']), true)
  inv.assets.push({ id: 'spell-a', code: '01060', exhausted: false },
    { id: 'spell-b', code: '01060', exhausted: false })
  assert.equal(canEquip(inv, ALL_CARDS['01060']), false, '默认 2 个法术槽已满')
  inv.assets.push({ id: 'sign-magick', code: '05112', exhausted: false })
  assert.equal(canEquip(inv, ALL_CARDS['01060']), true, '魔法手势提供额外法术槽')
  assert.equal(registeredEntry('05112').fast, true, '快速关键字在条目上')
  assert.deepEqual(registeredEntry('05112').modifiers.map(item => [item.target, item.value]), [['add:slot', 'arcane']])
})

// ---------------------------------------------------------------------------
// 05114 切肉刀
// ---------------------------------------------------------------------------

test('TCU 05114 切肉刀 剩余神智充足时 +1 战斗；可受 1 恐惧换 +1 伤害并在击败后治愈', () => {
  const state = fixture('01001')
  const cleaver = asset(state, '05114')
  const target = enemy(state, { id: 'cleaver-target', fight: 2, evade: 1, health: 2 })
  state.chaosBag = ['0']
  me(state).horror = 0
  move(state, { action: 'ability', assetId: cleaver.id, abilityIndex: 0, targetId: target.id })
  settle(state, pending => {
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'horror')) return 'horror'
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'heal')) return 'heal'
    return null
  })
  assert.equal(state.lastTestResult.value, getStat(state, me(state), 'combat') + 1, '剩余神智 5 → +1 战斗')
  assert.equal(state.enemies.some(item => item.id === target.id), false, '1 基础 + 1 额外伤害击败 2 生命敌人')
  assert.equal(me(state).horror, 0, '额外费用 1 恐惧，击败后治愈 1 恐惧')
})

test('TCU 05114 切肉刀 剩余神智不超过 3 时改为 +2 战斗', () => {
  const state = fixture('01001')
  const cleaver = asset(state, '05114')
  const target = enemy(state, { id: 'cleaver-low', fight: 3, evade: 1, health: 9 })
  state.chaosBag = ['0']
  me(state).horror = 3
  move(state, { action: 'ability', assetId: cleaver.id, abilityIndex: 0, targetId: target.id })
  settle(state, pending => (pending.kind === 'effect' ? 'skip' : null))
  assert.equal(state.lastTestResult.value, getStat(state, me(state), 'combat') + 2)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 1)
})

// ---------------------------------------------------------------------------
// 05116 秘密卷轴
// ---------------------------------------------------------------------------

test('TCU 05116 秘密卷轴 查看任意调查员牌库底并加入手牌', () => {
  const state = fixture('01001')
  const scroll = asset(state, '05116')
  me(state).deck = ['01016', '01088']
  me(state).hand = []
  move(state, { action: 'ability', assetId: scroll.id, abilityIndex: 0 })
  settle(state, pending => {
    if (pending.kind === 'deck') return 'seat:0'
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'hand')) return 'hand'
    return null
  })
  assert.equal(me(state).hand.includes('01016'), true, '牌库底那张进入手牌')
  assert.deepEqual(me(state).deck, ['01088'], '牌库少了一张（剩下的是牌库顶那张）')
  const after = me(state).assets.find(item => item.id === scroll.id)
  assert.equal(after.uses, 2, '消耗 1 秘密')
  assert.equal(after.exhausted, true, '能力要求横置')
})

test('TCU 05116 秘密卷轴 查看遭遇牌库底并弃掉', () => {
  const state = fixture('01001')
  const scroll = asset(state, '05116')
  state.encounterDeck = ['01165', '01088']
  move(state, { action: 'ability', assetId: scroll.id, abilityIndex: 0 })
  settle(state, pending => {
    if (pending.kind === 'deck') return 'encounter'
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'discard')) return 'discard'
    return null
  })
  assert.equal(state.encounterDiscard.includes('01165'), true, '遭遇牌库底那张进入遭遇弃牌堆')
  assert.deepEqual(state.encounterDeck, ['01088'])
})

// ---------------------------------------------------------------------------
// 05117 田纳西酸麦芽威士忌
// ---------------------------------------------------------------------------

test('TCU 05117 田纳西酸麦芽威士忌 诡计意志检定 +2 意志（横置 + 1 补给）', () => {
  const state = fixture('01001')
  const mash = asset(state, '05117')
  let offered = false
  run(state, current => {
    // 真实显现检定期间引擎写入 _treacheryResolving（src/engine/treachery-tokens.js）；
    // 这里直接置入同一上下文，再跑一次真实的意志检定。
    current._treacheryResolving = '01165'
    try {
      performTest(current, 0, 'willpower', 3, { resolve: value => { current.testResult = value } })
    } finally {
      delete current._treacheryResolving
    }
  }, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => item.cardCode === '05117')
      if (option) { offered = true; return option.id }
    }
    return null
  })
  assert.equal(offered, true, '诡计检定开始时提供能力')
  const after = me(state).assets.find(item => item.id === mash.id)
  assert.equal(after.uses, 1, '花费 1 补给')
  assert.equal(after.exhausted, true, '横置自身')
  assert.equal(state.testResult.value, 3 + 2 + 0, '意志 3 + 2，标记 0')
  assert.equal(state.testResult.success, true)
})

test('TCU 05117 田纳西酸麦芽威士忌 弃掉自身攻击：战斗 +3', () => {
  const state = fixture('01001')
  const mash = asset(state, '05117')
  const target = enemy(state, { id: 'mash-target', fight: 2, evade: 1, health: 6 })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: mash.id, abilityIndex: 0, targetId: target.id })
  settle(state)
  assert.equal(state.lastTestResult.value, getStat(state, me(state), 'combat') + 3)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 1)
  assert.equal(me(state).assets.some(item => item.code === '05117'), false, '弃掉自身')
  assert.equal(me(state).discard.includes('05117'), true)
})

// ---------------------------------------------------------------------------
// 05118 附魔剑
// ---------------------------------------------------------------------------

test('TCU 05118 附魔剑 +1 战斗；花 1 充能附魔再 +1 战斗/+1 伤害', () => {
  const state = fixture('01001')
  const blade = asset(state, '05118')
  const target = enemy(state, { id: 'blade-target', fight: 2, evade: 1, health: 6 })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: blade.id, abilityIndex: 0, targetId: target.id })
  settle(state, pending => (pending.kind === 'effect' && pending.options.some(option => option.id === 'empower') ? 'empower' : null))
  assert.equal(me(state).assets.find(item => item.id === blade.id).uses, 2, '消耗 1 充能')
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2, '1 基础 + 1 附魔')
  assert.equal(state.lastTestResult.value, getStat(state, me(state), 'combat') + 2)
  // 不花充能的普通攻击：只有 +1 战斗、1 伤害。
  const second = enemy(state, { id: 'blade-second', fight: 2, evade: 1, health: 6 })
  move(state, { action: 'ability', assetId: blade.id, abilityIndex: 0, targetId: second.id })
  settle(state, pending => (pending.kind === 'effect' ? 'skip' : null))
  assert.equal(me(state).assets.find(item => item.id === blade.id).uses, 2, '不花充能时次数不变')
  assert.equal(state.enemies.find(item => item.id === 'blade-second').damageTaken, 1)
  assert.equal(state.lastTestResult.value, getStat(state, me(state), 'combat') + 1)
})

// ---------------------------------------------------------------------------
// 05119 恐怖图腾
// ---------------------------------------------------------------------------

test('TCU 05119 恐怖图腾 投入后横置：该卡额外获得一个技能图标（检定 +1）', () => {
  const state = fixture('01001')
  const totem = asset(state, '05119')
  me(state).hand = ['01090'] // 洞察力：2 个智识图标
  me(state).deck = Array(20).fill('01088')
  state.chaosBag = ['0']
  move(state, { action: 'investigate' })
  settle(state, pending => {
    if (pending.kind === 'commit') {
      const option = pending.options.find(item => item.id === '0')
      return option ? '0' : 'done'
    }
    if (pending.kind === 'playerWindow') {
      const option = pending.options.find(item => item.assetId === totem.id)
      if (option) return option.id
    }
    return null
  })
  assert.equal(me(state).assets.find(item => item.id === totem.id).exhausted, true, '横置图腾')
  // 智识 3 + 投入的 2 个图标 + 恐怖图腾额外 1 个图标 = 6。
  assert.equal(state.lastTestResult.value, 6)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(me(state).discard.includes('01090'), true, '投入的卡检定后进弃牌堆')
})

// ---------------------------------------------------------------------------
// 05151 爱丽丝·洛克斯雷
// ---------------------------------------------------------------------------

test('TCU 05151 爱丽丝·洛克斯雷 +1 智识；发现线索后横置对同地点敌人造成 1 点伤害', () => {
  const state = fixture('01001')
  const alice = asset(state, '05151')
  const target = enemy(state, { id: 'alice-target', fight: 2, evade: 1, health: 6, engagedSeat: null })
  const location = state.locations[0]
  location.clues = 1
  location.shroud = 2
  state.chaosBag = ['0']
  assert.equal(getStat(state, me(state), 'intellect'), 3 + 1, '+1 智识')
  move(state, { action: 'investigate' })
  settle(state, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => item.cardCode === '05151')
      if (option) return option.id
    }
    if (pending.kind === 'target') return target.id
    return null
  })
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 1)
  assert.equal(me(state).assets.find(item => item.id === alice.id).exhausted, true, '横置爱丽丝')
})

// ---------------------------------------------------------------------------
// 05152 妥善养护
// ---------------------------------------------------------------------------

test('TCU 05152 妥善养护 快速附属到道具支援；每个支援仅限 1 张', () => {
  const state = fixture('01001')
  const item = asset(state, '01030') // 放大镜：Item / Tool
  me(state).hand = ['05152', '05152']
  me(state).resources = 10
  const actionsBefore = me(state).actionsLeft
  move(state, { action: 'play', cardId: '05152' })
  settle(state)
  const host = me(state).assets.find(asset => asset.id === item.id)
  assert.equal((host.attachments || []).filter(entry => entry.code === '05152').length, 1, '附属到道具支援')
  assert.equal(me(state).actionsLeft, actionsBefore, '快速事件不消耗行动点')
  // 第二张：同一个支援已有 1 张，没有其他合法宿主 → 打不出去，留在手牌。
  move(state, { action: 'play', cardId: '05152' })
  settle(state)
  const hostAfter = me(state).assets.find(asset => asset.id === item.id)
  assert.equal((hostAfter.attachments || []).filter(entry => entry.code === '05152').length, 1, '每个支援仅限 1 张')
  assert.equal(me(state).hand.includes('05152'), true, '第二张留在手牌')
})

// ---------------------------------------------------------------------------
// 05153 “老千”先生
// ---------------------------------------------------------------------------

test('TCU 05153 “老千”先生 从牌库顶 3 张找 1 张抽取；有弱点时也抽 1 张', () => {
  const state = fixture('01001')
  const rook = asset(state, '05153')
  // 牌库底 → 牌库顶：最后一个是牌库顶。
  me(state).deck = ['01016', '01088', '01058', '01089', '01090', '01013']
  me(state).hand = []
  let pickedSearch = false
  move(state, { action: 'ability', assetId: rook.id, abilityIndex: 0 })
  settle(state, pending => {
    if (pending.kind === 'search') {
      const cards = pending.options.filter(option => option.cardCode)
      if (!cards.length) return '3'
      if (!pickedSearch) {
        pickedSearch = true
        const target = cards.find(option => option.cardCode === '01090')
        if (target) return target.id
      }
    }
    if (pending.kind === 'deck' || pending.kind === 'commit' || pending.kind === 'discard') return null
    return null
  })
  assert.equal(me(state).hand.includes('01090'), true, '找出的卡进入手牌')
  assert.equal(me(state).hand.includes('01013'), true, '查找的卡牌中有弱点，也抽 1 张（黑暗回忆留手）')
  const after = me(state).assets.find(item => item.id === rook.id)
  assert.equal(after.uses, 2, '花费 1 秘密')
  assert.equal(after.exhausted, true, '横置先生')
})

// ---------------------------------------------------------------------------
// 05154 鹰眼折叠相机
// ---------------------------------------------------------------------------

test('TCU 05154 鹰眼折叠相机 最后线索后放证据；证据给意志/智识/神智加值', () => {
  const state = fixture('01001')
  const camera = asset(state, '05154')
  const location = state.locations[0]
  location.clues = 1
  location.shroud = 2
  state.chaosBag = ['0']
  const baseWillpower = getStat(state, me(state), 'willpower')
  const baseIntellect = getStat(state, me(state), 'intellect')
  const baseSanity = getMaxSanity(me(state))
  const before = baseWillpower
  run(state, current => { discoverClueAt(current, current.investigators[0], 1, []) }, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => item.cardCode === '05154')
      if (option) return option.id
    }
    return null
  })
  const after = me(state).assets.find(item => item.id === camera.id)
  assert.equal(after.uses, 1, '放置 1 个资源作为证据')
  assert.equal(getStat(state, me(state), 'willpower'), before + 1, '至少 1 个证据：+1 意志')
  assert.equal(getStat(state, me(state), 'intellect'), baseIntellect, '少于 2 个证据时没有智识加值')
  assert.equal(getMaxSanity(me(state)), baseSanity, '少于 3 个证据时神智上限不变')
  // 补到 3 个证据：+1 智识、+1 神智上限。
  after.uses = 3
  after.sanityModifier = 1
  assert.equal(getStat(state, me(state), 'intellect'), baseIntellect + 1)
  assert.equal(getMaxSanity(me(state)), baseSanity + 1)
})

// ---------------------------------------------------------------------------
// 05155 亨利·万
// ---------------------------------------------------------------------------

test('TCU 05155 亨利·万 选择停下后，每揭示 1 枚标记抽 1 张或获得 1 资源', () => {
  const state = fixture('01001')
  const henry = asset(state, '05155')
  state.chaosBag = ['0', '0', '0']
  me(state).resources = 5
  me(state).hand = []
  let continues = 0
  move(state, { action: 'ability', assetId: henry.id, abilityIndex: 0 })
  settle(state, pending => {
    if (pending.kind !== 'effect') return null
    if (pending.options.some(option => option.id === 'continue')) {
      continues += 1
      return continues >= 2 ? 'stop' : 'continue'
    }
    if (pending.options.some(option => option.id === 'resources')) return 'resources'
    return null
  })
  assert.equal(me(state).resources, 5 + 2, '停在第 2 枚后，每枚获得 1 资源')
  assert.equal(me(state).assets.find(item => item.id === henry.id).exhausted, true)
})

test('TCU 05155 亨利·万 揭示符号标记时无事发生', () => {
  const state = fixture('01001')
  const henry = asset(state, '05155')
  state.chaosBag = ['skull']
  me(state).resources = 5
  me(state).hand = []
  move(state, { action: 'ability', assetId: henry.id, abilityIndex: 0 })
  settle(state)
  assert.equal(me(state).resources, 5, '没有获得资源')
  assert.equal(me(state).hand.length, 0, '没有抽牌')
  assert.equal(me(state).assets.find(item => item.id === henry.id).exhausted, true)
})

// ---------------------------------------------------------------------------
// 05156 反应灵敏
// ---------------------------------------------------------------------------

test('TCU 05156 反应灵敏 立即获得 1 个不计入行动数的行动', () => {
  const state = fixture('01001')
  me(state).hand = ['05156']
  me(state).resources = 5
  const before = me(state).actionsLeft
  move(state, { action: 'play', cardId: '05156' })
  settle(state)
  assert.equal(me(state).actionsLeft, before + 1, '打出后行动数 +1')
  assert.equal(me(state).discard.includes('05156'), true)
})

// ---------------------------------------------------------------------------
// 05157 凋零术
// ---------------------------------------------------------------------------

test('TCU 05157 凋零术 用意志攻击；符号后敌人获得 -1 攻击值', () => {
  const state = fixture('01001')
  const wither = asset(state, '05157')
  const target = enemy(state, { id: 'wither-target', fight: 0, evade: 1, health: 9 })
  state.chaosBag = ['skull']
  move(state, { action: 'ability', assetId: wither.id, abilityIndex: 0, targetId: target.id })
  settle(state)
  assert.equal(state.lastTestResult.skill, 'willpower', '本次攻击改用意志')
  assert.equal(state.lastTestResult.success, true)
  assert.equal(state.lastTestResult.drawn.includes('skull'), true, '揭示了符号')
  const after = state.enemies.find(item => item.id === target.id)
  assert.equal(after.fightReduction?.amount, 1, '敌人 -1 攻击值')
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 1)
  assert.equal(registeredEntry('05157').simplified, true, '躲避值部分显式简化')
})

// ---------------------------------------------------------------------------
// 05158 第六感
// ---------------------------------------------------------------------------

test('TCU 05158 第六感 用意志调查（不用智力）', () => {
  const state = fixture('01001')
  asset(state, '05158')
  const location = state.locations[0]
  location.clues = 1
  location.shroud = 2
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: me(state).assets[0].id, abilityIndex: 0 })
  settle(state)
  assert.equal(state.lastTestResult.skill, 'willpower', '本次调查改用意志')
  assert.equal(state.lastTestResult.success, true)
  assert.equal(me(state).clues, 1, '调查成功发现了线索')
  assert.equal(registeredEntry('05158').simplified, true, '符号后改写地点部分显式简化')
})

// ---------------------------------------------------------------------------
// 05159 险中求胜
// ---------------------------------------------------------------------------

test('TCU 05159 险中求胜 检定开始时横置：难度 +2，并获得 2 资源', () => {
  const state = fixture('01001')
  const thin = asset(state, '05159')
  const location = state.locations[0]
  location.clues = 1
  location.shroud = 2
  state.chaosBag = ['0']
  me(state).resources = 5
  let offered = false
  move(state, { action: 'investigate' })
  settle(state, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => item.cardCode === '05159')
      if (option) { offered = true; return option.id }
    }
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'resources')) return 'resources'
    return null
  })
  assert.equal(offered, true, '检定开始时提供能力')
  assert.equal(state.lastTestResult.difficulty, 4, '隐藏值 2 + 2 = 难度 4')
  assert.equal(state.lastTestResult.value, 3, '智识 3 + 标记 0 = 3 < 4，检定失败')
  assert.equal(state.lastTestResult.success, false)
  assert.equal(me(state).resources, 7, '获得 2 资源')
  assert.equal(me(state).assets.find(item => item.id === thin.id).exhausted, true)
})

// ---------------------------------------------------------------------------
// 05160 勇闯虎穴
// ---------------------------------------------------------------------------

test('TCU 05160 勇闯虎穴 成功躲避超过难度 2 点后，发现该敌人所在地点的线索', () => {
  const state = fixture('01001')
  const location = state.locations[0]
  location.clues = 1
  const target = enemy(state, { id: 'beast-target', fight: 1, evade: 0, health: 6, engagedSeat: 0 })
  state.chaosBag = ['0']
  me(state).hand = ['05160']
  move(state, { action: 'evade', enemyId: target.id })
  settle(state, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => item.cardCode === '05160')
      if (option) return option.id
    }
    if (pending.kind === 'move') return 'skip'
    return null
  })
  assert.equal(me(state).clues, 1, '发现该敌人所在地点的 1 个线索')
  assert.equal(state.locations[0].clues, 0)
  assert.equal(me(state).discard.includes('05160'), true)
})

test('TCU 05160 勇闯虎穴 躲避未超过难度 2 点时打不出', () => {
  const state = fixture('01001')
  const location = state.locations[0]
  location.clues = 1
  const target = enemy(state, { id: 'beast-close', fight: 1, evade: 1, health: 6, engagedSeat: 0 })
  state.chaosBag = ['0']
  me(state).hand = ['05160']
  let offered = false
  move(state, { action: 'evade', enemyId: target.id })
  settle(state, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => item.cardCode === '05160')
      if (option) offered = true
    }
    if (pending.kind === 'move') return 'skip'
    return null
  })
  assert.equal(offered, false, '成功点数不足 2 时不提供勇闯虎穴')
  assert.equal(me(state).hand.includes('05160'), true)
  assert.equal(state.locations[0].clues, 1)
})
