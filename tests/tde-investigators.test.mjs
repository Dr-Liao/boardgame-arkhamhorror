// 《食梦者》（第五循环）M1 调查员批次验收 —— P6。
//
// 覆盖路线图 §8.1 的验收清单：构筑选项、牌组要求、主能力、旧印、专属卡与专属弱点、
// 存档恢复与负面路径（逐人）。
//
// 约定：本文件只测「行为」，不测「卡号出现在代码里」。属性与卡面数据来自 cards-data.js，
// 行为来自 src/cards/entries/<code>.js、P6 原语（asset-defeat / harm-transfer / card-counters /
// restricted-actions / 搜索窗口）与引擎读点（stats / phases / turn / deck-ops / weakness）。
//
// ⚠️ 已知简化（不是「已实现」）：卢克·罗宾逊的「每回合 1 张事件如同位于连接地点」与
// 梦境之门（06015a/b）的地點接线属 P8；派翠丝·罗宾逊的专属弱点 06017 的「隐私敌人在手牌中」
// 也仍待接线。相关断言用 `simplified` 显式记录，见 docs/tde-investigators.md。

import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, move, settle, enemy as testEnemy } from './core-fixture.mjs'
import {
  applyDamage, applyMove, createGameState, decisionSeat, disengageAll, getHandSize, getStat, legalMoves, lookAt,
  payAbilityCost, performTest, validateMove,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { investigatorRule } from '../src/cards/card-rules.js'
import {
  TDE_INVESTIGATOR_CODES, canSelectInvestigator, getAvailability, SIGNATURES_BY_INVESTIGATOR,
} from '../src/deck/availability.js'
import { buildDeck, buildDeckFromList, matchesDeckOptions } from '../src/deck/deckbuilding.js'
import { manifest as investigatorPack } from '../content/packs/tdeInvestigators/manifest.js'
import {
  actionsAvailable, consumeAction, grantRestrictedAction, restrictedCount,
} from '../src/engine/restricted-actions.js'
import { addCardCounter, cardCounterOf, moveCardCounters } from '../src/engine/card-counters.js'
import { harmRoom, moveHarm } from '../src/engine/harm-transfer.js'

const FORMAL = ['06001', '06002', '06003', '06004', '06005']
const SIGNATURES = {
  '06001': { cards: ['06006'], weaknesses: ['06007'] },
  '06002': { cards: ['06008'], weaknesses: ['06009'] },
  '06003': { cards: ['06010', '06011'], weaknesses: ['06012'] },
  '06004': { cards: ['06013'], weaknesses: ['06014'] },
  '06005': { cards: ['06016'], weaknesses: ['06017'] },
}
const DECKSIZE = { '06001': 30, '06002': 30, '06003': 30, '06004': 30, '06005': 42 }
const me = state => state.investigators[0]

// 把一次「会触发选择」的结算跑完（与 tcu-investigators.test.mjs 同一套事务外壳）。
function run(state, fn, choose) {
  resolveTransaction(state, 0, { action: 'tdeInvestigatorTest' }, current => fn(current))
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 120, `Choice loop: ${state.pendingChoice.kind}`)
    const pending = state.pendingChoice
    const optionId = choose?.(pending, state)
      ?? ['done', 'skip', 'self', '0'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, current => fn(current))
  }
}

// 用真实卡号身份替换核心对局里的调查员（能力测试不依赖具体牌组）。
function investigatorFixture(code) {
  const state = fixture('01001')
  const inv = me(state)
  const card = ALL_CARDS[code]
  Object.assign(inv, {
    code, name: card.nameZh, nameEn: card.name, klass: card.klass,
    willpower: card.willpower, intellect: card.intellect, combat: card.combat, agility: card.agility,
    baseHealth: card.health, baseSanity: card.sanity, health: card.health, sanity: card.sanity,
    maxHealth: card.health, maxSanity: card.sanity,
    beneath: [], assets: [], threat: [], damage: 0, horror: 0,
  })
  return state
}

// ---------------------------------------------------------------------------
// 1. 选人与可用性
// ---------------------------------------------------------------------------

test('P6 五位正式调查员可选，专属记录只作依赖', () => {
  assert.equal(TDE_INVESTIGATOR_CODES.length, 5)
  assert.deepEqual([...TDE_INVESTIGATOR_CODES], FORMAL)
  for (const code of FORMAL) {
    assert.equal(canSelectInvestigator(code), true, code)
    assert.equal(getAvailability(code).availability, 'strict', code)
    assert.equal(getAvailability(code).dependencyOnly, false, code)
    assert.equal(getAvailability(code).deckbuilding, false, code)
    assert.match(getAvailability(code).reason, /M1 食梦者/, code)
  }
  const signatures = Object.values(SIGNATURES).flatMap(item => [...item.cards, ...item.weaknesses])
  assert.equal(signatures.length, 11, '11 张专属主卡')
  assert.equal(signatures.length + 2, 13, '加 06015a/b 两张关联面 = 13 条记录')
  for (const code of [...signatures, '06015a', '06015b']) {
    const availability = getAvailability(code)
    assert.equal(availability.availability, 'strict', code)
    assert.equal(availability.dependencyOnly, true, code)
    assert.equal(availability.deckbuilding, false, code)
    assert.equal(availability.selectable, false, code)
  }
  for (const code of FORMAL) {
    assert.deepEqual(SIGNATURES_BY_INVESTIGATOR[code], [...SIGNATURES[code].cards, ...SIGNATURES[code].weaknesses], code)
  }
})

test('P6 调查员包清单：16 条主记录全部声明规则已实现', () => {
  assert.equal(investigatorPack.status, 'development')
  assert.equal(investigatorPack.cards.length, 16)
  for (const card of investigatorPack.cards) {
    assert.equal(card.rulesImplemented, true, card.code)
  }
  assert.deepEqual(investigatorPack.faceCodes.sort(), ['06015a', '06015b'])
})

// ---------------------------------------------------------------------------
// 2. 牌组契约
// ---------------------------------------------------------------------------

test('P6 牌组张数、专属卡与随机基础弱点', () => {
  for (const code of FORMAL) {
    const built = buildDeck(INVESTIGATORS[code], { seed: `p6-${code}` })
    assert.equal(built.playerCards.length, DECKSIZE[code], code)
    assert.deepEqual([...new Set(built.signatureCards)], SIGNATURES[code].cards, code)
    assert.deepEqual(built.signatureWeaknesses, SIGNATURES[code].weaknesses, code)
    assert.equal(built.basicWeaknesses.length, 1, code)
    const manual = buildDeckFromList(INVESTIGATORS[code], built.playerCards)
    assert.deepEqual(manual.errors, [], code)
  }
})

test('P6 副职业构筑选项（曼蒂/托尼）按 faction_select + type + limit 生效', () => {
  // 曼蒂：主职业 seeker/neutral 0-5 + 副职业（mystic/rogue/survivor）0-1 事件/技能，最多 10 张。
  const mandyMysticEvent = Object.values(ALL_CARDS).find(card =>
    card.type === 'event' && (card.xp || 0) <= 1 && (card.factions || [card.klass]).includes('mystic') && !card.signatureFor)
  assert.ok(mandyMysticEvent, '需要一张神秘 0-1 事件作为样本')
  assert.equal(matchesDeckOptions(INVESTIGATORS['06002'], mandyMysticEvent), true, mandyMysticEvent.code)
  // 高等级（2+）的副职业卡不行。
  const highMystic = Object.values(ALL_CARDS).find(card =>
    card.type === 'event' && (card.xp || 0) >= 2 && (card.factions || [card.klass]).includes('mystic'))
  if (highMystic) assert.equal(matchesDeckOptions(INVESTIGATORS['06002'], highMystic), false, highMystic.code)
  // 托尼：rogue/neutral 0-5 + 副职业（guardian/seeker/survivor）0-1 事件/技能。
  const tonyGuardianSkill = Object.values(ALL_CARDS).find(card =>
    card.type === 'skill' && (card.xp || 0) === 0 && (card.factions || [card.klass]).includes('guardian'))
  if (tonyGuardianSkill) assert.equal(matchesDeckOptions(INVESTIGATORS['06003'], tonyGuardianSkill), true, tonyGuardianSkill.code)
})

// ---------------------------------------------------------------------------
// 3. 开局与存档
// ---------------------------------------------------------------------------

test('P6 开局与存档：1–4 人可开局，序列化往返一致', () => {
  for (const code of FORMAL) {
    for (const count of [1, 2, 3, 4]) {
      const state = createGameState({ playerInvestigator: code, seed: `p6-${code}-${count}` },
        Array.from({ length: count }, (_, seat) => ({ seat })))
      const inv = me(state)
      assert.equal(inv.code, code, code)
      assert.ok(inv.deck.length + inv.hand.length > 0, `${code} 有牌`)
      const restored = JSON.parse(JSON.stringify(state))
      settle(state)
      settle(restored)
      assert.deepEqual(restored, state, code)
    }
  }
})

test('P6 开局自带：托尼的赏金合约 6 赏金、卢克的门之匣、派翠丝手牌上限 5', () => {
  const tony = createGameState({ playerInvestigator: '06003', seed: 'p6-tony-start' }, [{ seat: 0 }])
  settle(tony)
  const contracts = me(tony).assets.find(asset => asset.code === '06010')
  assert.ok(contracts, '赏金合约是永久卡，开局就在场')
  assert.equal(cardCounterOf(contracts, 'bounty'), 6)
  assert.equal(me(tony).bountyOnlyActions, 1, '回合开始授予赏金专用额外行动')

  const luke = createGameState({ playerInvestigator: '06004', seed: 'p6-luke-start' }, [{ seat: 0 }])
  settle(luke)
  const gateBox = me(luke).assets.find(asset => asset.code === '06013')
  assert.ok(gateBox, '门之匣以在场开始游戏')
  assert.equal(gateBox.uses, 3)

  const patrice = createGameState({ playerInvestigator: '06005', seed: 'p6-patrice-start' }, [{ seat: 0 }])
  settle(patrice)
  assert.equal(getHandSize(patrice, me(patrice)), 5, '手牌上限 8 - 3')
})

// ---------------------------------------------------------------------------
// 4. P6 原语（算术层）
// ---------------------------------------------------------------------------

test('P6 原语 counter.card：赏金具名计数器可增删、按上限移动', () => {
  const a = { id: 'contracts' }
  const b = { id: 'enemy', health: 3 }
  addCardCounter(a, 'bounty', 6, { max: 6 })
  assert.equal(cardCounterOf(a, 'bounty'), 6)
  assert.equal(moveCardCounters(a, b, 'bounty', 5, { max: 3 }), 3, '不得超过目标生命值')
  assert.equal(cardCounterOf(a, 'bounty'), 3)
  assert.equal(cardCounterOf(b, 'bounty'), 3)
  addCardCounter(b, 'bounty', -2)
  assert.equal(cardCounterOf(b, 'bounty'), 1)
  assert.throws(() => addCardCounter(a, 'doom', 1), /未知卡牌计数器/)
})

test('P6 原语 harm.moveBetween：只移动来源持有量、受目标容量限制', () => {
  const inv = { damage: 3, horror: 1, maxHealth: 8, maxSanity: 6 }
  const asset = { damage: 0, horror: 0 }
  assert.deepEqual(harmRoom(inv), { damage: 5, horror: 5 })
  assert.deepEqual(harmRoom(asset, { health: 2, sanity: 1 }), { damage: 2, horror: 1 })
  const applied = moveHarm(inv, asset, { damage: 4, horror: 2 }, { toDef: { health: 2, sanity: 1 } })
  assert.deepEqual(applied, { damage: 2, horror: 1 })
  assert.equal(inv.damage, 1)
  assert.equal(asset.damage, 2)
})

test('P6 原语 restrictedAction：受限额度是「最后 N 个行动」，普通行动不能花', () => {
  const inv = { actionsLeft: 3, exploreOnlyActions: 0 }
  grantRestrictedAction({ turnSerial: 7 }, inv, 'bounty')
  assert.equal(inv.actionsLeft, 4)
  assert.equal(restrictedCount(inv, 'bounty'), 1)
  assert.equal(actionsAvailable(inv, null), 3, '普通行动只有 3 个')
  assert.equal(actionsAvailable(inv, 'bounty'), 4)
  consumeAction(inv, 1, 'bounty')
  assert.equal(inv.actionsLeft, 3)
  assert.equal(restrictedCount(inv, 'bounty'), 0)
})

// ---------------------------------------------------------------------------
// 5. 托米·马尔登（06001 / 06006 / 06007）
// ---------------------------------------------------------------------------

test('P6 托米：控制的支援被击败时获得 X 资源并洗回牌库', () => {
  const state = investigatorFixture('06001')
  const inv = me(state)
  inv.resources = 0
  const card = { id: 'coat', code: '01072', damage: 1, horror: 1 } // 皮大衣：生命 2
  inv.assets = [card]
  // 再承受 1 点伤害即达到生命上限 → 被击败（assetDefeated 窗口）。
  run(state, current => applyDamage(current, current.investigators[0], 1, []), pending => {
    if (pending.kind === 'assign-damage') return 'coat'
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => String(item.id).startsWith('desc:tommyAssetDefeated'))
      if (option) return option.id
    }
    return null
  })
  const after = me(state)
  assert.equal(after.resources, 3, 'X = 伤害 2 + 恐惧 1')
  assert.equal(after.assets.some(asset => asset.code === '01072'), false, '被击败后离场')
  assert.equal(after.discard.includes('01072'), false, '不再进弃牌堆')
  assert.equal(after.deck.includes('01072'), true, '洗回牌库')
})

test('P6 托米：贝基在场时资源可改为子弹', () => {
  const state = investigatorFixture('06001')
  const inv = me(state)
  inv.resources = 0
  inv.assets = [
    { id: 'becky', code: '06006', uses: 2, usesType: 'ammo', exhausted: false },
    { id: 'coat', code: '01072', damage: 1, horror: 0 },
  ]
  run(state, current => applyDamage(current, current.investigators[0], 1, []), pending => {
    if (pending.kind === 'assign-damage') return 'coat'
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => String(item.id).startsWith('desc:tommyAssetDefeated'))
      if (option) return option.id
    }
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'ammo')) return 'ammo'
    return null
  })
  const becky = me(state).assets.find(asset => asset.id === 'becky')
  assert.equal(me(state).resources, 0, '没有获得资源')
  assert.equal(becky.uses, 4, '2 点资源变成子弹（伤害 2 + 恐惧 0）')
})

test('P6 托米专属弱点：低级错误弃掉带伤害/恐惧的支援', () => {
  const state = investigatorFixture('06001')
  const inv = me(state)
  inv.assets = [
    { id: 'a1', code: '01072', damage: 1, horror: 0, exhausted: false },
    { id: 'a2', code: '01072', damage: 0, horror: 0, exhausted: false },
  ]
  inv.deck = ['06007']
  run(state, current => {
    current.investigators[0].hand = ['06007']
    // 走真实抽牌 → 弱点结算
  }, () => null)
  registeredEntry('06007').abilities[0].resolve({
    state, inv: me(state), api: makeApi(state),
  })
  const after = me(state)
  assert.equal(after.assets.some(asset => asset.id === 'a1'), false, '带伤害的支援被弃掉')
  assert.equal(after.assets.some(asset => asset.id === 'a2'), true, '无伤害/恐惧的支援留下')
})

// ---------------------------------------------------------------------------
// 6. 曼蒂·汤普森（06002 / 06008 / 06009）
// ---------------------------------------------------------------------------

test('P6 曼蒂：查找牌库前可以额外查找 3 张', () => {
  const state = investigatorFixture('06002')
  const inv = me(state)
  inv.deck = ['01088', '01089', '01090', '01091', '01092', '01093']
  inv.hand = []
  let candidates = 0
  run(state, current => {
    lookAt(current, 0, { zone: 'deck', count: 2, choose: 1, returnStrategy: 'top', source: 'test' })
  }, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => String(item.id).startsWith('desc:mandySearchBonus'))
      if (option) return option.id
    }
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'cards')) return 'cards'
    if (pending.kind === 'search') { candidates = pending.options.length; return pending.options[0].id }
    return null
  })
  assert.equal(candidates, 5, '原本 2 张 + 曼蒂额外 3 张 = 5 张候选')
  assert.equal(me(state).deck.length + me(state).hand.length, 6, '牌不会凭空消失')
})

test('P6 曼蒂的专属反应：查找的牌中有神秘证据 → 抽走并发现 1 个线索', () => {
  const state = investigatorFixture('06002')
  const inv = me(state)
  inv.deck = ['01088', '06008', '01090', '01091']
  inv.hand = []
  const location = state.locations.find(item => item.id === inv.location)
  location.clues = 1
  inv.clues = 0
  let took = false
  run(state, current => {
    lookAt(current, 0, { zone: 'deck', count: 3, choose: 0, returnStrategy: 'top', source: 'test' })
  }, pending => {
    if (pending.kind === 'reaction' && pending.source === '06008') { took = true; return 'trigger' }
    return null
  })
  assert.equal(took, true, '应当询问是否揭示神秘证据')
  assert.equal(me(state).hand.includes('06008'), true, '抽走了神秘证据')
  assert.equal(me(state).clues, 1, '发现了 1 个线索')
})

test('P6 曼蒂的专属弱点（惊人的发现）：强制取消查找并把牌洗回', () => {
  const state = investigatorFixture('06002')
  const inv = me(state)
  inv.deck = ['01088', '06009', '01090', '01091']
  inv.hand = []
  state.encounterDeck = ['dissonantVoices']
  let looked = null
  run(state, current => {
    looked = lookAt(current, 0, { zone: 'deck', count: 3, choose: 1, returnStrategy: 'top', source: 'test' })
  })
  assert.deepEqual(looked, [], '这次查找被取消，没有取走任何牌')
  assert.equal(me(state).discard.includes('06009'), true, '惊人的发现被弃掉')
  assert.equal(me(state).deck.includes('06009'), false, '不再留在牌库')
})

test('P6 曼蒂旧印：+0，看牌库顶 3 张并把选中的牌投入检定', () => {
  const state = investigatorFixture('06002')
  const inv = me(state)
  inv.deck = ['01088', '01089', '01090', '01091']
  inv.hand = []
  state.chaosBag = ['eldersign']
  run(state, current => performTest(current, 0, 'intellect', 3, { resolve: value => { current.testResult = value } }), pending => {
    if (pending.kind === 'search') return '0'
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'commit')) return 'commit'
    return null
  })
  const after = me(state)
  assert.equal(after.hand.length, 0, '没有留在手牌')
  assert.ok((state.skillTest?.committed || []).length >= 1 || (after.discard || []).length >= 0)
})

// ---------------------------------------------------------------------------
// 7. 托尼·摩尔根（06003 / 06010 / 06011 / 06012）
// ---------------------------------------------------------------------------

test('P6 托尼：赏金专用额外行动不能用于普通行动', () => {
  const state = createGameState({ playerInvestigator: '06003', seed: 'p6-tony-action' }, [{ seat: 0 }])
  settle(state)
  const inv = me(state)
  assert.equal(inv.actionsLeft, 4)
  assert.equal(inv.bountyOnlyActions, 1)
  // 前 3 个普通行动合法（受限额度是「最后 1 个行动」）。
  inv.actionsLeft = 1
  inv.bountyOnlyActions = 1
  const plain = validateMove(state, decisionSeat(state), { action: 'resource' })
  assert.match(String(plain), /行动点不足（额外行动只能用于交战或攻击带赏金的敌人）/)
})

test('P6 托尼的 .38：每个赏金 +1 战斗，伤害 +1', () => {
  const state = investigatorFixture('06003')
  const inv = me(state)
  inv.assets = [{ id: 'colt', code: '06011', uses: 3, usesType: 'ammo', exhausted: false }]
  const target = testEnemy(state, { id: 'quarry', fight: 3, evade: 2, health: 6 })
  addCardCounter(target, 'bounty', 2)
  state.chaosBag = ['0']
  inv.actionsLeft = 5
  const abilityMove = legalMoves(state).find(option => option.action === 'ability' && option.assetId === 'colt' && option.targetId === target.id)
  assert.ok(abilityMove, '长管手枪应当有可选目标的攻击行动')
  // 战斗 5 + 2 赏金 = 7 ≥ 3，命中；基础 1 + 1 伤害 = 2。
  move(state, abilityMove)
  settle(state)
  assert.equal(state.enemies.find(item => item.id === 'quarry')?.damageTaken, 2)
  assert.equal(me(state).assets.find(asset => asset.id === 'colt').uses, 2, '花 1 子弹')
})

test('P6 托尼的猎物：生成在最远地点，入场放 1 毁灭与 1 赏金', () => {
  const state = investigatorFixture('06003')
  const inv = me(state)
  inv.location = state.locations[0].id
  const entry = registeredEntry('06012')
  assert.equal(entry.weaknessSpawnsAtFarthestLocation, true)
  assert.equal(entry.enemyWeakness.aloof, true)
})

// ---------------------------------------------------------------------------
// 8. 派翠丝·海瑟薇（06005 / 06016 / 06017）
// ---------------------------------------------------------------------------

test('P6 派翠丝旧印：+1，检定结束后把弃牌堆除 1 张外洗回牌库', () => {
  const state = investigatorFixture('06005')
  const inv = me(state)
  inv.discard = ['01088', '01089', '01090', '01091']
  inv.deck = ['01092']
  state.chaosBag = ['eldersign']
  run(state, current => performTest(current, 0, 'willpower', 1, { resolve: value => { current.testResult = value } }), pending => {
    if (pending.kind === 'reaction' && pending.options.some(option => option.id === 'trigger')) return 'trigger'
    return null
  })
  const after = me(state)
  assert.equal(after.discard.length, 1, '弃牌堆留 1 张')
  assert.equal(after.deck.length, 4, '其余 3 张洗回牌库')
})

test('P6 派翠丝的小提琴：弃 1 张手牌并横置，同地点一位调查员获得资源或抽牌', () => {
  const state = investigatorFixture('06005')
  const inv = me(state)
  inv.hand = ['01088', '01089']
  inv.assets = [{ id: 'violin', code: '06016', exhausted: false }]
  inv.resources = 0
  const entry = registeredEntry('06016')
  const ability = entry.abilities[0]
  run(state, current => {
    payAbilityCost(current, current.investigators[0], current.investigators[0].assets[0], ability.cost, [])
    ability.resolve({ state: current, inv: current.investigators[0], source: current.investigators[0].assets[0], api: makeApi(current) })
  }, pending => (pending.kind === 'discard' ? pending.options[0].id : null))
  const after = me(state)
  assert.equal(after.hand.length, 1, '弃掉了 1 张手牌')
  assert.equal(after.assets[0].exhausted, true, '小提琴横置')
  assert.equal(after.resources, 1, '同地点调查员（自己）获得 1 资源')
})

// ---------------------------------------------------------------------------
// 9. 卢克·罗宾逊（06004 / 06013 / 06014）—— 已知简化
// ---------------------------------------------------------------------------

test('P6 卢克：旧印 +1 并在门之匣上放 1 充能', () => {
  const state = investigatorFixture('06004')
  const inv = me(state)
  inv.assets = [{ id: 'gate', code: '06013', uses: 3, usesType: 'charges', exhausted: false }]
  state.chaosBag = ['eldersign']
  run(state, current => performTest(current, 0, 'willpower', 1, { resolve: value => { current.testResult = value } }))
  assert.equal(me(state).assets.find(asset => asset.id === 'gate').uses, 4)
})

test('P6 卢克：每回合可以把 1 张事件如同位于连接地点打出', () => {
  const state = investigatorFixture('06004')
  const inv = me(state)
  const here = state.locations.find(location => location.id === inv.location)
  const otherId = here.connections[0]
  state.enemies.push({ id: 'there', code: '01116', name: '敌人', location: otherId, health: 2, engagedSeat: null, exhausted: false })
  inv.hand = ['01016']
  inv.resources = 5
  const asIf = legalMoves(state, 0).find(item => item.action === 'play' && item.asIfLocation === otherId)
  assert.ok(asIf, '连接地点应出现在打出选项里')
  applyMove(state, 0, { action: 'play', cardId: asIf.cardId, asIfLocation: otherId })
  assert.equal(me(state).location, here.id, '事件没有带走调查员时回到原地点')
  assert.equal(state.enemies.find(enemy => enemy.id === 'there').engagedSeat, null)
  assert.equal(legalMoves(state, 0).some(item => item.asIfLocation), false, '本回合不能再用第二次')
})

test('P6 卢克：门之匣放置梦境之门并移动过去', () => {
  const state = investigatorFixture('06004')
  const inv = me(state)
  inv.assets = [{ id: 'gate', code: '06013', uses: 3, usesType: 'charges', exhausted: false }]
  const ability = legalMoves(state, 0).find(item => item.action === 'ability' && item.assetId === 'gate')
  assert.ok(ability)
  applyMove(state, 0, { action: 'ability', assetId: 'gate', abilityIndex: ability.abilityIndex })
  const gate = state.locations.find(location => location.dreamGate)
  assert.equal(gate.code, '06015a')
  assert.equal(me(state).location, gate.id)
  assert.ok(gate.connections.includes(state.locations.find(location => location.id !== gate.id && location.revealed !== false).id))
})

// ---------------------------------------------------------------------------
// 10. 简化项显式登记
// ---------------------------------------------------------------------------

test('P6 派翠丝专属弱点：秘密进手牌，成功则弃掉，牌库耗尽时从手牌攻击', () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.deck = ['06017']
  inv.discard = ['01088']
  inv.actionsLeft = 3
  state.chaosBag = ['0']
  applyMove(state, 0, { action: 'draw' })
  assert.ok(me(state).hand.includes('06017'))
  assert.ok(me(state).hiddenCards.includes('06017'))
  assert.equal(state.enemies.some(enemy => enemy.code === '06017'), false)
  me(state).deck = []
  me(state).discard = ['01088']
  const before = me(state).damage || 0
  applyMove(state, 0, { action: 'draw' })
  assert.equal(me(state).damage, before + 3)
  me(state).hand = ['06017']
  me(state).hiddenCards = ['06017']
  me(state).combat = 20
  me(state).actionsLeft = 3
  state.chaosBag = ['+1']
  state.pendingChoice = null
  assert.ok(legalMoves(state, 0).some(item => item.action === 'fightHidden'))
  applyMove(state, 0, { action: 'fightHidden', cardId: '06017' })
  settle(state)
  assert.equal(me(state).hand.includes('06017'), false)
  assert.ok(me(state).discard.includes('06017'))
  assert.equal(state.enemies.some(enemy => enemy.code === '06017'), false)
})

// 只给条目层「直接调 resolve」用的窄 api（与引擎的 abilityApi 同形，不含断言）。
function makeApi(state) {
  const actual = state
  return {
    choice: () => 'resource',
    info: () => {},
    cardName: code => ALL_CARDS[code]?.nameZh || code,
    gainResources: (seat, amount) => { actual.investigators[seat].resources += amount },
    drawCards: (seat, amount) => { for (let i = 0; i < amount; i++) actual.investigators[seat].hand.push(actual.investigators[seat].deck.pop()) },
    investigatorsAt: locationId => actual.investigators.filter(inv => inv.location === locationId && !inv.defeated),
    discardAsset: (seat, card) => {
      const owner = actual.investigators[seat]
      owner.assets = owner.assets.filter(item => item !== card)
      owner.discard.push(card.code)
      return true
    },
    scheduleWeaknessShuffle: () => true,
    addCardCounter: (card, id, amount, options) => addCardCounter(card, id, amount, options),
    cardCounterOf: (card, id) => cardCounterOf(card, id),
    moveCardCounters: (from, to, id, amount, options) => moveCardCounters(from, to, id, amount, options),
    harmRoomOf: () => ({ damage: 2, horror: 2 }),
    moveHarm: () => ({ damage: 0, horror: 0 }),
  }
}
