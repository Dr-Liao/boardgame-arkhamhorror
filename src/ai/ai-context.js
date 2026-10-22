import { ALL_CARDS, INVESTIGATORS } from '../cards/cards-data.js'
import { INVESTIGATOR_ABILITIES } from '../cards/card-effects.js'
import { implementationSummary } from '../cards/card-implementation.js'
import { registeredEntry } from '../engine/ability.js'
import { commitProfile } from '../engine/lifecycle.js'
import { playablePool, matchesDeckOptions } from '../deck/deckbuilding.js'
import { deckRules } from '../deck/deck-rules.js'
import { upgradeRecord } from '../campaign/campaign.js'
import { legalMoves, actionPreview, getStat, actingSeats, actObjectiveContext, investigatorEntryError, locationAbilityStatus, locationInvestigateStatus, abilityUsage } from '../engine/engine.js'
import { locationEntryNotice } from '../engine/location-facts.js'
import { investigatorAssigned, investigatorParticipation } from './ai-participation.js'
import { CLASS_NAMES } from '../engine/presentation-constants.js'
import { storyDecisionContext } from './ai-story.js'
import { campaignAgentHints } from '../cards/campaign-view.js'

const counts = codes => Object.fromEntries([...new Set(codes)].sort().map(code => [code, codes.filter(c => c === code).length]))
const locationSubname = loc => loc.revealed === false ? ''
  : String(loc.subname || ALL_CARDS[loc.code]?.subnameZh || ALL_CARDS[loc.originalCode]?.subnameZh || '').trim()
const card = code => {
  const c = ALL_CARDS[code]
  if (!c) return { code }
  return { code, name: c.nameZh || c.name, type: c.type, cost: c.cost, xp: c.xp || 0,
    icons: c.icons, slots: c.slots || c.slot, traits: c.traits, health: c.health, sanity: c.sanity,
    printedText: c.textZh || c.text, implemented: implementationSummary(code) }
}

// 已揭示地点：把本实现真正声明过的内容交给 AI——进入代价、地点能力、调查门槛、
// 剧本 notice、注册条目里的常驻规则，以及当前不能触发的原因。
// 未揭示地点只给地图层字段，不泄露背面文本或能力。
function locationRow(state, loc, inv) {
  const subname = locationSubname(loc)
  const row = { id: loc.id, name: loc.name, ...(subname ? { subname } : {}), clues: loc.clues,
    revealed: Boolean(loc.revealed), locked: Boolean(loc.locked), connections: [...loc.connections] }
  if (!loc.revealed) return row

  const entry = {}
  const entryText = locationEntryNotice(state, loc)
  if (entryText) entry.effects = `进入后：${entryText}`
  // 已经站在这个地点时，「进入受阻」没有意义，只对还没到的地点给。
  if (inv.location !== loc.id) {
    const blocked = investigatorEntryError(state, loc.id, inv.seat)
    if (blocked) entry.blocked = blocked
  }
  if (Object.keys(entry).length) row.entry = entry

  if (loc.ability) {
    row.ability = {
      label: loc.ability.label || '使用地点能力',
      ...(loc.ability.limit ? { limit: loc.ability.limit } : {}),
      ...(loc.ability.cost && Object.keys(loc.ability.cost).length ? { cost: loc.ability.cost } : {}),
      ...locationAbilityStatus(state, loc, inv),
    }
  }
  row.investigate = locationInvestigateStatus(state, loc, inv)

  // 非玩家卡通道里声明的常驻规则（如 04072 的蛇族敌人 +1 战斗）。
  const rule = registeredEntry(loc.originalCode || loc.code)?.text
  if (rule) row.rules = rule
  const traits = loc.traitsZh?.length ? loc.traitsZh : loc.traits
  if (Array.isArray(traits) && traits.length) row.traits = [...traits]
  if (loc.investigateSkill && loc.investigateSkill !== 'intellect') row.investigateSkill = loc.investigateSkill
  if (loc.shroudMod) row.shroudMod = loc.shroudMod
  if (loc.victory) row.victory = loc.victory
  if (loc.resign) row.resign = true
  if (loc.parley) row.parley = true
  if (loc.doom) row.doom = loc.doom
  if (loc.resources) row.resources = loc.resources
  const attachments = (loc.attachments || []).map(item => {
    const code = typeof item === 'string' ? item : item?.code
    return code ? (ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code) : null
  }).filter(Boolean)
  if (attachments.length) row.attachments = attachments
  return row
}

// 选人阶段：职业 → 队伍职责。只用来给模型一份「已有几个、还缺什么」的摘要，
// 不参与规则判定；真正的可用调查员仍以 legalMoves 为准。
const CLASS_DUTY = {
  guardian: { duty: '战斗/守护', planRole: 'fight' },
  seeker: { duty: '调查/线索', planRole: 'investigate' },
  mystic: { duty: '支援/法术', planRole: 'support' },
  rogue: { duty: '闪避/经济', planRole: 'flex' },
  survivor: { duty: '灵活/生存', planRole: 'flex' },
}

// 已定人且本关仍可参赛的调查员；死亡/疯狂的座位要算「还没定人」，否则缺口判断会失真。
function hubTeamSummary(state) {
  const active = state.investigators.filter(inv => {
    const status = state.campaign?.investigators?.[inv.seat]?.status
    if (status) return status === 'active'
    return Boolean(state.hubSeatSelected?.[inv.seat])
  })
  const rows = Object.entries(CLASS_DUTY).map(([klass, meta]) => ({
    klass, klassName: CLASS_NAMES[klass] || klass, ...meta,
    count: active.filter(inv => inv.klass === klass).length,
  }))
  const missingRoles = rows.filter(row => row.count === 0)
  const duplicatedRoles = rows.filter(row => row.count > 1)
  const pendingSeats = state.investigators.map(inv => inv.seat).filter(seat => !active.some(inv => inv.seat === seat))
  const list = (items, render) => items.length ? items.map(render).join('、') : '无'
  return {
    pickedSeats: active.map(inv => inv.seat),
    pendingSeats,
    classCounts: Object.fromEntries(rows.map(row => [row.klass, row.count])),
    missingRoles,
    duplicatedRoles,
    advice: `队伍已有：${list(rows.filter(row => row.count > 0), row => `${row.klassName}（${row.duty}）×${row.count}`)}；`
      + `还没定人的座位：${pendingSeats.length ? pendingSeats.join('、') : '无'}；`
      + `尚未覆盖的职责：${list(missingRoles, row => row.duty)}；`
      + `重复职责：${list(duplicatedRoles, row => `${row.duty}×${row.count}`)}。`
      + '选人时优先补齐尚未覆盖的职责，避免与队友重复同一职业定位。',
  }
}

// Only known cards and this observer's own deck composition; never deck order,
// RNG, continuation state, other hands, or unrevealed encounter draws.
export function aiDecisionContext(state, seat) {
  const inv = state.investigators.find(i => i.seat === seat)
  if (!inv) return ''
  const record = state.campaign.investigators[seat]
  const moves = actingSeats(state).includes(seat) ? legalMoves(state, seat) : []
  // 局外准备阶段：建局给每个座位预分配的调查员只是占位（见 setup.js 的
  // pickAiInvestigator），没真正选人的座位不展示，避免模型误判队伍构成。
  const hubPhase = Boolean(state.hubFlow) && state.uiState !== 'inScenario'
  const assigned = member => !hubPhase || investigatorAssigned(state, member.seat)
  const data = { observerSeat: seat, phase: state.phase, round: state.round,
    timing: state.skillTest && !state.skillTest.helpRequested && state.skillTest.seat !== seat ? null : state.timingWindow,
    investigator: assigned(inv)
      ? { code: inv.code, ability: INVESTIGATOR_ABILITIES[inv.code] }
      : { code: null, picked: false, note: '尚未选择调查员（建局预分配只是占位）' },
    team: state.investigators.map(i => {
      if (!assigned(i)) return { seat: i.seat, picked: false, note: '尚未选择调查员' }
      return { seat: i.seat, code: i.code, name: i.name, klass: i.klass,
        locationId: i.location, clues: i.clues,
        ...investigatorParticipation(state, i),
        stats: Object.fromEntries(['willpower', 'intellect', 'combat', 'agility'].map(k => [k, getStat(state, i, k)])),
        ...(hubPhase ? { picked: true } : {}) }
    }) }
  if (hubPhase) data.teamSummary = hubTeamSummary(state)
  // Phase 6（战役插件化：agentHints）：战役作者提供的公开提示；旧战役为空、提示词不变。
  const campaignHints = campaignAgentHints(state)
  if (campaignHints.length) data.campaignHints = campaignHints
  const known = new Set(inv.hand)
  for (const i of state.investigators) for (const c of [...i.assets, ...i.threat]) known.add(c.code)
  for (const code of inv.discard) known.add(code)
  if (state.uiState !== 'inScenario' && state.hubFlow) {
    data.investigatorCandidates = moves.filter(m => m.action === 'hubSelectInvestigator').map(m => {
      const i = INVESTIGATORS[m.code]
      return { code: i.code, name: i.nameZh || i.name, stats: { willpower: i.willpower, intellect: i.intellect, combat: i.combat, agility: i.agility },
        rules: deckRules(i), ability: INVESTIGATOR_ABILITIES[i.code] }
    })
    if (moves.some(m => m.action === 'hubSetDeck')) {
      data.deckRules = deckRules(INVESTIGATORS[inv.code])
      data.buildPool = playablePool().filter(c => (c.xp || 0) === 0 && matchesDeckOptions(INVESTIGATORS[inv.code], c)).map(c => c.code)
      data.buildPool.forEach(code => known.add(code))
      data.deckInstruction = '提交 hubSetDeck，codes 是普通玩家卡卡号数组，可重复以表示数量；必须凑足 deckRules.size。签名和随机弱点由引擎添加。根据队友职责、经济、槽位和组合构筑，不得调用自动构筑代替思考。'
    }
    if (record) {
      const effective = upgradeRecord(record)
      data.deck = counts(effective.deck)
      data.xp = effective.xp
      data.upgradeDraft = record.upgradeDraft?.changes || []
      data.upgradeInstruction = '逐次 hubPurchase 暂存，可连续购买；随后 hubConfirmUpgrades 确认或 hubCancelUpgrades 撤销；没有值得买的卡可 hubDoneSeat 保留 XP。不要调用自动升级。'
      effective.deck.forEach(code => known.add(code))
      moves.filter(m => m.action === 'hubPurchase').forEach(m => { known.add(m.added); if (m.removed) known.add(m.removed) })
    }
  } else {
    data.actObjective = actObjectiveContext(state)
    data.locations = state.locations.map(loc => locationRow(state, loc, inv))
    data.hand = counts(inv.hand)
    if (record) {
      data.campaignDeck = counts(record.deck)
      record.deck.forEach(code => known.add(code))
    }
    data.remainingDeck = counts(inv.deck)
    data.discard = counts(inv.discard)
    data.assets = inv.assets.map(a => ({ ...a }))
    // 上限记账：只给有「每回合/每场游戏…」能力的支援补一行，AI 才知道某个能力
    // 已经从 legalMoves 里消失了（而不是以为自己漏看了卡面）。
    const usageByAsset = new Map(abilityUsage(state, inv).map(item => [item.assetId, item]))
    for (const row of data.assets) {
      const usage = usageByAsset.get(row.id)
      if (!usage) continue
      row.abilities = usage.abilities.map(item => ({ label: item.label, limit: item.limitText, used: item.used }))
    }
    // 威胁区域也摆在自己面前，属于公开状态。旧版只给 assets，AI 因此看不见弱点上的
    // 充能/标记（例如「怒灵」03015）：卡面写着「少于 4 个充能」却无法判断当前数量，
    // 于是会把所有法术支援的充能都移过去。requiredUses 取自条目级阈值（物理创伤线）。
    data.threat = inv.threat.map(card => {
      const row = { id: card.id, code: card.code }
      if (card.uses != null) { row.uses = card.uses; row.usesType = card.usesType || 'charges' }
      if (card.counters != null) row.counters = card.counters
      if (card.exhausted) row.exhausted = true
      const requiredUses = registeredEntry(card.code)?.physicalTraumaIfUsesBelow
      if (Number.isFinite(requiredUses)) row.requiredUses = requiredUses
      return row
    })
    data.chaosBag = counts(state.chaosBag)
    data.revealedTokens = state.chaos?.revealed || []
    data.tokenMeanings = state.scenario?.tokenMeanings?.[state.difficulty]
    const test = state.skillTest
    if (test && (test.seat === seat || test.helpRequested)) {
      data.test = { ...test, marginBeforeToken: Number.isFinite(test.value) ? test.value - test.difficulty : null }
      data.commitOptions = state.pendingChoice?.kind === 'commit' && state.pendingChoice.seat === seat
        ? moves.filter(m => /^\d+$/.test(m.optionId)).map(m => {
          const code = inv.hand[Number(m.optionId)], c = ALL_CARDS[code]
          const icons = (c?.icons?.[test.skill] || 0) + (c?.icons?.wild || 0)
          return { optionId: m.optionId, code, icons, valueAfter: Number.isFinite(test.value) ? test.value + icons : null,
            // Phase 5：投入档案的唯一读点（描述子优先、旧 DSL 回落）。
            effect: commitProfile(code) }
        }) : []
    }
    data.actionCosts = state.pendingChoice ? [] : moves.map(m => ({ move: Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'label')), ...actionPreview(state, seat, m) }))
  }
  const story = storyDecisionContext(state, seat)
  if (story) data.story = story
  data.cards = [...known].sort().map(card)
  return '\n【决策资料】\n' + JSON.stringify(data) + '\nprintedText 是原卡参考；implemented 和当前合法选项才是本实现的效果依据。地点条目里 entry / ability / investigate 是本实现已声明的效果，available 为 false 时 reason 说明当前为什么不能触发；reason 为 null 表示没有额外门槛。available 只反映地点本身的门槛（揭示、位置、次数、费用、目标），不代表现在轮到你或有行动点；能否提交仍以合法行动列表为准。不要猜测未提供的隐藏信息。'
}
