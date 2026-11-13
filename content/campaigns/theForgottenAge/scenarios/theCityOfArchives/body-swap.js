// 天机之城（04237）设置阶段的「换身」与「放到一边」原语。
//
// 从 behavior.js 抽出的原因：behavior.js 总行数受 Phase 3 基线门禁（只减不增），
// 这一组设置/旧存档修复逻辑与本章流程无关，放独立模块更清楚，也不占 behavior 预算。
//
// 卡面（04237 设置）：
//   · 抽取起始手牌之前，每位调查员检查自己的牌库和游戏区域，找出所有独特的[[道具]]支援，
//     将这些卡牌放在一边，位于场外（它们不存在于当前时间段）；
//   · 抽取起始手牌之前，如果亚历山卓·维拉在任意一位玩家的牌库中，也把他放在一边；
//   · 将每位玩家的调查员卡牌替换为伊斯人身体调查员卡牌（起始手牌之后才换）。
//
// 旧实现把这两类卡直接从战役牌组记录（record.deck）里删掉，于是卢克的门之匣、佐伊的十字架、
// 古代遗物在天机之城结束后的余下战役里永久消失。正确口径：只从**本关**的牌库/场上取走，
// 实体放进 state.setAside（放到一边），下一关按战役牌组记录重建牌组时自然回收；战役记录不动。
// 场景标记沿用 removedCards（独特道具）与 setAsideCards（亚历山卓）两个键，旧存档修复按它们找卡。

import { ALL_CARDS, INVESTIGATORS } from '../../../../../src/cards/cards-data.js'
import { assetRuleFor } from '../../../../../src/cards/card-rules.js'
import {
  applyInvestigatorForm, hasInvestigatorForm, restoreInvestigatorForm,
} from '../../../../../src/engine/investigator-form.js'
import { markYithianAllies } from '../../encounter-rules.js'
import { CARD_CODES, isItemAsset } from './definition.js'

// 第 114 轮：换身设置里被放到一边的剧情资产（04051 亚历山卓·维拉）由条目 assetRule 声明。
const setAsideOnBodySwap = code => assetRuleFor(code)?.setAsideOnBodySwap === true
const isUniqueItemAsset = code => isItemAsset(code) && ALL_CARDS[code]?.unique === true
const playerCardName = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code
const flagsFor = state => (state.scenarioFlags ||= {})

function campaignRecord(state, seat) {
  const list = state.campaign?.investigators
  return Array.isArray(list) ? list[seat] : list?.[seat]
}

function rememberSetAside(state, inv, code, kind) {
  const flags = flagsFor(state)
  const list = kind === 'alejandro' ? (flags.setAsideCards ||= []) : (flags.removedCards ||= [])
  if (!list.includes(code)) list.push(code)
  state.setAside ||= []
  if (!state.setAside.some(card => card.code === code && card.ownerSeat === inv.seat)) {
    state.setAside.push({ code, ownerSeat: inv.seat })
  }
}

// 把独特道具支援与亚历山卓·维拉从本关的牌库/场上放到一边（印刷顺序：起始手牌之前）。
export function setAsideBodySwapCards(state, inv, info) {
  const take = code => isUniqueItemAsset(code) || setAsideOnBodySwap(code)
  const explain = code => isUniqueItemAsset(code)
    ? `📦 「${playerCardName(code)}」是独特的道具支援，被放在一边，位于场外（它不存在于当前时间段）。`
    : `📦 「${playerCardName(code)}」被放在一边，位于场外。`
  for (const code of inv.deck || []) {
    if (!take(code)) continue
    rememberSetAside(state, inv, code, setAsideOnBodySwap(code) ? 'alejandro' : 'item')
    info?.(explain(code))
  }
  inv.deck = (inv.deck || []).filter(code => !take(code))
  for (const asset of inv.assets || []) {
    const code = asset?.code
    if (!code || !take(code)) continue
    rememberSetAside(state, inv, code, setAsideOnBodySwap(code) ? 'alejandro' : 'item')
    info?.(explain(code))
  }
  inv.assets = (inv.assets || []).filter(asset => !take(asset?.code))
}

// 起始手牌抽完之后的换身（04237：「将每位玩家的调查员卡牌替换为伊斯人身体调查员卡牌」）。
// 换身放在起始手牌之后：04244 没有调查员条目，「在自己调查员卡上」的起始手牌能力
// （塞菲娜 13 张、戴安娜额外卡等）会失效。
export function applyBodyOfAYithian(state, inv, info) {
  if (hasInvestigatorForm(inv) && inv.code === CARD_CODES.bodyOfAYithian) return false
  const originalName = inv.name
  applyInvestigatorForm(state, inv, { code: CARD_CODES.bodyOfAYithian, form: 'yithian' })
  inv.yithianBody = true
  // 已在场的盟友也要获得伊斯特性（不只是之后入场的）。
  markYithianAllies(inv)
  info?.(`🧠 ${originalName} 换上了伊斯人身体：调查员卡替换为「${inv.name}」，四属性 2，生命 7，神智 7。`)
  return true
}

// 旧存档修复（一）：旧实现把独特道具从战役牌组记录里删掉（record.deck），当时在场的支援也直接
// 从 assets 里拿掉；这里用场景标记里的卡号 + signatureFor/最近一关牌组快照找回持有者，
// 把卡补回战役牌组记录，并把本关的实体放回「放到一边」。
function deckSnapshots(state) {
  return (state.campaign?.scenarioResults || []).flatMap(result => result.investigators || [])
}

function asideOwners(state, code) {
  const owners = new Set()
  const signatures = ALL_CARDS[code]?.signatureFor || []
  for (const inv of state.investigators || []) {
    const record = campaignRecord(state, inv.seat)
    if (record && signatures.includes(record.code)) owners.add(inv.seat)
  }
  if (owners.size) return owners
  for (const snapshot of deckSnapshots(state)) {
    if ((snapshot.deck || []).includes(code)) owners.add(snapshot.seat)
  }
  return owners
}

function pendingDeckRestores(state) {
  const flags = state.scenarioFlags || {}
  const codes = [...new Set([...(flags.removedCards || []), ...(flags.setAsideCards || [])])]
  const restores = []
  for (const code of codes) {
    if (!ALL_CARDS[code]) continue
    for (const seat of asideOwners(state, code)) {
      const record = campaignRecord(state, seat)
      if (!record?.deck || record.deck.includes(code)) continue
      const inv = (state.investigators || []).find(item => item.seat === seat)
      const zones = inv
        ? ['deck', 'hand', 'discard', 'assets', 'threat']
          .flatMap(zone => (inv[zone] || []).map(entry => typeof entry === 'string' ? entry : entry?.code))
        : []
      if (zones.includes(code)) continue
      restores.push({ code, seat })
    }
  }
  return restores
}

function restoreSetAsideCampaignCards(state) {
  const restores = pendingDeckRestores(state)
  for (const { code, seat } of restores) {
    const record = campaignRecord(state, seat)
    if (!record) continue
    if (!record.deck.includes(code)) {
      record.deck.push(code)
      record.deck.sort()
    }
    state.setAside ||= []
    if (!state.setAside.some(card => card.code === code && card.ownerSeat === seat)) {
      state.setAside.push({ code, ownerSeat: seat })
    }
  }
  return restores
}

// 旧存档修复（二）：旧存档的梦境之门只记了持有者卡号（dreamGateOwner）。天机之城换身后全队
// 卡号都是 04244，仅比卡号会让其他伊斯人也能进门、也让「调查阶段结束把门放在一边」找不到卢克。
// 按绑定主卡的 signatureFor 找回原卡号，再对照战役记录/原身份快照推出座位写回。
function dreamGateOwnerOriginal(state, gates) {
  const gateCodes = new Set(gates.map(location => location.originalCode || location.code))
  const main = Object.values(ALL_CARDS).find(card =>
    Array.isArray(card.bondedCards)
    && card.bondedCards.some(ref => gateCodes.has(ref.code))
    && (card.signatureFor?.length || card.restrictions?.investigator))
  if (!main) return null
  return main.signatureFor?.[0] || Object.keys(main.restrictions?.investigator || {})[0] || null
}

function dreamGateOwnerRepair(state) {
  const gates = (state.locations || []).filter(location =>
    location.dreamGate && !Number.isInteger(location.dreamGateOwnerSeat))
  if (!gates.length) return null
  const originalCode = dreamGateOwnerOriginal(state, gates)
  if (!originalCode) return null
  const owner = (state.investigators || []).find(inv =>
    inv.formOriginal?.code === originalCode || campaignRecord(state, inv.seat)?.code === originalCode)
  return owner ? { gates, owner } : null
}

function repairDreamGateOwnerSeats(state) {
  const repair = dreamGateOwnerRepair(state)
  if (!repair) return 0
  for (const gate of repair.gates) {
    gate.dreamGateOwnerSeat = repair.owner.seat
    if (!gate.dreamGateOwner) gate.dreamGateOwner = repair.owner.code
  }
  return repair.gates.length
}

// ---------------------------------------------------------------------------
// 「本关是否已经结算」判定：读档修复只应修**进行中**的本关存档。
// finishScenario 会先还原换身、再写入 scenarioResults；之后进入幕间/出发准备窗口时
// state.scenario 仍指向上一个关卡，scenarioFlags 也要等下一关开局才清空。旧修复只按
// scenarioFlags.yithianBody 判断，于是会把「意识已经回到自己身体」的关卡后存档重新换成
// 伊斯人身体（2026-11-11 实战：幽嘶深渊出发准备页显示两名调查员都是「伊斯人身体」）。
// ---------------------------------------------------------------------------
function isScenarioSettled(state) {
  const sc = state.scenario
  if (!sc?.id) return false
  const flow = state.campaign?.flow
  // 关末窗口里 flow.nodeId 已经推进到幕间（state.scenario 仍是本关），所以两个口径都要认：
  // 结算写入的 visitId 用的是「结算当时的流节点」，而关末窗口里要按 state.scenario.id 找回来。
  const visit = flow?.visits?.[sc.id] || 1
  const candidates = new Set([`${sc.id}:${visit}`, `${flow?.nodeId || sc.id}:${visit}`])
  return (state.campaign?.scenarioResults || []).some(result =>
    result.scenarioId === sc.id && candidates.has(result.visitId))
}

// 关末窗口里还残留的换身痕迹：旧存档的 scenarioFlags 标记，或误套在调查员身上的身体形态。
function hasBodySwapResidue(state) {
  return !!state.scenarioFlags?.yithianBody
    || !!state.scenarioFlags?.yithianBodyOriginals
    || (state.investigators || []).some(inv => hasInvestigatorForm(inv) || inv.yithianBody === true)
}

// 印刷身份以战役记录里的原调查员卡号为准。旧实现（v0.4.0 及更早）会先把四属性覆盖成
// 身体卡的 2/2/2/2，再拍 formOriginal 快照；这种存档还原后卡号/名字会回到本人，但四属性
// 还是 2——所以结算后的还原必须按卡面定义重建，不能只信快照。
function investigatorCardDefinition(code) {
  if (!code) return null
  if (INVESTIGATORS[code]) return INVESTIGATORS[code]
  const card = ALL_CARDS[code]
  return card?.type === 'investigator' ? card : null
}

function reapplyCampaignIdentity(state, inv) {
  const def = investigatorCardDefinition(campaignRecord(state, inv.seat)?.code)
  if (!def) return false
  let changed = false
  const assign = (key, value) => {
    if (inv[key] === value) return
    inv[key] = value
    changed = true
  }
  assign('code', def.code)
  assign('name', def.nameZh || def.name)
  assign('nameEn', def.name)
  assign('klass', def.klass)
  assign('willpower', def.willpower)
  assign('intellect', def.intellect)
  assign('combat', def.combat)
  assign('agility', def.agility)
  return changed
}

/** 已结算关卡的修正：把误套的身体还原、清掉关末残留标记（幂等，不碰牌组/记录）。 */
export function restoreBodySwapState(state) {
  let restored = 0
  for (const inv of state.investigators || []) {
    if (restoreInvestigatorForm(inv)) restored += 1
    // 旧实现（v0.4.0 之前）的换身标记也留在调查员身上；还原后它不属于任何身份，
    // 不清掉的话下次读档仍会按「有残留」重复触发修复。
    if (inv.yithianBody) delete inv.yithianBody
    reapplyCampaignIdentity(state, inv)
  }
  if (state.scenarioFlags) {
    delete state.scenarioFlags.yithianBody
    delete state.scenarioFlags.yithianBodyOriginals
  }
  return restored
}

/** 旧存档修复说明：进行中的本关与已结算的关末窗口分开提示。 */
export function bodySwapRepairNote(state) {
  return isScenarioSettled(state)
    ? '《天机之城》已结算：把误套的伊斯人身体还原，并清掉关末残留的换身标记'
    : '补齐《天机之城》的伊斯人身体换身，并把旧版误从战役牌组删除的独特道具放回牌组'
}

/** 旧存档是否需要这一组修复（换身 / 被误删的战役牌组卡 / 门的持有者座位 / 场上的独特道具）。 */
export function needsBodySwapRepair(state) {
  // 已结算：只做「还原/清理」，绝不能按进行中的关卡补换身。
  if (isScenarioSettled(state)) return hasBodySwapResidue(state)
  if (!state.scenarioFlags?.yithianBody) return false
  if ((state.investigators || []).some(inv => !hasInvestigatorForm(inv)
    || inv.code !== CARD_CODES.bodyOfAYithian)) return true
  if (pendingDeckRestores(state).length > 0) return true
  if (dreamGateOwnerRepair(state)) return true
  // 旧存档可能还让独特道具留在场上（设置阶段只清了牌库/手牌/弃牌）。
  const asideCodes = new Set([
    ...(state.scenarioFlags?.removedCards || []),
    ...(state.scenarioFlags?.setAsideCards || []),
  ])
  return (state.investigators || []).some(inv =>
    (inv.assets || []).some(asset => asideCodes.has(asset?.code)))
}

/** 旧存档修复入口（scenarioBehavior.repairSavedState 调用）。 */
export function repairBodySwapState(state) {
  if (isScenarioSettled(state)) return restoreBodySwapState(state)
  for (const inv of state.investigators || []) {
    if (!hasInvestigatorForm(inv)) applyBodyOfAYithian(state, inv)
    inv.yithianBody = true
    markYithianAllies(inv)
    // 设置阶段「检查牌库和游戏区域」：旧存档只清了牌库/手牌/弃牌，场上的独特道具支援还在。
    const removed = []
    inv.assets = (inv.assets || []).filter(asset => {
      const code = asset?.code
      const take = code && (isUniqueItemAsset(code) || setAsideOnBodySwap(code))
      if (take) removed.push(code)
      return !take
    })
    for (const code of removed) rememberSetAside(state, inv, code, setAsideOnBodySwap(code) ? 'alejandro' : 'item')
  }
  restoreSetAsideCampaignCards(state)
  repairDreamGateOwnerSeats(state)
}
