// 地球边缘 P5：调查员专属引擎读点与记账原语（通用，无卡号分支）。
//
// 这些状态只对「条目声明了对应 flag 的调查员」创建/写入：
//   · investigator.tracksAttacks —— 记录本回合/上次回合结束以来攻击过你的敌人（丹妮拉）；
//   · investigator.roundEvents  —— 本回合内事件记账（陈丽丽的 Broken 面轮末条件）；
//   · investigator.deckTop      —— 牌库顶常驻揭示（诺曼）；只对声明者同步，旧对局/回放不变；
//   · flags.weaknessStaysOnDeckTop / flags.locksDeckWhileRevealed —— 牌库顶弱点常驻与封锁。
// 既有 13 局 golden replay 使用的调查员都没有这些声明，因此回放指纹不受影响。
import { registeredEntry } from './ability.js'
import { cardDef } from './card-lookup.js'
import { eoteCampaignState } from './eote-state.js'
import { clearDeckTop, deckTopCard, revealDeckTop } from './eote-deck-top.js'
import { applyPhysicalFace } from './physical-faces.js'
import { initializeDisciplines } from './eote-disciplines.js'
import { grantRestrictedAction } from './restricted-actions.js'
import { eoteInvestigatorBuildRules } from '../../content/campaigns/edgeOfTheEarth/investigator-data.js'

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const entryOf = code => registeredEntry(code)
const flagsOf = code => entryOf(code)?.flags || {}
export const ROUND_EVENT_FIELDS = Object.freeze(['damage', 'horror', 'tests', 'handTwoPlus', 'enemyAtLocation'])

export function investigatorEoteFlags(code) {
  const rule = entryOf(code)?.investigator
  return isObject(rule) ? rule : null
}

export function tracksEnemyAttacks(code) {
  return investigatorEoteFlags(code)?.tracksAttacks === true
}

export function tracksRoundEvents(code) {
  return investigatorEoteFlags(code)?.roundEvents === true
}

export function passiveDeckTopConfig(code) {
  const rule = investigatorEoteFlags(code)?.deckTop
  if (rule === true) return { public: false, discount: 1, drawWeakness: true }
  if (!isObject(rule)) return null
  return { public: rule.public === true, discount: Number.isSafeInteger(rule.discount) ? rule.discount : 1, drawWeakness: rule.drawWeakness !== false }
}

// ── 攻击历史（丹妮拉/扳手）─────────────────────────────────────────────────────
export function noteEnemyAttackOnInvestigator(state, inv, enemy, attack = {}) {
  if (!inv || !enemy || !tracksEnemyAttacks(inv.code)) return false
  const history = Array.isArray(inv.attackedSinceTurnEnd) ? inv.attackedSinceTurnEnd : (inv.attackedSinceTurnEnd = [])
  const record = { enemyId: enemy.id, round: state.round, kind: attack.kind || 'enemy' }
  if (!history.some(item => item && item.enemyId === record.enemyId && item.round === record.round)) history.push(record)
  return true
}

export function clearAttackHistory(inv) {
  if (inv && Array.isArray(inv.attackedSinceTurnEnd)) delete inv.attackedSinceTurnEnd
}

export function attackedSinceTurnEnd(inv, enemyId = null) {
  const history = Array.isArray(inv?.attackedSinceTurnEnd) ? inv.attackedSinceTurnEnd : []
  return enemyId == null ? [...history] : history.some(item => item && item.enemyId === enemyId)
}

export function attackedThisRound(state, inv) {
  const history = Array.isArray(inv?.attackedSinceTurnEnd) ? inv.attackedSinceTurnEnd : []
  return history.some(item => item && item.round === state.round)
}

// ── 本回合事件记账（陈丽丽 Broken 面）──────────────────────────────────────────
export function roundEventsOf(inv) {
  const events = isObject(inv?.roundEvents) ? inv.roundEvents : {}
  return {
    damage: Number(events.damage) || 0,
    horror: Number(events.horror) || 0,
    tests: Number(events.tests) || 0,
    handTwoPlus: events.handTwoPlus === true,
    enemyAtLocation: events.enemyAtLocation === true,
  }
}

export function noteRoundEvent(state, inv, field, amount = 1) {
  if (!inv || !tracksRoundEvents(inv.code) || !ROUND_EVENT_FIELDS.includes(field)) return false
  const events = isObject(inv.roundEvents) ? inv.roundEvents : (inv.roundEvents = { damage: 0, horror: 0, tests: 0, handTwoPlus: false, enemyAtLocation: false })
  if (field === 'handTwoPlus') events.handTwoPlus = true
  else if (field === 'enemyAtLocation') events.enemyAtLocation = true
  else events[field] = (Number(events[field]) || 0) + Math.max(0, Number(amount) || 0)
  return true
}

export function resetRoundEvents(state) {
  for (const inv of state.investigators || []) {
    if (!inv || !tracksRoundEvents(inv.code)) continue
    inv.roundEvents = { damage: 0, horror: 0, tests: 0, handTwoPlus: false, enemyAtLocation: false }
  }
}

// 在行动/检定结算后采样「粘性」条件；只对声明 roundEvents 的调查员写入。
export function sampleRoundEvents(state) {
  for (const inv of state.investigators || []) {
    if (!inv || !tracksRoundEvents(inv.code) || inv.defeated || inv.resigned) continue
    const events = isObject(inv.roundEvents) ? inv.roundEvents : (inv.roundEvents = { damage: 0, horror: 0, tests: 0, handTwoPlus: false, enemyAtLocation: false })
    if ((inv.hand || []).length >= 2) events.handTwoPlus = true
    if ((state.enemies || []).some(enemy => enemy && enemy.location != null && enemy.location === inv.location)) events.enemyAtLocation = true
  }
}

// ── 延迟翻面（08013a）────────────────────────────────────────────────────────
// 延迟翻面是「我下一次技能检定 +N」效果的附属标记：效果本身（duration='endOfTest'）只在
// **该效果控制者自己**的检定结束 / 回合结束时过期；标记的有效性由「对应效果是否仍在
// state.effects」唯一判定（单一读点），因此：
//   · 别人的检定结束：效果还在 → 不翻面（卡面是「你」的下一次检定）；
//   · 本回合没做检定：效果随回合结束过期 → 标记作废，不翻面；
//   · 本人的下一次检定结束：效果仍在 → 翻面，随后效果过期。
export function markFlipAfterNextTest(asset, nextCode) {
  if (!isObject(asset) || typeof nextCode !== 'string' || !nextCode) throw new TypeError('延迟翻面需要支援实例与目标面卡号')
  asset.eoteFlipAfterTest = nextCode
  return true
}

// 资产上的延迟翻面标记是否仍有「未过期的下一次检定 +N」效果支撑。
function armedFlipAfterTestEffect(state, inv, asset) {
  return (state?.effects || []).some(effect => effect.duration === 'endOfTest'
    && effect.controllerSeat === inv.seat && effect.sourceInstanceId === asset.id)
}

function pendingFlipAfterTestOwner(state, seat) {
  if (!Number.isInteger(seat)) return state.investigators || []
  const inv = state.investigators?.[seat]
  return inv ? [inv] : []
}

export function applyPendingFlipAfterTests(state, seat = null) {
  let flipped = 0
  for (const inv of pendingFlipAfterTestOwner(state, seat)) {
    for (const asset of inv?.assets || []) {
      const nextCode = asset?.eoteFlipAfterTest
      if (typeof nextCode !== 'string' || !nextCode) continue
      // 效果已过期（回合结束清理）→ 标记同步作废：本次检定翻面的是「那次 +N 的检定」，
      // 不是之后任意一次检定。
      if (!armedFlipAfterTestEffect(state, inv, asset)) { delete asset.eoteFlipAfterTest; continue }
      const fromCode = asset.code
      delete asset.eoteFlipAfterTest
      applyPhysicalFace(state, asset, nextCode, { definitionFor: code => cardDef(code) })
      // 战役级演武面同步（P2 eote-disciplines 的 faces 读点）：a/b 面互翻。
      const store = eoteCampaignState(state)?.disciplines
      const sets = store?.sets
      if (Array.isArray(sets) && sets.length) {
        const pair = sets.find(set => set.unbrokenCode === fromCode || set.brokenCode === fromCode
          || set.unbrokenCode === nextCode || set.brokenCode === nextCode)
        if (pair) {
          store.faces ||= {}
          store.faces[pair.unbrokenCode] = nextCode === pair.brokenCode ? 'broken' : 'unbroken'
        }
      }
      flipped++
    }
  }
  return flipped
}

// 回合/轮边界的一次性清理：效果已在回合结束时过期、但标记还留在资产上的情况。
// 只由回合/阶段边界调用（不产生翻面），保证标记一定有过期点。
export function clearExpiredFlipAfterTestMarkers(state) {
  let cleared = 0
  for (const inv of state.investigators || []) {
    for (const asset of inv?.assets || []) {
      if (typeof asset?.eoteFlipAfterTest !== 'string') continue
      if (armedFlipAfterTestEffect(state, inv, asset)) continue
      delete asset.eoteFlipAfterTest
      cleared++
    }
  }
  return cleared
}

// ── 免费战斗/躲避行动（08014a）──────────────────────────────────────────────
export function grantFreeActions(state, seat, { count = 1, kinds = ['fight', 'evade'], noOpportunityAttack = true, source = null } = {}) {
  const inv = state.investigators?.[seat]
  if (!inv || inv.defeated || inv.resigned) return 0
  if (!Number.isSafeInteger(count) || count < 1 || count > 10) throw new TypeError('免费行动次数必须是 1–10')
  if (!Array.isArray(kinds) || !kinds.length || kinds.some(kind => !['fight', 'evade'].includes(kind))) throw new TypeError('免费行动只支持战斗/躲避')
  if (noOpportunityAttack !== true) throw new TypeError('免费行动必须声明不引发借机攻击')
  for (let i = 0; i < count; i++) grantRestrictedAction(state, inv, 'fightEvade')
  if (typeof source === 'string' && source) inv.freeActionsSource = source
  return inv.fightEvadeOnlyActions || 0
}

// ── 牌库顶常驻揭示（诺曼）与牌库顶弱点锁定（预示者）────────────────────────────
export function deckTopConfig(seat) {
  return passiveDeckTopConfig()
}

export function passiveDeckTopSeat(state, seat) {
  const inv = state.investigators?.[seat]
  return inv ? passiveDeckTopConfig(inv.code) : null
}

export function blockedByDeckTopLock(state, inv) {
  const top = deckTopCard(state, inv?.seat)
  if (!top) return null
  const flags = flagsOf(top.code)
  if (flags.locksDeckWhileRevealed === true) return top
  return null
}

export function deckTopWeaknessShown(state, inv) {
  const top = deckTopCard(state, inv?.seat)
  if (!top) return null
  const def = cardDef(top.code)
  if (!def || !['weakness', 'basicweakness'].includes(def.subtype)) return null
  return top
}

// 08006 预示者：牌库顶揭示期间，允许花 2 行动弃掉这张顶牌（普通行动列表里由 moves.js 枚举）。
export function discardRevealedDeckTopWeakness(state, seat, events = []) {
  const inv = state.investigators?.[seat]
  if (!inv) return false
  const top = deckTopCard(state, seat)
  if (!top || flagsOf(top.code).activatableWhileOnDeckTop !== true) return false
  if (!Number.isInteger(inv.deck[inv.deck.length - 1]) && inv.deck[inv.deck.length - 1] !== top.code) return false
  inv.deck.pop()
  discardPlayerCardFallback(state, inv, top.code)
  clearDeckTop(state, seat)
  syncPassiveDeckTop(state, seat)
  return true
}

// 无 hand-entry 依赖的弃置入口：普通玩家卡弃进弃牌堆；弱点类走 state 的默认弃牌堆。
function discardPlayerCardFallback(state, inv, code) {
  const def = cardDef(code)
  if (def && ['asset', 'event', 'skill'].includes(def.type)) inv.discard.push(code)
  else state.encounterDiscard.push(code)
}

export function syncPassiveDeckTop(state, seat, { force = false } = {}) {
  const inv = state.investigators?.[seat]
  if (!inv) return false
  const config = passiveDeckTopConfig(inv.code)
  if (!config) return false
  if (!Array.isArray(inv.deck)) return false
  if (inv._eoteDeckTopSyncing) return false
  inv._eoteDeckTopSyncing = true
  try {
    const topCode = inv.deck.length ? inv.deck[inv.deck.length - 1] : null
    const existing = deckTopCard(state, seat)
    if (!topCode) { if (existing) clearDeckTop(state, seat); return true }
    if (!force && existing && existing.code === topCode) return true
    // 牌库顶是「常驻揭示弱点」时：保持揭示但不抽取（预示者）。
    if (flagsOf(topCode).weaknessStaysOnDeckTop === true) {
      if (!existing || existing.code !== topCode) revealDeckTop(state, seat, { public: config.public, discount: 0 })
      return true
    }
    if (existing) clearDeckTop(state, seat)
    revealDeckTop(state, seat, { public: config.public, discount: config.discount })
    return true
  } finally {
    inv._eoteDeckTopSyncing = false
  }
}

export function syncAllPassiveDeckTops(state) {
  let changed = false
  for (const inv of state.investigators || []) if (inv) changed = syncPassiveDeckTop(state, inv.seat) || changed
  return changed
}

// ── 牌库顶投入（伊波恩之书）──────────────────────────────────────────────────
// 唯一执行路径是技能检定的投入窗口（play-channels.js#commitEntries 的 deckTopCommit 通道 +
// tests.js 的投入循环）：那里统一走 canCommitToTest（图标匹配/额外费用/限制）与
// commitIcons（按本次检定技能过滤图标），投入后由 syncPassiveDeckTop 重新揭示新的牌库顶。
// 下面两个函数是同一条状态转移的读点（canCommitDeckTop 供 UI/存档校验查询，
// commitDeckTop 保留为 api.investigatorTools 的入口；卡面行为不再依赖它）。
export function canCommitDeckTop(state, seat) {
  const inv = state.investigators?.[seat]
  const test = state.skillTest
  if (!inv || !test) return false
  if (inv.defeated || inv.resigned) return false
  const performer = state.investigators?.[test.seat]
  // 卡面：只能投入「你所在地点一位调查员执行的」技能检定。
  if (!performer || performer.location == null || inv.location == null || performer.location !== inv.location) return false
  const top = deckTopCard(state, seat)
  if (!top || inv.deck[inv.deck.length - 1] !== top.code) return false
  const def = cardDef(top.code)
  // 弱点/非玩家卡不能投入检定（与 commit-rules 的 subtype 检查同口径）。
  return Boolean(def) && !def.subtype && ['asset', 'event', 'skill'].includes(def.type)
}

function deckTopCommitIcons(def, skill) {
  const skills = Array.isArray(skill) ? skill : [skill]
  const icons = isObject(def?.icons) ? def.icons : {}
  let total = 0
  for (const name of skills) if (name) total += Number(icons[name]) || 0
  total += Number(icons.wild) || 0
  return total
}

// 把揭示中的牌库顶牌移入本次检定的投入区（不含写 committed）。返回卡号或 null。
export function takeDeckTopForCommit(state, seat) {
  const inv = state.investigators?.[seat]
  const test = state.skillTest
  if (!inv || !test) return null
  const top = deckTopCard(state, seat)
  if (!top || inv.deck[inv.deck.length - 1] !== top.code) return null
  inv.deck.pop()
  clearDeckTop(state, seat)
  // 常驻揭示：投入后新的牌库顶立即重新揭示（08004）。
  syncPassiveDeckTop(state, seat)
  return top.code
}

export function commitDeckTop(state, seat) {
  if (!canCommitDeckTop(state, seat)) return false
  const inv = state.investigators[seat]
  const test = state.skillTest
  const code = inv.deck[inv.deck.length - 1]
  // 图标只在这里计一次：committed 记录由 tests.js#collectForcedCommitments 统一求和
  // （不再写 test.extraCommittedIcons，否则同一个图标会被两条读点各加一次）。
  const icons = deckTopCommitIcons(cardDef(code), test.skill)
  if (!icons) return false
  if (takeDeckTopForCommit(state, seat) !== code) return false
  test.committed.push({ seat, code, icons, fromDeckTop: true })
  return true
}

// ── 开局演武（陈丽丽）────────────────────────────────────────────────────────
export function initBeginGameDisciplines(state, inv) {
  const rules = eoteInvestigatorBuildRules(inv?.code)
  if (!rules) return false
  // 演武状态在战役级 campaign.eote.disciplines（P2 原语）；已有声明时不重复初始化。
  const store = eoteCampaignState(state)?.disciplines || {}
  if (Array.isArray(store.sets) && store.sets.length) return false
  initializeDisciplines(state, { sets: rules.disciplineSets })
  return true
}

// ── 校验（save-migration 读点）──────────────────────────────────────────────
export function validateEoteInvestigatorFields(inv) {
  if (!inv || typeof inv !== 'object') return true
  if (inv.attackedSinceTurnEnd != null) {
    if (!Array.isArray(inv.attackedSinceTurnEnd) || inv.attackedSinceTurnEnd.some(item => !item
      || Object.keys(item).some(key => !['enemyId', 'round', 'kind'].includes(key))
      || typeof item.enemyId !== 'string' || !Number.isSafeInteger(item.round) || typeof item.kind !== 'string')) {
      throw new TypeError('攻击历史存档无效')
    }
  }
  if (inv.roundEvents != null) {
    if (!isObject(inv.roundEvents) || Object.keys(inv.roundEvents).some(key => !ROUND_EVENT_FIELDS.includes(key))) throw new TypeError('回合事件记账存档无效')
    for (const key of ['damage', 'horror', 'tests']) if (inv.roundEvents[key] != null && (!Number.isSafeInteger(inv.roundEvents[key]) || inv.roundEvents[key] < 0)) throw new TypeError('回合事件计数存档无效')
    for (const key of ['handTwoPlus', 'enemyAtLocation']) if (inv.roundEvents[key] != null && typeof inv.roundEvents[key] !== 'boolean') throw new TypeError('回合事件标记存档无效')
  }
  for (const asset of inv.assets || []) {
    if (asset?.eoteFlipAfterTest != null && (typeof asset.eoteFlipAfterTest !== 'string' || !asset.eoteFlipAfterTest)) throw new TypeError('延迟翻面标记存档无效')
  }
  return true
}
