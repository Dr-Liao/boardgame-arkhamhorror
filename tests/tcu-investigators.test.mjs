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
  createGameState, executeDescriptor, getStat, healHorrorFrom, isSpellAction, legalMoves, playCost,
  performTest, reactionWindow, validateMove, applyDamage, applySkillOnSuccess, slotUsage, canEquip, enemyAttack,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registeredEntry } from '../src/engine/ability.js'
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
  // 调查阶段开始时已经揭示了牌库顶（那张已经进手牌），所以「直觉牌库总张数」要把揭示的算回来。
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
  assert.equal(me(state).hand.includes('01037'), true, '揭示的那张进手牌（如同手牌）')
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

test('P6 乔：揭示的那张打出时少付 2 资源', () => {
  const state = investigatorFixture('05002')
  const inv = me(state)
  inv.hand = ['01037']
  inv.hunchDeck = []
  inv.hunchRevealed = '01037'
  inv.resources = 10
  const discounted = playCost(state, me(state), ALL_CARDS['01037'])
  assert.equal(discounted, Math.max(0, (ALL_CARDS['01037'].cost || 0) - 2))
  // 不是揭示的那张时没有折扣。
  me(state).hunchRevealed = null
  assert.equal(playCost(state, me(state), ALL_CARDS['01037']), ALL_CARDS['01037'].cost || 0)
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

test('P6 普雷斯顿：回合开始放 4 资源，回合结束弃掉寄存的部分', () => {
  const bank = bankEngine
  const state = investigatorFixture('05003')
  const inv = me(state)
  inv.assets = [{ id: 'family', code: '05011', exhausted: false }]
  inv.resources = 6
  bank.beginTurn(state, inv, [])
  assert.equal(inv.resources, 10)
  assert.equal(bank.bankedOf(inv), 4)
  assert.equal(bank.projection(inv).banked, 4)
  // 花掉 2 点：寄存标记不变；回合结束时按 min(寄存, 现有) 扣回。
  inv.resources -= 2
  bank.endTurn(state, inv, [])
  assert.equal(inv.resources, 4)
  assert.equal(bank.bankedOf(inv), 0)
  // [action]：把寄存的资源转成永久资源。
  inv.assets[0].resources = 0
  assert.equal(bank.withdrawAll(state, inv, []), 0)
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
  me(state).beneath = ['01088', '01088']
  assert.equal(getStat(state, me(state), 'willpower'), base + 2)
  state.chaosBag = ['eldersign']
  const execute = current => performTest(current, 0, 'willpower', 3, {
    resolve: value => { current.testResult = value },
  })
  runTransaction(state, execute, pending => {
    if (pending.kind === 'beneath' && pending.options.some(option => option.id === '0')) return '0'
    return null
  })
  assert.equal(me(state).beneath.length, 1)
  assert.equal(me(state).hand.includes('01088'), true)
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

  // 旧印放开本轮的限制：换一个仍然交战的新敌人再躲一次。
  me(state).ritaIgnoreLimitRound = state.round
  const third = enemy(state, { id: 'rita-third', fight: 1, evade: 1, health: 4 })
  move(state, { action: 'evade', enemyId: third.id })
  settle(state, choose)
  assert.equal(offers, 2, '旧印后再次询问')
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
    if (pending.kind === 'reaction' && pending.options.some(option => option.cardCode === '05048')) {
      reduced = true
      return pending.options.find(option => option.cardCode === '05048').id
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

test('task-22 05010 悬案：作为弱点事件打出，放线索到最高隐藏值地点并移出游戏', () => {
  const state = investigatorFixture('05002')
  const inv = me(state)
  inv.hand = ['05010']
  inv.hunchRevealed = '05010'
  inv.clues = 2
  inv.resources = 10
  inv.discard = []
  state.removedFromGame = []
  const numeric = state.locations.filter(location => typeof location.shroud === 'number')
  const maxShroud = Math.max(...numeric.map(location => location.shroud || 0))
  const candidates = numeric.filter(location => (location.shroud || 0) === maxShroud)
  const before = Object.fromEntries(state.locations.map(location => [location.id, location.clues || 0]))
  const playMove = legalMoves(state).find(moveOption => moveOption.action === 'play' && moveOption.cardId === '05010')
  assert.ok(playMove, '悬案应当可以作为弱点事件打出（playableWeakness + played 描述子）')
  move(state, playMove)
  settle(state, pending => (pending.kind === 'location' ? pending.options[0].id : null))
  const after = me(state)
  assert.ok((state.removedFromGame || []).includes('05010'), '打出后移出游戏（removeAfterPlay）')
  assert.equal((after.discard || []).includes('05010'), false, '不进入弃牌堆')
  assert.equal(after.hunchRevealed ?? null, null, '打出后清掉直觉牌库揭示标记（避免阶段末重复洗回）')
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

test('task-22 05019 安息日男爵：同地点调查员受到伤害时额外 +1 点', () => {
  const state = investigatorFixture('05006')
  const inv = me(state)
  inv.threat = [{ id: 'baron', code: '05019', exhausted: false, doom: 0, counters: 3 }]
  inv.damage = 0
  runTransaction(state, current => applyDamage(current, current.investigators[0], 1, []), null)
  assert.equal(me(state).damage, 2, '基础 1 点 + 男爵强制额外 1 点')
})

test('task-22 05019 安息日男爵：3 毁灭后弃掉；补给阶段重整并同步离场保护', () => {
  // 3 个毁灭 → 弃掉（且 counters 归零解除保护）。
  const state = investigatorFixture('05006')
  me(state).threat = [{ id: 'baron', code: '05019', exhausted: false, doom: 2, counters: 1 }]
  me(state).actionsLeft = 5
  const ability = legalMoves(state).find(moveOption => moveOption.action === 'ability' && moveOption.assetId === 'baron')
  assert.ok(ability, '男爵的免费能力应当可用')
  move(state, ability)
  settle(state)
  assert.equal(me(state).threat.some(card => card.code === '05019'), false, '3 个毁灭后弃掉')

  // 补给阶段：威胁区卡由引擎复位；counters 按 3 − doom 同步（少于 3 毁灭不能离场）。
  const state2 = investigatorFixture('05006')
  me(state2).threat = [{ id: 'baron2', code: '05019', exhausted: false, doom: 0, counters: 3 }]
  me(state2).actionsLeft = 5
  const ability2 = legalMoves(state2).find(moveOption => moveOption.action === 'ability' && moveOption.assetId === 'baron2')
  assert.ok(ability2)
  move(state2, ability2)
  settle(state2)
  const baron2 = () => me(state2).threat.find(card => card.code === '05019')
  assert.equal(baron2()?.exhausted, true, '使用后横置')
  assert.equal(baron2()?.doom, 1)
  assert.equal(baron2()?.counters, 2, '离场保护镜像 counters = 3 − doom')
  move(state2, { action: 'endTurn' })
  settle(state2)
  assert.equal(baron2()?.exhausted, false, '补给阶段威胁区卡复位（引擎 2026-10-25 修复）')
  assert.equal(baron2()?.counters, 2, '补给阶段同步 counters')
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

test('task-30 05002 乔：打出的直觉牌会清 hunchRevealed（不再重复洗回、折扣不泄漏）', () => {
  const state = investigatorFixture('05002')
  const inv = me(state)
  inv.hunchDeck = []
  inv.hunchRevealed = '01037'
  inv.hand = ['01037']
  inv.discard = []
  inv.deck = ['01088']
  inv.resources = 20
  inv.actionsLeft = 5
  move(state, { action: 'play', cardId: '01037' })
  settle(state)
  assert.equal(me(state).hunchRevealed ?? null, null, '打出后清除 hunchRevealed')
  assert.ok((me(state).discard || []).includes('01037'), '打出的牌进弃牌堆')
  // 阶段末 returnHunchCard 不会把已打出的牌再洗回直觉牌库。
  runTransaction(state, current => hunchEngine.returnHunchCard(current, current.investigators[0], []), () => null)
  assert.equal((me(state).hunchDeck || []).includes('01037'), false, '不重复洗回直觉牌库')
  // 不再有 -2 折扣泄漏到手上同名卡。
  assert.equal(playCost(state, me(state), ALL_CARDS['01037']), ALL_CARDS['01037'].cost, '没有揭示牌时按印刷费用')
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
