import { ALL_CARDS, INVESTIGATORS } from '../cards/cards-data.js'
import { PLAYER_CARD_CODES, CORE_UPGRADE_CODES, TFA_PLAYER_BUILDABLE_CODES, TCU_PLAYER_BUILDABLE_CODES, TDE_PLAYER_BUILDABLE_CODES, canSelectInvestigator, isCardAvailable } from '../deck/availability.js'
import { allowsCard, filterCardCodes } from '../deck/card-pool.js'
import { matchesDeckOptions, cardLimit, isPlayable, scoreCard, hashSeed, DRAFT_PLAYER_CARD_CODES } from '../deck/deckbuilding.js'
import { validateDeckRules, upgradeQuote, deckRules, draftCardLimit } from '../deck/deck-rules.js'
import { registeredEntry } from '../engine/ability.js'
import { partScopedView } from './campaign-parts.js'
import { TIC_PLAYER_BUILDABLE_CODES } from '../deck/availability.js'

const playerPool = [...PLAYER_CARD_CODES, ...CORE_UPGRADE_CODES]
const tfaPool = [...TFA_PLAYER_BUILDABLE_CODES]
const tfaPoolSet = new Set(tfaPool)
const tcuPool = [...TCU_PLAYER_BUILDABLE_CODES]
const tcuPoolSet = new Set(tcuPool)
// P7（食梦者 M2）：06 记录能看到「原有池 + 食梦者 83 张可构筑玩家卡」；01–05 记录看不到 06 卡。
// 与 TCU/失落的时代同一口径：新卡池不改变既有循环的升级候选与 AI 推荐结果。
const tdePool = [...TDE_PLAYER_BUILDABLE_CODES]
const tdePoolSet = new Set(tdePool)
const ticPool = [...TIC_PLAYER_BUILDABLE_CODES], ticPoolSet = new Set(ticPool)
const poolFor = (record, context = null) => filterCardCodes(
  record?.draftMode ? DRAFT_PLAYER_CARD_CODES : [...(record && /^04\d{3}$/.test(String(record.code || '')) ? [...playerPool, ...tfaPool]
    : record && /^05\d{3}$/.test(String(record.code || '')) ? [...playerPool, ...tcuPool]
      : record && /^06\d{3}$/.test(String(record.code || '')) ? [...playerPool, ...tdePool]
        : playerPool), ...(record && (/^07\d{3}$/.test(String(record.code || '')) || record.deck?.some(code => ticPoolSet.has(code))) ? ticPool : [])], context)
const ordinary = code => playerPool.includes(code) || tfaPoolSet.has(code) || tcuPoolSet.has(code) || tdePoolSet.has(code) || ticPoolSet.has(code)
const ordinaryFor = record => code => record.draftMode ? DRAFT_PLAYER_CARD_CODES.includes(code) : ordinary(code)
// 第 123 轮（第 8 批）：升级前置记录、开局经验、永久资产身份、同名去重全部由条目声明：
// `researchRequirement` / `startingXp` / `shrewdAnalysis` / `arcaneResearch` / `uniqueInDeck`。
const entryFlagOf = code => registeredEntry(code) || null
const researchRequirementFor = code => entryFlagOf(code)?.researchRequirement || null
// 「老练分析」「奥术研究」按身份标志在牌组里定位（不再写死卡号）。
const deckCardWithFlag = (record, flag) => (record.deck || []).find(code => entryFlagOf(code)?.[flag] === true) || null

// 「掉进兔子洞」这类永久卡的经验计价参数由条目声明式 flag 提供，战役层只读声明、不认卡号
// （与 arcaneResearch 同口径）：
//   flags.upgradeDiscount = { first, amount }：每个关间前 first 次「升级」各减 amount 经验；
//   flags.purchaseCostDelta：购买新卡（无替换的购入）经验 +N。
const permanentPricingFor = record => {
  const code = (record?.deck || []).find(item => entryFlagOf(item)?.flags?.upgradeDiscount)
  if (!code) return null
  const flags = entryFlagOf(code)?.flags || {}
  const spec = flags.upgradeDiscount || {}
  const first = Number.isSafeInteger(spec.first) ? spec.first : 0
  const amount = Number.isSafeInteger(spec.amount) ? spec.amount : 0
  const purchaseCostDelta = Number.isSafeInteger(flags.purchaseCostDelta) ? flags.purchaseCostDelta : 0
  if (!first || amount <= 0) return null
  return { code, first, amount, purchaseCostDelta }
}
const permanentPricingUsed = record => Number.isSafeInteger(record?.upgradeDiscountUsed)
  ? record.upgradeDiscountUsed : 0

// 个别调查员在战役开始时带有额外经验（马泰奥神父：+5，由 04004 条目声明）。

// 「老练分析」（04106）：带（未鉴定）/（未翻译）副标题的卡牌升级时，
// 可以用 0 经验再升级一张同名副本，两张升级版本从合法选项中确定性地伪随机挑选。
const UNRESOLVED_SUBTITLE = /(未鉴定|未翻译|Unidentified|Untranslated)/
const shrewdAnalysisEligible = (record, removedCode, context = null) => {
  const removedDef = ALL_CARDS[removedCode]
  if (!removedDef || !UNRESOLVED_SUBTITLE.test(String(removedDef.subnameZh || removedDef.subname || ''))) return []
  const inv = INVESTIGATORS[record.code]
  if (!deckCardWithFlag(record, 'shrewdAnalysis')) return []
  return filterCardCodes([...playerPool, ...tfaPool], context).filter(code => {
    const def = ALL_CARDS[code]
    if (!def || def.name !== removedDef.name || (def.xp || 0) === 0) return false
    if (!isCardAvailable(code) || !isPlayable(def) || !matchesDeckOptions(inv, def)) return false
    return !validateDeckRules(inv, [...record.deck.filter(item => item !== removedCode), code].filter(ordinaryFor(record)), ALL_CARDS, { draftMode: !!record.draftMode }).errors.length
  }).sort((left, right) => left.localeCompare(right))
}

// 确定性伪随机：同一牌组记录总是得到同一结果，保证存档回放一致。
const shrewdPick = (record, campaign, eligible) =>
  eligible[hashSeed(`${record.id}:${campaign.scenarioIndex}:${record.purchases.length}:${eligible.length}`) % eligible.length]

export function shrewdAnalysisUpgrade(campaign, seat, removedCode, context = null) {
  const record = campaign.investigators[seat]
  if (!record) return null
  const eligible = shrewdAnalysisEligible(record, removedCode, context)
  if (eligible.length < 1) return null
  // 需要牌组里还有另一张同名副本可以升级。
  if (!record.deck.includes(removedCode)) return null
  const picked = shrewdPick(record, campaign, eligible)
  record.deck.splice(record.deck.indexOf(removedCode), 1, picked)
  record.deck.sort()
  const change = { added: picked, removed: removedCode, cost: 0, scenarioIndex: campaign.scenarioIndex,
    adaptable: false, shrewdAnalysis: true }
  record.purchases.push(change)
  return change
}

// 「奥术研究」（04109）：购买时承受 1 点精神创伤；每场冒险后重置法术升级优惠。
export function applyPermanentPurchaseEffects(campaign, seat, addedCode) {
  const record = campaign.investigators[seat]
  if (!record) return null
  // 第 123 轮：「奥术研究」按条目 identity 判定，不再写死 04109。
  if (!entryFlagOf(addedCode)?.arcaneResearch) return null
  campaign.trauma ||= {}
  campaign.trauma[seat] ||= { physical: 0, mental: 0 }
  campaign.trauma[seat].mental += 1
  record.trauma ||= { physical: 0, mental: 0 }
  record.trauma.mental += 1
  record.arcaneResearchDiscount = true
  updateCampaignStatus(campaign, seat)
  return { code: addedCode, mentalTrauma: 1 }
}

export function refreshArcaneResearch(campaign) {
  const refreshed = []
  for (const record of Object.values(campaign.investigators || {})) {
    // 08059「掉进兔子洞」：「前 N 次升级 -1 经验」按关间计数，与奥术研究同一刷新点重置。
    if (permanentPricingFor(record)) record.upgradeDiscountUsed = 0
    if (!deckCardWithFlag(record, 'arcaneResearch')) continue
    record.arcaneResearchDiscount = true
    refreshed.push(record.seat)
  }
  return refreshed
}

export function registerCampaignInvestigator(campaign, inv, deck) {
  const id = `investigator-${++campaign.investigatorSeq}`
  const startingXp = entryFlagOf(inv.code)?.startingXp ?? 0
  const record = {
    id, seat: inv.seat, code: inv.code, name: inv.name, deck: [...deck].sort(),
    currentScenarioIndex: campaign.scenarioIndex || 0,
    xp: startingXp, earnedXp: startingXp, spentXp: 0, trauma: { physical: 0, mental: 0 },
    status: 'active', purchases: [], removedCards: [],
  }
  campaign.investigators[inv.seat] = record
  campaign.xp = Object.values(campaign.investigators).reduce((sum, item) => sum + item.xp, 0)
  campaign.trauma[inv.seat] = { ...record.trauma }
  inv.campaignId = id
  return record
}

export function updateCampaignStatus(campaign, seat) {
  const record = campaign.investigators[seat]
  record.trauma = { ...campaign.trauma[seat] }
  const def = INVESTIGATORS[record.code]
  if (record.status === 'active') {
    if (record.trauma.physical >= def.health) record.status = 'killed'
    else if (record.trauma.mental >= def.sanity) record.status = 'insane'
  }
  return record.status
}

export function replacementCandidates(campaign, context = null) {
  const used = new Set([...Object.values(campaign.investigators), ...campaign.retired].map(record => record.code))
  return Object.keys(INVESTIGATORS).filter(code => canSelectInvestigator(code) && !used.has(code) && allowsCard(code, context))
}

export function awardExperience(campaign, seat, amount) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('经验奖励必须为非负整数')
  const record = campaign.investigators[seat]
  record.xp += amount
  record.earnedXp += amount
  campaign.xp = Object.values(campaign.investigators).reduce((sum, item) => sum + item.xp, 0)
}

export function campaignCardChange(campaign, seat, code, action, reason) {
  const record = campaign.investigators[seat]
  if (!record || !ALL_CARDS[code]) throw new Error('无效的战役卡牌变更')
  if (action === 'add') {
    // 第 123 轮：「丽塔·钱德勒」这类剧情资产由条目 uniqueInDeck 声明同名只保留一张。
    if (!entryFlagOf(code)?.uniqueInDeck || !record.deck.includes(code)) record.deck.push(code)
    record.deck.sort()
  } else if (action === 'remove') {
    const index = record.deck.indexOf(code)
    if (index < 0) throw new Error('战役牌组不含待移除卡牌')
    record.deck.splice(index, 1)
    record.removedCards.push({ code, reason, scenarioIndex: campaign.scenarioIndex })
  } else throw new Error('未知战役卡牌变更')
}

export function upgradeCost(added, removed) {
  return upgradeQuote(added, removed).cost
}

// 升级优惠：记录上的通用优惠 + 「奥术研究」每场冒险后的第一张法术减 1。
function upgradeDiscountsFor(record) {
  const discounts = [...(record.upgradeDiscounts || [])]
  const arcaneCode = deckCardWithFlag(record, 'arcaneResearch')
  if (record.arcaneResearchDiscount && arcaneCode) {
    discounts.push({ amount: 1, match: { traits: ['Spell'] }, source: arcaneCode })
  }
  return discounts
}

// 不参与升级替换的牌组卡：升级界面据此把卡置灰并说明原因。
function nonReplaceableReason(card) {
  if (!card) return '这张卡不在本次升级的可替换范围内。'
  if (card.subtype === 'weakness' || card.subtype === 'basicweakness') return '弱点不能替换。'
  if (card.signatureFor) return '专属卡牌（签名卡/专属弱点）随调查员加入牌组，不能替换。'
  if (card.permanent) return '永久卡始终在场上，不占牌组槽位，不能替换。'
  return '剧情资产与战役奖赏不占普通牌组槽位，不能通过升级替换。'
}

// 单张替换的判定（顺序与 legalMoves 完全一致）：成功给出报价，失败给出界面可直接展示的中文原因。
function replacementVerdict(record, addedCode, added, inv, removedCode, mayFillVacancy) {
  const removed = removedCode ? ALL_CARDS[removedCode] : null
  if (record.draftMode && added.permanent && removedCode) return { ok: false, reason: '永久卡直接加入牌组，不能替换普通卡。' }
  if (!removedCode) {
    // 「无需替换」只在永久卡或牌组还有空位时成立。
    if (!added.permanent && !mayFillVacancy) return { ok: false, reason: '牌组已满，需要先替换掉一张普通卡。' }
  } else if (removedCode === addedCode) {
    return { ok: false, reason: '不能把这张卡替换成同一张卡。' }
  } else if (!ordinaryFor(record)(removedCode) || (removed && (removed.permanent || removed.signatureFor || removed.subtype))) {
    return { ok: false, reason: nonReplaceableReason(removed) }
  }
  const limit = record.draftMode ? draftCardLimit(added) : cardLimit(added)
  const label = added.nameZh || added.name
  const count = record.deck.filter(code => ALL_CARDS[code]?.name === added.name).length
    - (removed?.name === added.name ? 1 : 0)
  if (count >= limit) return { ok: false, reason: `牌组中已有 ${count} 张同名的「${label}」，达到 ${limit} 张上限。` }
  const deck = [...record.deck]
  if (removedCode) deck.splice(deck.indexOf(removedCode), 1)
  deck.push(addedCode)
  // Story assets earned by resolutions (e.g. Lita) are campaign dependencies,
  // not ordinary deck slots. They must not block every subsequent upgrade.
  const validatable = deck.filter(ordinaryFor(record))
  if (record.draftMode) {
    const rules = deckRules(inv, validatable, ALL_CARDS)
    const remaining = rules.size - validatable.filter(code => !ALL_CARDS[code].permanent && !ALL_CARDS[code].ignoreDeckLimit).length
    if (Object.entries(rules.minimumTypes || {}).some(([type, minimum]) =>
      validatable.filter(code => ALL_CARDS[code].type === type).length + remaining < minimum)) {
      return { ok: false, reason: '扩容后的空位不足以满足最低卡牌类型要求，请先调整牌组。' }
    }
  }
  const errors = validateDeckRules(inv, validatable, ALL_CARDS,
    { partial: mayFillVacancy || Boolean(registeredEntry(addedCode)?.deckConstruction?.sizeBonus), draftMode: !!record.draftMode }).errors
  if (errors.length) {
    // 永久卡不占牌组槽位：换走一张普通卡会让牌组少一张，只能「无需替换」直接加入。
    const rulesSize = inv.deckRequirements?.size || 30
    const counted = validatable.filter(code => ALL_CARDS[code] && !ALL_CARDS[code].permanent && !ALL_CARDS[code].ignoreDeckLimit).length
    return { ok: false, reason: added.permanent && counted < rulesSize
      ? '永久卡不占牌组槽位，只能直接加入牌组，不能替换普通卡。'
      : `替换后牌组不合法：${errors[0]}` }
  }
  const adaptableUsed = (record.purchases || []).filter(purchase => purchase.scenarioIndex === record.currentScenarioIndex && purchase.adaptable).length
  // Phase 5（5b-9）：「适应性」这类「关间免费替换等级 0 卡」由条目级 adaptableSwaps 声明（次数即上限）。
  const adaptableRule = record.deck.map(code => registeredEntry(code)?.adaptableSwaps).find(value => value > 0)
  const adaptable = adaptableRule && removed && (added.xp || 0) === 0 && (removed.xp || 0) === 0 && adaptableUsed < adaptableRule
  const quote = record.draftMode && (added.xp || 0) === 0
    ? { cost: 0, explanation: '三选一模式：0 经验卡免费替换' } : !removedCode && mayFillVacancy && (added.xp || 0) === 0
    ? { cost: 0, explanation: '免费补足牌组张数' } : adaptable
    ? { cost: 0, explanation: '随机应变：本次关间免费替换等级 0 卡牌' }
    : upgradeQuote(added, removed, { discounts: upgradeDiscountsFor(record) })
  // 永久卡的关间计价（08059 掉进兔子洞，按条目声明式 flags 读，不认卡号）：
  //   · 升级（有被替换的卡）：每关间前 first 次各 -amount 经验；
  //   · 新购卡（无替换的购入，且不是免费补足牌组张数）：+purchaseCostDelta 经验。
  // 两项互斥到同一张卡上，计数由 refreshArcaneResearch 在关间入口重置。
  const pricing = permanentPricingFor(record)
  let pricedQuote = quote
  if (pricing) {
    if (!removedCode) {
      if (quote.cost > 0 && pricing.purchaseCostDelta > 0) {
        pricedQuote = {
          ...quote,
          cost: quote.cost + pricing.purchaseCostDelta,
          purchaseCostDelta: pricing.purchaseCostDelta,
          explanation: `${quote.explanation}（永久卡：新购卡 +${pricing.purchaseCostDelta} 经验）`,
        }
      }
    } else if (permanentPricingUsed(record) < pricing.first) {
      pricedQuote = {
        ...quote,
        cost: Math.max(0, quote.cost - pricing.amount),
        upgradeDiscount: pricing.amount,
        explanation: `${quote.explanation}（永久卡：升级 -${pricing.amount} 经验）`,
      }
    }
  }
  if (pricedQuote.cost > record.xp) return { ok: false, reason: `经验不足：这次替换需要 ${pricedQuote.cost} XP，当前只有 ${record.xp} XP。` }
  return { ok: true, quote: pricedQuote, adaptable }
}

// 升级替换的唯一判定实现：legalMoves / 升级界面的置灰原因 / AI 推荐都读它。
// 返回 { allowed, removals, blocked }；allowed=false 表示新卡本身不可购入。
// knownLegal 是 legalMoves 已经确认可替换的卡号集合（[] 里的 null 也算），
// 只用于补算置灰原因时跳过重复校验。
export function replacementAnalysis(record, addedCode, campaignRecords = null, context = null, knownLegal = null) {
  const result = { allowed: false, removals: [], blocked: [] }
  const added = ALL_CARDS[addedCode]
  const inv = INVESTIGATORS[record.code]
  if (!added || record.status !== 'active' || !poolFor(record, context).includes(addedCode) || !isCardAvailable(addedCode)
    || !isPlayable(added) || !matchesDeckOptions(inv, added, [...record.deck, addedCode]) || added.signatureFor || added.subtype) return result
  const requiredResearch = researchRequirementFor(addedCode)
  if (requiredResearch && !campaignRecords?.[requiredResearch] && !record.research?.[requiredResearch]) return result
  result.allowed = true
  const invRulesSize = deckRules(inv, record.deck, ALL_CARDS).size
  const ordinaryCount = record.deck.filter(code => ordinaryFor(record)(code) && !ALL_CARDS[code]?.permanent).length
  const mayFillVacancy = ordinaryCount < invRulesSize
  for (const removedCode of [null, ...new Set(record.deck)]) {
    if (knownLegal?.has(removedCode)) continue
    const verdict = replacementVerdict(record, addedCode, added, inv, removedCode, mayFillVacancy)
    if (verdict.ok) result.removals.push({ code: removedCode, ...verdict.quote, adaptable: verdict.adaptable })
    else if (removedCode) result.blocked.push({ code: removedCode, reason: verdict.reason })
  }
  return result
}

export function replacementOptions(record, addedCode, campaignRecords = null, context = null) {
  return replacementAnalysis(record, addedCode, campaignRecords, context).removals
}

// 升级界面用：这次升级里换不掉的牌组卡与原因；合法替换已经由 legalMoves 列出，两者互补。
export function replacementBlockers(record, addedCode, campaignRecords = null, context = null, knownLegal = null) {
  return replacementAnalysis(record, addedCode, campaignRecords, context, knownLegal).blocked
}

export function settleExiledCards(campaign, entries = []) {
  const removed = []
  for (const { seat, code } of entries) {
    const record = campaign.investigators[seat]
    if (!record?.deck.includes(code)) continue
    campaignCardChange(campaign, seat, code, 'remove', 'exiled')
    removed.push({ seat, code })
  }
  return removed
}

export function availablePurchases(record, campaignRecords = null, context = null) {
  return poolFor(record, context).filter(code => replacementOptions(record, code, campaignRecords, context).length)
}

export function purchaseCard(campaign, seat, addedCode, removedCode, context = null) {
  if (campaign.phase !== 'interlude' || campaign.upgradesAllowed === false) throw new Error('只能在允许升级的关间阶段升级牌组')
  const record = campaign.investigators[seat]
  if (!record) throw new Error('未知战役调查员')
  const option = replacementOptions(record, addedCode, campaign.records, context).find(item => item.code === removedCode)
  if (!option) throw new Error('非法升级：卡池、经验、职业、张数或移除依赖不满足')
  if (removedCode) record.deck.splice(record.deck.indexOf(removedCode), 1, addedCode)
  else record.deck.push(addedCode)
  record.deck.sort()
  record.xp -= option.cost
  record.spentXp += option.cost
  const purchase = { added: addedCode, removed: removedCode, cost: option.cost, scenarioIndex: campaign.scenarioIndex, adaptable: !!option.adaptable,
    // 永久卡关间计价（08059 掉进兔子洞）：记录本单用了升级减免/新购加价，供逐关间计数与界面展示。
    ...(option.upgradeDiscount ? { upgradeDiscount: option.upgradeDiscount } : {}),
    ...(option.purchaseCostDelta ? { purchaseCostDelta: option.purchaseCostDelta } : {}) }
  record.purchases.push(purchase)
  // 升级减免的已用次数（每个关间前 N 次，refreshArcaneResearch 在关间入口重置）。
  if (option.upgradeDiscount) record.upgradeDiscountUsed = permanentPricingUsed(record) + 1
  // 「奥术研究」：优惠只对下一张法术升级生效一次。
  if (record.arcaneResearchDiscount
    && (ALL_CARDS[addedCode]?.traits || []).some(trait => String(trait).toLowerCase() === 'spell')) {
    delete record.arcaneResearchDiscount
  }
  // 永久卡购买的战役层效果（如「奥术研究」的精神创伤）。
  applyPermanentPurchaseEffects(campaign, seat, addedCode)
  // 04106 老练分析：升级「(未鉴定)/(未翻译)」卡时，牌组里有老练分析则用 0 经验
  // 再把另一张同名副本升级为新版本（选择为自动执行，记入 purchases 供界面展示）。
  if (removedCode) {
    const extra = shrewdAnalysisUpgrade(campaign, seat, removedCode, context)
    if (extra) purchase.shrewdAnalysisUpgrade = extra
  }
  campaign.xp = Object.values(campaign.investigators).reduce((sum, item) => sum + item.xp, 0)
  return purchase
}

export function upgradeRecord(record) { return record.upgradeDraft?.record || record }

export function stagePurchase(campaign, seat, added, removed, context = null) {
  const original = campaign.investigators[seat]
  const record = structuredClone(upgradeRecord(original))
  delete record.upgradeDraft
  const temporary = { ...campaign, investigators: { ...campaign.investigators, [seat]: record } }
  const purchase = purchaseCard(temporary, seat, added, removed, context)
  original.upgradeDraft = { record, changes: [...(original.upgradeDraft?.changes || []), purchase] }
  return purchase
}

export function finishUpgradeDraft(campaign, seat, commit) {
  const original = campaign.investigators[seat]
  if (!original?.upgradeDraft) throw new Error('没有待确认的升级草稿')
  if (commit && original.upgradeDraft.record.deck.some(code => registeredEntry(code)?.deckConstruction)) {
    const errors = validateDeckRules(INVESTIGATORS[original.code], original.upgradeDraft.record.deck.filter(ordinaryFor(original)), ALL_CARDS).errors
    if (errors.length) throw new Error(`请先完成扩充后的牌组：${errors[0]}`)
  }
  if (commit) campaign.investigators[seat] = original.upgradeDraft.record
  else delete original.upgradeDraft
  campaign.xp = Object.values(campaign.investigators).reduce((sum, record) => sum + record.xp, 0)
}

export function recommendUpgrade(record, campaignRecords = null, context = null) {
  record = upgradeRecord(record)
  const inv = INVESTIGATORS[record.code]
  const candidates = availablePurchases(record, campaignRecords, context)
    .flatMap(added => replacementOptions(record, added, campaignRecords, context).map(option => {
      const before = ALL_CARDS[option.code]
      const after = ALL_CARDS[added]
      const sameName = before?.name === after.name
      const benefit = scoreCard(after, inv) - (before ? scoreCard(before, inv) : 0)
        + (sameName ? 3 * ((after.xp || 0) - (before.xp || 0)) : 0)
      return { added, removed: option.code, cost: option.cost, score: benefit - option.cost * 0.25,
        reason: `${sameName ? '保留原有卡牌用途并提升等级' : '按调查员属性与卡牌能力比较收益'}；${option.explanation}；剩余 ${record.xp - option.cost} XP。` }
    })).filter(item => item.score > 0)
  candidates.sort((a, b) => b.score - a.score || a.cost - b.cost || a.added.localeCompare(b.added) || String(a.removed).localeCompare(String(b.removed)))
  return candidates[0] || { reason: '当前没有收益足够明确且能支付的升级，建议保留经验。' }
}

// 战役结局：按 manifest.endings 的顺序匹配剧本日志，取第一个命中的结局。
export function campaignEnding(manifest, records = {}) {
  for (const ending of manifest?.endings || []) {
    if (ending.record && records[ending.record]) return { id: ending.id, label: ending.label }
  }
  return null
}

export function campaignView(campaign, observerSeat) {
  const view = structuredClone(campaign)
  const observerId = Object.values(view.investigators || {})
    .find(record => record.seat === observerSeat)?.id
  if (view.privateStories) {
    view.privateStories = view.privateStories
      .filter(story => observerId && story.audienceInvestigatorIds.includes(observerId))
      .map(story => {
        const copy = { ...story }
        delete copy.audienceInvestigatorIds
        return copy
      })
  }
  if (view.privateEpiloguesByInvestigatorId) {
    const own = observerId ? view.privateEpiloguesByInvestigatorId[observerId] : null
    view.privateEpiloguesByInvestigatorId = own ? { [observerId]: own } : {}
  }
  if (Array.isArray(view.records?.possessed) && !view.records.possessed.includes(observerId)) {
    delete view.records.possessed
  }
  for (const record of [...Object.values(view.investigators || {}), ...(view.retired || [])]) {
    record.deckSize = record.deck.length
    if (record.seat !== observerSeat) {
      delete record.deck
      delete record.purchases
      delete record.removedCards
      delete record.draftMode
      delete record.upgradeDraft
      delete record.upgradeAdvice
    }
  }
  for (const result of view.scenarioResults || []) {
    for (const record of result.investigators) {
      if (record.seat !== observerSeat) {
        delete record.deck
        delete record.purchases
      }
    }
  }
  // 双线战役：线快照只投影公开摘要，观察者自己的牌组留在所属线里。
  return partScopedView(view, observerSeat)
}
