// 九循环《铁杉谷盛宴》P5：汉克·萨姆森（10015）及绑定坚毅面 10016a/10016b、
// 专属事件 10017、专属弱点 10018 的 Node 验收。
//
// 口径：
//   · 条目文件按一卡一文件注册；本测试显式 import 五个条目（主进程重建 entries/index.js
//     之后它们也会由聚合入口注册，这里只在索引尚未重建时兜底注册）；
//   · 调查员行为用 fixture('10015') 的真实开局路径，只把伤恐/手牌/资源改成用例需要的准备态；
//   · 规则事务（会开选择窗口）统一走 resolveTransaction 重放，普通测试态写入只用于准备状态；
//   · 每条标题以 `P5 10015 ` 开头（FHV P5 调查员账本的发现口径）。
import test from 'node:test'
import assert from 'node:assert/strict'

import hank from '../src/cards/entries/10015.js'
import hankResoluteAssistant from '../src/cards/entries/10016a.js'
import hankResoluteWarden from '../src/cards/entries/10016b.js'
import stouthearted from '../src/cards/entries/10017.js'
import wheresPa from '../src/cards/entries/10018.js'
import '../src/engine/engine.js'

import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import {
  applyHarm, checkDefeated, drawCards, elderSignEffect, engageEnemy, healDamageFrom,
  legalMoves, reactionWindow, scenarioRuntime, triggerReaction,
} from '../src/engine/engine.js'
import { enemyAttack } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { migrateState } from '../src/engine/save-migration.js'
import { investigatorRule } from '../src/cards/card-rules.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { buildDeck, cardLimit, matchesDeckOptions } from '../src/deck/deckbuilding.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { getAvailability } from '../src/deck/availability.js'
import { asset, enemy, fixture } from './core-fixture.mjs'

const ENTRY_LIST = [hank, hankResoluteAssistant, hankResoluteWarden, stouthearted, wheresPa]
const pendingEntries = ENTRY_LIST.filter(entry => !registeredEntry(entry.code))
if (pendingEntries.length) registerCardAbilities(pendingEntries)

const copy = value => JSON.parse(JSON.stringify(value))
const invOf = state => state.investigators[0]
const findById = (list, id) => (list || []).find(item => item.id === id) || null

// 规则事务里的选择（反应窗口 / 强制能力 / 弱点显现等）必须用 resolveTransaction 消费恢复凭据。
function transact(state, run, select = () => null) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'fhv10015Test' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 100, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}

// 汉克开局（fixture 会清空手牌/支援/伤害/资源，只保留真实调查员卡面与启动路径）。
function setupHank(extra = {}, count = 1) {
  const state = fixture('10015', count)
  const inv = state.investigators[0]
  Object.assign(inv, { damage: 0, horror: 0, hand: [], resources: 10, actionsLeft: 20, ...extra })
  delete inv.form
  delete inv.cardCode
  delete inv.formOriginal
  delete inv.formHealingProhibited
  return state
}

// 濒败替换到指定坚毅面（真实的 wouldDefeat 窗口 + 二选一）。
function swapToForm(state, code = '10016a') {
  transact(state, draft => applyHarm(draft, draft.investigators[0], 10, 0, [], true),
    choice => (choice.options.some(option => option.id === code) ? code : null))
  assert.equal(invOf(state).code, code, '应已换成所选坚毅面')
}

// 一轮结束窗口（forced 能力由 openAbilityWindow 自动结算）。
function roundEnds(state) {
  transact(state, draft => reactionWindow(draft, 'roundEnds', { when: 'roundEnds', round: draft.round }, []))
}

// ── 条目 / 卡面形状 ──────────────────────────────────────────────────────────
test('P5 10015 条目注册与卡面形状：调查员、伤恐承接 flag、旧印与绑定坚毅面', () => {
  for (const entry of ENTRY_LIST) assert.ok(registeredEntry(entry.code), `条目未注册：${entry.code}`)
  assert.equal(registeredEntry('10015').kind, 'investigator')
  assert.deepEqual(registeredEntry('10015').flags, { assignInvestigatorHarmAtLocation: true })
  assert.equal(investigatorRule('10015').elderSign.bonus, 1, '旧印 +1 应写在 investigator.elderSign.bonus')
  assert.ok(registeredEntry('10015').elderSign?.resolve, '旧印描述子应可结算')

  const card = ALL_CARDS['10015']
  assert.equal(card.type, 'investigator')
  assert.equal(card.deckRequirements.size, 35, '印刷牌组 35 张')
  assert.deepEqual([...card.deckRequirements.signatureCards].sort(), ['10017', '10018'])
  assert.deepEqual(card.bondedCards.map(entry => entry.code), ['10016a', '10016b'])
  assert.equal(ALL_CARDS['10017'].quantity, 1)
  assert.equal(ALL_CARDS['10018'].quantity, 1)

  for (const code of ['10016a', '10016b']) {
    const entry = registeredEntry(code)
    assert.equal(entry.kind, 'investigator')
    assert.equal(investigatorRule(code).elderSign.bonus, 1)
    assert.deepEqual(entry.flags, { assignInvestigatorHarmAtLocation: true })
    assert.ok(entry.elderSign?.resolve)
    assert.equal(ALL_CARDS[code].type, 'investigator')
  }
  assert.deepEqual(ALL_CARDS['10016a'].traits, ['Assistant', 'Resolute'])
  assert.deepEqual(ALL_CARDS['10016b'].traits, ['Warden', 'Resolute'])

  // 10017：快速事件走 P2-4 统一通道（enemyEngaged 只经过 openAbilityWindow，旧 played 写法不可达）。
  const stout = registeredEntry('10017').abilities.find(descriptor => descriptor.trigger.includes('enemyEngaged'))
  assert.ok(stout)
  assert.equal(stout.kind, 'reaction')
  assert.equal(stout.fromHand, true)
  assert.equal(stout.quickEvent, true)
  assert.deepEqual(ALL_CARDS['10017'].signatureFor, ['10015'])
  assert.deepEqual(ALL_CARDS['10017'].traits, ['Spirit'])

  // 10018：弱点描述子（attachedEnemy 使 deck-ops 不把它再弃进弃牌堆）+ 逃逸光环。
  const weakness = registeredEntry('10018').abilities.find(descriptor => descriptor.kind === 'weakness')
  assert.ok(weakness)
  assert.deepEqual(weakness.weakness, { type: 'attachedEnemy' })
  assert.ok(weakness.resolve)
  assert.deepEqual(registeredEntry('10018').treacheryRule.enemyKeywordAura.keywords, ['elusive'])
  assert.deepEqual(ALL_CARDS['10018'].signatureFor, ['10015'])
  for (const code of ['10016a', '10016b', '10017', '10018']) {
    assert.equal(getAvailability(code).dependencyOnly, true, `${code} 必须是依赖卡`)
    assert.equal(getAvailability(code).deckbuilding, false, `${code} 不得进入一般构筑池`)
  }
  assert.equal(getAvailability('10015').selectable, true)
})

// ── 构筑 ────────────────────────────────────────────────────────────────────
// 合法 35 张：生存者/中立 0 级、非签名、非同名的普通卡各 2 张。
function legalDeckCodes(def = INVESTIGATORS['10015']) {
  const pool = Object.values(ALL_CARDS).filter(card =>
    ['asset', 'event', 'skill'].includes(card.type)
    && !card.subtype && !card.signatureFor && !card.story && !card.permanent
    && (card.xp ?? 0) === 0 && cardLimit(card) >= 2
    && matchesDeckOptions(def, card))
  const codes = []
  const seen = new Set()
  for (const card of pool) {
    if (seen.has(card.name)) continue
    seen.add(card.name)
    for (let index = 0; index < Math.min(2, cardLimit(card)) && codes.length < 35; index++) codes.push(card.code)
    if (codes.length >= 35) break
  }
  return codes
}

test('P5 10015 构筑：35 张玩家卡合法、越出选项/特性限额的牌组被拒绝', () => {
  const def = INVESTIGATORS['10015']
  assert.equal(def.deckRequirements.size, 35)
  assert.deepEqual([...def.deckRequirements.signatureCards].sort(), ['10017', '10018'])
  assert.deepEqual(def.deckOptions?.[1]?.trait, ['spirit', 'innate'])
  assert.equal(def.deckOptions?.[1]?.limit, 10)

  const legal = legalDeckCodes(def)
  assert.equal(legal.length, 35)
  assert.deepEqual(validateDeckRules(def, legal, ALL_CARDS).errors, [], '合法 35 张牌组应无错误')

  // 非法职阶/等级：07021 是其他循环的守卫者卡，不在生存者/中立或天性/勇气限额内。
  const illegal = [...legal.slice(0, 34), '07021']
  assert.ok(validateDeckRules(def, illegal, ALL_CARDS).errors.length > 0, '混入职阶外卡牌必须报错')

  // 天性/勇气「其他」限额 10：12 张不同名的跨职阶 [[Innate]]/[[Spirit]] 0–2 级卡超限。
  const traitPool = Object.values(ALL_CARDS).filter(card =>
    ['asset', 'event', 'skill'].includes(card.type)
    && !card.subtype && !card.signatureFor && !card.story && !card.permanent
    && cardLimit(card) >= 2 && (card.xp ?? 0) <= 2
    && !(card.factions || [card.klass]).some(faction => ['survivor', 'neutral'].includes(String(faction).toLowerCase()))
    && (card.traits || []).some(trait => ['spirit', 'innate'].includes(String(trait).toLowerCase()))
    && matchesDeckOptions(def, card))
  const traitCodes = []
  const traitNames = new Set()
  for (const card of traitPool) {
    if (traitNames.has(card.name)) continue
    traitNames.add(card.name)
    for (let index = 0; index < 2 && traitCodes.length < 12; index++) traitCodes.push(card.code)
    if (traitCodes.length >= 12) break
  }
  assert.equal(traitCodes.length, 12, '需要 12 张跨职阶天性/勇气卡验证限额')
  const nonTrait = legalDeckCodes(def).filter(code => {
    const card = ALL_CARDS[code]
    return !(card.traits || []).some(trait => ['spirit', 'innate'].includes(String(trait).toLowerCase()))
  })
  const overTraitLimit = [...nonTrait.slice(0, 23), ...traitCodes]
  assert.equal(overTraitLimit.length, 35)
  assert.ok(validateDeckRules(def, overTraitLimit, ALL_CARDS).errors.length > 0,
    '其他 [[Innate]]/[[Spirit]] 超过 10 张必须报错')
})

// 主进程合并后已重建 entries/index.js；buildDeck 通过静态实现索引判定签名卡已实现。
test('P5 10015 构筑：buildDeck 产出 35 张玩家卡并强制带入 10017/10018', () => {
  const def = INVESTIGATORS['10015']
  const built = buildDeck(def, { seed: 'fhv-p5-10015', xp: 0 })
  assert.equal(built.playerCards.length, 35)
  assert.deepEqual(built.signatureCards, ['10017'])
  assert.deepEqual(built.signatureWeaknesses, ['10018'])
  assert.equal(built.basicWeaknesses.length, 1)
  assert.equal(built.deck.length, 38, '35 张玩家卡 + 10017 + 10018 + 1 张随机基础弱点')
  assert.deepEqual(validateDeckRules(def, built.playerCards, ALL_CARDS).errors, [])
})

// ── 伤恐承接 flag ───────────────────────────────────────────────────────────
test('P5 10015 同地点调查员的盟友受到的伤害/恐惧可以分配给汉克（读档后仍可）', () => {
  const state = fixture('10015', 2)
  assert.equal(state.investigators[1].location, invOf(state).location)
  const ally = asset(state, '01018', {}, 1)
  const allyId = ally.id
  transact(state, draft => scenarioRuntime(draft, []).damageAsset(1, allyId, 2),
    choice => (choice.options.some(option => option.id === '2') ? '2' : null))
  assert.equal(invOf(state).damage, 2, '汉克承接 2 点伤害')
  assert.equal(findById(state.investigators[1].assets, allyId).damage || 0, 0, '盟友未受伤')

  const saved = copy(state)
  migrateState(saved)
  const horrorAlly = asset(saved, '01018', {}, 1)
  const horrorAllyId = horrorAlly.id
  const execute = draft => scenarioRuntime(draft, []).horrorAsset(1, horrorAllyId, 1)
  resolveTransaction(saved, 0, { action: 'fhv10015Harm' }, execute)
  for (let i = 0; saved.pendingChoice; i++) {
    const choice = saved.pendingChoice
    assert.ok(i < 20)
    const id = choice.options.some(option => option.id === '1') ? '1' : choice.options[0]?.id
    resolveTransaction(saved, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
  assert.equal(saved.investigators[0].horror, 1, '读档后汉克仍可承接恐惧')
  assert.equal(findById(saved.investigators[1].assets, horrorAllyId).horror || 0, 0)

  // 对照：没有 flag 的调查员不能承接同地点他人的盟友伤恐。
  const control = fixture('01001', 2)
  const ally2 = asset(control, '01018', {}, 1)
  const ally2Id = ally2.id
  transact(control, draft => scenarioRuntime(draft, []).damageAsset(1, ally2Id, 1))
  assert.equal(invOf(control).damage, 0)
  assert.equal(findById(control.investigators[1].assets, ally2Id).damage, 1)
})

// ── 濒败替换形态 ────────────────────────────────────────────────────────────
test('P5 10015 濒败替换：清空伤恐、换成 10016a、禁止治疗；读档后保持、restore 后恢复治疗', () => {
  const state = setupHank()
  swapToForm(state, '10016a')
  let inv = invOf(state)
  assert.equal(inv.code, '10016a')
  assert.equal(inv.cardCode, '10016a', '换面后当前卡面卡号指向所选坚毅面')
  assert.equal(inv.form, 'alternate')
  assert.equal(inv.formHealingProhibited, true)
  assert.deepEqual([inv.damage, inv.horror], [0, 0], '替换时治愈全部伤害与恐惧')
  assert.deepEqual([inv.willpower, inv.intellect, inv.combat, inv.agility], [3, 3, 4, 4])
  assert.deepEqual([inv.maxHealth, inv.maxSanity], [4, 6])
  assert.equal(inv.formOriginal.code, '10015')

  const saved = copy(state)
  migrateState(saved)
  assert.equal(saved.investigators[0].code, '10016a')
  assert.equal(saved.investigators[0].cardCode, '10016a')
  assert.equal(saved.investigators[0].formHealingProhibited, true, '存档往返保留治疗禁止')
  applyHarm(saved, saved.investigators[0], 1, 0, [], true)
  assert.equal(healDamageFrom(saved, saved.investigators[0], 1, []), 0, '坚毅面不能被治疗')
  assert.equal(saved.investigators[0].damage, 1)
  assert.equal(scenarioRuntime(saved, []).restoreInvestigatorForm(0), true)
  assert.equal(saved.investigators[0].code, '10015')
  assert.equal(saved.investigators[0].form, undefined)
  assert.equal(saved.investigators[0].formHealingProhibited, undefined)
  assert.equal(healDamageFrom(saved, saved.investigators[0], 1, []), 1, '还原形态后可以治疗')
  assert.equal(saved.investigators[0].damage, 0)
  inv = invOf(saved)
  assert.equal(inv.maxHealth, 5)
})

test('P5 10015 濒败替换：可选 10016b 面，数值按印刷坚毅·监守面', () => {
  const state = setupHank()
  swapToForm(state, '10016b')
  const inv = invOf(state)
  assert.deepEqual([inv.willpower, inv.intellect, inv.combat, inv.agility], [4, 1, 6, 3])
  assert.deepEqual([inv.maxHealth, inv.maxSanity], [6, 4])
  assert.equal(inv.code, '10016b')
  assert.equal(inv.cardCode, '10016b')
  assert.equal(inv.formHealingProhibited, true)
})

test('P5 10015 濒败替换只发生一次：坚毅面再次致命时正常败退', () => {
  const state = setupHank({}, 2)
  swapToForm(state, '10016a')
  invOf(state).damage = 4
  transact(state, draft => checkDefeated(draft, 0, []))
  assert.equal(invOf(state).defeated, true, '坚毅面没有第二次濒败替换')
  assert.equal(invOf(state).code, '10016a')
})

test('P5 10015 濒败替换只在仍然致命时结算：被快速卡救回后不换面', () => {
  const state = setupHank({ damage: 0, horror: 0 })
  transact(state, draft => reactionWindow(draft, 'wouldDefeat', {
    when: 'wouldDefeat', seat: 0, cause: 'damage', location: draft.investigators[0].location,
  }, []))
  assert.equal(invOf(state).code, '10015', '未处于致命伤/恐时不换成坚毅面')
  assert.equal(invOf(state).form, undefined)
  assert.equal(state.pendingChoice, null)
})

// ── 坚毅面反应与旧印 ────────────────────────────────────────────────────────
test('P5 10015 坚毅·助理面：恐惧放置后抽 1 张；旧印把 1 点恐惧移到支援', () => {
  const state = setupHank()
  swapToForm(state, '10016a')
  const handBefore = invOf(state).hand.length
  // 同一窗口可以再次触发（引擎会继续询问）；规则上每次放置只取一次，触发后让过。
  let triggered = false
  transact(state, draft => applyHarm(draft, draft.investigators[0], 0, 1, [], true), choice => {
    const usable = choice.options.find(option => option.id !== 'skip')
    if (usable && !triggered) { triggered = true; return usable.id }
    return null
  })
  assert.equal(invOf(state).hand.length, handBefore + 1, '恐惧放置后抽 1 张')
  assert.equal(invOf(state).horror, 1)

  const support = asset(state, '01018')
  const supportId = support.id
  const effect = elderSignEffect(state, invOf(state))
  assert.equal(effect.delta, 1)
  assert.equal(invOf(state).horror, 0, '旧印移走 1 点恐惧')
  assert.equal(findById(invOf(state).assets, supportId).horror, 1, '支援承接 1 点恐惧')
})

test('P5 10015 坚毅·监守面：伤害放置后获得 2 资源；旧印把 1 点伤害移到支援', () => {
  const state = setupHank()
  swapToForm(state, '10016b')
  invOf(state).resources = 5
  let triggered = false
  transact(state, draft => applyHarm(draft, draft.investigators[0], 1, 0, [], true), choice => {
    const usable = choice.options.find(option => option.id !== 'skip')
    if (usable && !triggered) { triggered = true; return usable.id }
    return null
  })
  assert.equal(invOf(state).resources, 7, '伤害放置后获得 2 资源')
  assert.equal(invOf(state).damage, 1)

  const support = asset(state, '01018')
  const supportId = support.id
  const effect = elderSignEffect(state, invOf(state))
  assert.equal(effect.delta, 1)
  assert.equal(invOf(state).damage, 0, '旧印移走 1 点伤害')
  assert.equal(findById(invOf(state).assets, supportId).damage, 1, '支援承接 1 点伤害')
})

// ── 一身是胆 10017 ──────────────────────────────────────────────────────────
function stoutheartedOnEngage(state, foeId, select) {
  transact(state, draft => engageEnemy(draft, draft.enemies.find(item => item.id === foeId), 0, []), select)
}

const pickStouthearted = choice => {
  const card = choice.options.find(option => option.cardCode === '10017')
  return card ? card.id : null
}

test('P5 10017 一身是胆：只能在与非精英敌人交战时打出，按 2 点上限分配伤/恐并作为伤害', () => {
  const state = setupHank({ damage: 1, horror: 1, resources: 10, hand: ['10017'] })
  const foe = enemy(state, { engagedSeat: null, health: 10 })
  const foeId = foe.id
  stoutheartedOnEngage(state, foeId, choice => {
    const card = pickStouthearted(choice)
    if (card) return card
    if (choice.options.some(option => option.id === 'horror')) return 'horror'
    if (choice.options.some(option => option.id === 'damage')) return 'damage'
    return null
  })
  assert.equal(invOf(state).hand.length, 0, '事件离手')
  assert.equal(invOf(state).resources, 8, '支付 2 资源')
  assert.deepEqual(invOf(state).discard.filter(code => code === '10017'), ['10017'])
  assert.deepEqual([invOf(state).damage, invOf(state).horror], [0, 0], '移动 1 伤害 + 1 恐惧')
  assert.equal(findById(state.enemies, foeId).damageTaken, 2, '敌人受到 2 点伤害')
})

test('P5 10017 一身是胆：普通行动/未交战/精英敌人都不提供快速窗口', () => {
  const state = setupHank({ damage: 2, horror: 0, resources: 10, hand: ['10017'] })
  // 快速事件只能在反应窗口打出（playAccess.reactionOnly）。
  assert.equal(legalMoves(state, 0).some(move => move.action === 'play' && move.cardId === '10017'), false)

  const elite = enemy(state, { engagedSeat: 0, elite: true, health: 10 })
  const eliteId = elite.id
  transact(state, draft => triggerReaction(draft, 0, 'enemyEngaged', [], { enemy: { id: eliteId, engagedSeat: 0, elite: true }, seat: 0 }))
  assert.equal(invOf(state).hand.includes('10017'), true, '精英敌人不能触发')
  assert.equal(state.pendingChoice, null)

  const unengaged = enemy(state, { engagedSeat: null, health: 10 })
  const unengagedId = unengaged.id
  transact(state, draft => triggerReaction(draft, 0, 'enemyEngaged', [], { enemy: { id: unengagedId, engagedSeat: 1 }, seat: 0 }))
  assert.equal(invOf(state).hand.includes('10017'), true, '未与你交战不能触发')

  // 汉克身上没有伤/恐时也不提供。
  const clean = setupHank({ damage: 0, horror: 0, resources: 10, hand: ['10017'] })
  const foe = enemy(clean, { engagedSeat: null, health: 10 })
  stoutheartedOnEngage(clean, foe.id, pickStouthearted)
  assert.equal(invOf(clean).hand.includes('10017'), true, '没有可移动伤恐时不能打出')
})

test('P5 10017 一身是胆：可移动总量受敌人剩余生命限制，不会超过 2 点', () => {
  const state = setupHank({ damage: 2, horror: 0, resources: 10, hand: ['10017'] })
  const foe = enemy(state, { engagedSeat: null, health: 1 })
  const foeId = foe.id
  stoutheartedOnEngage(state, foeId, choice => {
    const card = pickStouthearted(choice)
    if (card) return card
    if (choice.options.some(option => option.id === 'damage')) return 'damage'
    return null
  })
  assert.equal(state.enemies.some(item => item.id === foeId), false, '1 点生命的敌人被击败')
  assert.equal(invOf(state).damage, 1, '只移动了 1 点伤害（敌人剩余生命上限）')
})

test('P5 10017 一身是胆：坚毅面的「不能被治愈」不妨碍把伤/恐移动给敌人', () => {
  const state = setupHank()
  swapToForm(state, '10016a')
  assert.equal(invOf(state).formHealingProhibited, true)
  Object.assign(invOf(state), { damage: 1, horror: 0, resources: 10, hand: ['10017'] })
  const foe = enemy(state, { engagedSeat: null, health: 10 })
  const foeId = foe.id
  stoutheartedOnEngage(state, foeId, choice => {
    const card = choice.options.find(option => option.cardCode === '10017')
    if (card) return card.id
    if (choice.options.some(option => option.id === 'damage')) return 'damage'
    return null
  })
  assert.equal(invOf(state).damage, 0, '移动不是治疗：坚毅面仍可移出伤害')
  assert.equal(findById(state.enemies, foeId).damageTaken, 1)
})

// ── 专属弱点 10018 “爹爹在哪儿？” ──────────────────────────────────────────
function revealWheresPa() {
  const state = setupHank()
  const hereId = invOf(state).location
  const here = state.locations.find(location => location.id === hereId)
  const alley = {
    id: 'pa-alley', name: '小巷', code: 'pa-alley', revealed: true,
    clues: 0, shroud: 1, traits: [], connections: [hereId],
  }
  state.locations.push(alley)
  here.connections = ['pa-alley']
  // 遭遇牌库：顶到底 = 恐怖低语 ×2、食尸鬼（敌人最后被弃掉）。牌库顶是数组末位。
  state.encounterDeck = ['ghoulMinion', 'dissonantVoices', 'dissonantVoices']
  state.encounterDiscard = []
  invOf(state).deck = ['10018']
  transact(state, draft => drawCards(draft, draft.investigators[0], 1, []))
  return { state, hereId, alleyId: alley.id }
}

test('P5 10018 “爹爹在哪儿？”：从遭遇牌库顶弃到敌人，附属、生成在连接地点并获得逃逸', () => {
  const { state, hereId, alleyId } = revealWheresPa()
  const foe = state.enemies.find(item => item.code === 'ghoulMinion')
  assert.ok(foe, '找到的敌人应已生成')
  assert.equal(foe.location, alleyId, '生成在连接地点')
  assert.equal(foe.engagedSeat, null, '不与你交战')
  assert.deepEqual(foe.attachments.map(card => card.code), ['10018'])
  assert.equal(foe.attachments[0].ownerSeat, 0)
  assert.deepEqual(state.encounterDiscard, ['dissonantVoices', 'dissonantVoices'], '非敌人按顺序进遭遇弃牌堆')
  assert.equal(state.encounterDiscard.includes('ghoulMinion'), false)
  assert.equal(invOf(state).discard.includes('10018'), false, '附属中的弱点不进弃牌堆')
  assert.equal(state.locations.some(location => location.id === hereId), true)

  // 附属的敌人动态获得逃逸：实际攻击后按逃逸移动并横置。
  const foeId = foe.id
  invOf(state).location = alleyId
  transact(state, draft => enemyAttack(draft, draft.enemies.find(item => item.id === foeId), draft.investigators[0], []))
  const moved = state.enemies.find(item => item.id === foeId)
  assert.equal(moved.location, hereId, '逃逸：攻击后移动到连接地点')
  assert.equal(moved.exhausted, true, '逃逸后横置')

  // 存档往返保留附属与逃逸读点。
  const saved = copy(state)
  migrateState(saved)
  const restored = saved.enemies.find(item => item.id === foeId)
  assert.deepEqual(restored.attachments.map(card => card.code), ['10018'])
  assert.deepEqual(registeredEntry('10018').treacheryRule.enemyKeywordAura.keywords, ['elusive'])
})

test('P5 10018 “爹爹在哪儿？”：轮末汉克受到 1 点直接恐惧；所附属敌人不在场时不结算', () => {
  const { state } = revealWheresPa()
  const foe = state.enemies.find(item => item.code === 'ghoulMinion')
  const foeId = foe.id
  const before = invOf(state).horror
  roundEnds(state)
  assert.equal(invOf(state).horror, before + 1, '轮末受到 1 点直接恐惧')

  // 敌人离场（附属随宿主消失）：轮末不再造成恐惧。
  state.enemies = state.enemies.filter(item => item.id !== foeId)
  const after = invOf(state).horror
  roundEnds(state)
  assert.equal(invOf(state).horror, after, '所附属敌人不在场时不结算')
})

test('P5 10018 “爹爹在哪儿？”：没有连接地点时生成在当前地点；遭遇牌库无敌人时进弃牌堆', () => {
  const state = setupHank()
  const hereId = invOf(state).location
  state.locations.find(location => location.id === hereId).connections = []
  state.encounterDeck = ['ghoulMinion']
  state.encounterDiscard = []
  invOf(state).deck = ['10018']
  transact(state, draft => drawCards(draft, draft.investigators[0], 1, []))
  const foe = state.enemies.find(item => item.code === 'ghoulMinion')
  assert.ok(foe)
  assert.equal(foe.location, hereId, '没有连接地点时退回当前地点')
  assert.deepEqual(foe.attachments.map(card => card.code), ['10018'])

  const empty = setupHank()
  empty.encounterDeck = []
  empty.encounterDiscard = []
  invOf(empty).deck = ['10018']
  transact(empty, draft => drawCards(draft, draft.investigators[0], 1, []))
  assert.equal(invOf(empty).discard.filter(code => code === '10018').length, 1, '找不到敌人时弱点进弃牌堆')

  // 整副遭遇牌都没有敌人：扫描一轮后结束，不反复洗回弃牌堆空转。
  const noEnemy = setupHank()
  noEnemy.encounterDeck = ['dissonantVoices', 'dissonantVoices']
  noEnemy.encounterDiscard = []
  invOf(noEnemy).deck = ['10018']
  transact(noEnemy, draft => drawCards(draft, draft.investigators[0], 1, []))
  assert.equal(invOf(noEnemy).discard.filter(code => code === '10018').length, 1)
  assert.deepEqual([...noEnemy.encounterDiscard].sort(), ['dissonantVoices', 'dissonantVoices'],
    '无敌人时只扫描一轮，遭遇弃牌堆不重复堆叠')
})
