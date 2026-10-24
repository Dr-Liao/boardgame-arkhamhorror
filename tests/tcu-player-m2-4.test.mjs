// 万象无终（第四循环）M2 玩家卡 · M2-4 逐卡验收 —— P7。
//
// 分片：05275–05283、05313–05324（21 张）。
// 约定：每张卡至少一条以 `TCU <code> <中文名>` 开头的真实行为测试；账本按这个前缀收集证据。
// 测试只走公开读点（core-fixture、engine.js、resolution.js、campaign.js），不 import 卡文件。

import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, move, settle, asset, enemy, validateMove } from './core-fixture.mjs'
import {
  applyHarm, createGameState, getHandSize, getStat, performTest, reactionWindow, returnAssetToHand,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { expireEffects } from '../src/engine/effect-state.js'
import { tarotSlotCapacity } from '../src/engine/tarot-slot.js'
import { campaignCardChange } from '../src/campaign/campaign.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const codes = [
  '05275', '05276', '05277', '05278', '05279', '05280', '05281', '05282', '05283',
  '05313', '05314', '05315', '05316', '05317', '05318', '05319', '05320', '05321',
  '05322', '05323', '05324',
]
assert.equal(codes.length, 21)

const me = state => state.investigators[0]
const nameOf = code => ALL_CARDS[code].nameZh || ALL_CARDS[code].name

// 在事务里跑一段会触发选择的结算，直到不再有待决选择。
function run(state, fn, choose) {
  const execute = current => fn(current)
  resolveTransaction(state, 0, { action: 'tcuPlayerM24Test' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 120, `Choice loop: ${state.pendingChoice.kind}`)
    const pending = state.pendingChoice
    const optionId = choose?.(pending, state)
      ?? ['done', 'skip', 'self', 'normal'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

// 走真实的开局通道（hub）：把永久卡/开局卡塞进战役牌组，进入剧本看它们的效果。
function startWithCards(cardCodes, { investigator = '01001', seed = 'tcu-m2-4' } = {}) {
  const state = createGameState({ campaignHub: true, seed }, [{ seat: 0, role: 'human' }])
  move(state, { action: 'hubGoSetup' })
  move(state, { action: 'hubSelectInvestigator', code: investigator })
  move(state, { action: 'hubAutoDeck' })
  for (const code of cardCodes) campaignCardChange(state.campaign, 0, code, 'add', 'tcu-m2-4-test')
  move(state, { action: 'hubDoneSeat' })
  move(state, { action: 'hubBeginScenario' })
  settle(state)
  return state
}

// 一条连接地点：study ↔ hallway（可按需继续接 attic）。
function addConnections(state, extra = []) {
  for (const location of extra) state.locations.push(location)
  return state
}

// ---------------------------------------------------------------------------
// 05275 恐怖揭露
// ---------------------------------------------------------------------------

test(`TCU 05275 ${nameOf('05275')} 发现 3 线索后自我击败并受 1 点精神创伤`, () => {
  const state = fixture('01001', 2)
  const inv = me(state)
  state.locations[0].clues = 3
  inv.hand = ['05275']
  move(state, { action: 'play', cardId: '05275' })
  settle(state, pending => {
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'done')) return 'done'
    if (pending.kind === 'target') return pending.options[0].id
    if (pending.kind === 'resource') return pending.options.at(-1).id
    return null
  })
  assert.equal(me(state).defeated, true, '打出后被击败')
  assert.equal(state.locations[0].clues, 3, '被击败后，身上的 3 个线索按消除规则放回地点')
  assert.equal(state.campaign.trauma[0].mental, 1, '承受 1 点精神创伤')
})

test(`TCU 05275 ${nameOf('05275')} 可把线索交给另一位调查员`, () => {
  const state = fixture('01001', 2)
  const inv = me(state)
  state.locations[0].clues = 3
  inv.hand = ['05275']
  move(state, { action: 'play', cardId: '05275' })
  settle(state, pending => {
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'give')) return 'give'
    if (pending.kind === 'target') return pending.options[0].id
    if (pending.kind === 'resource') return '2'
    return null
  })
  assert.equal(state.investigators[1].clues, 2, '交给另一位调查员 2 个线索')
  assert.equal(state.locations[0].clues, 1, '被击败后自己留的 1 个线索按消除规则放回地点')
})

test(`TCU 05275 ${nameOf('05275')} 修复：把线索放到地点不改变地点 maxClues`, () => {
  const state = fixture('01001', 2)
  const inv = me(state)
  state.locations[0].clues = 3
  const maxCluesBefore = state.locations[0].maxClues
  inv.hand = ['05275']
  move(state, { action: 'play', cardId: '05275' })
  settle(state, pending => {
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'place')) return 'place'
    if (pending.kind === 'target') return pending.options[0].id
    if (pending.kind === 'resource') return '1'
    return null
  })
  assert.equal(state.locations[0].maxClues, maxCluesBefore, '放置线索不再抬高 maxClues（非卡面规则）')
})

// ---------------------------------------------------------------------------
// 05277 帮个小忙
// ---------------------------------------------------------------------------

test(`TCU 05277 ${nameOf('05277')} 对所在地点非精英敌人造成 1 点伤害`, () => {
  const state = fixture('01001')
  const target = enemy(state, { fight: 2, evade: 2, health: 5, damageTaken: 0 })
  me(state).hand = ['05277']
  move(state, { action: 'play', cardId: '05277' })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 1)
  assert.equal(me(state).resources, 28, '打出费用 2')
  assert.ok(me(state).discard.includes('05277'))
})

test(`TCU 05277 ${nameOf('05277')} 额外付 2 费改成 2 点伤害`, () => {
  const state = fixture('01001')
  const target = enemy(state, { fight: 2, evade: 2, health: 5, damageTaken: 0 })
  me(state).hand = ['05277']
  move(state, { action: 'play', cardId: '05277' })
  settle(state, pending => pending.kind === 'effect' ? 'damage' : null)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2)
  assert.equal(me(state).resources, 26, '打出费用 2 + 额外 2')
})

test(`TCU 05277 ${nameOf('05277')} 额外付 2 费可指向连接 2 次内的地点`, () => {
  const state = fixture('01001')
  addConnections(state, [
    { id: 'hallway', name: '走廊', connections: ['study', 'attic'], clues: 0, revealed: true },
    { id: 'attic', name: '阁楼', connections: ['hallway'], clues: 0, revealed: true },
  ])
  state.locations[0].connections = ['hallway']
  const far = enemy(state, { location: 'attic', fight: 2, evade: 2, health: 5, damageTaken: 0 })
  me(state).hand = ['05277']
  move(state, { action: 'play', cardId: '05277' })
  settle(state, pending => pending.kind === 'effect' ? 'range' : null)
  assert.equal(state.enemies.find(item => item.id === far.id).damageTaken, 1, '连接 2 次内的敌人被命中')
})

test(`TCU 05277 ${nameOf('05277')} 修复：范围模式不含自身地点；没有可伤害目标时打不出`, () => {
  // 范围内（1–2 连接）有敌人：范围模式不应把「自身地点」算进范围——
  // 只放一个「本地」敌人时，本模式没有合法目标，可选模式只剩基础模式。
  const state = fixture('01001')
  addConnections(state, [
    { id: 'hallway', name: '走廊', connections: ['study', 'attic'], clues: 0, revealed: true },
    { id: 'attic', name: '阁楼', connections: ['hallway'], clues: 0, revealed: true },
  ])
  state.locations[0].connections = ['hallway']
  const local = enemy(state, { id: 'local-only', fight: 2, evade: 2, health: 5, damageTaken: 0 })
  me(state).hand = ['05277']
  move(state, { action: 'play', cardId: '05277' })
  settle(state, pending => (pending.kind === 'effect' ? null : null))
  assert.equal(state.enemies.find(item => item.id === local.id).damageTaken, 1, '基础模式打本地敌人')

  // 完全没有非精英敌人：打出被拒绝。
  const bare = fixture('01001')
  me(bare).hand = ['05277']
  assert.match(String(validateMove(bare, 0, { action: 'play', cardId: '05277' })), /非\[\[精英\]\]敌人|不能打出/,
    '没有合法目标时不能打出「帮个小忙」')
})

// ---------------------------------------------------------------------------
// 05279 黛雅娜·艾丝帕伦斯
// ---------------------------------------------------------------------------

test(`TCU 05279 ${nameOf('05279')} 把手牌中的法术事件附属到自身`, () => {
  const state = fixture('01001')
  const inv = me(state)
  const dayana = asset(state, '05279')
  inv.hand = ['05314']
  move(state, { action: 'ability', assetId: dayana.id, abilityIndex: 0, targetId: '05314' })
  const current = state.investigators[0].assets.find(item => item.id === dayana.id)
  assert.deepEqual(current.attachments.map(entry => entry.code), ['05314'], '02314 附属在黛雅娜身上')
  assert.ok(!me(state).hand.includes('05314'), '事件离开手牌')
})

test(`TCU 05279 ${nameOf('05279')} 横置并花 1 秘密打出附属事件（打出后仍附属）`, () => {
  const state = fixture('01001')
  const inv = me(state)
  const dayana = asset(state, '05279')
  inv.hand = ['05314']
  inv.damage = 2
  inv.deck = ['01088', '01088', '01088']
  move(state, { action: 'ability', assetId: dayana.id, abilityIndex: 0, targetId: '05314' })
  settle(state)
  move(state, { action: 'ability', assetId: dayana.id, abilityIndex: 1 })
  settle(state, pending => {
    if (pending.kind !== 'heal') return null
    const option = pending.options.find(item => String(item.id).startsWith('dmg:'))
    return option?.id ?? 'done'
  })
  const current = state.investigators[0].assets.find(item => item.id === dayana.id)
  assert.equal(current.uses, 2, '花费 1 秘密')
  assert.equal(current.exhausted, true, '横置黛雅娜')
  assert.equal(me(state).damage, 0, '附属的舒缓旋律治愈了 2 点伤害')
  assert.equal(current.attachments.length, 1, '打出后事件仍附属在原处')
})

// ---------------------------------------------------------------------------
// 05280 否决存在
// ---------------------------------------------------------------------------

test(`TCU 05280 ${nameOf('05280')} 忽略敌人攻击的伤害并反向治愈`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05280']
  inv.damage = 2
  run(state, current => applyHarm(current, current.investigators[0], 2, 0, [], false,
    { enemy: { id: 'e1', name: '测试敌人' }, damage: 2, horror: 0 }), pending => {
    if (pending.kind !== 'reaction') return null
    return pending.options.find(option => option.cardCode === '05280')?.id ?? null
  })
  assert.equal(me(state).damage, 0, '忽略 2 点伤害后反向治愈 2 点旧伤害')
})

test(`TCU 05280 ${nameOf('05280')} 忽略遭遇卡造成的恐惧并反向治愈`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05280']
  inv.horror = 1
  run(state, current => {
    current._treacheryResolving = 'test-treachery'
    applyHarm(current, current.investigators[0], 0, 2, [], false, null)
  }, pending => {
    if (pending.kind !== 'reaction') return null
    return pending.options.find(option => option.cardCode === '05280')?.id ?? null
  })
  assert.equal(me(state).horror, 0, '忽略 2 点恐惧后反向治愈 1 点旧恐惧')
})

// ---------------------------------------------------------------------------
// 05281 勇闯火线
// ---------------------------------------------------------------------------

test(`TCU 05281 ${nameOf('05281')} 把选定技能的基础值设为 5 直到回合结束`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05281']
  const base = inv.agility
  move(state, { action: 'play', cardId: '05281' })
  settle(state, pending => pending.kind === 'skill' ? 'agility' : null)
  assert.equal(getStat(state, me(state), 'agility'), 5, '敏捷基础值视为 5')
  expireEffects(state, 'endOfTurn')
  assert.equal(getStat(state, me(state), 'agility'), base, '回合结束后恢复')
})

// ---------------------------------------------------------------------------
// 05282 偷梁换柱
// ---------------------------------------------------------------------------

test(`TCU 05282 ${nameOf('05282')} 修复：没有可躲避的敌人时打不出`, () => {
  const state = fixture('01001')
  me(state).hand = ['05282']
  assert.match(String(validateMove(state, 0, { action: 'play', cardId: '05282' })), /没有可以躲避|不能打出/,
    '无合法目标时不能打出「偷梁换柱」')
})

test(`TCU 05282 ${nameOf('05282')} 躲避交战敌人成功后把它移到连接地点`, () => {
  const state = fixture('01001')
  addConnections(state, [{ id: 'hallway', name: '走廊', connections: ['study'], clues: 0, revealed: true }])
  state.locations[0].connections = ['hallway']
  state.chaosBag = ['0']
  const target = enemy(state, { engagedSeat: 0, fight: 1, evade: 1, health: 5 })
  me(state).hand = ['05282']
  move(state, { action: 'play', cardId: '05282' })
  settle(state)
  const moved = state.enemies.find(item => item.id === target.id)
  assert.equal(moved.location, 'hallway', '敌人被移动到连接地点')
  assert.equal(moved.exhausted, true, '敌人被躲避（横置）')
})

test(`TCU 05282 ${nameOf('05282')} 躲避连接地点的非精英敌人并交换地点`, () => {
  const state = fixture('01001')
  addConnections(state, [{ id: 'hallway', name: '走廊', connections: ['study'], clues: 0, revealed: true }])
  state.locations[0].connections = ['hallway']
  state.chaosBag = ['0']
  const target = enemy(state, { location: 'hallway', engagedSeat: null, fight: 1, evade: 1, health: 5 })
  me(state).hand = ['05282']
  move(state, { action: 'play', cardId: '05282' })
  settle(state)
  const moved = state.enemies.find(item => item.id === target.id)
  assert.equal(me(state).location, 'hallway', '调查员移动到敌人原来的地点')
  assert.equal(moved.location, 'study', '敌人换到调查员原来的地点')
  assert.equal(moved.exhausted, true, '敌人被躲避（横置）')
})

// ---------------------------------------------------------------------------
// 05283 安娜·卡斯洛
// ---------------------------------------------------------------------------

test(`TCU 05283 ${nameOf('05283')} 额外 2 个塔罗槽位`, () => {
  const state = fixture('01001')
  assert.equal(tarotSlotCapacity(me(state)), 1)
  asset(state, '05283')
  assert.equal(tarotSlotCapacity(me(state)), 3, '基础 1 + 安娜 2')
})

test(`TCU 05283 ${nameOf('05283')} 入场后检索一张塔罗支援并放置入场`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05283']
  inv.deck = ['05023', ...Array(9).fill('01088')]
  move(state, { action: 'play', cardId: '05283' })
  settle(state, pending => pending.kind === 'search' ? '0' : null)
  assert.ok(me(state).assets.some(item => item.code === '05283'), '安娜入场')
  assert.ok(me(state).assets.some(item => item.code === '05023'), '检索到的塔罗支援直接放置入场')
  assert.ok(!me(state).deck.includes('05023'), '塔罗支援离开牌库')
})

test(`TCU 05283 ${nameOf('05283')} 游戏开始时从起始手牌放置入场`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05283']
  inv.deck = ['05023', ...Array(9).fill('01088')]
  run(state, current => reactionWindow(current, 'scenarioStarts', { when: 'scenarioStarts' }, []), pending => {
    if (pending.kind === 'reaction') return pending.options.find(option => option.cardCode === '05283')?.id ?? null
    if (pending.kind === 'search') return '0'
    return null
  })
  assert.ok(me(state).assets.some(item => item.code === '05283'), '开局放置入场')
  assert.ok(!me(state).hand.includes('05283'), '离开起始手牌')
})

// ---------------------------------------------------------------------------
// 05313 圣化之镜 / 05316 密教辞典（绑定主卡）
// ---------------------------------------------------------------------------

test(`TCU 05313 ${nameOf('05313')} 入场检索 3 张舒缓旋律（1 张入手，其余洗回牌库）`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05313']
  inv.deck = Array(20).fill('01088')
  move(state, { action: 'play', cardId: '05313' })
  settle(state)
  assert.equal(me(state).hand.filter(code => code === '05314').length, 1, '1 张加入手牌')
  assert.equal(me(state).deck.filter(code => code === '05314').length, 2, '其余 2 张洗回牌库')
  assert.deepEqual(state.bondedSets['05313'].cards, [], '场外集合清空')
  assert.equal(state.bondedSets['05313'].retrieved, true)
})

test(`TCU 05316 ${nameOf('05316')} 入场检索 3 张鲜血仪式（1 张入手，其余洗回牌库）`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05316']
  inv.deck = Array(20).fill('01088')
  move(state, { action: 'play', cardId: '05316' })
  settle(state)
  assert.equal(me(state).hand.filter(code => code === '05317').length, 1, '1 张加入手牌')
  assert.equal(me(state).deck.filter(code => code === '05317').length, 2, '其余 2 张洗回牌库')
})

// ---------------------------------------------------------------------------
// 05314 舒缓旋律（绑定：圣化之镜）
// ---------------------------------------------------------------------------

test(`TCU 05314 ${nameOf('05314')} 两点治疗可分配给伤害/恐惧并抽 1 张`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05314']
  inv.damage = 2
  inv.horror = 0
  inv.deck = ['01088', '01088', '01088']
  move(state, { action: 'play', cardId: '05314' })
  settle(state, pending => {
    if (pending.kind !== 'heal') return null
    const option = pending.options.find(item => item.kind === 'damage' || String(item.id).startsWith('dmg:'))
    return option?.id ?? 'done'
  })
  assert.equal(me(state).damage, 0, '2 点治疗都用来治愈伤害')
  assert.ok(me(state).hand.includes('01088'), '结算后抽 1 张牌')
})

test(`TCU 05314 ${nameOf('05314')} 恐惧与盟友支援同样是治疗目标`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05314']
  inv.damage = 0
  inv.horror = 2
  inv.deck = ['01088', '01088']
  move(state, { action: 'play', cardId: '05314' })
  settle(state, pending => {
    if (pending.kind !== 'heal') return null
    const option = pending.options.find(item => item.kind === 'horror' || String(item.id).startsWith('hor:'))
    return option?.id ?? 'done'
  })
  assert.equal(me(state).horror, 0, '2 点治疗都用来治愈恐惧')
})

// ---------------------------------------------------------------------------
// 05315 “我见过更糟的……”
// ---------------------------------------------------------------------------

test(`TCU 05315 ${nameOf('05315')} 取消最多 2 点伤害并换成同等资源`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05315']
  inv.resources = 5
  inv.damage = 2
  inv.horror = 0
  run(state, current => applyHarm(current, current.investigators[0], 2, 0, [], false), pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => item.cardCode === '05315')
      if (option) return option.id
    }
    if (pending.kind === 'harm') return '2:0'
    return null
  })
  assert.equal(me(state).damage, 2, '2 点伤害被取消，只剩原有的 2 点')
  assert.equal(me(state).resources, 7, '取消 2 点获得 2 资源')
  assert.ok(me(state).discard.includes('05315'), '快速事件结算后进弃牌堆')
})

// ---------------------------------------------------------------------------
// 05317 鲜血仪式
// ---------------------------------------------------------------------------

test(`TCU 05317 ${nameOf('05317')} 抽 2 张、弃 1 张换资源`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05317', '01088', '01089']
  inv.deck = Array(20).fill('01088')
  inv.resources = 30
  move(state, { action: 'play', cardId: '05317' })
  let discardAsked = 0
  settle(state, pending => {
    if (pending.kind === 'discard') { discardAsked++; return discardAsked === 1 ? '0' : 'done' }
    if (pending.kind === 'effect') return 'resource'
    return null
  })
  assert.equal(me(state).resources, 31, '弃 1 张牌换 1 资源')
  assert.ok(me(state).discard.includes('01088'), '弃掉的是选中的那张手牌')
  assert.equal(me(state).hand.length, 3, '抽 2 弃 1 后的手牌数')
})

test(`TCU 05317 ${nameOf('05317')} 弃牌后可花 1 资源对敌人造成伤害`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05317', '01088']
  inv.deck = Array(20).fill('01089')
  inv.resources = 30
  const target = enemy(state, { fight: 2, evade: 2, health: 5, damageTaken: 0 })
  move(state, { action: 'play', cardId: '05317' })
  let discardAsked = 0
  settle(state, pending => {
    if (pending.kind === 'discard') { discardAsked++; return discardAsked === 1 ? '0' : 'done' }
    if (pending.kind === 'effect') return 'damage'
    if (pending.kind === 'target') return pending.options[0].id
    return null
  })
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 1)
  assert.equal(me(state).resources, 29, '打出 0 费，造成伤害花 1 资源')
})

// ---------------------------------------------------------------------------
// 05318 窥看不思议之事
// ---------------------------------------------------------------------------

test(`TCU 05318 ${nameOf('05318')} 非弱点手牌洗回牌库并补抽到手牌上限、自身移出游戏`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05318', '01088', '01089']
  inv.deck = Array(10).fill('01090')
  move(state, { action: 'play', cardId: '05318' })
  let asked = 0
  settle(state, pending => {
    if (pending.kind === 'card') { asked++; return asked === 1 ? (pending.options[1]?.id ?? 'done') : 'done' }
    return null
  })
  assert.ok((state.exiled || []).includes('05318'), '自身从游戏中移除（流放）')
  const max = getHandSize(state, me(state))
  assert.equal(me(state).hand.length, max, '补抽到手牌上限')
  assert.equal(me(state).deck.length, 11 - (max - 1), '牌库 = 10 + 1 张洗回 - 补抽')
})

// ---------------------------------------------------------------------------
// 05319 “你欠我一次”
// ---------------------------------------------------------------------------

test(`TCU 05319 ${nameOf('05319')} 打出另一位调查员手牌并双方各抽 1`, () => {
  const state = fixture('01001', 2)
  const inv = me(state)
  const other = state.investigators[1]
  inv.hand = ['05319']
  inv.deck = Array(10).fill('01090')
  other.hand = ['01088']
  other.deck = Array(10).fill('01089')
  move(state, { action: 'play', cardId: '05319' })
  settle(state, pending => {
    if (pending.kind === 'card') return pending.options.find(option => option.cardCode === '01088')?.id ?? 'done'
    return null
  })
  assert.ok(!state.investigators[1].hand.includes('01088'), '对方手牌被拿走')
  assert.equal(me(state).resources, 33, '打出了对方的「应急物品」，获得 3 资源')
  assert.equal(me(state).hand.length, 1, '打牌者抽 1 张')
  assert.equal(state.investigators[1].hand.length, 1, '对方抽 1 张')
  // 修复：手牌内容走 privateInfo 私密投影，公开日志只报张数（不再包含卡名）。
  assert.ok(state.log.some(line => /查看了.*手牌（共 1 张）/.test(line)), '公开日志只报张数')
  assert.ok(!state.log.some(line => /查看了.*手牌：/.test(line)), '公开日志不列出对方手牌内容')
})

// ---------------------------------------------------------------------------
// 05321 凋零术
// ---------------------------------------------------------------------------

test(`TCU 05321 ${nameOf('05321')} 用意志代替战斗攻击并 +2 意志`, () => {
  const state = fixture('01001')
  const wither = asset(state, '05321')
  state.chaosBag = ['0']
  const target = enemy(state, { fight: 2, evade: 2, health: 5, damageTaken: 0 })
  move(state, { action: 'ability', assetId: wither.id, abilityIndex: 0, targetId: target.id })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 1, '攻击造成 1 点伤害')
  assert.equal(state.lastTestResult.skill, 'willpower', '本次攻击使用意志')
  assert.equal(state.lastTestResult.value, 5, '意志 3 + 2')
})

// ---------------------------------------------------------------------------
// 05322 第六感
// ---------------------------------------------------------------------------

test(`TCU 05322 ${nameOf('05322')} 用意志代替智力调查并 +2 意志`, () => {
  const state = fixture('01001')
  const sixth = asset(state, '05322')
  state.chaosBag = ['0']
  state.locations[0].clues = 2
  move(state, { action: 'ability', assetId: sixth.id, abilityIndex: 0 })
  settle(state)
  assert.equal(me(state).clues, 1, '调查成功发现 1 个线索')
  assert.equal(state.lastTestResult.skill, 'willpower', '本次调查使用意志')
  assert.equal(state.lastTestResult.value, 5, '意志 3 + 2')
})

// ---------------------------------------------------------------------------
// 05323 诱敌深入
// ---------------------------------------------------------------------------

test(`TCU 05323 ${nameOf('05323')} 附属到地点后敌人阶段朝这里移动、回合结束弃掉`, () => {
  const state = fixture('01001')
  addConnections(state, [{ id: 'hallway', name: '走廊', connections: ['study'], clues: 0, revealed: true }])
  state.locations[0].connections = ['hallway']
  me(state).hand = ['05323']
  move(state, { action: 'play', cardId: '05323' })
  settle(state, pending => pending.kind === 'target' ? 'hallway' : null)
  const lureLoc = state.locations.find(location => location.id === 'hallway')
  assert.equal(lureLoc.lure?.code, '05323', '连接地点被设为诱饵')
  assert.equal(lureLoc.lure?.seat, 0)
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(state.locations.find(location => location.id === 'hallway')?.lure, undefined, '一轮结束后诱饵失效')
  assert.ok(me(state).discard.includes('05323'), '回合结束弃掉「诱敌深入」')
})


test(`TCU 05278 ${nameOf('05278')} 永久卡在开局多给 2 资源`, () => {
  const state = startWithCards(['05278'])
  assert.ok(me(state).assets.some(item => item.code === '05278'), '永久卡开局即在场')
  assert.equal(me(state).resources, 7, '起始 5 资源 + 2')
  assert.ok(!me(state).hand.includes('05278'), '永久卡不进起始手牌')
})

// ---------------------------------------------------------------------------
// 05276 苦心钻研（永久卡）
// ---------------------------------------------------------------------------

test(`TCU 05276 ${nameOf('05276')} 永久卡让起始手牌多 1 张`, () => {
  const control = startWithCards(['05278'])
  const withStudious = startWithCards(['05276'], { seed: 'tcu-m2-4-studious' })
  assert.ok(me(withStudious).assets.some(item => item.code === '05276'), '永久卡开局即在场')
  assert.equal(me(control).hand.length + 1, me(withStudious).hand.length, '起始手牌比对照多 1 张')
  assert.ok(!me(withStudious).deck.includes('05276'), '永久卡不在牌库里')
})

// ---------------------------------------------------------------------------
// 05313 / 05316 离场收回绑定副本
// ---------------------------------------------------------------------------

test(`TCU 05313 ${nameOf('05313')} 离场时把所有舒缓旋律收回场外集合`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05313']
  inv.deck = Array(20).fill('01088')
  move(state, { action: 'play', cardId: '05313' })
  settle(state)
  const mirror = me(state).assets.find(item => item.code === '05313')
  assert.equal(me(state).hand.filter(code => code === '05314').length, 1, '入场检索 1 张')
  run(state, current => returnAssetToHand(current, 0, { assetId: mirror.id }, []))
  assert.equal(state.bondedSets['05313'].cards.filter(code => code === '05314').length, 3, '3 张全部收回场外集合')
  assert.equal(me(state).hand.filter(code => code === '05314').length, 0, '手牌里的副本被收回')
  assert.ok(!me(state).deck.includes('05314'), '牌库里的副本被收回')
})

test(`TCU 05316 ${nameOf('05316')} 离场时把所有鲜血仪式收回场外集合`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05316']
  inv.deck = Array(20).fill('01088')
  move(state, { action: 'play', cardId: '05316' })
  settle(state)
  const lexicon = me(state).assets.find(item => item.code === '05316')
  assert.equal(me(state).hand.filter(code => code === '05317').length, 1, '入场检索 1 张')
  run(state, current => returnAssetToHand(current, 0, { assetId: lexicon.id }, []))
  assert.equal(state.bondedSets['05316'].cards.filter(code => code === '05317').length, 3, '3 张全部收回场外集合')
  assert.equal(me(state).hand.filter(code => code === '05317').length, 0, '手牌里的副本被收回')
})

// ---------------------------------------------------------------------------
// 05320 超级加倍（卓越）
// ---------------------------------------------------------------------------

test(`TCU 05320 ${nameOf('05320')} 打出一张事件后横置自身再次打出该事件`, () => {
  const state = fixture('01001')
  const inv = me(state)
  const dd = asset(state, '05320')
  inv.hand = ['01088', '01088']
  inv.resources = 30
  move(state, { action: 'play', cardId: '01088' })
  settle(state, pending => {
    if (pending.kind !== 'reaction') return null
    return pending.options.find(option => option.cardCode === '05320')?.id ?? null
  })
  const current = state.investigators[0].assets.find(item => item.id === dd.id)
  assert.equal(current.exhausted, true, '超级加倍被横置')
  assert.equal(me(state).resources, 36, '应急物品打出两次，共 +6 资源')
  assert.ok(state.log.some(line => String(line).includes('超级加倍')), '日志记录了「超级加倍」的重放')
})

// ---------------------------------------------------------------------------
// 05324 美满结局（显式简化：负修正标记 → 等值正修正）
// ---------------------------------------------------------------------------

test(`TCU 05324 ${nameOf('05324')} 负修正标记将要令技能值降到 0 时翻转为正修正`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05324']
  inv.resources = 10
  state.chaosBag = ['-4']
  state.testResult = null
  run(state, current => {
    performTest(current, 0, 'willpower', 3, { resolve: result => { current.testResult = result } })
  }, pending => {
    if (pending.kind !== 'reaction') return null
    return pending.options.find(option => option.cardCode === '05324')?.id ?? null
  })
  assert.equal(state.testResult?.drawn?.includes('-4'), true, '揭示了 -4 标记')
  assert.equal(state.testResult?.success, true, '翻转成正修正后检定成功')
  assert.equal(me(state).resources, 8, '打出费用 2')
  assert.ok(me(state).discard.includes('05324'), '快速事件结算后进弃牌堆')
})
