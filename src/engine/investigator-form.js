// 调查员「换身」原语：把调查员的卡面身份整体替换成另一张调查员卡。
//
// 印刷场景：失落的时代《天机之城》（04237）设置阶段「将每位玩家的调查员卡牌替换为
// 伊斯人身体调查员卡牌（04244）」；幕间四（归位程式反效果）之后，被判定困在伊斯人
// 身体里的调查员还要在战役余下时间继续使用这张卡。
//
// 与 story-investigators.js 的区别：换身**不换牌库**。牌库/手牌/弃牌/场上支援/威胁区/
// 创伤全部保留，只替换卡面身份：
//   · 卡号、名字、职业、四项技能、生命/理智的印刷值；
//   · 于是调查员卡文本（能力、旧印、特性等）也跟着换成新卡——原卡文本不再可用，
//     这正是「无法使用其调查员的能力」的引擎读点：所有读点都按 inv.code 查条目，
//     inv.code 变成 04244 之后自然查不到原调查员条目。
// 原身份快照进 inv.formOriginal，跨关时由 startScenario / finishScenario 还原；
// 战役记录（ruleFlags.investigatorForms）要求延续的换身，在每关 prepareInvestigator
// 之后重新套用。
//
// 状态形状（纯 JSON，随存档往返）：
//   inv.form = 'yithian'     // 非空 = 当前处于换身状态（内容层用 inv.form 判断读点）
//   inv.cardCode = '<身体卡号>' // 当前卡面卡号（仅供展示/工具；inv.code 才是规则身份）
//   inv.formOriginal = { code, name, nameEn, klass, willpower, …, maxSanity, sanity, yithianBody }
//
// 兼容旧读点：04244 的旧实现用 inv.yithianBody 标记；apply 时一并写入，restore 时按快照还原。

import { ALL_CARDS, INVESTIGATORS } from '../cards/cards-data.js'

// 换身会改写的卡面身份字段：快照/还原用同一张清单，避免两边漂移。
export const INVESTIGATOR_FORM_FIELDS = Object.freeze([
  'code', 'name', 'nameEn', 'klass',
  'willpower', 'intellect', 'combat', 'agility',
  'baseHealth', 'maxHealth', 'health',
  'baseSanity', 'maxSanity', 'sanity',
  'yithianBody',
])

function cardDefinition(code) {
  const def = INVESTIGATORS[code]
  if (def) return def
  if (ALL_CARDS[code]?.type === 'investigator') return ALL_CARDS[code]
  return null
}

// 当前是否处于换身状态；展示/读点用这个而不是直接摸 inv.form。
export function hasInvestigatorForm(inv) {
  return Boolean(inv?.form)
}

// 当前卡面卡号（没有换身时就是调查员自己的卡号）。
export function investigatorFormCode(inv) {
  return inv?.cardCode || null
}

function snapshotFromDefinition(def) {
  return {
    code: def.code,
    name: def.nameZh || def.name,
    nameEn: def.name,
    klass: def.klass,
    willpower: def.willpower,
    intellect: def.intellect,
    combat: def.combat,
    agility: def.agility,
    baseHealth: def.health,
    maxHealth: def.health,
    health: def.health,
    baseSanity: def.sanity,
    maxSanity: def.sanity,
    sanity: def.sanity,
    yithianBody: undefined,
  }
}

// 换身前的身份快照。正常路径直接记 inv 当前值；只有「inv.code 已经是目标卡号、却没有快照」
// 的异常态（旧存档/测试夹具）才退回按战役记录里的调查员卡号重建，避免把身体自己当成原身。
function originalSnapshot(state, inv, def) {
  if (inv.code !== def.code) {
    return Object.fromEntries(INVESTIGATOR_FORM_FIELDS.map(key => [key, inv[key]]))
  }
  const recordCode = state?.campaign?.investigators?.[inv.seat]?.code
  const originalDef = recordCode && recordCode !== def.code ? cardDefinition(recordCode) : null
  if (originalDef) return snapshotFromDefinition(originalDef)
  return Object.fromEntries(INVESTIGATOR_FORM_FIELDS.map(key => [key, inv[key]]))
}

// 把 inv 换成 code 这张调查员卡。可重复调用：已有快照时只刷新卡面读数，不覆盖原身份。
export function applyInvestigatorForm(state, inv, { code, form = 'yithian' } = {}) {
  if (!inv || !code) throw new Error('换身需要调查员实例与目标调查员卡号')
  const def = cardDefinition(code)
  if (!def) throw new Error(`换身目标不是调查员卡：${code}`)
  inv.formOriginal ||= originalSnapshot(state, inv, def)
  inv.form = form
  inv.cardCode = def.code
  inv.code = def.code
  inv.name = def.nameZh || def.name
  inv.nameEn = def.name
  inv.klass = def.klass
  inv.willpower = def.willpower
  inv.intellect = def.intellect
  inv.combat = def.combat
  inv.agility = def.agility
  // 印刷生命/理智：当前伤害/恐惧标记保留（创伤随卡面转移），有效上限由 getMaxHealth/getMaxSanity 叠加。
  inv.baseHealth = def.health
  inv.maxHealth = def.health
  inv.health = def.health
  inv.baseSanity = def.sanity
  inv.maxSanity = def.sanity
  inv.sanity = def.sanity
  if (form === 'yithian') inv.yithianBody = true
  return inv
}

// 还原换身前的卡面身份；没有快照时只清掉残留的换身字段（不猜测原身份）。
export function restoreInvestigatorForm(inv) {
  if (!inv) return false
  if (!inv.formOriginal) {
    delete inv.form
    delete inv.cardCode
    delete inv.yithianBody
    return false
  }
  for (const key of INVESTIGATOR_FORM_FIELDS) {
    const value = inv.formOriginal[key]
    if (value === undefined) delete inv[key]
    else inv[key] = value
  }
  delete inv.form
  delete inv.cardCode
  delete inv.formOriginal
  return true
}

// 还原队伍里所有换身状态，返回还原人数（用于日志/迁移变更说明）。
export function restoreInvestigatorForms(state) {
  let restored = 0
  for (const inv of state?.investigators || []) if (restoreInvestigatorForm(inv)) restored += 1
  return restored
}

// 战役记录里要求「余下时间继续换身」的座位：{ [seat]: { code, form } }。
// 数据由战役效果写入 campaign.ruleFlags.investigatorForms（幕间四：困在伊斯人身体里的调查员）。
export function campaignInvestigatorForms(campaign) {
  const raw = campaign?.ruleFlags?.investigatorForms
  if (!raw || typeof raw !== 'object') return null
  const forms = {}
  for (const [seat, value] of Object.entries(raw)) {
    const index = Number(seat)
    if (!Number.isInteger(index) || index < 0) continue
    const spec = typeof value === 'string' ? { code: value } : value
    if (!spec?.code || typeof spec.code !== 'string') continue
    forms[index] = { code: spec.code, form: spec.form || 'yithian' }
  }
  return Object.keys(forms).length ? forms : null
}
