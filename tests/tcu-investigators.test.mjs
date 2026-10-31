// 万象无终（第四循环）M1 调查员批次验收 —— P6。
//
// 覆盖路线图 §7.1 的验收清单：初始化、主能力、旧印、构筑规则、专属卡、专属弱点、
// 存档恢复、负面路径（1–4 人、非法目标、重复触发）。
//
// 约定：本文件只测「行为」，不测「卡号出现在代码里」。属性与卡面数据来自 cards-data.js，
// 行为来自 src/cards/entries/<code>.js 与引擎读点（hunch-deck / resource-bank / spell-actions /
// healHorrorFrom / cardCancelled / evadeSuccess）。

import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, move, settle, enemy } from './core-fixture.mjs'
import {
  actionPreview,
  applyMove, createGameState, eliminateInvestigator, evaluateCriteria, executeDescriptor, finishScenario, getStat, healHorrorFrom, isSpellAction, legalMoves, payAbilityCost, playCost,
  performTest, playerWindow, reactionWindow, validateMove, applyDamage, applySkillOnSuccess, slotUsage, canEquip, enemyAttack,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registeredEntry } from '../src/engine/ability.js'
// P2-6（2026-10-28）：丽塔的「每轮一次」走 limits.js 的通用上限账本，旧印用 ignoreLimitForRound。
import { ignoreLimitForRound, limitIgnored } from '../src/engine/limits.js'
import { pushRevelation, popRevelation } from '../src/engine/resolution-scope.js'
import { investigatorRule } from '../src/cards/card-rules.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import {
  TCU_INVESTIGATOR_CODES, canSelectInvestigator, getAvailability, SIGNATURES_BY_INVESTIGATOR,
} from '../src/deck/availability.js'
import { buildDeck, buildDeckFromList } from '../src/deck/deckbuilding.js'
import { createHunchDeck, normalizeHunchDeckRule } from '../src/engine/hunch-deck.js'
import { createResourceBank, normalizeResourceBankRule } from '../src/engine/resource-bank.js'
import {
  actionsAvailable, consumeAction, grantSpellCredit, spellOnlyActionsOf,
} from '../src/engine/spell-actions.js'
import { manifest as investigatorPack } from '../content/packs/tcuInvestigators/manifest.js'

const FORMAL = ['05001', '05002', '05003', '05004', '05005', '05006']
const STORY = ['05046', '05047', '05048', '05049']
const SIGNATURES = {
  '05001': { cards: ['05007'], weaknesses: ['05008'] },
  '05002': { cards: ['05009'], weaknesses: ['05010'] },
  '05003': { cards: ['05011'], weaknesses: ['05012'] },
  '05004': { cards: ['05013', '05014'], weaknesses: ['05015'] },
  '05005': { cards: ['05016'], weaknesses: ['05017'] },
  '05006': { cards: ['05018'], weaknesses: ['05019'] },
}
const DECKSIZE = { '05001': 30, '05002': 40, '05003': 30, '05004': 35, '05005': 30, '05006': 30 }

// 每次事务提交后引擎会替换调查员对象，因此断言前必须重新读 state.investigators[0]。
const me = state => state.investigators[0]
const cardName = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code

// 把一次「会触发选择」的结算跑完：execute 拿到的 current 是事务里的草稿状态，必须往里写。
function runTransaction(state, execute, choose) {
  resolveTransaction(state, 0, { action: 'tcuInvestigatorTest' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 120, `Choice loop: ${state.pendingChoice.kind}`)
    const pending = state.pendingChoice
    const optionId = choose?.(pending, state)
      ?? ['done', 'skip', 'self', 'normal'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

const run = (state, fn, choose) => runTransaction(state, current => fn(current), choose)

// 用真实卡号身份替换核心对局里的调查员：能力测试不依赖具体牌组。
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

// 引擎读点的独立实例：只喂纯函数依赖，用来精确测揭示 / 洗回 / 寄存这三条规则。
const hunchEngine = createHunchDeck({
  cardDef: code => ALL_CARDS[code],
  cardName,
  info: () => {},
  newCardInstance: (state, code) => ({ id: `c${++state.instanceSeq.c}`, code }),
  randomValue: () => 0.5,
  registeredEntry,
  requestChoice: () => null,
  shuffle: list => list,
})
const bankEngine = createResourceBank({ cardName, info: () => {} })

// 走真实的「抽到弱点」通道：resolveWeakness 是弱点的唯一结算入口。
function drawWeakness(state, code, choose) {
  me(state).deck = [code]
  run(state, current => {
    executeDescriptor(current, {
      inv: current.investigators[0], source: null, events: [], context: {},
      descriptor: { code: '01037', label: '测试抽牌', resolve: ({ api }) => api.drawCards(0, 1) },
    })
  }, choose)
}

// ---------------------------------------------------------------------------
// 1. 选人与可用性
// ---------------------------------------------------------------------------

test('P6 六位正式调查员可选，序章故事调查员永不进入选人列表', () => {
  assert.equal(TCU_INVESTIGATOR_CODES.length, 6)
  for (const code of FORMAL) {
    assert.equal(canSelectInvestigator(code), true, code)
    assert.equal(getAvailability(code).availability, 'strict', code)
    assert.equal(getAvailability(code).dependencyOnly, false, code)
    assert.match(getAvailability(code).reason, /M1 万象无终/, code)
  }
  for (const code of STORY) {
    assert.equal(canSelectInvestigator(code), false, code)
    assert.equal(getAvailability(code).selectable, false, code)
    assert.equal(INVESTIGATORS[code].type, 'investigator', code)
  }
})

test('P6 十三张专属卡只作依赖可用（不计入构筑、不进入玩家卡池）', () => {
  const signatures = Object.values(SIGNATURES).flatMap(item => [...item.cards, ...item.weaknesses])
  assert.equal(signatures.length, 13)
  for (const code of signatures) {
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

test('P6 卡包清单声明：6 位正式调查员与 13 张专属卡都已实现规则', () => {
  assert.equal(investigatorPack.cards.length, 19)
  for (const card of investigatorPack.cards) {
    assert.equal(card.rulesImplemented, true, card.code)
  }
})

// ---------------------------------------------------------------------------
// 2. 牌组契约
// ---------------------------------------------------------------------------

test('P6 牌组张数、专属卡与随机基础弱点', () => {
  for (const code of FORMAL) {
    const built = buildDeck(INVESTIGATORS[code], { seed: `p6-${code}` })
    assert.equal(built.playerCards.length, DECKSIZE[code], code)
    assert.deepEqual(built.signatureCards, SIGNATURES[code].cards, code)
    assert.deepEqual(built.signatureWeaknesses, SIGNATURES[code].weaknesses, code)
    assert.equal(built.basicWeaknesses.length, 1, code)
    assert.equal(built.deck.length, DECKSIZE[code] + SIGNATURES[code].cards.length
      + SIGNATURES[code].weaknesses.length + 1, code)
    // 手动构筑同一份清单应当通过。
    const manual = buildDeckFromList(INVESTIGATORS[code], built.playerCards)
    assert.deepEqual(manual.errors, [], code)
  }
})

test('P6 乔·戴蒙德必须至少 11 张洞察事件（含悬案），自动构筑会放够配额', () => {
  const built = buildDeck(INVESTIGATORS['05002'], { seed: 'p6-joe' })
  const insights = built.deck.filter(code => (ALL_CARDS[code]?.traits || [])
    .some(trait => String(trait).toLowerCase() === 'insight') && ALL_CARDS[code]?.type === 'event')
  assert.ok(insights.length >= 11, `洞察事件 ${insights.length} 张`)
  assert.ok(built.deck.includes('05010'), '必须包含悬案')
  // 手动构筑缺洞察事件时明确失败，而不是静默通过。
  const short = buildDeckFromList(INVESTIGATORS['05002'], built.playerCards
    .filter(code => !(ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'insight')))
  assert.ok(short.errors.some(error => error.includes('直觉牌库')), short.errors.join('；'))
})

test('P6 构筑限制是排除项（卡洛琳没有高等级武器、普雷斯顿没有违法卡）', () => {
  const carolyn = buildDeck(INVESTIGATORS['05001'], { seed: 'p6-carolyn' })
  for (const code of carolyn.playerCards) {
    const card = ALL_CARDS[code]
    const weaponHigh = (card.traits || []).some(trait => String(trait).toLowerCase() === 'weapon') && (card.xp || 0) >= 1
    assert.equal(weaponHigh, false, `${code} 是高等级武器`)
  }
  const preston = buildDeck(INVESTIGATORS['05003'], { seed: 'p6-preston' })
  for (const code of preston.playerCards) {
    assert.equal((ALL_CARDS[code].traits || []).some(trait => String(trait).toLowerCase() === 'illicit'), false, code)
  }
})

// ---------------------------------------------------------------------------
// 3. 开局与存档
// ---------------------------------------------------------------------------

test('P6 开局与存档：1–4 人可开局，序列化往返一致', () => {
  for (const code of FORMAL) {
    for (const count of [1, 2, 3, 4]) {
      const state = createGameState({ playerInvestigator: code, seed: `p6-${code}-${count}` },
        Array.from({ length: count }, (_, seat) => ({ seat })))
      const inv = state.investigators[0]
      assert.equal(inv.code, code, code)
      assert.ok(inv.deck.length + inv.hand.length > 0, `${code} 有牌`)
      const restored = JSON.parse(JSON.stringify(state))
      settle(state)
      settle(restored)
      assert.deepEqual(restored, state)
    }
  }
})

// ---------------------------------------------------------------------------
// 4. 卡洛琳·弗恩（05001）
// ---------------------------------------------------------------------------

test('P6 卡洛琳：自己的卡牌效果治愈恐惧后，被治愈卡牌的控制者获得 1 资源', () => {
  const state = investigatorFixture('05001')
  me(state).horror = 2
  me(state).resources = 5
  let asked = false
  run(state, current => {
    healHorrorFrom(current, current.investigators[0], 1, [], { healerSeat: 0, cardCode: '05007' })
  }, pending => {
    if (pending.kind === 'reaction' && pending.options.some(option => option.id === 'skip')) {
      asked = true
      return pending.options.find(option => option.id !== 'skip')?.id ?? 'skip'
    }
    return null
  })
  assert.equal(asked, true, '应当询问是否触发卡洛琳的反应')
  assert.equal(me(state).horror, 1)
  assert.equal(me(state).resources, 6, '被治愈的调查员获得 1 资源')
})

test('P6 卡洛琳：别人的卡牌效果治愈恐惧时不给资源', () => {
  const state = investigatorFixture('05001')
  me(state).horror = 2
  me(state).resources = 5
  let asked = false
  run(state, current => {
    healHorrorFrom(current, current.investigators[0], 1, [], { healerSeat: 1, cardCode: '01037' })
  }, pending => {
    if (pending.kind === 'reaction') { asked = true; return 'skip' }
    return null
  })
  assert.equal(asked, false)
  assert.equal(me(state).resources, 5)
})

test('P6 卡洛琳：理性思考在场时恐惧被它吸收，且不能从反应获得资源', () => {
  const state = investigatorFixture('05001')
  me(state).horror = 0
  me(state).threat = [{ id: 'rt', code: '05008', counters: 4 }]
  me(state).resources = 5
  run(state, current => {
    healHorrorFrom(current, current.investigators[0], 1, [], { healerSeat: 0, cardCode: '05007' })
  }, pending => (pending.kind === 'reaction' ? pending.options.find(option => option.id !== 'skip')?.id ?? null : null))
  assert.equal(me(state).threat[0].counters, 3, '理性思考上的恐惧被治愈')
  assert.equal(me(state).horror, 0)
  assert.equal(me(state).resources, 5, '不能从卡洛琳的反应获得资源')
})

test('P6 卡洛琳旧印：+1 并可治愈 1 点恐惧', () => {
  const state = investigatorFixture('05001')
  me(state).horror = 2
  state.chaosBag = ['eldersign']
  const execute = current => performTest(current, 0, 'willpower', 4, {
    resolve: value => { current.testResult = value },
  })
  runTransaction(state, execute, pending => {
    if (pending.kind === 'target' && pending.options.some(option => option.id.startsWith('i:'))) return 'i:0'
    return null
  })
  assert.equal(state.testResult.success, true)
  assert.equal(me(state).horror, 1, '旧印治愈了 1 点恐惧')
})

test('P6 卡洛琳专属弱点：理性思考入场带 4 点恐惧', () => {
  const state = investigatorFixture('05001')
  drawWeakness(state, '05008', pending => {
    if (pending.kind === 'reaction') return 'skip'
    return null
  })
  const threat = me(state).threat.find(card => card.code === '05008')
  assert.ok(threat, '理性思考进入威胁区域')
  assert.equal(threat.counters, 4)
})

// ---------------------------------------------------------------------------
// 5. 乔·戴蒙德（05002）
// ---------------------------------------------------------------------------

test('P6 乔：冒险设置抽出 11 张洞察事件（含悬案）', () => {
  const state = createGameState({ playerInvestigator: '05002', seed: 'p6-joe-setup' }, [{ seat: 0 }])
  // 设置期间的「从牌库挑 11 张洞察事件」是一个待决选择（与重调同层），先结算它。
  settle(state)
  const inv = me(state)
  // 调查阶段开始时已经揭示了牌库顶（R7 起揭示牌不进手牌，只记 hunchRevealed），所以「直觉牌库总张数」要把揭示的算回来。
  const pool = [...inv.hunchDeck, ...(inv.hunchRevealed ? [inv.hunchRevealed] : [])]
  assert.equal(pool.length, 11)
  for (const code of pool) {
    assert.equal(ALL_CARDS[code].type, 'event', code)
    assert.ok((ALL_CARDS[code].traits || []).some(trait => trait.toLowerCase() === 'insight'), code)
  }
  assert.equal(pool.includes('05010'), true, '直觉牌库必须包含悬案')
  assert.equal(inv.deck.includes('05010'), false, '悬案从牌库移到直觉牌库')
  assert.equal(normalizeHunchDeckRule(investigatorRule('05002').hunchDeck).size, 11)
})

test('P6 乔：调查阶段开始揭示牌库顶，阶段结束洗回；悬案改为进入威胁区域', () => {
  const state = investigatorFixture('05002')
  const inv = me(state)
  inv.hunchDeck = ['01036', '01037']
  inv.hand = []
  inv.hunchRevealed = null
  run(state, current => hunchEngine.revealHunchCard(current, current.investigators[0], []))
  assert.equal(me(state).hunchRevealed, '01037')
  assert.equal(me(state).hand.includes('01037'), false, '揭示牌不进手牌（R7：只记 inv.hunchRevealed）')
  assert.equal(me(state).hunchDeck.length, 1)
  run(state, current => hunchEngine.returnHunchCard(current, current.investigators[0], []))
  assert.equal(me(state).hunchRevealed, null)
  assert.equal(me(state).hand.includes('01037'), false)
  assert.equal(me(state).hunchDeck.includes('01037'), true, '未打出则洗回直觉牌库')

  // 悬案：本应洗回时改为进入威胁区域。
  const unsolved = investigatorFixture('05002')
  unsolved.investigators[0].hunchDeck = ['05010']
  unsolved.investigators[0].hand = []
  unsolved.investigators[0].hunchRevealed = null
  run(unsolved, current => hunchEngine.revealHunchCard(current, current.investigators[0], []))
  run(unsolved, current => hunchEngine.returnHunchCard(current, current.investigators[0], []))
  assert.equal(me(unsolved).hunchDeck.includes('05010'), false)
  assert.equal(me(unsolved).threat.some(card => card.code === '05010'), true)
})

test('R7 05002：hunch 揭示牌可从直觉牌库打出（-2 费、清标记、正常弃置）', () => {
  const state = investigatorFixture('05002')
  const inv = me(state)
  inv.hand = []
  inv.hunchDeck = []
  inv.hunchRevealed = '02105'
  inv.resources = 10
  inv.damage = 2
  const playMove = legalMoves(state).find(option => option.action === 'play'
    && option.cardId === '02105' && option.fromHunch === true)
  assert.ok(playMove, '揭示牌应提供 fromHunch 打出候选（-2 费）')
  move(state, playMove)
  settle(state, pending => (pending.kind === 'target' ? pending.options[0].id : null))
  const after = me(state)
  assert.equal(after.resources, 10, '费用 2 - 2 = 0')
  assert.equal(after.hunchRevealed ?? null, null, '打出后清掉 hunchRevealed')
  assert.equal(after.hand.includes('02105'), false, '不留在手牌')
  assert.ok(after.discard.includes('02105'), '打出后按普通事件进弃牌堆')
  assert.equal(after.damage, 0, '事件正常结算（治愈 2 点伤害）')
})

test('R7 05002：手中同名另一张按普通价打出，不吃 hunch 折扣、不误清揭示标记', () => {
  const state = investigatorFixture('05002')
  const inv = me(state)
  inv.hand = ['02105']
  inv.hunchDeck = []
  inv.hunchRevealed = '02105'
  inv.resources = 10
  inv.damage = 2
  assert.equal(playCost(state, me(state), ALL_CARDS['02105']), 2, 'playCost 不再按卡号给 hunch 折扣')
  const plays = legalMoves(state).filter(option => option.action === 'play' && option.cardId === '02105')
  const hunchMove = plays.find(option => option.fromHunch === true)
  const handMove = plays.find(option => !option.fromHunch)
  assert.ok(hunchMove, '揭示副本仍提供 fromHunch 候选（与手牌同名牌并存）')
  assert.ok(handMove, '手牌同名另一张按普通价单独列出')
  move(state, handMove)
  settle(state, pending => (pending.kind === 'target' ? pending.options[0].id : null))
  assert.equal(me(state).resources, 8, '手牌那张按印刷费用 2 支付（无 -2）')
  assert.equal(me(state).hunchRevealed, '02105', '同名手牌打出不会误清 hunchRevealed')
})

test('P6 乔旧印：+1，并把弃牌堆的一张洞察事件放到直觉牌库底', () => {
  const state = investigatorFixture('05002')
  me(state).discard = ['01037', '01088']
  me(state).hunchDeck = ['01036']
  state.chaosBag = ['eldersign']
  const execute = current => performTest(current, 0, 'intellect', 3, {
    resolve: value => { current.testResult = value },
  })
  runTransaction(state, execute, pending => {
    if (pending.kind === 'card' && pending.options.some(option => option.id === '0')) return '0'
    return null
  })
  assert.equal(me(state).hunchDeck.at(-1), '01037')
  assert.equal(me(state).discard.includes('01037'), false)
})

test('P6 乔专属武器：花费 1 子弹攻击（战斗 +1，伤害 +1）', () => {
  const state = investigatorFixture('05002')
  me(state).assets = [{ id: 'colt', code: '05009', exhausted: false, uses: 4, usesType: 'ammo' }]
  const target = enemy(state, { id: 'joe-target', fight: 1, evade: 1, health: 6 })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: 'colt', abilityIndex: 0, targetId: target.id })
  settle(state)
  const after = me(state).assets.find(asset => asset.id === 'colt')
  assert.equal(after.uses, 3, '消耗 1 子弹')
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2, '基础 1 + 武器 1')
})

// ---------------------------------------------------------------------------
// 6. 普雷斯顿·费尔蒙特（05003）
// ---------------------------------------------------------------------------

test('P6 普雷斯顿：家族遗产开局入场，卡牌效果获得的资源寄存', () => {
  const state = createGameState({ playerInvestigator: '05003', seed: 'p6-preston' }, [{ seat: 0 }])
  settle(state)
  const inv = me(state)
  const family = inv.assets.find(asset => asset.code === '05011')
  assert.ok(family, '家族遗产是永久卡，开局即在场上')
  assert.equal(normalizeResourceBankRule(investigatorRule('05003').resourceBank).perTurn, 4)
  family.resources = 0
  const before = inv.resources
  run(state, current => {
    executeDescriptor(current, {
      inv: current.investigators[0], source: null, events: [], context: {},
      descriptor: { code: '01016', label: '测试获得资源', resolve: ({ api }) => api.gainResources(0, 3) },
    })
  })
  assert.equal(me(state).resources, before + 3)
  assert.equal(me(state).assets.find(asset => asset.code === '05011').resources, 3, '资源寄存到家族遗产')
})

test('P6 普雷斯顿：回合开始放 4 资源，支付先扣寄存部分，回合结束弃掉剩下的寄存', () => {
  const bank = bankEngine
  const state = investigatorFixture('05003')
  const inv = me(state)
  inv.assets = [{ id: 'family', code: '05011', exhausted: false }]
  inv.resources = 6
  bank.beginTurn(state, inv, [])
  assert.equal(inv.resources, 10)
  assert.equal(bank.bankedOf(inv), 4)
  assert.equal(bank.projection(inv).banked, 4)
  // 花掉 2 点：走统一支付入口，先扣寄存标记；回合结束时只剩 2 点寄存被弃回。
  bank.spendResources(state, inv, 2, [])
  assert.equal(inv.resources, 8)
  assert.equal(bank.bankedOf(inv), 2, '支付先扣家族遗产上的寄存资源')
  bank.endTurn(state, inv, [])
  assert.equal(inv.resources, 6)
  assert.equal(bank.bankedOf(inv), 0)
  // [action]：把寄存的资源转成永久资源。
  inv.assets[0].resources = 0
  assert.equal(bank.withdrawAll(state, inv, []), 0)
})

test('P6 普雷斯顿：普通支付（打牌）先扣家族遗产上的寄存资源，回合结束不再重复流失', () => {
  const state = fixture('01001')
  const inv = me(state)
  const card = ALL_CARDS['05003']
  Object.assign(inv, {
    code: '05003', name: card.nameZh, nameEn: card.name, klass: card.klass,
    willpower: card.willpower, intellect: card.intellect, combat: card.combat, agility: card.agility,
    baseHealth: card.health, baseSanity: card.sanity, health: card.health, sanity: card.sanity,
  })
  // 模拟「回合已开始」：自己的 2 点 + 家族遗产上的寄存 4 点。
  inv.assets = [{ id: 'family', code: '05011', exhausted: false, resources: 4 }]
  inv.resources = 6
  inv.hand = ['01087'] // 手电筒，费用 2
  move(state, { action: 'play', cardId: '01087' })
  settle(state)
  const after = me(state)
  const family = after.assets.find(asset => asset.code === '05011')
  assert.equal(after.resources, 4, '资源池 6 → 4')
  assert.equal(family.resources, 2, '先扣家族遗产上的寄存资源，而不是留到回合末白弃')
  bankEngine.endTurn(state, after, [])
  assert.equal(me(state).resources, 2, '自己的 2 点保留；剩下 2 点寄存被弃')
  assert.equal(me(state).assets.find(asset => asset.code === '05011')?.resources ?? 0, 0)
})

test('P6 普雷斯顿：能力层费用（payAbilityCost）同样先扣寄存资源', () => {
  const state = investigatorFixture('05003')
  const inv = me(state)
  inv.assets = [{ id: 'family', code: '05011', exhausted: false, resources: 4 }]
  inv.resources = 6
  assert.equal(payAbilityCost(state, inv, null, { resources: 2 }, []), true)
  assert.equal(inv.resources, 4)
  assert.equal(inv.assets[0].resources, 2, '能力费用也先扣寄存资源')
})

test('P6 普雷斯顿旧印：+0，可花 2 资源改为自动成功', () => {
  const state = investigatorFixture('05003')
  me(state).resources = 5
  state.chaosBag = ['eldersign']
  const execute = current => performTest(current, 0, 'willpower', 6, {
    resolve: value => { current.testResult = value },
  })
  runTransaction(state, execute, pending => {
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'pay')) return 'pay'
    return null
  })
  assert.equal(state.testResult.success, true, '花 2 资源后自动成功')
  assert.equal(me(state).resources, 3)
})

// ---------------------------------------------------------------------------
// 7. 黛安娜·史丹利（05004）
// ---------------------------------------------------------------------------

test('P6 黛安娜：底下每有一张卡牌 +1 意志；旧印可把一张底下卡牌加入手牌', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.beneath = []
  const base = getStat(state, inv, 'willpower')
  // 两张不同卡号：验证「加入手牌的是所选的那张」而不是 splice 后的下一张（选末张时曾为 undefined）。
  me(state).beneath = ['01088', '01037']
  assert.equal(getStat(state, me(state), 'willpower'), base + 2)
  state.chaosBag = ['eldersign']
  const execute = current => performTest(current, 0, 'willpower', 3, {
    resolve: value => { current.testResult = value },
  })
  runTransaction(state, execute, pending => {
    if (pending.kind === 'beneath' && pending.options.some(option => option.id === '1')) return '1'
    return null
  })
  const after = me(state)
  assert.deepEqual(after.beneath, ['01088'], '从底下移除所选的那张')
  assert.equal(after.hand.includes('01037'), true, '加入手牌的是所选的卡牌')
  assert.equal(after.hand.includes('01088'), false, '不会错拿下一张')
})

test('P6 黛安娜：自己的卡牌取消效果后，把那张卡压在底下并抽 1 张、获得 1 资源', () => {
  const state = investigatorFixture('05004')
  me(state).beneath = []
  me(state).hand = []
  me(state).deck = ['01088', '01088']
  me(state).resources = 5
  run(state, current => {
    // 模拟「一张自己的卡取消了一项效果」：executeDescriptor 会记录正在结算的卡号。
    executeDescriptor(current, {
      inv: current.investigators[0], source: null, events: [], context: {},
      descriptor: {
        code: '05014', label: '黑暗洞察（测试）',
        resolve: () => reactionWindow(current, 'cardCancelled', {
          when: 'cardCancelled', seat: 0, cardSeat: 0,
          location: current.investigators[0].location, cardCode: '05014',
        }, []),
      },
    })
  }, pending => (pending.kind === 'reaction' ? pending.options.find(option => option.id !== 'skip')?.id ?? null : null))
  assert.deepEqual(me(state).beneath, ['05014'], '取消方那张卡压在黛安娜底下')
  assert.equal(me(state).hand.length, 1, '抽 1 张牌')
  assert.equal(me(state).resources, 6, '获得 1 资源')
})

test('P6 黛安娜：守护结界取消遭遇后只压到底下，不再同时留在弃牌堆', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.hand = ['02307']
  inv.beneath = []
  inv.deck = ['01088', '01088']
  state.encounterDeck = ['dissonantVoices']
  state.chaosBag = ['0']
  move(state, { action: 'endTurn' })
  settle(state, pending => {
    const ward = pending.options.find(option => option.cardCode === '02307')
    if (ward) return ward.id
    const diana = pending.options.find(option => String(option.id).includes('diana'))
    if (diana) return diana.id
    return null
  })
  const after = me(state)
  assert.deepEqual(after.beneath, ['02307'], '只放进底下一次')
  assert.equal(after.discard.includes('02307'), false, '同一张卡不能再留在弃牌堆')
  assert.equal(after.hand.includes('02307'), false)
})

test('P6 黛安娜：别的调查员的卡取消效果时不触发；底下已有 5 张时也不触发', () => {
  const other = investigatorFixture('05004')
  me(other).beneath = []
  let otherAsked = false
  run(other, current => {
    reactionWindow(current, 'cardCancelled', {
      when: 'cardCancelled', seat: 1, cardSeat: 1, location: current.investigators[0].location, cardCode: '01023',
    }, [])
  }, pending => {
    if (pending.kind === 'reaction' && pending.options.some(option => option.cardCode === '05004')) otherAsked = true
    return null
  })
  assert.equal(otherAsked, false)
  assert.deepEqual(me(other).beneath, [])

  const full = investigatorFixture('05004')
  full.investigators[0].beneath = ['01088', '01088', '01088', '01088', '01088']
  let fullAsked = false
  run(full, current => {
    executeDescriptor(current, {
      inv: current.investigators[0], source: null, events: [], context: {},
      descriptor: {
        code: '05014', label: '黑暗洞察（测试）',
        resolve: () => reactionWindow(current, 'cardCancelled', {
          when: 'cardCancelled', seat: 0, cardSeat: 0,
          location: current.investigators[0].location, cardCode: '05014',
        }, []),
      },
    })
  }, pending => {
    if (pending.kind === 'reaction' && pending.options.some(option => option.cardCode === '05004')) fullAsked = true
    return null
  })
  assert.equal(fullAsked, false)
})

test('P6 黛安娜专属弱点：底下有卡牌时，每张弃掉或承受 1 点恐惧', () => {
  const state = investigatorFixture('05004')
  me(state).beneath = ['01036']
  me(state).horror = 0
  drawWeakness(state, '05015', pending => (pending.kind === 'discard' ? 'horror' : null))
  assert.equal(me(state).horror >= 1, true)
  assert.deepEqual(me(state).beneath, ['01036'])
})

// ---------------------------------------------------------------------------
// 8. 丽塔·杨（05005）
// ---------------------------------------------------------------------------

test('P6 丽塔：躲避后可以对敌人造成 1 点伤害（每轮一次）', () => {
  const state = investigatorFixture('05005')
  const first = enemy(state, { id: 'rita-target', fight: 1, evade: 1, health: 4 })
  state.chaosBag = ['0']
  let offers = 0
  const choose = pending => {
    if (pending.kind === 'reaction') {
      const ability = pending.options.find(option => String(option.id).startsWith('desc:ritaEvadeReaction'))
      if (ability) { offers++; return ability.id }
    }
    // 能力内部的目标选择「造成 1 点伤害 / 移动到连接地点」。
    const damage = pending.options.find(option => option.id === 'damage')
    if (damage) return 'damage'
    return null
  }
  move(state, { action: 'evade', enemyId: 'rita-target' })
  settle(state, choose)
  assert.equal(offers, 1)
  assert.equal(state.enemies.find(item => item.id === first.id)?.damageTaken, 1)

  // 同一轮再躲避一个敌人：反应已用过，不再询问。
  const second = enemy(state, { id: 'rita-second', fight: 1, evade: 1, health: 4 })
  move(state, { action: 'evade', enemyId: second.id })
  settle(state, choose)
  assert.equal(offers, 1, '每轮只询问一次')

  // 旧印放开本轮的限制（走条目接线：elderSign.resolve → api.ignoreLimitForRound）：
  // 换一个仍然交战的新敌人再躲一次。
  const elderSign = registeredEntry('05005').elderSign
  const elderResult = elderSign.resolve({
    state, inv: me(state),
    api: { info() {}, ignoreLimitForRound: id => ignoreLimitForRound(state, id) },
  })
  assert.equal(elderResult?.delta, 2, '旧印仍给 +2')
  assert.equal(limitIgnored(state, { id: 'ritaEvadeReaction' }), true, '本轮忽略反应上限')
  const third = enemy(state, { id: 'rita-third', fight: 1, evade: 1, health: 4 })
  move(state, { action: 'evade', enemyId: third.id })
  settle(state, choose)
  assert.equal(offers, 2, '旧印后再次询问')
  // 同一触发窗口内不会重复结算：第三次躲避只询问一次。
  assert.equal(me(state).ritaEvadeRound, undefined, '不再写单卡私有字段')
})

test('P6 丽塔专属事件：重整并交战此地点的所有敌人', () => {
  const state = investigatorFixture('05005')
  const nearby = enemy(state, { id: 'rita-nearby', exhausted: true, engagedSeat: null })
  me(state).hand = ['05016']
  move(state, { action: 'play', cardId: '05016' })
  settle(state, pending => (pending.kind === 'discard' ? 'skip' : null))
  const after = state.enemies.find(item => item.id === nearby.id)
  assert.equal(after.exhausted, false, '敌人重整')
  assert.equal(after.engagedSeat, 0, '敌人与丽塔交战')
  assert.equal(state.investigators[0].evadeDamageInsteadRound, state.round)
})

// ---------------------------------------------------------------------------
// 9. 玛丽·朗博（05006）
// ---------------------------------------------------------------------------

test('P6 玛丽：控制卡牌上有毁灭标记时获得只能用于法术的额外行动', () => {
  const state = investigatorFixture('05006')
  state.turnSerial = 3
  const inv = me(state)
  inv.assets = [{ id: 'doom-asset', code: '01088', exhausted: false, doom: 1 }]
  inv.actionsLeft = 3
  delete inv.spellOnlyActions
  delete inv.spellCreditTurn
  assert.equal(grantSpellCredit(state, inv, { info: () => {} }), true)
  assert.equal(me(state).actionsLeft, 4)
  assert.equal(spellOnlyActionsOf(me(state)), 1)
  assert.equal(actionsAvailable(me(state), false), 3, '普通行动只能用 3 个')
  assert.equal(actionsAvailable(me(state), true), 4)
  // 同一回合不重复授权。
  assert.equal(grantSpellCredit(state, me(state), { info: () => {} }), false)
  // 花掉 3 个普通行动后只剩法术额度：普通行动被拒绝，法术行动仍可花。
  consumeAction(me(state), 3, false)
  assert.equal(actionsAvailable(me(state), false), 0)
  assert.equal(actionsAvailable(me(state), true), 1)
})

test('fix 05006 法术额度：先花法术专用行动后普通可用行动数正确（不残留额外行动）', () => {
  const state = investigatorFixture('05006')
  state.turnSerial = 7
  const inv = me(state)
  inv.assets = [{ id: 'doom-asset', code: '01088', exhausted: false, doom: 1 }]
  inv.actionsLeft = 3
  delete inv.spellOnlyActions
  delete inv.spellCreditTurn
  assert.equal(grantSpellCredit(state, inv, { info: () => {} }), true)
  assert.equal(actionsAvailable(me(state), false), 3)
  assert.equal(actionsAvailable(me(state), true), 4)
  // 先花掉法术专用行动：总额与额度同步减少，不会残留 1 个额外行动（审计第三轮发现的算术 bug）。
  consumeAction(me(state), 1, true)
  assert.equal(me(state).actionsLeft, 3, '法术额度应从总行动数里扣除')
  assert.equal(actionsAvailable(me(state), false), 3, '普通可用行动 = 3（3 普通 + 1 法术 = 4 行动）')
  assert.equal(actionsAvailable(me(state), true), 3)
  consumeAction(me(state), 3, false)
  assert.equal(actionsAvailable(me(state), false), 0)
})

test('P6 玛丽：只剩法术额度时普通行动被拒绝（validateMove 与 legalMoves 同一口径）', () => {
  const state = investigatorFixture('05006')
  const inv = me(state)
  inv.actionsLeft = 1
  inv.spellOnlyActions = 1
  inv.assets = []
  const denied = validateMove(state, 0, { action: 'resource' })
  assert.equal(denied, '行动点不足（额外行动只能用于探索或法术）')
  assert.equal(legalMoves(state).some(moveOption => moveOption.action === 'resource'), false)
  // 手里有一张 0 费法术事件时，法术行动仍然可以花掉这个额度。
  inv.hand = ['02267']
  const spell = { action: 'play', cardId: '02267' }
  assert.equal(isSpellAction(state, me(state), spell), true)
  assert.equal(validateMove(state, 0, spell), null)
})

test('P6 玛丽：没有毁灭标记时没有额外行动', () => {
  const state = investigatorFixture('05006')
  state.turnSerial = 5
  const inv = me(state)
  inv.assets = [{ id: 'bare-asset', code: '01088', exhausted: false }]
  inv.actionsLeft = 3
  delete inv.spellOnlyActions
  delete inv.spellCreditTurn
  assert.equal(grantSpellCredit(state, inv, { info: () => {} }), false)
  assert.equal(me(state).actionsLeft, 3)
})

test('P6 玛丽旧印：+1，并可在控制的卡牌上增减 1 个毁灭标记', () => {
  const state = investigatorFixture('05006')
  me(state).assets = [{ id: 'spell-asset', code: '01088', exhausted: false, doom: 1 }]
  state.chaosBag = ['eldersign']
  const execute = current => performTest(current, 0, 'willpower', 3, {
    resolve: value => { current.testResult = value },
  })
  runTransaction(state, execute, pending => {
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'add:0')) return 'add:0'
    return null
  })
  assert.equal(me(state).assets[0].doom, 2)
})

// ---------------------------------------------------------------------------
// 10. 序章故事调查员（05046–05049）
// ---------------------------------------------------------------------------

test('P6 故事调查员：四条条目都登记为调查员，且不在调查员卡包里', () => {
  for (const code of STORY) {
    const entry = registeredEntry(code)
    assert.ok(entry, code)
    assert.equal(entry.kind, 'investigator', code)
    assert.ok(investigatorRule(code).elderSign, code)
    assert.equal(investigatorPack.cards.some(card => card.code === code), false, code)
  }
})

test('P6 故事调查员旧印：加弗瑞拉治愈伤害与恐惧、瓦伦蒂诺获得资源', () => {
  const gavriella = investigatorFixture('05046')
  me(gavriella).damage = 2
  me(gavriella).horror = 2
  gavriella.chaosBag = ['eldersign']
  runTransaction(gavriella, current => performTest(current, 0, 'combat', 3, {
    resolve: value => { current.testResult = value },
  }), () => null)
  assert.equal(me(gavriella).damage, 1)
  assert.equal(me(gavriella).horror, 1)

  const valentino = investigatorFixture('05048')
  me(valentino).resources = 0
  valentino.chaosBag = ['eldersign']
  runTransaction(valentino, current => performTest(current, 0, 'agility', 3, {
    resolve: value => { current.testResult = value },
  }), () => null)
  assert.equal(me(valentino).resources, 2)
})

test('P6 故事调查员：减弱检定难度的能力（瓦伦蒂诺）', () => {
  const state = investigatorFixture('05048')
  me(state).resources = 5
  state.chaosBag = ['0']
  let reduced = false
  // 意志 1 + 标记 0 = 1；难度 2 只有在「难度 -1」之后才会成功。
  const execute = current => performTest(current, 0, 'willpower', 2, {
    resolve: value => { current.testResult = value },
  })
  runTransaction(state, execute, pending => {
    // player-window-fast-actions：调查员自身的 [free] 描述子现在以 playerWindow 选项出现。
    if (pending.kind === 'playerWindow'
      && pending.options.some(option => String(option.id).startsWith('free-descriptor:05048:'))) {
      reduced = true
      return pending.options.find(option => String(option.id).startsWith('free-descriptor:05048:')).id
    }
    return null
  })
  assert.equal(reduced, true, '应当提供「难度 -1」的能力')
  assert.equal(state.testResult.success, true, '难度 2 -1 = 1，标记 0 刚好成功')
  assert.equal(me(state).resources, 3)
})

// ---------------------------------------------------------------------------
// 11. task-22 / task-30 修复回归（调查员与专属卡）
// ---------------------------------------------------------------------------

test('fix 05010 悬案：直觉牌库揭示时作为弱点事件打出，放线索到最高隐藏值地点并移出游戏', () => {
  const state = investigatorFixture('05002')
  const inv = me(state)
  // 真实流程：揭示牌不进手牌，只记 inv.hunchRevealed（旧测试靠 hand 兜底，掩盖了 fromHunch 通道
  // 用 !isWeaknessCard 一刀切、弱点事件打不出的问题）。
  inv.hand = []
  inv.hunchRevealed = '05010'
  inv.clues = 2
  inv.resources = 10
  inv.discard = []
  state.removedFromGame = []
  const numeric = state.locations.filter(location => typeof location.shroud === 'number')
  const maxShroud = Math.max(...numeric.map(location => location.shroud || 0))
  const candidates = numeric.filter(location => (location.shroud || 0) === maxShroud)
  const before = Object.fromEntries(state.locations.map(location => [location.id, location.clues || 0]))
  const playMove = legalMoves(state).find(moveOption => moveOption.action === 'play'
    && moveOption.cardId === '05010' && moveOption.fromHunch === true)
  assert.ok(playMove, '悬案应当能从直觉牌库揭示通道打出（playableWeakness 放行弱点事件）')
  move(state, playMove)
  settle(state, pending => (pending.kind === 'location' ? pending.options[0].id : null))
  const after = me(state)
  assert.equal(after.resources, 8, '揭示窗口 -2 费用：4 - 2 = 2')
  assert.ok((state.removedFromGame || []).includes('05010'), '打出后移出游戏（removeAfterPlay）')
  assert.equal((after.discard || []).includes('05010'), false, '不进入弃牌堆')
  assert.equal(after.hunchRevealed ?? null, null, '打出后清掉直觉牌库揭示标记（避免阶段末重复洗回）')
  assert.equal(after.clues, 1, '消耗 1 个线索')
  const placed = candidates.some(location =>
    (state.locations.find(item => item.id === location.id)?.clues || 0) === (before[location.id] || 0) + 1)
  assert.equal(placed, true, '1 个线索放到隐藏值最高的地点之一')
})

test('fix 05010 悬案：在威胁区也能打出（playableFromThreat），放线索并移出游戏', () => {
  const state = investigatorFixture('05002')
  const inv = me(state)
  inv.hand = []
  inv.hunchRevealed = null
  inv.threat = [{ id: 'threat-05010', code: '05010' }]
  inv.clues = 2
  inv.resources = 10
  inv.discard = []
  state.removedFromGame = []
  const numeric = state.locations.filter(location => typeof location.shroud === 'number')
  const maxShroud = Math.max(...numeric.map(location => location.shroud || 0))
  const candidates = numeric.filter(location => (location.shroud || 0) === maxShroud)
  const before = Object.fromEntries(state.locations.map(location => [location.id, location.clues || 0]))
  const playMove = legalMoves(state).find(moveOption => moveOption.action === 'play'
    && moveOption.cardId === '05010' && moveOption.threatId === 'threat-05010')
  assert.ok(playMove, '威胁区里的悬案应当可以打出（条目级 playableFromThreat）')
  move(state, playMove)
  settle(state, pending => (pending.kind === 'location' ? pending.options[0].id : null))
  const after = me(state)
  assert.equal(after.resources, 6, '威胁区打出按印刷费用 4 支付（没有揭示窗口的 -2 折扣）')
  assert.equal((after.threat || []).some(card => card.code === '05010'), false, '打出后离开威胁区')
  assert.ok((state.removedFromGame || []).includes('05010'), '打出后移出游戏（removeAfterPlay）')
  assert.equal((after.discard || []).includes('05010'), false, '不进入弃牌堆')
  assert.equal(after.clues, 1, '消耗 1 个线索')
  const placed = candidates.some(location =>
    (state.locations.find(item => item.id === location.id)?.clues || 0) === (before[location.id] || 0) + 1)
  assert.equal(placed, true, '1 个线索放到隐藏值最高的地点之一')
})

test('task-22 05013 银暮匕首：攻击可以选择战斗或意志（原先固定用意志）', () => {
  const build = () => {
    const state = investigatorFixture('05004')
    const inv = me(state)
    inv.assets = [{ id: 'blade', code: '05013', exhausted: false }]
    const target = enemy(state, { id: 'blade-enemy', fight: 3, evade: 3, health: 6, damage: 0, horror: 0, engagedSeat: 0 })
    target.engagedSeat = 0
    state.chaosBag = ['0']
    inv.actionsLeft = 5
    return state
  }
  // 选「战斗」：黛安娜战斗 3 + 标记 0 = 3 ≥ 攻击值 3 → 命中。
  {
    const state = build()
    const ability = legalMoves(state).find(moveOption =>
      moveOption.action === 'ability' && moveOption.assetId === 'blade' && moveOption.targetId)
    assert.ok(ability, '银暮匕首应当有可选目标的攻击行动')
    let asked = false
    move(state, ability)
    settle(state, pending => {
      if (pending.kind === 'effect' && pending.options.some(option => option.id === 'combat')) {
        asked = true
        return 'combat'
      }
      return null
    })
    assert.equal(asked, true, '应当询问使用战斗还是意志')
    assert.equal(state.enemies.find(item => item.id === 'blade-enemy')?.damageTaken, 1, '战斗命中造成 1 点伤害')
  }
  // 选「意志」：意志 1 + 标记 0 = 1 < 3 → 未命中（验证技能真的按选择结算）。
  {
    const state = build()
    const ability = legalMoves(state).find(moveOption =>
      moveOption.action === 'ability' && moveOption.assetId === 'blade' && moveOption.targetId)
    move(state, ability)
    settle(state, pending => {
      if (pending.kind === 'effect' && pending.options.some(option => option.id === 'willpower')) return 'willpower'
      return null
    })
    assert.equal(state.enemies.find(item => item.id === 'blade-enemy')?.damageTaken || 0, 0, '意志低于攻击值时不命中')
  }
})

test('R7 05019 安息日男爵：显现后进入支援区（doom=0，不占威胁区）', () => {
  const state = investigatorFixture('05006')
  const inv = me(state)
  inv.assets = []
  inv.threat = []
  drawWeakness(state, '05019', pending => (pending.kind === 'reaction' ? 'skip' : null))
  const after = me(state)
  const baron = after.assets.find(card => card.code === '05019')
  assert.ok(baron, '弱点资产作为真实支援进入支援区')
  assert.equal(baron.doom || 0, 0, '入场没有毁灭标记')
  assert.equal((after.threat || []).some(card => card.code === '05019'), false, '不进入威胁区域')
})

test('R7 05019 安息日男爵：少于 3 个毁灭标记时离场被拒', () => {
  const state = investigatorFixture('05006')
  const inv = me(state)
  inv.assets = [{ id: 'baron', code: '05019', doom: 0, exhausted: false }]
  inv.threat = []
  inv.discard = []
  run(state, current => {
    const owner = current.investigators[0]
    const asset = owner.assets.find(card => card.code === '05019')
    executeDescriptor(current, {
      inv: owner, source: null, events: [], context: {},
      descriptor: { code: '01037', label: '测试弃置支援', resolve: ({ api }) => api.discardAsset(0, asset) },
    })
  })
  const after = me(state)
  assert.ok(after.assets.some(card => card.code === '05019'), '少于 3 毁灭时支援仍在场（离场被拒）')
  assert.ok((state.log || []).some(line => String(line).includes('当前不能离场')), '给出「不能离场」日志')
})

test('R7 05019 安息日男爵：3 个毁灭标记后弃掉（真实离场）', () => {
  const state = investigatorFixture('05006')
  const inv = me(state)
  inv.assets = [{ id: 'baron', code: '05019', doom: 2, exhausted: false }]
  inv.threat = []
  inv.discard = []
  inv.actionsLeft = 5
  let used = false
  runTransaction(state, current => playerWindow(current, 'test.beforeCommit', []), pending => {
    if (pending.kind !== 'playerWindow') return null
    const option = pending.options.find(item => String(item.label || '').includes('安息日男爵'))
    if (option) { used = true; return option.id }
    return null
  })
  assert.equal(used, true, '[fast] 能力出现在玩家窗口')
  const after = me(state)
  assert.equal(after.assets.some(card => card.code === '05019'), false, '3 个毁灭后弃掉（从支援区移除）')
  assert.ok((after.discard || []).includes('05019'), '进入弃牌堆')
})

test('R7 05019 安息日男爵：同地点调查员受到伤害时额外 +1 点', () => {
  const state = investigatorFixture('05006')
  const inv = me(state)
  inv.assets = [{ id: 'baron', code: '05019', doom: 0, exhausted: false }]
  inv.threat = []
  inv.damage = 0
  runTransaction(state, current => applyDamage(current, current.investigators[0], 1, []), null)
  assert.equal(me(state).damage, 2, '基础 1 点 + 男爵强制额外 1 点')
})
test('task-22 05007 催眠疗法：治疗盟友恐惧不触发额外治疗；[action] 无恐惧也能让目标抽牌', () => {
  // 反应目标收窄：治疗盟友支援时不触发。
  const state = investigatorFixture('05001')
  const inv = me(state)
  inv.assets = [
    { id: 'hyp', code: '05007', exhausted: false },
    { id: 'ally1', code: '01021', horror: 1, damage: 0 },
  ]
  inv.horror = 2
  let offered = false
  runTransaction(state, current => {
    healHorrorFrom(current, current.investigators[0].assets.find(asset => asset.code === '01021'), 1, [], {
      owner: current.investigators[0], cardCode: '01019',
    })
  }, pending => {
    if (pending.kind === 'reaction' && pending.options.some(option => option.cardCode === '05007')) offered = true
    return null
  })
  assert.equal(offered, false, '治疗盟友支援的恐惧不应触发催眠疗法')
  assert.equal(me(state).horror, 2, '不会额外治疗调查员')

  // [action]：所在地点没有恐惧时仍选目标并让目标抽 1 张。
  const state2 = investigatorFixture('05001')
  const inv2 = me(state2)
  inv2.assets = [{ id: 'hyp2', code: '05007', exhausted: false }]
  inv2.horror = 0
  state2.chaosBag = ['0']
  const handBefore = (inv2.hand || []).length
  const actionMove = legalMoves(state2).find(moveOption => moveOption.action === 'ability' && moveOption.assetId === 'hyp2')
  assert.ok(actionMove, '催眠疗法的行动应当可用')
  move(state2, actionMove)
  let drawOffered = false
  settle(state2, pending => {
    if (pending.kind === 'reaction' && pending.options.some(option => option.id === 'draw')) {
      drawOffered = true
      return 'draw'
    }
    return null
  })
  assert.equal(drawOffered, true, '没有恐惧时也应询问目标是否抽牌')
  assert.equal((me(state2).hand || []).length, handBefore + 1, '目标抽 1 张')
})

test('R7 05002：手牌含同名另一张时，揭示副本仍可按 -2 费打出', () => {
  const state = investigatorFixture('05002')
  const inv = me(state)
  inv.hand = ['02105']
  inv.hunchDeck = []
  inv.hunchRevealed = '02105'
  inv.resources = 10
  inv.damage = 2
  inv.discard = []
  const hunchMove = legalMoves(state).find(option => option.action === 'play'
    && option.cardId === '02105' && option.fromHunch === true)
  assert.ok(hunchMove, '揭示副本提供 fromHunch 候选')
  move(state, hunchMove)
  settle(state, pending => (pending.kind === 'target' ? pending.options[0].id : null))
  const after = me(state)
  assert.equal(after.resources, 10, '揭示副本按 -2 费打出（2-2=0）')
  assert.equal(after.hunchRevealed ?? null, null, '打出揭示副本后 hunchRevealed 清除')
  assert.ok(after.hand.includes('02105'), '手牌里的同名另一张仍在手')
  assert.ok(after.discard.includes('02105'), '打出的揭示副本进弃牌堆')
})

test('R7 05002 乔：手牌同名另一张按普通价打出，hunchRevealed 保留并在阶段末洗回', () => {
  const state = investigatorFixture('05002')
  const inv = me(state)
  inv.hunchDeck = []
  inv.hunchRevealed = '01037'
  inv.hand = ['01037']
  inv.discard = []
  inv.deck = ['01088']
  inv.resources = 20
  inv.actionsLeft = 5
  assert.equal(playCost(state, me(state), ALL_CARDS['01037']), ALL_CARDS['01037'].cost,
    '同名手牌不吃 hunch 折扣（R7：折扣只走 fromHunch 路径）')
  move(state, { action: 'play', cardId: '01037' })
  settle(state)
  assert.equal(me(state).hunchRevealed, '01037', '同名手牌打出不会误清 hunchRevealed')
  assert.ok((me(state).discard || []).includes('01037'), '打出的手牌进弃牌堆')
  // 阶段末：仍然处于揭示状态的牌照常洗回直觉牌库。
  runTransaction(state, current => hunchEngine.returnHunchCard(current, current.investigators[0], []), () => null)
  assert.equal((me(state).hunchDeck || []).includes('01037'), true, '揭示牌在阶段末洗回直觉牌库')
})

test('task-33 05001 卡洛琳：技能卡成功治愈恐惧也会触发「获得 1 资源」（引擎 events 修复回归）', () => {
  const state = investigatorFixture('05001')
  const inv = me(state)
  inv.horror = 1
  inv.resources = 0
  let offered = false
  runTransaction(state, current => {
    applySkillOnSuccess(current, current.investigators[0], ['01067'], true, 0)
  }, pending => {
    if (pending.kind === 'reaction' && pending.options.some(option => option.cardCode === '05001')) {
      offered = true
      return pending.options.find(option => option.cardCode === '05001').id
    }
    return null
  })
  assert.equal(offered, true, 'skill-effects 治疗现在会开 horrorHealed 窗口（events 已透传）')
  assert.equal(me(state).horror, 0, '无所畏惧治愈 1 点恐惧')
  assert.equal(me(state).resources, 1, '卡洛琳的反应获得 1 资源')
})

test('task-33 05009 侦探手枪：最多 2 张[[工具]]支援不占用手部槽位', () => {
  const state = investigatorFixture('05002')
  const inv = me(state)
  const handSlotsOf = code => (ALL_CARDS[code]?.slots || []).reduce((sum, slot) => {
    const key = String(slot).toLowerCase()
    return sum + (key === 'hand x2' ? 2 : key === 'hand' ? 1 : 0)
  }, 0)
  // 用核心包的两张[[工具]]（放大镜 01030 / 手电筒 01087），避免扩展卡被动加槽干扰。
  const toolCodes = ['01030', '01087']
  assert.equal(handSlotsOf('05009'), 2, '柯尔特占 2 个手部槽位')
  inv.assets = [
    { id: 'colt', code: '05009', exhausted: false, uses: 4, usesType: 'ammo' },
    { id: 'tool1', code: toolCodes[0], exhausted: false },
    { id: 'tool2', code: toolCodes[1], exhausted: false },
  ]
  const rawHand = handSlotsOf('05009') + toolCodes.reduce((sum, code) => sum + handSlotsOf(code), 0)
  assert.equal(rawHand, 4, '原始占用 4 手槽（柯尔特 2 + 两张工具各 1）')
  assert.equal(slotUsage(inv).hand, 2, '最多 2 张[[工具]]被豁免后只剩柯尔特的 2 手槽')
  // 豁免不能超过 2：第 3 张工具仍按正常槽位限制（容量 2 已满）而被拒绝。
  assert.equal(canEquip(inv, ALL_CARDS['01687']), false, '第 3 张[[工具]]仍受手部槽位限制')
})

test('task-41 05004 黛安娜：真实闪避 01023 取消攻击后触发反应（引擎 allowNested wrapper 修复回归）', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.hand = ['01023']
  inv.deck = ['01088']
  inv.discard = []
  inv.resources = 10
  inv.beneath = []
  const dodgeCost = playCost(state, inv, ALL_CARDS['01023'])
  enemy(state, { id: 'dodge-enemy', engagedSeat: 0, damage: 1, horror: 0, health: 5 })
  state.chaosBag = ['0']
  let offered = false
  // 直接触发一次敌人攻击（不走 endTurn 的敌人/神话/补给流程，避免补给抽牌/收入干扰断言）。
  runTransaction(state, current => {
    const target = current.enemies.find(item => item.id === 'dodge-enemy')
    enemyAttack(current, target, current.investigators[0], [], '测试攻击')
  }, pending => {
    if (pending.kind === 'reaction') {
      const dodge = pending.options.find(option => option.cardCode === '01023')
      if (dodge) return dodge.id
      const diana = pending.options.find(option => option.cardCode === '05004')
      if (diana) {
        offered = true
        return diana.id
      }
    }
    return null
  })
  assert.equal(offered, true, '真实取消路径应当能触发黛安娜的 cardCancelled 反应')
  assert.ok((me(state).beneath || []).includes('01023'), '取消方那张牌压到黛安娜底下')
  assert.equal((me(state).hand || []).length, 1, '反应抽 1 张牌')
  assert.equal(me(state).resources, 10 - dodgeCost + 1, '支付闪避费用后由反应获得 1 资源')
})

test('task-41 05047 杰罗姆：真实 treachery 窗口按智力图标弃牌取消显现', () => {
  // 图标不足：只有 0 智力图标的手牌 → 不提供反应。
  const weakState = investigatorFixture('05047')
  me(weakState).hand = ['01088']
  weakState.cards = { ...(weakState.cards || {}), '01088': ALL_CARDS['01088'] }
  let offered = false
  runTransaction(weakState, current => {
    reactionWindow(current, 'treachery', {
      when: 'treachery', seat: 0, location: current.investigators[0].location,
      cardCode: '01037', prompt: '测试诡计',
    }, [])
  }, pending => {
    if (pending.kind === 'reaction' && pending.options.some(option => option.cardCode === '05047')) offered = true
    return null
  })
  assert.equal(offered, false, '智力图标不足 2 个时不应提供反应')

  // 图标足够：一张 2 智力图标的事件（01037）→ 触发、弃掉并取消显现。
  const state = investigatorFixture('05047')
  me(state).hand = ['01037']
  state.cards = { ...(state.cards || {}), '01037': ALL_CARDS['01037'] }
  let triggered = false
  let discardHadSkip = false
  runTransaction(state, current => {
    reactionWindow(current, 'treachery', {
      when: 'treachery', seat: 0, location: current.investigators[0].location,
      cardCode: '01037', prompt: '测试诡计',
    }, [])
  }, pending => {
    if (pending.kind === 'reaction' && pending.options.some(option => option.cardCode === '05047')) {
      triggered = true
      return pending.options.find(option => option.cardCode === '05047').id
    }
    if (pending.kind === 'discard') {
      if (pending.options.some(option => option.id === 'skip')) discardHadSkip = true
      return pending.options.find(option => option.id !== 'skip')?.id
    }
    return null
  })
  assert.equal(triggered, true, '手牌智力图标合计 2 时提供反应')
  assert.equal((me(state).hand || []).length, 0, '弃掉 1 张手牌')
  assert.ok((me(state).discard || []).includes('01037'), '弃掉的手牌进弃牌堆')
  assert.equal(discardHadSkip, false, '弃牌阶段不应再提供「不弃牌」选项')
  assert.ok((state.log || []).some(entry => String(entry?.text ?? entry).includes('取消了「') && String(entry?.text ?? entry).includes('显现效果')),
    '确认显现效果被取消（resolve 里设置 context.cancelled 后的日志）')
})

// ---------------------------------------------------------------------------
// 12. TCU 修复 Wave1（包H 条目侧接线：05046 / 05010 / 05018）
// ---------------------------------------------------------------------------

test('fix 05046 加弗瑞拉：攻击被取消后仍触发反应并发现线索（有线索时）', () => {
  const state = investigatorFixture('05046')
  const inv = me(state)
  inv.hand = ['01023']
  inv.discard = []
  inv.resources = 10
  const here = state.locations.find(location => location.id === inv.location)
  here.clues = 1
  enemy(state, { id: 'gav-cancel-enemy', engagedSeat: 0, damage: 1, horror: 0, health: 5 })
  state.chaosBag = ['0']
  let offered = false
  runTransaction(state, current => {
    const target = current.enemies.find(item => item.id === 'gav-cancel-enemy')
    enemyAttack(current, target, current.investigators[0], [], '测试攻击')
  }, pending => {
    if (pending.kind === 'reaction') {
      const dodge = pending.options.find(option => option.cardCode === '01023')
      if (dodge) return dodge.id
      const gavriella = pending.options.find(option => option.cardCode === '05046')
      if (gavriella) {
        offered = true
        return gavriella.id
      }
    }
    return null
  })
  assert.equal(offered, true, '被取消的攻击也应开 enemyAttacked 窗口（engine enemies.js:140-146）')
  // 事务提交后引擎会替换调查员/地点对象，断言前重新读取。
  const after = me(state)
  const hereAfter = state.locations.find(location => location.id === after.location)
  assert.equal(after.damage, 0, '闪避取消了攻击')
  assert.equal(hereAfter.clues, 0, '反应发现所在地点 1 个线索')
})

test('fix 05046 加弗瑞拉：所在地点没有线索时不提供反应（ClueOnLocation）', () => {
  const state = investigatorFixture('05046')
  const inv = me(state)
  const here = state.locations.find(location => location.id === inv.location)
  here.clues = 0
  enemy(state, { id: 'gav-empty-enemy', engagedSeat: 0, damage: 1, horror: 0, health: 5 })
  let offered = false
  runTransaction(state, current => {
    reactionWindow(current, 'enemyAttacked', {
      when: 'enemyAttacked', seat: 0, location: current.investigators[0].location,
      enemy: current.enemies.find(item => item.id === 'gav-empty-enemy'), cancelled: true,
    }, [])
  }, pending => {
    if (pending.kind === 'reaction' && pending.options.some(option => option.cardCode === '05046')) offered = true
    return null
  })
  assert.equal(offered, false, '地点无可发现线索时该触发式能力不能发动')
})

test('fix 05018 神秘乐曲：快速打出后移出游戏（exileAfterPlay 在快速窗口生效）', () => {
  const state = investigatorFixture('05006')
  const inv = me(state)
  inv.hand = ['05018']
  inv.resources = 10
  inv.discard = []
  state.removedFromGame = []
  let played = false
  runTransaction(state, current => {
    reactionWindow(current, 'agendaWouldAdvance', {
      when: 'agendaWouldAdvance', seat: 0, location: current.investigators[0].location,
      prompt: '密谋将要推进', agendaId: current.agendas?.[0]?.id || null,
    }, [])
  }, pending => {
    if (pending.kind === 'reaction') {
      const song = pending.options.find(option => option.cardCode === '05018')
      if (song) {
        played = true
        return song.id
      }
    }
    return null
  })
  assert.equal(played, true, '密谋将推进窗口可以打出神秘乐曲')
  // 「从游戏中移除」走引擎 exilePlayerCard：计入本关流放，战役层关末从牌组移除。
  assert.ok((state.exiled || []).includes('05018'), '移出游戏（exileAfterPlay → 流放记账）')
  assert.ok((state.exiledBySeat || []).some(record => record.code === '05018' && record.seat === 0),
    '记录流放者座位（战役结算读点）')
  const after = me(state)
  assert.equal((after.discard || []).includes('05018'), false, '快速事件收尾不再固定进弃牌堆')
  assert.equal((after.hand || []).includes('05018'), false, '已离开手牌')
  assert.deepEqual(state.agendaDoomLock, { round: state.round, phase: state.phase }, '本阶段密谋锁定')
})

test('fix 05010 悬案：scenarioXpModifier 已登记，供结局 XP 结算读取', () => {
  assert.equal(registeredEntry('05010').scenarioXpModifier, -2,
    '条目级字段（引擎读点 src/engine/campaign-flow.js:252-260）')
  assert.equal(registeredEntry('05010').avoidHunchShuffle, true)
  assert.equal(registeredEntry('05010').playableWeakness, true)
  assert.equal(registeredEntry('05010').playableFromThreat, true)
  assert.equal(registeredEntry('05010').removeAfterPlay, true)
})

// ---------------------------------------------------------------------------
// Wave2（包H 条目侧接线）：05048 检定期间 [free]、05009 attackResult 判定
// ---------------------------------------------------------------------------

test('fix 05048 瓦伦蒂诺：[free] 检定期间花 2 资源降难度（投入前/投入后窗口都可用、每轮一次）', () => {
  for (const useAt of ['beforeCommit', 'afterCommit']) {
    const state = investigatorFixture('05048')
    me(state).resources = 5
    state.chaosBag = ['0']
    let used = false
    let seen = 0
    const execute = current => performTest(current, 0, 'willpower', 2, {
      resolve: value => { current.testResult = value },
    })
    runTransaction(state, execute, pending => {
      if (pending.kind !== 'playerWindow') return null
      const option = (pending.options || [])
        .find(item => String(item.id).startsWith('free-descriptor:05048:'))
      if (!option) return null
      seen += 1
      if ((useAt === 'beforeCommit' && seen === 1) || (useAt === 'afterCommit' && seen === 2)) {
        used = true
        return option.id
      }
      return null // 其它窗口让过（默认 skip），确保只在指定窗口发动
    })
    assert.equal(used, true, `${useAt} 窗口应提供「花 2 资源降难度」`)
    assert.equal(state.testResult.success, true, `${useAt}：难度 2-1=1，标记 0 成功`)
    assert.equal(me(state).resources, 3, `${useAt}：支付 2 资源`)
    // 同一轮第二次检定：oncePerRound 已用，不应再提供。
    let offeredAgain = false
    runTransaction(state, current => performTest(current, 0, 'willpower', 1, {
      resolve: value => { current.testResult = value },
    }), pending => {
      if (pending.kind === 'playerWindow'
        && pending.options.some(item => String(item.id).startsWith('free-descriptor:05048:'))) offeredAgain = true
      return null
    })
    assert.equal(offeredAgain, false, '每轮仅限一次，第二次检定不再提供')
  }
})

test('fix 05009 柯尔特：本次攻击击败敌人时回收弃牌堆洞察事件（attackResult 判定）', () => {
  const state = investigatorFixture('05002')
  const inv = me(state)
  inv.assets = [{ id: 'colt', code: '05009', exhausted: false, uses: 4, usesType: 'ammo' }]
  inv.discard = ['01022']
  inv.hunchDeck = ['01036']
  inv.actionsLeft = 5
  const target = enemy(state, { id: 'colt-foe', fight: 1, evade: 1, health: 2 })
  state.chaosBag = ['0']
  let recycled = false
  move(state, { action: 'ability', assetId: 'colt', abilityIndex: 0, targetId: target.id })
  settle(state, pending => {
    if (pending.kind === 'card' && pending.source === '05009') {
      recycled = true
      return pending.options.find(option => option.id === '0')?.id
    }
    return null
  })
  assert.equal(recycled, true, '击败敌人后应提供回收洞察事件的选项')
  assert.equal(me(state).hunchDeck.at(-1), '01022', '洞察事件被放到直觉牌库底')
  assert.equal(me(state).discard.includes('01022'), false)
})

test('fix 05009 柯尔特：未击败敌人时不触发回收（不再用敌人是否离场近似）', () => {
  const state = investigatorFixture('05002')
  const inv = me(state)
  inv.assets = [{ id: 'colt', code: '05009', exhausted: false, uses: 4, usesType: 'ammo' }]
  inv.discard = ['01022']
  inv.hunchDeck = ['01036']
  inv.actionsLeft = 5
  const target = enemy(state, { id: 'colt-tough', fight: 1, evade: 1, health: 8 })
  state.chaosBag = ['0']
  let recycled = false
  move(state, { action: 'ability', assetId: 'colt', abilityIndex: 0, targetId: target.id })
  settle(state, pending => {
    if (pending.kind === 'card' && pending.source === '05009') recycled = true
    return null
  })
  assert.equal(recycled, false, '未击败不提供回收')
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2, '命中造成 2 点伤害')
})

// ---------------------------------------------------------------------------
// Wave4（包H）：05012 秘社“债务” —— 留在手牌 / 10 费打出移出游戏 / 游戏结束手牌创伤
// ---------------------------------------------------------------------------

// 引擎的 finishScenario 以 ScenarioEnded 异常作为「本关结算完成」的信号；测试里在事务内吞掉该异常，
// 让 finishScenario 已写入的状态（含本卡的手牌创伤扫描）被提交，再断言结果。
function finishScenarioForTest(state) {
  // 用 r2 结局：本关 r1 自带「队长 +1 精神创伤」，会污染本卡的手牌创伤断言。
  const swallow = current => {
    try { finishScenario(current, 'r2', []) } catch (error) {
      if (error?.constructor?.name !== 'ScenarioEnded') throw error
    }
  }
  resolveTransaction(state, 0, { action: 'tcuFinishScenario' }, swallow)
  for (let guard = 0; state.pendingChoice && guard < 200; guard++) {
    const pending = state.pendingChoice
    const optionId = ['done', 'skip', 'self', 'normal'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, swallow)
  }
}

test('fix 05012 秘社“债务”：抽到后留在手牌（不立即结算、不进弃牌堆）', () => {
  const state = investigatorFixture('05003')
  me(state).hand = []
  me(state).discard = []
  state.removedFromGame = []
  drawWeakness(state, '05012')
  assert.ok(me(state).hand.includes('05012'), '事件弱点抽到后留在手牌')
  assert.equal((me(state).discard || []).includes('05012'), false, '不进入弃牌堆')
  assert.equal((state.removedFromGame || []).includes('05012'), false, '不立即移出游戏')
})

test('fix 05012 秘社“债务”：支付 10 资源打出后移出游戏', () => {
  const state = investigatorFixture('05003')
  const inv = me(state)
  inv.hand = ['05012']
  inv.resources = 10
  inv.actionsLeft = 3
  state.removedFromGame = []
  const playMove = legalMoves(state).find(option => option.action === 'play' && option.cardId === '05012')
  assert.ok(playMove, '弱点事件可以作为行动打出（playableWeakness）')
  move(state, playMove)
  settle(state)
  assert.ok((state.removedFromGame || []).includes('05012'), '打出后移出游戏')
  assert.equal((me(state).discard || []).includes('05012'), false, '不进入弃牌堆')
  assert.equal((me(state).hand || []).includes('05012'), false, '已离开手牌')
  assert.equal(me(state).resources, 0, '支付 10 资源')
})

test('fix 05012：游戏结束时仍在手牌 → 1 点精神创伤；已移出游戏则不触发', () => {
  const inHand = investigatorFixture('05003')
  me(inHand).hand = ['05012']
  finishScenarioForTest(inHand)
  assert.equal(inHand.campaign.trauma[0].mental, 1, '手牌中 → 游戏结束 +1 精神创伤')
  assert.equal(inHand.campaign.trauma[0].physical, 0)
  const played = investigatorFixture('05003')
  me(played).hand = []
  played.removedFromGame = ['05012']
  finishScenarioForTest(played)
  assert.equal(played.campaign.trauma[0].mental, 0, '已打出/移出游戏 → 不触发')
})

test('fix 05012：退场时仍在手牌 → 1 点精神创伤（eliminateInvestigator 读点）', () => {
  const state = investigatorFixture('05003')
  const inv = me(state)
  inv.hand = ['05012']
  inv.damage = 0
  runTransaction(state, current => {
    const target = current.investigators[0]
    target.defeated = true
    target.defeatCause = 'damage'
    eliminateInvestigator(current, target, [])
  }, null)
  assert.equal(me(state).defeated, true, '调查员被击败/退场')
  assert.equal(state.campaign.trauma[0].mental, 1, '退场时手牌中的弱点 → +1 精神创伤')
  assert.equal(state.campaign.trauma[0].physical, 0, '不额外产生肉体创伤')
})

test('fix 05012：退场后再结算游戏结束不重复结算精神创伤（finishScenario 跳过已退场者）', () => {
  const state = investigatorFixture('05003')
  const inv = me(state)
  inv.hand = ['05012']
  inv.damage = 0
  runTransaction(state, current => {
    const target = current.investigators[0]
    target.defeated = true
    target.defeatCause = 'card'
    eliminateInvestigator(current, target, [])
  }, null)
  assert.equal(state.campaign.trauma[0].mental, 1, '退场分支 +1')
  // 再走一次游戏结束的手牌扫描：已退场/撤退者应被跳过，不得与退场分支重复。
  finishScenarioForTest(state)
  assert.equal(state.campaign.trauma[0].mental, 1, '游戏结束扫描跳过已退场者，不重复 +1')
  assert.equal(state.campaign.trauma[0].physical, 0)
})

// ---------------------------------------------------------------------------
// 第五轮（R5）：取消自动记账 + 显现作用域原语接线回归（05004 / 05049）
// ---------------------------------------------------------------------------
test('task-50 05004 黛安娜：01523 闪躲直接写 context.cancelled 取消攻击后触发反应（R5 自动记账）', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.hand = ['01523']
  inv.deck = ['01088']
  inv.discard = []
  inv.resources = 10
  inv.beneath = []
  const dodgeCost = playCost(state, inv, ALL_CARDS['01523'])
  enemy(state, { id: 'dodge-tcu', engagedSeat: 0, damage: 1, horror: 0, health: 5 })
  state.chaosBag = ['0']
  let offered = false
  runTransaction(state, current => {
    const target = current.enemies.find(item => item.id === 'dodge-tcu')
    enemyAttack(current, target, current.investigators[0], [], '测试攻击')
  }, pending => {
    if (pending.kind === 'reaction') {
      const dodge = pending.options.find(option => option.cardCode === '01523')
      if (dodge) return dodge.id
      const diana = pending.options.find(option => option.cardCode === '05004')
      if (diana) { offered = true; return diana.id }
    }
    return null
  })
  assert.equal(offered, true, '01523 直接写 context.cancelled 也应自动记账并触发黛安娜反应')
  assert.ok((me(state).beneath || []).includes('01523'), '取消方 01523 压在黛安娜底下')
  assert.equal((me(state).hand || []).length, 1, '反应抽 1 张牌')
  assert.equal(me(state).resources, 10 - dodgeCost + 1, '支付费用后由反应获得 1 资源')
})

test('R7 05004 黛安娜：05280 忽略伤害走 api.noteCancelled，触发 cardCancelled 并把卡压到黛安娜底下', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.hand = ['05280']
  inv.beneath = []
  inv.discard = []
  inv.deck = ['01088']
  inv.resources = 10
  inv.damage = 0
  const cancelCost = playCost(state, inv, ALL_CARDS['05280'])
  const attacker = enemy(state, { id: '05280-enemy', engagedSeat: 0, damage: 1, horror: 0, health: 5 })
  let used05280 = false
  let usedDiana = false
  runTransaction(state, current => {
    const target = current.enemies.find(item => item.id === attacker.id)
    enemyAttack(current, target, current.investigators[0], [], '测试攻击')
  }, pending => {
    if (pending.kind !== 'reaction') return null
    const cancel = pending.options.find(option => option.cardCode === '05280'
      || /否决存在/.test(String(option.label)))
    if (cancel) { used05280 = true; return cancel.id }
    const diana = pending.options.find(option => option.cardCode === '05004')
    if (diana) { usedDiana = true; return diana.id }
    return null
  })
  assert.equal(used05280, true, '05280 的忽略反应出现在 harmDealt 窗口')
  assert.equal(me(state).damage, 0, '05280 把刚受到的伤害清零（未承受伤害）')
  assert.equal(usedDiana, true, '05280 显式 noteCancelled 后触发黛安娜的 cardCancelled 反应')
  assert.deepEqual(me(state).beneath, ['05280'], '05280 被压在黛安娜底下')
  assert.equal((me(state).discard || []).includes('05280'), false, '不再进弃牌堆（已压到底下，R7 深度冲刷修复）')
  assert.equal((me(state).hand || []).length, 1, '反应抽 1 张')
  assert.equal(me(state).resources, 10 - cancelCost + 1, '支付 05280 费用后由反应获得 1 资源')
})
// 05049 佩妮的显现作用域测试辅助：造一个带线索、固定混乱袋的状态。
const revelationTestState = () => {
  const state = investigatorFixture('05049')
  const inv = me(state)
  const location = state.locations.find(item => item.id === inv.location)
  location.clues = 2
  inv.clues = 0
  state.chaosBag = ['0']
  return { state, location }
}

test('task-50 05049 佩妮：显现效果期间（弱点/诡计）的检定成功后反应发现 1 个线索', () => {
  const { state, location } = revelationTestState()
  let offered = false
  runTransaction(state, current => {
    pushRevelation('01013')
    try {
      performTest(current, 0, 'willpower', 1, { resolve: value => { current.testResult = value } })
    } finally {
      popRevelation()
    }
  }, pending => {
    if (pending.kind === 'reaction') {
      const penny = pending.options.find(option => option.cardCode === '05049')
      if (penny) { offered = true; return penny.id }
    }
    return null
  })
  assert.equal(offered, true, '显现效果期间的检定成功应提供佩妮反应')
  assert.equal(me(state).clues, 1, '发现所在地点的 1 个线索')
  const locationAfter = state.locations.find(item => item.id === me(state).location)
  assert.equal(locationAfter.clues, 1, '地点线索数减 1')
})

test('task-50 05049 佩妮：普通（非显现）检定成功后不提供反应', () => {
  const { state } = revelationTestState()
  let offered = false
  runTransaction(state, current => {
    performTest(current, 0, 'willpower', 1, { resolve: value => { current.testResult = value } })
  }, pending => {
    if (pending.kind === 'reaction'
      && pending.options.some(option => option.cardCode === '05049')) {
      offered = true
      return pending.options.find(option => option.cardCode === '05049').id
    }
    return null
  })
  assert.equal(offered, false, '普通检定不应触发「显现效果期间」反应')
  assert.equal(me(state).clues, 0)
})

test('task-50 05049 佩妮：显现效果期间的旧印给下回合额外行动，普通检定不给', () => {
  const revealed = investigatorFixture('05049')
  revealed.chaosBag = ['eldersign']
  runTransaction(revealed, current => {
    pushRevelation('01013')
    try {
      performTest(current, 0, 'willpower', 1, { resolve: value => { current.testResult = value } })
    } finally {
      popRevelation()
    }
  }, () => null)
  assert.equal(me(revealed).extraActionNextTurn, true, '显现效果期间的旧印 → 下回合额外行动')

  const normal = investigatorFixture('05049')
  normal.chaosBag = ['eldersign']
  runTransaction(normal, current => performTest(current, 0, 'willpower', 1, {
    resolve: value => { current.testResult = value },
  }), () => null)
  assert.notEqual(me(normal).extraActionNextTurn, true, '普通检定的旧印不写额外行动')
})

// ---------------------------------------------------------------------------
// 第六轮（R6）：05014 黑暗洞察 —— cardWouldBeDrawn 窗口取消抽到的弱点
// ---------------------------------------------------------------------------
test('R6 05014 黑暗洞察：抽到弱点时可取消并洗回牌库（不重抽）', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.hand = ['05014']
  inv.resources = 10
  inv.discard = []
  const cost = playCost(state, inv, ALL_CARDS['05014'])
  let offered = false
  drawWeakness(state, '05015', pending => {
    if (pending.kind === 'reaction') {
      const dark = pending.options.find(option => option.cardCode === '05014')
      if (dark) { offered = true; return dark.id }
    }
    return null
  })
  assert.equal(offered, true, '抽到弱点时应出现 05014 的取消窗口')
  assert.equal((me(state).hand || []).includes('05015'), false, '弱点没有进入手牌')
  assert.ok((me(state).deck || []).includes('05015'), '弱点洗回牌库')
  assert.equal((me(state).discard || []).includes('05014'), true, '05014 使用后进弃牌堆')
  assert.equal(me(state).hand.length, 0, '不重抽：没有替换牌进入手牌')
  assert.equal(me(state).resources, 10 - cost, '支付 05014 的打出费用')
})

test('R6 05014 黑暗洞察：普通抽牌不触发（窗口只对弱点开）', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.hand = ['05014']
  inv.deck = ['01088']
  inv.resources = 10
  let offered = false
  run(state, current => {
    executeDescriptor(current, {
      inv: current.investigators[0], source: null, events: [], context: {},
      descriptor: { code: '01037', label: '测试抽牌', resolve: ({ api }) => api.drawCards(0, 1) },
    })
  }, pending => {
    if (pending.kind === 'reaction') {
      const dark = pending.options.find(option => option.cardCode === '05014')
      if (dark) { offered = true; return dark.id }
    }
    return null
  })
  assert.equal(offered, false, '普通抽牌不应出现 05014 的取消窗口')
  assert.ok((me(state).hand || []).includes('01088'), '普通牌正常进手牌')
  assert.ok((me(state).hand || []).includes('05014'), '05014 仍在手牌')
})

// ---------------------------------------------------------------------------
// 第七轮（R7）：heal-pipeline v3 + resource-bank v2 接线回归
// ---------------------------------------------------------------------------
test('R7 05007+05001：同一治疗内追加 1 点，不重开 horrorHealed（卡洛琳只结算一次）', () => {
  const state = investigatorFixture('05001')
  const inv = me(state)
  inv.horror = 3
  inv.resources = 5
  inv.assets = [{ id: 'hyp', code: '05007', exhausted: false }]
  let hypnotismReactions = 0
  let carolynReactions = 0
  run(state, current => {
    healHorrorFrom(current, current.investigators[0], 1, [], { healerSeat: 0, cardCode: '01019' })
  }, pending => {
    if (pending.kind !== 'reaction') return null
    const hypnotism = pending.options.find(item => /催眠疗法/.test(String(item.label)))
    if (hypnotism) { hypnotismReactions++; return hypnotism.id }
    const carolyn = pending.options.find(item => item.cardCode === '05001' || /卡洛琳/.test(String(item.label)))
    if (carolyn) { carolynReactions++; return carolyn.id }
    return null
  })
  assert.equal(hypnotismReactions, 1, '催眠疗法的反应结算一次')
  assert.equal(carolynReactions, 1, '卡洛琳对同一次治疗只结算一次（extend 不重开窗口）')
  assert.equal(me(state).horror, 1, '原治疗 1 + 追加 1 = 共治愈 2 点')
  assert.equal(me(state).resources, 6, '卡洛琳反应只获得 1 资源')
})

test('R7 05001：legacy effect-data 通道（急救）治他人恐惧时按发起者座位触发反应', () => {
  const state = fixture('01001', 2)
  const p0 = state.investigators[0]
  const p1 = state.investigators[1]
  Object.assign(p0, { code: '05001', name: '卡洛琳·弗恩', klass: 'seeker',
    willpower: 3, intellect: 4, combat: 2, agility: 3 })
  p0.assets = [{ id: 'firstaid', code: '01019', uses: 3, usesType: 'supplies', exhausted: false }]
  p0.resources = 5
  p1.horror = 2
  p1.resources = 5
  let carolynReactions = 0
  move(state, { action: 'ability', assetId: 'firstaid', abilityIndex: 0 })
  settle(state, pending => {
    if (pending.kind === 'target') {
      const seat1 = pending.options.find(item => String(item.id) === '1')
      return (seat1 || pending.options[0]).id
    }
    if (pending.kind === 'effect' || pending.kind === 'choice') {
      const horror = pending.options.find(item => /恐惧/.test(String(item.label)))
      return horror ? horror.id : null
    }
    if (pending.kind === 'reaction') {
      const carolyn = pending.options.find(item => item.id !== 'skip')
      if (carolyn) { carolynReactions++; return carolyn.id }
    }
    return null
  })
  assert.equal(state.investigators[1].horror, 1, '急救治愈了 1 点恐惧')
  assert.equal(carolynReactions, 1, '发起者（seat0）的「治愈恐惧后」反应被触发')
  assert.equal(state.investigators[1].resources, 6, '被治愈的调查员获得 1 资源')
})

test('R7 05008：改道可选（redirect 治汇点 / skip 治原目标）', () => {
  const redirectState = investigatorFixture('05001')
  const inv = me(redirectState)
  inv.horror = 2
  inv.threat = [{ id: 'rt', code: '05008', counters: 4, exhausted: false }]
  let healed = null
  run(redirectState, current => {
    healed = healHorrorFrom(current, current.investigators[0], 1, [], { healerSeat: 0, cardCode: '01019' })
  }, pending => {
    if (pending.kind === 'reaction' && pending.options.some(option => option.id === 'redirect')) return 'redirect'
    if (pending.kind === 'reaction') return 'skip'
    return null
  })
  assert.equal(healed, 1)
  assert.equal(me(redirectState).threat[0].counters, 3, 'redirect：治愈的是理性思考上的恐惧')
  assert.equal(me(redirectState).horror, 2, 'redirect：本人恐惧不变')

  const skipState = investigatorFixture('05001')
  const inv2 = me(skipState)
  inv2.horror = 2
  inv2.threat = [{ id: 'rt', code: '05008', counters: 4, exhausted: false }]
  let healed2 = null
  run(skipState, current => {
    healed2 = healHorrorFrom(current, current.investigators[0], 1, [], { healerSeat: 0, cardCode: '01019' })
  }, pending => (pending.kind === 'reaction' && pending.options.some(option => option.id === 'skip') ? 'skip' : null))
  assert.equal(healed2, 1)
  assert.equal(me(skipState).horror, 1, 'skip：治疗原目标（本人）')
  assert.equal(me(skipState).threat[0].counters, 4, 'skip：汇点恐惧不变')
})

test('R7 05008：超出汇点剩余恐惧的治疗量按 overflow:"discard" 丢弃', () => {
  const state = investigatorFixture('05001')
  const inv = me(state)
  inv.horror = 5
  inv.threat = [{ id: 'rt', code: '05008', counters: 2, exhausted: false }]
  let healed = null
  run(state, current => {
    healed = healHorrorFrom(current, current.investigators[0], 5, [], { healerSeat: 0, cardCode: '01019' })
  }, pending => (pending.kind === 'reaction' && pending.options.some(option => option.id === 'redirect') ? 'redirect' : null))
  assert.equal(healed, 2, '只治愈汇点剩余的 2 点')
  assert.equal(me(state).horror, 5, '多余 3 点丢弃、不回流到本人')
  assert.ok(!me(state).threat.some(card => card.code === '05008'), '汇点恐惧清空后弃掉')
})

test('R7 05008：blockHealOtherCards 阻止治疗其它卡牌，但不阻止治疗调查员', () => {
  const state = investigatorFixture('05001')
  const inv = me(state)
  inv.horror = 2
  inv.threat = [{ id: 'rt', code: '05008', counters: 4, exhausted: false }]
  const ally = { id: 'ally1', code: '01021', horror: 2, damage: 0, exhausted: false }
  inv.assets = [ally]
  let blocked = null
  run(state, current => {
    const target = current.investigators[0].assets.find(item => item.id === 'ally1')
    blocked = healHorrorFrom(current, target, 1, [], { owner: current.investigators[0], healerSeat: 0, cardCode: '01019' })
  }, () => null)
  assert.equal(blocked, 0, '不能治愈其它卡牌上的恐惧')
  const allyAfter = me(state).assets.find(item => item.id === 'ally1')
  assert.equal(allyAfter.horror, 2, '盟友支援上的恐惧不变')

  let healedSelf = null
  run(state, current => {
    healedSelf = healHorrorFrom(current, current.investigators[0], 1, [], { healerSeat: 0, cardCode: '01019' })
  }, pending => (pending.kind === 'reaction' && pending.options.some(option => option.id === 'skip') ? 'skip' : null))
  assert.equal(healedSelf, 1, '治疗调查员本人不受 blockHealOtherCards 限制')
  assert.equal(me(state).horror, 1)
})

test('R7 05011：withdrawBanked 清掉寄存标记（合并模型：资源池不变）', () => {
  const state = investigatorFixture('05003')
  const inv = me(state)
  inv.resources = 10
  inv.actionsLeft = 3
  inv.assets = [{ id: 'inh', code: '05011', exhausted: false, resources: 4 }]
  const ability = legalMoves(state).find(option => option.action === 'ability' && option.assetId === 'inh')
  assert.ok(ability, '家族遗产有 [action] 能力')
  move(state, ability)
  settle(state)
  const asset = me(state).assets.find(item => item.code === '05011')
  assert.equal(asset?.resources || 0, 0, '寄存标记被清空')
  assert.equal(me(state).resources, 10, '合并模型下资源池数值不变（这些资源不会在回合末流失）')
})

// ---------------------------------------------------------------------------
// 第七轮（R7）：05013 银暮匕首 beneath 通道
// ---------------------------------------------------------------------------
test('R7 05013 beneath 通道：从底下打出事件（横置匕首、按手牌费用）', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.resources = 10
  inv.hand = []
  inv.beneath = ['01052']
  inv.assets = [{ id: 'dagger', code: '05013', exhausted: false }]
  const target = enemy(state, { id: 'sneak-target', fight: 1, evade: 1, health: 5, exhausted: true })
  // 直接走 dispatch 的 fromBeneath 分支（legalMoves 候选过滤见下方 skip 用例：引擎 validateMove 仍要求卡在手牌）。
  applyMove(state, 0, { action: 'play', cardId: '01052', fromBeneath: true, channelAssetId: 'dagger' })
  settle(state, pending => (pending.kind === 'target' ? pending.options[0].id : null))
  const after = me(state)
  assert.equal(after.assets.find(item => item.id === 'dagger')?.exhausted, true, '额外费用：横置银暮匕首')
  assert.deepEqual(after.beneath, [], '卡从 beneath 移出')
  assert.equal(after.resources, 8, '按手牌费用支付 2 资源')
  assert.equal(state.enemies.find(item => item.id === target.id)?.damageTaken, 2, '事件正常结算（偷袭 2 点伤害）')
  assert.ok(after.discard.includes('01052'), '打出后按普通事件进弃牌堆')
})

test('R7 05013 beneath 通道：投入底下技能（横置匕首、图标生效、检定后进弃牌堆）', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.hand = []
  inv.beneath = ['01025']
  inv.assets = [{ id: 'dagger', code: '05013', exhausted: false }]
  state.chaosBag = ['0']
  let committed = false
  runTransaction(state, current => performTest(current, 0, 'combat', 1, {
    resolve: value => { current.testResult = value },
  }), pending => {
    if (pending.kind === 'commit') {
      const option = pending.options.find(item => String(item.id) === 'beneath:01025')
      if (option) { committed = true; return option.id }
      if (pending.options.some(item => item.id === 'done')) return 'done'
    }
    return null
  })
  assert.equal(committed, true, '投入候选包含 beneath 的技能')
  assert.equal(me(state).assets.find(item => item.id === 'dagger')?.exhausted, true, '额外费用：横置银暮匕首')
  assert.deepEqual(me(state).beneath, [], '卡从 beneath 移出')
  assert.ok(me(state).discard.includes('01025'), '检定后技能进弃牌堆')
  assert.equal(state.testResult.success, true)
})

test('R7 05013 beneath 通道：两张同名牌可以同时出现在投入窗口', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.hand = []
  inv.beneath = ['01025', '01025']
  inv.assets = [{ id: 'dagger', code: '05013', exhausted: false }]
  state.chaosBag = ['0']
  let ids = null
  runTransaction(state, current => performTest(current, 0, 'combat', 1, {
    resolve: value => { current.testResult = value },
  }), pending => {
    if (pending.kind === 'commit') {
      if (!ids) ids = pending.options.filter(item => String(item.id).includes('01025')).map(item => item.id)
      const second = pending.options.find(item => item.id === 'beneath:1:01025')
      if (second) return second.id
      if (pending.options.some(item => item.id === 'done')) return 'done'
    }
    return null
  })
  assert.deepEqual(ids, ['beneath:0:01025', 'beneath:1:01025'])
  assert.deepEqual(me(state).beneath, ['01025'], '只移出被投入的那一张')
  assert.ok(me(state).discard.includes('01025'))
  assert.equal(state.testResult.success, true)
})

test('R7 05013 beneath 通道：匕首横置时不提供 beneath 打出/投入选项', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.resources = 10
  inv.hand = []
  inv.beneath = ['01052', '01025']
  inv.assets = [{ id: 'dagger', code: '05013', exhausted: true }]
  enemy(state, { id: 'sneak-target-2', fight: 1, evade: 1, health: 5, exhausted: true })
  assert.equal(legalMoves(state).some(option => option.action === 'play' && option.fromBeneath), false,
    '通道支援横置后不提供 beneath 打出候选')
  let offered = false
  runTransaction(state, current => performTest(current, 0, 'combat', 1, {
    resolve: value => { current.testResult = value },
  }), pending => {
    if (pending.kind === 'commit' && pending.options.some(item => String(item.id).startsWith('beneath:'))) offered = true
    if (pending.kind === 'commit' && pending.options.some(item => item.id === 'done')) return 'done'
    return null
  })
  assert.equal(offered, false, '通道支援横置后不提供 beneath 投入候选')
})

test('R7 05013+05004：beneath 通道结算期间黛安娜 reaction 被排除', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.beneath = []
  const entry = registeredEntry('05004')
  const ability = entry.abilities.find(item => [].concat(item.trigger).includes('cardCancelled'))
  assert.ok(ability, '05004 有 cardCancelled reaction')
  const ctx = {
    state, inv, source: null, windowId: 'cardCancelled',
    context: { when: 'cardCancelled', seat: 0, cardSeat: 0, cardCode: '01052',
      location: inv.location },
  }
  assert.equal(evaluateCriteria(ability.criteria, ctx), true, '普通结算时 criteria 允许反应')
  state._playedFromBeneath = { seat: 0, cardCode: '01052' }
  assert.equal(evaluateCriteria(ability.criteria, ctx), false, 'beneath 通道结算期间 criteria 排除反应')
  state._playedFromBeneath = { seat: 1, cardCode: '01052' }
  assert.equal(evaluateCriteria(ability.criteria, ctx), true, '别的座位的 beneath 结算不影响本人')
  delete state._playedFromBeneath
})

test('R7 05013 beneath 打出候选：legalMoves/validateMove 应提供 fromBeneath 候选', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.resources = 10
  inv.hand = []
  inv.beneath = ['01052']
  inv.assets = [{ id: 'dagger', code: '05013', exhausted: false }]
  enemy(state, { id: 'sneak-target', fight: 1, evade: 1, health: 5, exhausted: true })
  const playMove = legalMoves(state).find(option => option.action === 'play'
    && option.cardId === '01052' && option.fromBeneath === true)
  assert.ok(playMove, '持有未横置通道支援时，底下的事件应可打出（fromBeneath 候选）')
})

// 借机攻击回归（2026-10-26）：卡面「攻击。」= Fight 行动，发起攻击不引发借机攻击。
test('R7 05013 银暮匕首：卡面「攻击。」→ 攻击行动不引发借机攻击', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.assets = [{ id: 'blade', code: '05013', exhausted: false }]
  inv.actionsLeft = 5
  enemy(state, { id: 'aoo-enemy', fight: 1, evade: 1, health: 6, damage: 2, engagedSeat: 0 })
  state.chaosBag = ['0']
  const ability = legalMoves(state).find(moveOption =>
    moveOption.action === 'ability' && moveOption.assetId === 'blade' && moveOption.targetId === 'aoo-enemy')
  assert.ok(ability, '银暮匕首应当有可选目标的攻击行动')
  assert.deepEqual(actionPreview(state, 0, ability).opportunityAttacks, [], '攻击行动不应预览借机攻击')
  move(state, ability)
  settle(state, pending => (pending.options.some(option => option.id === 'combat') ? 'combat' : null))
  assert.equal(me(state).damage, 0, '攻击行动不引发借机攻击')
  assert.equal(state.enemies.find(item => item.id === 'aoo-enemy')?.damageTaken, 1, '攻击正常结算 1 点伤害')
})

test('R7 05013 beneath：从底下打出 03153 灵力风暴不引发借机攻击', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.resources = 10
  inv.hand = []
  inv.beneath = ['03153']
  inv.assets = [{ id: 'dagger', code: '05013', exhausted: false }]
  inv.actionsLeft = 5
  enemy(state, { id: 'storm-enemy', fight: 1, evade: 1, health: 6, damage: 2, engagedSeat: 0 })
  state.chaosBag = ['0']
  const playMove = legalMoves(state).find(option => option.action === 'play'
    && option.cardId === '03153' && option.fromBeneath === true)
  assert.ok(playMove, '底下的事件应可打出（fromBeneath 候选）')
  assert.deepEqual(actionPreview(state, 0, playMove).opportunityAttacks, [], '「攻击。」事件打出不应预览借机攻击')
  move(state, playMove)
  settle(state)
  const after = me(state)
  assert.equal(after.damage, 0, '从底下打出攻击事件不引发借机攻击')
  assert.equal(after.assets.find(item => item.id === 'dagger')?.exhausted, true, '额外费用：横置银暮匕首')
  assert.deepEqual(after.beneath, [], '卡从 beneath 移出')
  assert.ok(after.discard.includes('03153'), '打出后按普通事件进弃牌堆')
  assert.equal(state.enemies.find(item => item.id === 'storm-enemy')?.damageTaken, 2, '灵力风暴正常结算 2 点伤害')
})

// ---------------------------------------------------------------------------
// 2026-10-27：05013「如同其在你的手牌中」——反应窗口里的 beneath 通道
// （旧实现只给普通行动与技能检定投入接了 beneath；快速事件/fromHand 反应窗口没有接，
//   玩家看到黛安娜底下有牌、匕首在场却始终点不出可用动作。）
// ---------------------------------------------------------------------------
test('05013 beneath 通道：底下的快速事件出现在反应窗口，选中后横置匕首并正常进弃牌堆', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.hand = []
  inv.resources = 10
  inv.deck = ['01088', '01088']
  inv.beneath = ['05014']
  inv.assets = [{ id: 'dagger', code: '05013', exhausted: false }]
  let offered = null
  let answered = false
  run(state, current => {
    reactionWindow(current, 'encounterDrawn', {
      when: 'encounterDrawn', seat: 0, location: current.investigators[0].location,
      cardCode: '01037', prompt: '测试遭遇',
    }, [])
  }, pending => {
    if (pending.kind !== 'reaction') return null
    const option = pending.options.find(item => item.cardCode === '05014')
    if (option && !answered) { offered = option; answered = true; return option.id }
    if (pending.options.some(item => item.id === 'skip')) return 'skip'
    return null
  })
  assert.ok(offered, '底下的快速事件（05014 黑暗洞察）必须出现在反应窗口候选里')
  assert.match(offered.label, /银暮匕首/, '候选要标出「从下方用银暮匕首打出」')
  const after = me(state)
  assert.equal(after.assets.find(item => item.id === 'dagger')?.exhausted, true, '额外费用：横置银暮匕首')
  assert.deepEqual(after.beneath, [], '卡从 beneath 移出')
  assert.ok(after.discard.includes('05014'), '打出后按普通快速事件进弃牌堆')
  assert.equal(after.hand.length, 0, '不会重复加入手牌')
  assert.equal(state._playedFromBeneath, undefined, '结算后恢复 beneath 结算标记')
})

test('05013 beneath 通道：底下的 fromHand 反应描述子（05324）在能力窗口可触发', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.hand = []
  inv.resources = 10
  inv.beneath = ['05324']
  inv.assets = [{ id: 'dagger', code: '05013', exhausted: false }]
  let offered = null
  let flipped = false
  run(state, current => {
    const ctx = {
      when: 'negativeTokenRevealed', seat: 0, location: current.investigators[0].location,
      token: '-2', testValue: 0, flipTokenSign: false, prompt: '测试负修正',
    }
    reactionWindow(current, 'negativeTokenRevealed', ctx, [])
    if (ctx.flipTokenSign) flipped = true
  }, pending => {
    if (pending.kind !== 'reaction') return null
    const option = pending.options.find(item => item.cardCode === '05324')
    if (option && !offered) { offered = option; return option.id }
    if (pending.options.some(item => item.id === 'skip')) return 'skip'
    return null
  })
  assert.ok(offered, '底下的 fromHand 反应（05324 美满结局）必须出现在能力窗口候选里')
  assert.match(offered.label, /银暮匕首/)
  assert.equal(flipped, true, '从底下触发的反应正常结算（把负修正翻成正修正）')
  const after = me(state)
  assert.equal(after.assets.find(item => item.id === 'dagger')?.exhausted, true, '额外费用：横置银暮匕首')
  assert.deepEqual(after.beneath, [], '卡从 beneath 移出')
  assert.ok(after.discard.includes('05324'), '反应事件结算后进弃牌堆')
  assert.equal(after.resources, 8, '按手牌口径支付 05324 的 2 资源')
})

test('05013 beneath 通道：匕首横置时底下的牌也不出现在反应窗口', () => {
  const state = investigatorFixture('05004')
  const inv = me(state)
  inv.hand = []
  inv.resources = 10
  inv.beneath = ['05014']
  inv.assets = [{ id: 'dagger', code: '05013', exhausted: true }]
  run(state, current => {
    reactionWindow(current, 'encounterDrawn', {
      when: 'encounterDrawn', seat: 0, location: current.investigators[0].location,
      cardCode: '01037', prompt: '测试遭遇',
    }, [])
  }, () => null)
  assert.equal(state.pendingChoice, null, '通道支援横置后不再给出 beneath 候选（窗口直接关闭）')
  assert.deepEqual(me(state).beneath, ['05014'], '底下的牌保持不动')
})

// ---------------------------------------------------------------------------
// 第七轮（R7）：05006 玛丽·朗博 —— 毁灭→法术专用额度联动
// ---------------------------------------------------------------------------
test('R7 05006：入场即带毁灭的支援获得 1 个法术专用行动', () => {
  const state = investigatorFixture('05006')
  const inv = me(state)
  inv.hand = ['01063']
  inv.resources = 10
  const actionsBefore = inv.actionsLeft
  const playMove = legalMoves(state).find(option => option.action === 'play' && option.cardId === '01063')
  assert.ok(playMove, '新晋术士可以从手牌打出')
  move(state, playMove)
  settle(state)
  const after = me(state)
  const asset = after.assets.find(item => item.code === '01063')
  assert.equal(asset?.doom, 1, '入场即带 1 个毁灭标记（onPlayDoom）')
  assert.equal(after.spellOnlyActions, 1, '获得 1 个法术专用行动')
  assert.equal(spellOnlyActionsOf(after), 1)
  assert.equal(after.actionsLeft, actionsBefore, '打出花费 1 行动 + 额度补 1 = 净不变')
})

test('R7 05006：旧印移除毁灭到 0 时收回未使用的法术专用额度', () => {
  const state = investigatorFixture('05006')
  const inv = me(state)
  inv.hand = ['01063']
  inv.resources = 10
  const playMove = legalMoves(state).find(option => option.action === 'play' && option.cardId === '01063')
  move(state, playMove)
  settle(state)
  assert.equal(me(state).spellOnlyActions, 1, '打出后先获得额度')
  const actionsBefore = me(state).actionsLeft
  state.chaosBag = ['eldersign']
  runTransaction(state, current => performTest(current, 0, 'willpower', 1, {
    resolve: value => { current.testResult = value },
  }), pending => {
    if (pending.kind === 'effect') {
      const remove = pending.options.find(option => String(option.id).startsWith('remove:'))
      if (remove) return remove.id
    }
    return null
  })
  const after = me(state)
  assert.equal(after.assets.find(item => item.code === '01063')?.doom || 0, 0, '旧印移除了毁灭标记')
  assert.equal(after.spellOnlyActions ?? 0, 0, '额度收回（spellOnlyActions 清除）')
  assert.equal(spellOnlyActionsOf(after), 0)
  assert.equal(after.actionsLeft, actionsBefore - 1, 'actionsLeft 相应减少 1')
})
