import { deckRules, matchesCardRule, deckCardLimit, validateDeckRules, optionExcluded } from './deck-rules.js'
// 诡镇奇谈：卡牌版（Arkham Horror LCG）· 牌组构筑引擎
//
// Phase 2 · 完整构筑规则：
//   - deck_options：职业 + 等级区间（含副职业 splash，见 cards-data.js 的 deckOptions 数组）；
//   - deck_requirements：牌库大小 30 + 专属签名卡/专属弱点 + 随机基础弱点；
//   - deck_limit：卡牌张数上限（非唯一卡默认 2，唯一/特例卡 1）。
//
// 卡牌数据来自 cards-data.js，效果编码来自 card-effects.js。
// 仅运行时白名单中的玩家卡可构筑；效果条目或技能图标不代表规则验收。
// 本引擎只读数据、可复现（种子随机），供 engine.js 调用。

import { PLAYER_CARDS, ALL_CARDS, INVESTIGATORS } from '../cards/cards-data.js'
import { legacyEntry, implementation } from '../cards/card-implementation.js'
import { PHASE5_MIGRATED_CODES } from '../cards/card-abilities.js'
import { abilityShim, modifiersFor, registeredEntry } from '../engine/ability.js'
import { playedEffect } from '../engine/lifecycle.js'
import {
  CORE_INVESTIGATOR_CODES, SIMPLIFIED_PLAYER_CARD_CODES, PLAYER_CARD_CODES,
  PLAYABLE_INVESTIGATOR_CODES,
  SIGNATURE_CARD_CODES_BY_INVESTIGATOR, BASIC_WEAKNESS_CODES, ALL_BASIC_WEAKNESS_CODES,
  TCU_PLAYER_BUILDABLE_CODES,
  canSelectInvestigator, isCardAvailable,
} from './availability.js'

const DECK_SIZE_DEFAULT = 30
const PLAYER_TYPES = new Set(['asset', 'event', 'skill'])
const PLAYER_CODE_SET = new Set(PLAYER_CARD_CODES)
// P10（M5 全量开放）：05 循环已验收的玩家卡进入开放玩家池（默认池 + 83 张可入牌组的 05 卡）。
// 05314/05317 是绑定卡的场外副本（deckLimit=0，不在牌组里），只作为已验收目录卡存在，不进构筑池。
// 默认池 PLAYER_CARD_CODES 保持原语义（核心 + 可选扩展包），00–04 循环的自动牌组产出不变；
// 「开放玩家池」只用于 TCU 战役的起始牌组与 TCU 调查员的构筑界面。
const TCU_DECK_CARD_CODES = Object.freeze(TCU_PLAYER_BUILDABLE_CODES.filter(code => {
  const card = ALL_CARDS[code]
  return Boolean(card) && cardLimit(card) > 0
}))
export const EXPANDED_PLAYER_CARD_CODES = Object.freeze([...PLAYER_CARD_CODES, ...TCU_DECK_CARD_CODES])
const EXPANDED_PLAYER_CODE_SET = new Set(EXPANDED_PLAYER_CARD_CODES)
// Phase 5 机械迁移的卡号：评分口径对这些卡改用能力层读点（其余卡保持旧口径）。
const PHASE5_MIGRATED = PHASE5_MIGRATED_CODES

export { CORE_INVESTIGATOR_CODES, PLAYABLE_INVESTIGATOR_CODES }

// ---------------------------------------------------------------------------
// 可用性判定
// ---------------------------------------------------------------------------

// 该卡是否满足调查员的 deck_options（阵营 + 等级区间）。
// 「额外限制：无等级 1-5 的[[武器]]卡牌」这类排除项先否决，再看是否命中某个允许项。
export function matchesDeckOptions(invDef, card) {
  if (optionExcluded(invDef, card)) return false
  return deckRules(invDef).options.some(rule => rule.not !== true && matchesCardRule(card, rule, invDef))
}

// 仅简化模式许可且有明确效果条目的卡牌；不使用技能图标隐式放行。
// 「有行为实现」的判定收敛到 src/cards/card-implementation.js（描述子 / 旧 DSL / 卡面数据三条通道）。
export function isPlayable(card) {
  return !!card && card.dataStatus !== 'quarantined' && isCardAvailable(card.code)
    && implementation(card.code).implemented
}

// 无效的张数元数据不能使构筑绕过数量限制。
export function cardLimit(card) {
  return deckCardLimit(card)
}

function validateInvestigator(invDef) {
  if (!canSelectInvestigator(invDef?.code) || !INVESTIGATORS[invDef.code] || invDef.type !== 'investigator'
    || invDef.dataStatus === 'quarantined' || INVESTIGATORS[invDef.code].dataStatus === 'quarantined') {
    throw new Error('调查员未获运行时许可、已隔离或定义缺失：' + (invDef?.code ?? '未知'))
  }
  const req = invDef.deckRequirements
  const signatures = SIGNATURE_CARD_CODES_BY_INVESTIGATOR[invDef.code]
  if (!req || (!Number.isSafeInteger(req.size) || req.size < 1 || req.size !== INVESTIGATORS[invDef.code].deckRequirements.size) || !Array.isArray(req.signatureCards)
    || req.signatureCards.length !== signatures.length
    || signatures.some((code) => !req.signatureCards.includes(code))
    || !Array.isArray(req.random) || req.random.length !== 1
    || req.random[0]?.target !== 'subtype' || req.random[0]?.value !== 'basicweakness'
    || !Array.isArray(invDef.deckOptions) || !invDef.deckOptions.length
    || JSON.stringify(invDef.deckOptions) !== JSON.stringify(INVESTIGATORS[invDef.code].deckOptions)) {
    throw new Error('调查员构筑依赖不完整或不受支持：' + invDef.code)
  }
}

function xpBudget(options) {
  const budget = options.xpBudget ?? 0
  if (!Number.isSafeInteger(budget) || budget < 0) throw new Error('XP 预算必须为非负整数')
  return budget
}

function cardDefinitionIn(set, code) {
  const card = ALL_CARDS[code]
  if (!set.has(code) || !Object.hasOwn(PLAYER_CARDS, code) || !card || card.code !== code) {
    throw new Error('玩家卡依赖缺失或未获许可：' + code)
  }
  if (!PLAYER_TYPES.has(card.type) || card.subtype === 'weakness' || card.subtype === 'basicweakness' || card.signatureFor) {
    throw new Error('玩家卡类型或签名归属不合法：' + code)
  }
  if (!isPlayable(card)) throw new Error('玩家卡效果依赖缺失：' + code)
  if (!Number.isSafeInteger(card.xp ?? 0) || (card.xp ?? 0) < 0 || cardLimit(card) === 0) {
    throw new Error('玩家卡等级或张数定义不合法：' + code)
  }
  return card
}

function playerCardDefinition(code) {
  return cardDefinitionIn(PLAYER_CODE_SET, code)
}

function expandedPlayerCardDefinition(code) {
  return cardDefinitionIn(EXPANDED_PLAYER_CODE_SET, code)
}

function allowedPlayerPool(options) {
  const provided = options.playerPool !== undefined
  const source = provided ? options.playerPool : PLAYER_CARD_CODES
  const allowed = provided ? EXPANDED_PLAYER_CODE_SET : PLAYER_CODE_SET
  if (!Array.isArray(source)) throw new Error('playerPool 必须为玩家卡数组')
  const codes = source.map((card) => typeof card === 'string' ? card : card?.code)
  if (codes.some((code) => typeof code !== 'string')) throw new Error('playerPool 包含无效卡牌编号')
  return [...new Set(codes)].filter((code) => allowed.has(code)).map((code) => cardDefinitionIn(allowed, code))
}

function emptyDeck(errors) {
  return { deck: [], playerCards: [], signatureCards: [], signatureWeaknesses: [], basicWeaknesses: [], errors }
}

// ---------------------------------------------------------------------------
// 打分（与调查员属性契合度，沿用 Phase 0/1 的定向构筑思路）
// ---------------------------------------------------------------------------

function skillRank(invDef) {
  const top = ['willpower', 'intellect', 'combat', 'agility']
    .slice()
    .sort((a, b) => (invDef[b] || 0) - (invDef[a] || 0))
  return (sk) => top.indexOf(sk)
}

// 单条效果的「技能权重」：{ skills: {combat:1.5, ...}, flat: 1.2 }
function effectWeights(effect) {
  const w = { skills: {}, flat: 0 }
  if (!effect) return w
  const boost = (sk, v) => { w.skills[sk] = (w.skills[sk] || 0) + v }
  switch (effect.type) {
    case 'fight': boost(effect.skill || 'combat', 2); break
    case 'investigate': boost('intellect', 2); break
    case 'evade': boost('agility', 1.5); break
    case 'dealDamage': boost('combat', 1.2); break
    case 'discoverClue': boost('intellect', 1.2); break
    case 'gainResource': w.flat += 1.4; break
    case 'draw': w.flat += 1.4; break
    case 'heal': w.flat += 1.2; break
    case 'gainAction': w.flat += 2.0; break
    case 'skillTest': boost(effect.skill, 1.5); break
    case 'chooseOne':
      for (const opt of (effect.options || [])) {
        const sub = effectWeights(opt.effect)
        for (const [sk, v] of Object.entries(sub.skills)) boost(sk, v)
        w.flat += sub.flat
      }
      break
    default: break
  }
  return w
}

export function scoreCard(card, invDef) {
  let s = 0
  const rank = skillRank(invDef)
  const boost = (sk, v) => { s += v * (4 - rank(sk)) }

  const eff = legacyEntry(card.code)
  // Phase 5：自动构筑的评分口径必须与迁移前一致（牌组会被写进对局存档）。
  // 因此只对「Phase 5 机械迁移」的卡改用新读点——把搬走的数据原样计回分数；
  // 更早手写描述子的卡保持历史口径（它们的 abilities/played 数据历来不参与评分）。
  const migrated = PHASE5_MIGRATED.has(card.code)

  // Phase 5（5b-6d）：被动数据体可能已在能力层条目上（过渡方案），评分口径不变。
  const passive = eff?.passive || registeredEntry(card.code)?.passive || null
  if (passive) {
    const p = passive
    if (p.stats) for (const [sk, v] of Object.entries(p.stats)) boost(sk, v * 2.5)
    if (p.fightDamage) boost('combat', p.fightDamage * 1.5)
    if (p.healthBonus) s += 2.0
    if (p.sanityBonus) s += 1.5
    if (p.handSizeBonus) s += 1.2
  } else if (migrated) {
    // 迁移后 passive.stats 写成声明式修正；按同一折算系数计分。
    for (const modifier of modifiersFor(card.code)) {
      if (modifier.condition || typeof modifier.amount !== 'number') continue
      if (typeof modifier.target !== 'string' || !modifier.target.startsWith('skill:')) continue
      const skill = modifier.target === 'skill:*' ? 'wild' : modifier.target.slice('skill:'.length)
      boost(skill, modifier.amount * 2.5)
    }
  }

  // 主动能力：旧 DSL 的 abilities，加上迁移后从描述子折叠回来的同一份形状。
  const abilities = [...(eff?.abilities || []), ...(migrated ? abilityShim(card.code) : [])]
  if (abilities.length) {
    for (const ab of abilities) {
      const w = effectWeights(ab.effect)
      for (const [sk, v] of Object.entries(w.skills)) boost(sk, v)
      s += w.flat
    }
  }

  // 事件卡打出效果：迁移后改由 lifecycle 读点提供（数据原样）。
  const played = migrated ? playedEffect(card.code) : (eff ? eff.event : null)
  if (played) {
    const w = effectWeights(played)
    for (const [sk, v] of Object.entries(w.skills)) boost(sk, v)
    s += w.flat
  }

  // Phase 5（5b-7）：天赋档位搬到能力层后评分口径不变（旧 DSL 优先、条目回落）。
  const freeTriggers = eff?.freeTriggers || registeredEntry(card.code)?.freeTriggers || []
  if (freeTriggers.length) {
    for (const ft of freeTriggers) boost(ft.skill, 1.2)
  }

  if (card.icons) {
    for (const [sk, v] of Object.entries(card.icons)) {
      if (sk === 'wild') s += v * 1.5
      else boost(sk, v)
    }
  }
  return s
}

// ---------------------------------------------------------------------------
// 牌组构筑
// ---------------------------------------------------------------------------

// options: { seat, seed, playerPool?, basicWeaknessPool?, xpBudget? }
// playerPool 只能收窄许可池（卡定义或编号数组）；XP 预算默认 0。
// deck 为洗好的 30 张玩家卡 + 签名卡 + 专属弱点 + 随机基础弱点。
// 第 5 步 P6：直觉牌库（乔·戴蒙德）要求牌组至少含 N 张[[洞察]]事件——自动构筑会先放够配额。
function hunchRequirement(invDef) {
  const rule = registeredEntry(invDef?.code)?.investigator?.hunchDeck || null
  if (!rule || typeof rule.trait !== 'string' || !Number.isSafeInteger(rule.size)) return null
  const required = Array.isArray(rule.requiredCodes) ? rule.requiredCodes.length : 0
  return { trait: rule.trait, size: rule.size, required: Math.max(0, rule.size - required) }
}

function isTraitCard(card, trait) {
  return (card?.traits || []).some(item => String(item).toLowerCase() === String(trait).toLowerCase())
}

export function buildDeck(invDef, options = {}) {
  validateInvestigator(invDef)
  const size = deckRules(invDef).size
  const budget = xpBudget(options)
  const rng = mulberry32(hashSeed((options.seed || 'deck') + ':' + invDef.code + ':' + (options.seat ?? 0)))
  const pool = allowedPlayerPool(options).filter((c) => matchesDeckOptions(invDef, c))
  const scored = pool.map((c) => ({ card: c, score: scoreCard(c, invDef) + (rng() * 0.6 - 0.3) }))
  scored.sort((a, b) => b.score - a.score)

  const hunch = hunchRequirement(invDef)
  const deck = []
  let spentXp = 0
  // 直觉牌库的定额先放：只要洞察事件，避免自动构筑把配额定缺。
  // 0 XP 开局只能放等级 0 的卡（升级后才可能换成更高等级的洞察事件）。
  if (hunch) {
    let added = 0
    for (const { card } of scored) {
      if (added >= hunch.required) break
      if (card.type !== 'event' || !isTraitCard(card, hunch.trait)) continue
      const xpCost = (card.xp ?? 0) * (card.exceptional ? 2 : 1)
      if (xpCost && xpCost > budget - spentXp) continue
      const add = Math.min(cardLimit(card), hunch.required - added, size - deck.length)
      for (let k = 0; k < add; k++) {
        if (validateDeckRules(invDef, [...deck, card.code], ALL_CARDS, { partial: true }).errors.length) break
        deck.push(card.code)
        added++
        spentXp += xpCost
      }
    }
  }
  for (const { card } of scored) {
    if (deck.length >= size) break
    const cost = (card.xp ?? 0) * (card.exceptional ? 2 : 1)
    const affordable = cost ? Math.floor((budget - spentXp) / cost) : size
    const add = Math.min(cardLimit(card), size - deck.length, affordable)
    for (let k = 0; k < add; k++) {
      if (validateDeckRules(invDef, [...deck, card.code], ALL_CARDS, { partial: true }).errors.length) break
      deck.push(card.code); spentXp += cost
    }
  }
  if (deck.length !== size) throw new Error('许可卡池与 XP 预算不足以构筑 ' + size + ' 张玩家卡，当前 ' + deck.length + ' 张')
  if (hunch) {
    const insights = deck.filter(code => isTraitCard(ALL_CARDS[code], hunch.trait) && ALL_CARDS[code]?.type === 'event')
    if (insights.length < hunch.required) {
      throw new Error(`许可卡池不足以构筑直觉牌库：需要 ${hunch.required} 张[[${hunch.trait}]]事件，当前 ${insights.length} 张`)
    }
  }

  const sig = signatureAndWeaknesses(invDef, rng, options)
  const full = [...deck, ...sig.signatureCards, ...sig.signatureWeaknesses, ...sig.basicWeaknesses]
  return {
    deck: shuffle(full, rng),
    playerCards: deck,
    ...sig,
  }
}

// 抽取专属签名卡 / 专属弱点 / 随机基础弱点（自动构筑与手动构筑共用）。
export function signatureAndWeaknesses(invDef, rng, options = {}) {
  const signatureCards = []
  const signatureWeaknesses = []
  for (const code of deckRules(invDef).signatureCards) {
    const def = ALL_CARDS[code]
    if (!def || def.code !== code
      || !implementation(code).implemented
      || !Array.isArray(def.signatureFor)
      || !def.signatureFor.includes(invDef.code)) {
      throw new Error('签名卡或专属弱点依赖缺失/不合法：' + code)
    }
    const quantity = Number.isSafeInteger(def.quantity) && def.quantity > 0 ? def.quantity : 1
    if (def.subtype === 'weakness') signatureWeaknesses.push(...Array(quantity).fill(code))
    else if (PLAYER_TYPES.has(def.type) && !def.subtype) signatureCards.push(...Array(quantity).fill(code))
    else throw new Error('签名卡或专属弱点类型不合法：' + code)
  }


  const basicPool = options.basicWeaknessPool === undefined ? BASIC_WEAKNESS_CODES : options.basicWeaknessPool
  if (!Array.isArray(basicPool) || !basicPool.length) throw new Error('基础弱点依赖缺失：候选池不能为空')
  for (const code of basicPool) {
    const def = ALL_CARDS[code]
    // P8：TCU 的 05042《高塔·XVI》是**资产**型基础弱点（占塔罗槽），构筑规则允许它作为
    // 随机基础弱点候选；旧校验只认 treachery/enemy，会把整包合法候选判成非法。
    const weaknessTypeOk = ['treachery', 'enemy'].includes(def?.type) || PLAYER_TYPES.has(def?.type)
    if (!ALL_BASIC_WEAKNESS_CODES.includes(code) || !def || def.code !== code || def.subtype !== 'basicweakness'
      || def.dataStatus === 'quarantined' || def.signatureFor || !weaknessTypeOk
      || (def.type !== 'enemy' && !isPlayable(def))) {
      throw new Error('基础弱点依赖缺失或未获许可：' + code)
    }
  }
  const candidates = [...new Set(basicPool)]
  const requests = deckRules(invDef).random || []
  if (requests.some(rule => rule.target !== 'subtype' || rule.value !== 'basicweakness' || !Number.isSafeInteger(rule.count ?? 1) || (rule.count ?? 1) < 0)) throw new Error('未支持的随机构筑依赖')
  const basicWeaknesses = requests.flatMap(rule => Array.from({ length: rule.count ?? 1 }, () => candidates[Math.floor(rng() * candidates.length)]))
  return { signatureCards, signatureWeaknesses, basicWeaknesses }
}

// ---------------------------------------------------------------------------
// Phase 6 · 手动构筑（D5 选 B：玩家可选调查员 + 手动组卡，AI 自动）
// ---------------------------------------------------------------------------

// 用显式卡牌清单构筑牌库，并做完整校验。返回与 buildDeck 同形的结果，外加 errors 数组。
// cardCodes：30 张玩家卡（不含签名卡/弱点，这些会自动加入）。
export function buildDeckFromList(invDef, cardCodes, options = {}) {
  const errors = []
  let pool, budget
  try {
    validateInvestigator(invDef)
    budget = xpBudget(options)
    pool = new Set(allowedPlayerPool(options).map((card) => card.code))
  } catch (error) {
    return emptyDeck([error.message])
  }
  if (!Array.isArray(cardCodes)) return emptyDeck(['玩家卡清单必须为编号数组'])
  const codes = cardCodes.slice()
  const size = deckRules(invDef).size
  const rng = mulberry32(hashSeed((options.seed || 'deck') + ':' + invDef.code + ':' + (options.seat ?? 0)))
  const seen = new Map()
  for (const code of codes) {
    if (typeof code !== 'string') { errors.push('卡牌编号必须为字符串'); continue }
    seen.set(code, (seen.get(code) || 0) + 1)
  }

  let spentXp = 0
  for (const [code, n] of seen) {
    if (!Object.hasOwn(ALL_CARDS, code)) { errors.push('未知卡牌：' + code); continue }
    const card = ALL_CARDS[code]
    const name = card.nameZh || card.name || code
    if (card.signatureFor) { errors.push(name + ' 是签名卡或专属弱点，会自动加入'); continue }
    if (!PLAYER_TYPES.has(card.type) || card.subtype === 'weakness' || card.subtype === 'basicweakness') {
      errors.push(name + ' 不是可手动加入的普通玩家卡'); continue
    }
    if (!PLAYER_CODE_SET.has(code) || !isPlayable(card)) { errors.push(name + ' 未获运行时许可'); continue }
    if (!pool.has(code)) { errors.push(name + ' 不在 playerPool 白名单内'); continue }
    if (!matchesDeckOptions(invDef, card)) { errors.push(name + ' 不符合构筑限制'); continue }
    if (n > cardLimit(card)) errors.push(name + ' 超过张数上限（' + cardLimit(card) + '）')
    spentXp += n * (card.xp ?? 0) * (card.exceptional ? 2 : 1)
  }
  errors.push(...validateDeckRules(invDef, codes, ALL_CARDS).errors)
  // 第 5 步 P6：直觉牌库的定额（手动构筑同样要满足）。
  const hunch = hunchRequirement(invDef)
  if (hunch) {
    const insights = codes.filter(code => isTraitCard(ALL_CARDS[code], hunch.trait) && ALL_CARDS[code]?.type === 'event')
    if (insights.length < hunch.required) {
      errors.push(`牌组需要至少 ${hunch.required} 张[[${hunch.trait}]]事件作为直觉牌库，当前 ${insights.length} 张`)
    }
  }
  if (spentXp > budget) errors.push('牌组需要 ' + spentXp + ' XP，超过预算 ' + budget + ' XP')


  let sig
  try {
    sig = signatureAndWeaknesses(invDef, rng, options)
  } catch (error) {
    errors.push(error.message)
  }
  if (errors.length) return emptyDeck(errors)
  const full = [...codes, ...sig.signatureCards, ...sig.signatureWeaknesses, ...sig.basicWeaknesses]
  return { deck: shuffle(full, rng), playerCards: codes, ...sig, errors }
}

// 固定的 Core 58 张简化模式玩家卡；缺少定义或效果时明确报错，不静默缩小。
export function corePlayablePool() {
  return SIMPLIFIED_PLAYER_CARD_CODES.map(playerCardDefinition)
}
export function playablePool() { return PLAYER_CARD_CODES.map(playerCardDefinition) }
// P10：开放玩家池 = 默认池 + 83 张 05 可入牌组的卡。自动构筑默认仍用 playablePool（旧循环产出不变），
// 只有 TCU 战役的起始牌组（engine corePlayerPool）与构筑界面（deckBuilderData）、'all' 范围手动提交用它。
export function expandedPlayablePool() { return EXPANDED_PLAYER_CARD_CODES.map(expandedPlayerCardDefinition) }

// 给前端「卡组构筑界面」的静态元数据（纯 JSON，经 catalog 下发）。
export function deckBuilderData() {
  const pool = expandedPlayablePool()
  const investigators = PLAYABLE_INVESTIGATOR_CODES.map((code) => {
    const inv = INVESTIGATORS[code]
    validateInvestigator(inv)
    signatureAndWeaknesses(inv, () => 0)
    const req = { ...inv.deckRequirements, ...deckRules(inv) }
    const sigs = req.signatureCards.map((c) => {
      const d = ALL_CARDS[c]
      return {
        code: c,
        name: d ? (d.nameZh || d.name) : c,
        nameEn: d ? d.name : c,
        type: d ? d.type : null,
        subtype: d ? d.subtype : null,
      }
    })
    return {
      code: inv.code, name: inv.nameZh, nameEn: inv.name, klass: inv.klass,
      willpower: inv.willpower, intellect: inv.intellect, combat: inv.combat, agility: inv.agility,
      health: inv.health, sanity: inv.sanity,
      subname: inv.subnameZh || inv.subname || '',
      traits: inv.traitsZh || inv.traits || [],
      pack: inv.pack || 'core', packName: inv.packName || '',
      abilityText: inv.textZh || inv.text || '',
      deckSize: deckRules(inv).size,
      rules: deckRules(inv),
      deckOptions: deckRules(inv).options,
      allowedCards: pool.filter(card => matchesDeckOptions(inv, card) && (card.xp || 0) === 0).map(card => card.code),
      signatureCards: sigs.filter((s) => !s.subtype || (s.subtype !== 'weakness' && s.subtype !== 'basicweakness')),
      signatureWeaknesses: sigs.filter((s) => s.subtype === 'weakness' || s.subtype === 'basicweakness'),
    }
  })

  const cardPool = pool.map((c) => ({
    code: c.code, name: c.nameZh, nameEn: c.name, klass: c.klass, type: c.type,
    pack: c.pack || null, campaignCode: c.campaignCode || null,
    cost: c.cost, xp: c.xp ?? 0, icons: c.icons || {}, slot: c.slot || null, slots: c.slots || [],
    traits: c.traits || [], traitsZh: c.traitsZh || [],
    text: c.textZh || c.text || '', flavor: c.flavorZh || c.flavor || '',
    subname: c.subnameZh || c.subname || '',
    permanent: !!c.permanent, ignoreDeckLimit: !!c.ignoreDeckLimit, factions: c.factions || [c.klass, c.klass2, c.klass3].filter(Boolean),
    deckLimit: cardLimit(c), unique: !!c.unique, exceptional: !!c.exceptional,
    doubleSided: !!c.doubleSided, subtype: c.subtype || null,
  }))

  return { investigators, cardPool, size: DECK_SIZE_DEFAULT }
}

// ---------------------------------------------------------------------------
// 随机 / 洗牌（与 engine.js 保持同一实现，可复现）
// ---------------------------------------------------------------------------

export function hashSeed(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle(arr, rng) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
