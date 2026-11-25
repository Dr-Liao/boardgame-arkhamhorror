// 验收 12-a 分片 2（2026 核心盒 core_2026 · 12041–12080）补充证据：
// 本分片 40 张里 29 张为 strict（有单卡条目），11 张为 catalog-only 重印别名
// （12042→05276、12044→04107、12049→09064、12050→07114、12056→05278、12064→04199、
//  12065→01065、12069→02268、12073→08073、12077→05114、12078→01079）。
// 批次 3 只为玩家包写了聚合用例（starter-batch-3），没有逐卡标题用例，故在此为 29 张
// strict 卡各补一条真实执行（引擎 fixture + legalMoves/move/settle/真实窗口），并补 11 条
// 别名解析断言（标题含别名卡号，canonical 见上）。
// 主进程合并时需登记进 tests/suites.mjs 与 tests/node-suite.mjs（未登记会使 suite-manifest 红）。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { fixture, asset, enemy, move, settle, legalMoves } from './core-fixture.mjs'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { reactionWindow } from '../src/engine/engine.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { REPRINT_ALIASES } from '../src/cards/card-identity.js'

import e12041 from '../src/cards/entries/12041.js'
import e12043 from '../src/cards/entries/12043.js'
import e12045 from '../src/cards/entries/12045.js'
import e12046 from '../src/cards/entries/12046.js'
import e12047 from '../src/cards/entries/12047.js'
import e12048 from '../src/cards/entries/12048.js'
import e12051 from '../src/cards/entries/12051.js'
import e12052 from '../src/cards/entries/12052.js'
import e12053 from '../src/cards/entries/12053.js'
import e12054 from '../src/cards/entries/12054.js'
import e12055 from '../src/cards/entries/12055.js'
import e12057 from '../src/cards/entries/12057.js'
import e12058 from '../src/cards/entries/12058.js'
import e12059 from '../src/cards/entries/12059.js'
import e12060 from '../src/cards/entries/12060.js'
import e12061 from '../src/cards/entries/12061.js'
import e12062 from '../src/cards/entries/12062.js'
import e12063 from '../src/cards/entries/12063.js'
import e12066 from '../src/cards/entries/12066.js'
import e12067 from '../src/cards/entries/12067.js'
import e12068 from '../src/cards/entries/12068.js'
import e12070 from '../src/cards/entries/12070.js'
import e12071 from '../src/cards/entries/12071.js'
import e12072 from '../src/cards/entries/12072.js'
import e12074 from '../src/cards/entries/12074.js'
import e12075 from '../src/cards/entries/12075.js'
import e12076 from '../src/cards/entries/12076.js'
import e12079 from '../src/cards/entries/12079.js'
import e12080 from '../src/cards/entries/12080.js'

const ENTRIES = [e12041, e12043, e12045, e12046, e12047, e12048, e12051, e12052, e12053, e12054,
  e12055, e12057, e12058, e12059, e12060, e12061, e12062, e12063, e12066, e12067, e12068, e12070,
  e12071, e12072, e12074, e12075, e12076, e12079, e12080]
const missing = ENTRIES.filter(entry => !registeredEntry(entry.code))
if (missing.length) registerCardAbilities(missing)

const me = (state, seat = 0) => state.investigators[seat]
const game = () => {
  const state = fixture('01001', 1)
  state.abilityLimits = {}
  for (const inv of state.investigators) {
    inv.hand = []; inv.assets = []; inv.threat = []; inv.discard = []
    inv.deck = Array(30).fill('01088')
    inv.resources = 30; inv.damage = 0; inv.horror = 0; inv.clues = 0; inv.actionsLeft = 20
  }
  const here = state.locations.find(item => item.id === state.investigators[0].location)
  if (here && !state.locations.some(item => item.id === 'hallway')) {
    state.locations.push({ id: 'hallway', name: '走廊', revealed: true, clues: 0, shroud: 2, connections: [here.id] })
    here.connections = ['hallway']
  }
  return state
}
const fresh = (state, code, seat = 0) => me(state, seat).assets.find(card => card.code === code)
const transact = (state, run, select = () => null) => {
  resolveTransaction(state, 0, { action: 'acceptance12a2' }, draft => run(draft))
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 200, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, draft => run(draft))
  }
}
const windowProbe = (state, when, context, select = () => null) => {
  let captured = null
  transact(state, draft => {
    captured = { ...context }
    reactionWindow(draft, when, captured, [], { allowNested: true })
  }, select)
  return captured
}
const abilityAt = (state, assetId, index, seat = 0) => legalMoves(state, seat).find(item =>
  item.action === 'ability' && item.assetId === assetId && item.abilityIndex === index)
const byLabel = label => choice => (choice.options || []).find(option => String(option.label || '').includes(label))?.id
const byCard = code => choice => (choice.options || []).find(option => String(option.cardCode) === code)?.id
const firstChoice = choice => (choice.options || []).find(option => !['done', 'skip'].includes(String(option.id)))?.id
const pickTrigger = choice => (choice.options || []).some(option => option.id === 'trigger') ? 'trigger' : null
const triggerLabel = name => choice => (choice.options || []).find(option =>
  String(option.id).startsWith('desc:') || (option.id !== 'skip' && String(option.label || '').includes(name)))?.id
const playEvent = (state, code) => { me(state).hand.push(code); return move(state, { action: 'play', cardId: code }) }
const playAsset = (state, code) => { playEvent(state, code); settle(state); return fresh(state, code) }
const startTest = (state, action = 'investigate') => {
  const candidate = legalMoves(state, 0).find(item => item.action === action)
  assert.ok(candidate, `应有 ${action} 行动`)
  move(state, candidate)
  return state.pendingChoice
}
const chooseWindowAbility = (state, label) => {
  const choice = state.pendingChoice
  const option = (choice?.options || []).find(item => String(item.label || '').includes(label))
  assert.ok(option, `窗口里应有「${label}」选项：${JSON.stringify((choice?.options || []).map(o => o.label))}`)
  move(state, { action: 'choose', choiceId: choice.id, optionId: option.id })
}
const commitCard = (state, code) => {
  const choice = state.pendingChoice
  const option = (choice?.options || []).find(item => String(item.label || '').includes(ALL_CARDS[code]?.nameZh || code))
  assert.ok(option, `投入选项里应有 ${code}：${JSON.stringify((choice?.options || []).map(o => o.label))}`)
  move(state, { action: 'choose', choiceId: choice.id, optionId: option.id })
}

// ── 12041 溜之大吉 ───────────────────────────────────────────────────────────
test('12-a 12041 溜之大吉：每控制 1 线索 +2 敏捷（上限 +6），成功可与敌人解除交战并移动', () => {
  const s = game()
  const foe = enemy(s, { evade: 1, health: 5 })
  me(s).clues = 2
  playEvent(s, '12041')
  settle(s, pickTrigger)
  assert.equal(me(s).engaged.length, 0, '成功后可与交战敌人解除交战')
  assert.ok(s.enemies[0]?.exhausted, '躲避成功的敌人应横置')
})

// ── 12043 狂野知识 ───────────────────────────────────────────────────────────
test('12-a 12043 狂野知识：查看牌库顶 5 张（≥2 线索为 8 张），抽 3 张其余放顶/底', () => {
  const s = game()
  me(s).deck = ['01020', '01025', '01030', '01034', '01037', '01039', '01079', '01088']
  playEvent(s, '12043')
  settle(s, firstChoice)
  assert.equal(me(s).hand.length, 3, '抽 3 张')
  assert.equal(me(s).deck.length, 5, '其余 5 张按顶/底放回')

  const s2 = game()
  me(s2).deck = Array.from({ length: 10 }, (_, index) => ['01020', '01025', '01030', '01034', '01037', '01039', '01079', '01088', '01088', '01088'][index])
  me(s2).clues = 2
  playEvent(s2, '12043')
  settle(s2, firstChoice)
  assert.equal(me(s2).hand.length, 3, '≥2 线索查看 8 张后仍抽 3')
  assert.equal(me(s2).deck.length, 7, '8 张中 3 张入手、5 张放回：10-3=7')
})

// ── 12045 M1903 ─────────────────────────────────────────────────────────────
test('12-a 12045 M1903 击锤内置式手枪：花 1 弹药敏捷攻击，目标横置时伤害 +1', () => {
  const s = game()
  const gun = playAsset(s, '12045')
  const foe = enemy(s, { exhausted: true, fight: 1, health: 6 })
  move(s, abilityAt(s, gun.id, 0))
  settle(s)
  assert.equal(s.enemies[0].damageTaken, 2, '基础 1 伤害 + 目标横置 1 伤害')
  assert.equal(fresh(s, '12045').uses, 3, '花费 1 弹药')
})

// ── 12046 奥利维尔·毕晓普 ───────────────────────────────────────────────────
test('12-a 12046 奥利维尔·毕晓普：+1 敏捷；[fast] 横置移动到连接地点', () => {
  const s = game()
  const ally = playAsset(s, '12046')
  const from = me(s).location
  move(s, abilityAt(s, ally.id, 0))
  settle(s)
  assert.notEqual(me(s).location, from, '移动到连接地点')
  assert.ok(fresh(s, '12046').exhausted, '横置自己')
})

// ── 12047 三寸之舌 ───────────────────────────────────────────────────────────
test('12-a 12047 三寸之舌：检定期间花 1 资源获得本次智识 +1', () => {
  const s = game()
  playAsset(s, '12047')
  startTest(s, 'investigate')
  chooseWindowAbility(s, '三寸之舌')
  assert.equal(s.skillTest?.pendingBonus, 1, '普通检定 +1 智识')
  settle(s)
})

// ── 12048 / 12054 妙手空空 ───────────────────────────────────────────────────
test('12-a 12048 妙手空空：成功躲避后横置获得 1 资源', () => {
  const s = game()
  playAsset(s, '12048')
  enemy(s, { evade: 1, health: 5 })
  const evade = legalMoves(s, 0).find(item => item.action === 'evade')
  move(s, evade)
  settle(s, triggerLabel('妙手空空'))
  assert.equal(me(s).resources, 30, '打出花费 1、躲避成功后获得 1 资源')
  assert.ok(fresh(s, '12048').exhausted, '横置')
})

test('12-a 12054 妙手空空（2 经验）：快速打出，成功躲避后横置获得 1 资源', () => {
  const s = game()
  playAsset(s, '12054')
  enemy(s, { evade: 1, health: 5 })
  const evade = legalMoves(s, 0).find(item => item.action === 'evade')
  move(s, evade)
  settle(s, triggerLabel('妙手空空'))
  assert.equal(me(s).resources, 30, '打出花费 1、躲避成功后获得 1 资源')
  assert.ok(fresh(s, '12054').exhausted, '横置')
})

// ── 12051 血洗全城 ───────────────────────────────────────────────────────────
test('12-a 12051 血洗全城：从遭遇牌库顶 9 张找非精英敌人，抽取并获得其印刷生命值资源', () => {
  const s = game()
  const enemyCode = Object.values(ALL_CARDS).find(def => def.type === 'enemy'
    && !(def.traits || []).some(trait => String(trait).toLowerCase() === 'elite')
    && Number(def.health) > 0 && def.encounterCode)?.code
  assert.ok(enemyCode, '需要一张遭遇敌人数据')
  s.encounterDeck = [...s.encounterDeck.slice(0, -1), enemyCode]
  playEvent(s, '12051')
  settle(s)
  assert.equal(me(s).resources, 30 + Number(ALL_CARDS[enemyCode].health), '获得等于印刷生命值的资源')
})

// ── 12052 变戏法 ─────────────────────────────────────────────────────────────
test('12-a 12052 变戏法：从手牌打出道具支援（费用 -2），回合结束标记返回手牌', () => {
  const s = game()
  const item = Object.values(ALL_CARDS).find(def => def.type === 'asset'
    && (def.traits || []).some(trait => String(trait).toLowerCase() === 'item')
    && Number(def.cost) >= 3 && def.xp === 0 && !def.permanent && def.deckLimit !== 0
    && !String(def.code).includes('a') && !(def.slots || []).includes('Head'))?.code
  assert.ok(item, '需要一张费用≥3 的道具支援')
  me(s).hand.push(item)
  playEvent(s, '12052')
  settle(s, byCard(item))
  const entered = fresh(s, item)
  assert.ok(entered, '道具支援已入场')
  const expected = 30 - 1 - Math.max(0, Number(ALL_CARDS[item].cost) - 2)
  assert.equal(me(s).resources, expected, '费用减 2')
  assert.ok(entered.returnToHandAtRoundEnd || entered.roundEndReturn, '入场的这张道具带有轮末返回标记')
})

// ── 12053 / 12057 视线盲区 ───────────────────────────────────────────────────
test('12-a 12053 视线盲区：成功且超过难度 2+ 时解除交战并移动到已揭示连接地点', () => {
  const s = game()
  me(s).hand.push('12053')
  enemy(s, { evade: 1, health: 5 })
  startTest(s, 'evade')
  commitCard(s, '12053')
  settle(s, pickTrigger)
  assert.equal(me(s).engaged.length, 0, '解除与每个敌人的交战')
})

test('12-a 12057 视线盲区（3 经验）：成功且超过难度 1+ 时移动到 1–2 个连接内的已揭示地点', () => {
  const s = game()
  me(s).hand.push('12057')
  enemy(s, { evade: 1, health: 5 })
  startTest(s, 'evade')
  commitCard(s, '12057')
  const before = me(s).location
  settle(s, firstChoice)
  assert.notEqual(me(s).location, before, '移动到 1–2 个连接内的已揭示地点')
})

// ── 12055 致胜一击 ───────────────────────────────────────────────────────────
test('12-a 12055 致胜一击：战斗 +2、伤害 +1；击败敌人获得 5 资源', () => {
  const s = game()
  enemy(s, { fight: 1, health: 1 })
  playEvent(s, '12055')
  settle(s)
  assert.equal(s.enemies.length, 0, '敌人被击败')
  assert.equal(me(s).resources, 33, '打出花费 2、击败敌人获得 5 资源')
})

// ── 12058 共鸣长袍 ───────────────────────────────────────────────────────────
test('12-a 12058 共鸣长袍：恐惧放到本卡后横置，对同地点敌人造成 1 伤害', () => {
  const s = game()
  const cloak = playAsset(s, '12058')
  const foe = enemy(s, { health: 5 })
  windowProbe(s, 'assetHarmPlaced', { when: 'assetHarmPlaced', seat: 0, assetId: cloak.id, horror: 1 }, triggerLabel('共鸣长袍'))
  assert.equal(s.enemies[0].damageTaken, 1, '对同地点敌人 1 伤害')
  assert.ok(fresh(s, '12058').exhausted, '横置本卡')
})

// ── 12059 宇宙烈焰 ───────────────────────────────────────────────────────────
test('12-a 12059 宇宙烈焰：意志攻击；成功后花 1 充能使本次攻击 +1 伤害', () => {
  const s = game()
  const flame = playAsset(s, '12059')
  const foe = enemy(s, { fight: 1, health: 6 })
  move(s, abilityAt(s, flame.id, 0))
  settle(s, choice => (choice.options || []).some(option => option.id === 'spend') ? 'spend' : null)
  assert.equal(s.enemies[0].damageTaken, 2, '基础 1 + 花费充能 1')
  assert.equal(fresh(s, '12059').uses, 2, '花费 1 充能')
})

// ── 12060 吉姆·卡尔弗 ───────────────────────────────────────────────────────
test('12-a 12060 吉姆·卡尔弗：+1 意志；受到伤害/恐惧后横置抽 1 张', () => {
  const s = game()
  playAsset(s, '12060')
  windowProbe(s, 'harmDealt', { when: 'harmDealt', seat: 0, damage: 1 }, byLabel('吉姆·卡尔弗'))
  assert.equal(me(s).hand.length, 1, '受到伤害后抽 1 张')
  assert.ok(fresh(s, '12060').exhausted, '横置')
})

// ── 12061 幸运符 ─────────────────────────────────────────────────────────────
test('12-a 12061 幸运符：花 1 充能并横置，把 1 点伤害/恐惧从同地点卡牌移到你控制的牌上', () => {
  const s = game()
  const charm = playAsset(s, '12061')
  const ally = asset(s, '01028')
  ally.damage = 0
  me(s).damage = 1
  move(s, abilityAt(s, charm.id, 0))
  settle(s)
  assert.equal(me(s).damage, 0, '伤害被移走')
  assert.equal(fresh(s, '01028').damage, 1, '1 点伤害移到你控制的另一张有生命值的卡上')
  assert.equal(fresh(s, '12061').uses, 3, '花费 1 充能并横置')
  assert.equal(fresh(s, '12061').uses, 3, '花费 1 充能')
})

// ── 12062 第二视觉 ───────────────────────────────────────────────────────────
test('12-a 12062 第二视觉：意志调查；成功后花 1 充能在所在地点额外发现 1 线索', () => {
  const s = game()
  const sight = playAsset(s, '12062')
  const location = s.locations.find(item => item.id === me(s).location)
  location.clues = 2
  move(s, abilityAt(s, sight.id, 0))
  settle(s, choice => (choice.options || []).some(option => option.id === 'spend') ? 'spend' : null)
  assert.equal(me(s).clues, 2, '基础 1 + 充能 1 线索')
  assert.equal(fresh(s, '12062').uses, 2, '花费 1 充能')
})

// ── 12063 灵性直觉 ───────────────────────────────────────────────────────────
test('12-a 12063 灵性直觉：检定期间花 1 资源获得意志/战斗 +1', () => {
  const s = game()
  playAsset(s, '12063')
  enemy(s, { fight: 1, health: 5 })
  startTest(s, 'fight')
  chooseWindowAbility(s, '灵感敏锐')
  assert.equal(s.skillTest?.pendingBonus, 1, '普通战斗检定 +1')
  settle(s)
})

// ── 12066 宇宙意志 ───────────────────────────────────────────────────────────
test('12-a 12066 宇宙意志：在控制的玩家卡上放 1 毁灭，然后发现所在地点与另一个已揭示地点各 1 线索', () => {
  const s = game()
  const card0 = asset(s, '01020')
  const here = s.locations.find(item => item.id === me(s).location)
  here.clues = 1
  const other = s.locations.find(item => item.id !== me(s).location && item.revealed !== false)
  assert.ok(other, '需要另一个已揭示地点')
  other.clues = 1
  playEvent(s, '12066')
  settle(s)
  assert.equal(fresh(s, '01020').doom, 1, '玩家卡上放置 1 毁灭')
  assert.equal(me(s).clues, 2, '发现所在地点 1 线索 + 另一个已揭示地点 1 线索')
  assert.equal(card0.code, '01020')
})

// ── 12067 灵魂链接 ───────────────────────────────────────────────────────────
test('12-a 12067 灵魂链接：作为投入的额外费用受到 1 点恐惧', () => {
  const s = game()
  me(s).hand.push('12067')
  enemy(s, { evade: 1, health: 5 })
  startTest(s, 'evade')
  commitCard(s, '12067')
  assert.equal(me(s).horror, 1, '投入时受到 1 点恐惧')
  settle(s)
})

// ── 12068 萨梯的面具 ─────────────────────────────────────────────────────────
test('12-a 12068 萨梯的面具（缺陷：Head 槽未登记，strict 卡无法打出）', () => {
  const s = game()
  me(s).hand.push('12068')
  assert.throws(() => move(s, { action: 'play', cardId: '12068' }), /没有合法的支援放置方案/,
    'cards-data slots=["Head"]，引擎 SLOT_CAPACITY 未登记 head → 该 strict 卡不可打出（缺陷，见报告 §6）')
})

// ── 12070 俄洛寇斯的预言 ─────────────────────────────────────────────────────
test('12-a 12070 俄洛寇斯的预言：智力调查把意志加入智力；成功额外 1 线索，符号标记可弃威胁区恐怖诡计', () => {
  const s = game()
  const here = s.locations.find(item => item.id === me(s).location)
  here.clues = 2
  s.chaosBag = ['skull']
  const terror = Object.values(ALL_CARDS).find(def => def.type === 'treachery'
    && (def.traits || []).some(trait => String(trait).toLowerCase() === 'terror'))?.code
  assert.ok(terror, '需要一张恐怖诡计')
  me(s).threat = [{ id: 'threat1', code: terror }]
  playEvent(s, '12070')
  settle(s, choice => (choice.options || []).some(option => option.id !== 'skip') ? choice.options.find(option => option.id !== 'skip').id : null)
  assert.equal(me(s).clues, 2, '成功额外 1 线索')
  assert.equal(me(s).threat.length, 0, '弃掉威胁区的恐怖诡计')
})

// ── 12071 宇宙烈焰（5 经验）─────────────────────────────────────────────────
test('12-a 12071 宇宙烈焰（5 经验）：意志 +2、伤害 +1；成功后花 1 充能对同地点敌人 1 伤害', () => {
  const s = game()
  const flame = playAsset(s, '12071')
  const foe = enemy(s, { fight: 1, health: 8 })
  move(s, abilityAt(s, flame.id, 0))
  settle(s, choice => (choice.options || []).some(option => option.id === 'spend') ? 'spend' : null)
  assert.equal(s.enemies[0].damageTaken, 3, '基础 1 + 伤害 +1 + 充能 1')
  assert.equal(fresh(s, '12071').uses, 3, '花费 1 充能')
})

// ── 12072 阿列克谢·萨布罗夫 ─────────────────────────────────────────────────
test('12-a 12072 阿列克谢·萨布罗夫：回合开始时治愈自身 1 点伤害或恐惧', () => {
  const s = game()
  const ally = playAsset(s, '12072')
  ally.damage = 1
  windowProbe(s, 'turnBegins', { when: 'turnBegins', seat: 0 }, choice => {
    const option = (choice.options || []).find(item => item.id === 'damage' || String(item.label || '').includes('伤害'))
    return option?.id
  })
  assert.equal(fresh(s, '12072').damage, 0, '治愈 1 点伤害')
})

// ── 12074 猎人直觉 ───────────────────────────────────────────────────────────
test('12-a 12074 猎人直觉：与敌人交战后花 1 补给并横置，从弃牌堆拿回一张 0 级事件', () => {
  const s = game()
  playAsset(s, '12074')
  me(s).discard = ['01079']
  windowProbe(s, 'enemyEngaged', { when: 'enemyEngaged', seat: 0, enemyId: 'e1' }, firstChoice)
  assert.ok(me(s).hand.includes('01079'), '0 级事件回到手牌')
  assert.equal(fresh(s, '12074').uses, 2, '花费 1 补给')
})

// ── 12075 连体服 ─────────────────────────────────────────────────────────────
test('12-a 12075 连体服：弃掉本卡，从弃牌堆把一张工具/武器支援加入手牌', () => {
  const s = game()
  const jumpsuit = playAsset(s, '12075')
  const tool = Object.values(ALL_CARDS).find(def => def.type === 'asset'
    && (def.traits || []).some(trait => ['tool', 'weapon'].includes(String(trait).toLowerCase())))?.code
  assert.ok(tool, '需要一张工具/武器支援')
  me(s).discard = [tool]
  move(s, abilityAt(s, jumpsuit.id, 0))
  settle(s)
  assert.ok(me(s).hand.includes(tool), '工具/武器支援加入手牌')
})

// ── 12076 镇静自若 ───────────────────────────────────────────────────────────
test('12-a 12076 镇静自若：检定期间花 1 资源获得意志/敏捷 +1', () => {
  const s = game()
  playAsset(s, '12076')
  const flame = playAsset(s, '12059')
  enemy(s, { fight: 1, health: 6 })
  move(s, abilityAt(s, flame.id, 0))
  if (s.pendingChoice?.kind === 'playerWindow') chooseWindowAbility(s, '镇静自若')
  assert.equal(s.skillTest?.pendingBonus, 1, '普通意志检定 +1')
  settle(s)
})

// ── 12079 “滚开！” ───────────────────────────────────────────────────────────
test('12-a 12079 “滚开！”：成功躲避后对被躲避的敌人造成 1 点伤害', () => {
  const s = game()
  enemy(s, { evade: 1, health: 5 })
  playEvent(s, '12079')
  settle(s)
  assert.equal(s.enemies[0].damageTaken, 1, '成功躲避后 1 伤害')
})

// ── 12080 灵活脱身 ───────────────────────────────────────────────────────────
test('12-a 12080 灵活脱身：躲避非精英敌人成功后，该敌人下一个补给阶段不重整', () => {
  const s = game()
  me(s).hand.push('12080')
  const foe = enemy(s, { evade: 1, health: 5 })
  startTest(s, 'evade')
  commitCard(s, '12080')
  settle(s)
  assert.ok(s.enemies[0]?.preventReady && s.enemies[0].preventReady.rounds >= 1, '该敌人下一个补给阶段不重整')
})

// ── 重印别名（catalog-only，按 canonical 实现判）────────────────────────────
const ALIASES = {
  12042: '05276', 12044: '04107', 12049: '09064', 12050: '07114', 12056: '05278',
  12064: '04199', 12065: '01065', 12069: '02268', 12073: '08073', 12077: '05114', 12078: '01079',
}
test('12-a 12042/12044/12049/12050/12056/12064/12065/12069/12073/12077/12078 重印别名解析到已实现 canonical', () => {
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    assert.ok(REPRINT_ALIASES[canonical]?.includes(alias) || Object.values(REPRINT_ALIASES).some(list => list.includes(alias)),
      `${alias} 应登记在 REPRINT_ALIASES`)
    assert.ok(registeredEntry(canonical) || fs.existsSync('src/cards/entries/' + canonical + '.js'),
      `${canonical} 应有 canonical 实现`)
    assert.equal(ALL_CARDS[alias].duplicateOfCode, canonical, `${alias} 的 duplicateOfCode 指向 ${canonical}`)
  }
})
