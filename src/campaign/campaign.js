import { ALL_CARDS, INVESTIGATORS } from '../cards/cards-data.js'
import { PLAYER_CARD_CODES, CORE_UPGRADE_CODES, TFA_PLAYER_BUILDABLE_CODES, canSelectInvestigator, isCardAvailable } from '../deck/availability.js'
import { allowsCard, filterCardCodes } from '../deck/card-pool.js'
import { matchesDeckOptions, cardLimit, isPlayable, scoreCard, hashSeed } from '../deck/deckbuilding.js'
import { validateDeckRules, upgradeQuote } from '../deck/deck-rules.js'
import { registeredEntry } from '../engine/ability.js'

const playerPool = [...PLAYER_CARD_CODES, ...CORE_UPGRADE_CODES]
const tfaPool = [...TFA_PLAYER_BUILDABLE_CODES]
const tfaPoolSet = new Set(tfaPool)
// 失落的时代玩家卡只有在失落的时代调查员的记录里才是合法升级目标，
// 这样新卡池不会改变既有循环的升级候选与 AI 推荐结果。
// context 是「卡牌范围」过滤语境（src/deck/card-pool.js）：null 表示不限制。
const poolFor = (record, context = null) => filterCardCodes(
  record && /^04\d{3}$/.test(String(record.code || '')) ? [...playerPool, ...tfaPool] : playerPool, context)
const ordinary = code => playerPool.includes(code) || tfaPoolSet.has(code)
const researchRequirement = Object.freeze({
  '02262': 'identifiedStrangeSolution',
  '02263': 'identifiedStrangeSolution',
  '02264': 'identifiedStrangeSolution',
  '03192': 'translatedGlyphs',
  '03193': 'translatedGlyphs',
})

// 个别调查员在战役开始时带有额外经验（马泰奥神父：+5）。
const STARTING_XP = Object.freeze({ '04004': 5 })

// 「老练分析」（04106）：带（未鉴定）/（未翻译）副标题的卡牌升级时，
// 可以用 0 经验再升级一张同名副本，两张升级版本从合法选项中确定性地伪随机挑选。
const UNRESOLVED_SUBTITLE = /(未鉴定|未翻译|Unidentified|Untranslated)/
const shrewdAnalysisEligible = (record, removedCode, context = null) => {
  const removedDef = ALL_CARDS[removedCode]
  if (!removedDef || !UNRESOLVED_SUBTITLE.test(String(removedDef.subnameZh || removedDef.subname || ''))) return []
  const inv = INVESTIGATORS[record.code]
  if (!record.deck.includes('04106')) return []
  return filterCardCodes([...playerPool, ...tfaPool], context).filter(code => {
    const def = ALL_CARDS[code]
    if (!def || def.name !== removedDef.name || (def.xp || 0) === 0) return false
    if (!isCardAvailable(code) || !isPlayable(def) || !matchesDeckOptions(inv, def)) return false
    return !validateDeckRules(inv, [...record.deck.filter(item => item !== removedCode), code].filter(ordinary), ALL_CARDS).errors.length
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
  if (addedCode !== '04109') return null
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
    if (!record.deck?.includes('04109')) continue
    record.arcaneResearchDiscount = true
    refreshed.push(record.seat)
  }
  return refreshed
}

export function registerCampaignInvestigator(campaign, inv, deck) {
  const id = `investigator-${++campaign.investigatorSeq}`
  const startingXp = STARTING_XP[inv.code] || 0
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
    if (code !== '01117' || !record.deck.includes(code)) record.deck.push(code)
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
  if (record.arcaneResearchDiscount) discounts.push({ amount: 1, match: { traits: ['Spell'] }, source: '04109' })
  return discounts
}

export function replacementOptions(record, addedCode, campaignRecords = null, context = null) {
  const added = ALL_CARDS[addedCode]
  const inv = INVESTIGATORS[record.code]
  if (record.status !== 'active' || !poolFor(record, context).includes(addedCode) || !isCardAvailable(addedCode)
    || !isPlayable(added) || !matchesDeckOptions(inv, added) || added.signatureFor || added.subtype) return []
  const requiredResearch = researchRequirement[addedCode]
  if (requiredResearch && !campaignRecords?.[requiredResearch] && !record.research?.[requiredResearch]) return []
  const invRulesSize = inv.deckRequirements?.size || 30
  const ordinaryCount = record.deck.filter(code => ordinary(code) && !ALL_CARDS[code]?.permanent).length
  const mayFillVacancy = ordinaryCount < invRulesSize
  return (added.permanent || mayFillVacancy ? [null, ...new Set(record.deck.filter(ordinary))] : [...new Set(record.deck.filter(ordinary))]).flatMap(removedCode => {
    if (removedCode === addedCode) return []
    const removed = ALL_CARDS[removedCode]
    if (removed && (removed.permanent || removed.signatureFor || removed.subtype)) return []
    const count = record.deck.filter(code => ALL_CARDS[code]?.name === added.name).length
      - (removed?.name === added.name ? 1 : 0)
    if (count >= cardLimit(added)) return []
    const deck = [...record.deck]
    if (removedCode) deck.splice(deck.indexOf(removedCode), 1)
    deck.push(addedCode)
    // Story assets earned by resolutions (e.g. Lita) are campaign dependencies,
    // not ordinary deck slots. They must not block every subsequent upgrade.
    if (validateDeckRules(inv, deck.filter(ordinary), ALL_CARDS).errors.length) return []
    const adaptableUsed = (record.purchases || []).filter(purchase => purchase.scenarioIndex === record.currentScenarioIndex && purchase.adaptable).length
    // Phase 5（5b-9）：「适应性」这类「关间免费替换等级 0 卡」由条目级 adaptableSwaps 声明（次数即上限）。
    const adaptableRule = record.deck.map(code => registeredEntry(code)?.adaptableSwaps).find(value => value > 0)
    const adaptable = adaptableRule && removed && (added.xp || 0) === 0 && (removed.xp || 0) === 0 && adaptableUsed < adaptableRule
    const quote = adaptable
      ? { cost: 0, explanation: '随机应变：本次关间免费替换等级 0 卡牌' }
      : upgradeQuote(added, removed, { discounts: upgradeDiscountsFor(record) })
    return quote.cost <= record.xp ? [{ code: removedCode, ...quote, adaptable }] : []
  })
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
  const purchase = { added: addedCode, removed: removedCode, cost: option.cost, scenarioIndex: campaign.scenarioIndex, adaptable: !!option.adaptable }
  record.purchases.push(purchase)
  // 「奥术研究」：优惠只对下一张法术升级生效一次。
  if (record.arcaneResearchDiscount
    && (ALL_CARDS[addedCode]?.traits || []).some(trait => String(trait).toLowerCase() === 'spell')) {
    delete record.arcaneResearchDiscount
  }
  // 永久卡购买的战役层效果（如「奥术研究」的精神创伤）。
  applyPermanentPurchaseEffects(campaign, seat, addedCode)
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
  return view
}
