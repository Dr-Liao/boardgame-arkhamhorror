// 血色阴影（Sanguine Shadows · 09545）· 引擎钩子（章节流程 + 标靶/隐匿/密钥机械）。
//
// 约定（与 EotE/TDE 章节 behavior 相同）：
//   · 逐卡规则在单卡条目的 enemyRule / treacheryRule / assetRule / enemyScript / flags；
//     behavior 只做分派与本章专属机械（标靶、隐匿迷你卡、双牌库重置、见红幕间、结局记录）。
//   · 内容层（behavior）允许直接读写 state；卡条目禁止，只拿 ctx.api。
//   · 隐匿迷你卡统一走 P2 原语 `src/engine/tsk-concealed.js`；绯红密钥走
//     `api.mechanics.tsk.keys`（`src/engine/tsk-scarlet-keys.js`）。
//
// 本章机械（参考 Scenarios/TheScarletKeys/SanguineShadows.hs）：
//   1. 布置：五月大道（中心）+ 七张候选地点随机移除一张、其余六张环形围绕；除中心外每张地点放 1 个标靶；
//      红衣女郎翻到敌人面并结算「隐匿 5」（5 张诱饵 + 真身，分布在有标靶的地点上）。
//   2. 标靶：地点上的标靶 → 密谋 1 背面被红衣女郎收集（放在她身上，3 个即 → 结局 3）
//      → 幕 2 背面把「离红衣女郎最近的有标靶地点」上的标靶放到冒险参考卡（3 个即进入幕间「云开见日」）。
//      [skull] 的 X 就是冒险参考卡上的标靶数量。
//   3. 幕间：见红既是当前幕也是当前密谋；血色监视者生成在某张有标靶的地点，分裂精魂结算「隐匿 4」。
//   4. 结局：五个（未达成 / 未达成·见红 / 1 / 2 / 3），记录、时间与恸哭女士归属都在 resolution 里结算。
import { exposeWithReaction } from '../../concealed.js'
import { concealedMiniCards, distributeConcealed, exposeMiniCard } from '../../../../../src/engine/tsk-concealed.js'
import { isPendingChoice } from '../../../../../src/engine/resolution.js'
import { randomValue } from '../../../../../src/engine/rules-state.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { assetRuleFor, enemyRuleFor, treacheryRuleFor } from '../../../../../src/cards/card-rules.js'
import {
  AVENIDA_DE_MAYO, AVENIDA_SHROUD_BY_DIFFICULTY, CANDIDATE_LOCATION_IDS, CONCEALED_AMOUNTS, DECOY_KIND,
  GATHER_GROUPS, LOCATIONS, LOCATION_SYMBOLS, RAW_CODES, RECORD_READS, RECORD_WRITES, SEEING_RED_ACT,
  SEEING_RED_AGENDA, WEEPING_LADY_KEY, acts, agendas, clueValueOf, resolutions, scenario,
} from './definition.js'
import {
  SANGUINE_SHADOWS_TOKEN_MEANINGS, cardNameOf, sanguineShadowsAfterTest, sanguineShadowsChaosToken,
} from './chaos.js'

const CHAPTER_ID = 'sanguineShadows'
const LA_CHICA_ROJA = RAW_CODES.laChicaRoja
const SANGUINE_WATCHER = RAW_CODES.sanguineWatcher
const APPORTIONED_KA = RAW_CODES.apportionedKa
const STATE_VERSION = 1
const COTERIE_TRAIT = 'Coterie'
const CENTRAL_TRAIT = 'Central'
// 09557b「在阴影中」的锚点键：条目用 ctx.api.setScenarioFlag 写入，behavior 在回合开始时消费。
export const SHADOW_ANCHOR_PREFIX = 'sanguineShadowAnchor:'
// 迷你卡 kind 不能是纯数字卡号（原语 KIND_PATTERN 要求字母开头），因此敌人 → 符号名一一对应。
export const CONCEALED_KINDS = Object.freeze({
  [RAW_CODES.laChicaRoja]: 'LaChicaRoja',
  [RAW_CODES.apportionedKa]: 'ApportionedKa',
})
export const kindOf = code => CONCEALED_KINDS[code] || String(code)
export const codeOfKind = kind =>
  Object.keys(CONCEALED_KINDS).find(code => CONCEALED_KINDS[code] === kind) || kind
// 诱饵也按敌人分名（`DecoyLaChicaRoja` / `DecoyApportionedKa`）：这样「把这名敌人的迷你卡重新分发」
// 能精确回收它自己那一套（物理牌组里的诱饵是共用的，本模型按敌人记账以避免重复结算时数量膨胀）。
export const decoyKindOf = code => `${DECOY_KIND}${kindOf(code)}`
export const isDecoyKind = kind => String(kind).startsWith(DECOY_KIND)

export const scenarioApproximations = Object.freeze([
  '标靶在地点上用章节状态记录（`scenarioFlags.sanguineShadows.targets`）而不是真实资源；引擎没有通用「地点上的剧目标记」原语（已登记原语请求 new.locationTargetMarker）。',
  '冒险参考卡上的标靶数量记在章节状态 `referenceTargets`，红衣女郎身上的记在 `laChicaRojaTargets`；[skull] 的 X 读前者。',
  '「尽可能平均分发」在张数除不尽时由本实现按地点顺序补足（参考实现让领队选择多出的那 1 张）；确定性顺序便于重放。',
  '揭露迷你卡按规则可以在调查/攻击/躲避中顺带进行；本章实现为独立的剧本行动（1 行动），避免在每个基础行动里重复写窗口。',
  '09557b 红衣女郎（剧情支援面）的「把调查员迷你卡放入阴影」用章节状态近似：记录锚点地点，回合开始时把移动过的调查员移回锚点（引擎没有「调查员在阴影中」原语，已登记原语请求 new.investigatorInShadows）。',
  '恸哭女士（09565a/b）的归属：调查员持有走 `api.mechanics.tsk.keys.bind`；对手（红衣女郎 / 血色监视者）持有只写战役记录，因为敌人在阴影中时不在场、无法作为密钥持有实体。',
  '时间（time）累加写 `campaign.records.time`（参考实现的 incrementRecordCount Time），并在世界地图已初始化时同步 `campaign.tsk.map.time`。',
  '09558 履约夜魇的「攻击它时负值修正翻倍」按引擎现有读点接到 `enemyRule.doubleNegative`（读点在躲避），攻击路径的翻倍登记为原语请求 extend.doubleNegativeOnFight。',
])

export const scenarioGaps = Object.freeze([
  '共享遭遇组（黑暗笼罩/处处神秘/重重疑影/奇异现象/上锁的门/夜魇）的卡牌行为属于共享组 worker，本章只声明 requiredEncounterGroupIds。',
  '世界地图的时间阈值（状况报告 α–ω）与启程循环由战役流程层结算；本章只累加 time 记录。',
])

const codeOf = card => card?.originalCode || card?.code || card
const enemyOf = (state, code) => (state.enemies || []).find(enemy =>
  !enemy.defeated && codeOf(enemy) === code) || null
const aliveInvestigators = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const difficultyKey = state => {
  const value = String(state?.difficulty || 'standard')
  return AVENIDA_SHROUD_BY_DIFFICULTY[value] != null ? value : 'standard'
}
const shuffleWith = (state, list, helper) => {
  if (typeof helper?.shuffle === 'function') return helper.shuffle([...list], () => helper.randomValue(state))
  const copy = [...list]
  const random = typeof helper?.random === 'function' ? helper.random : () => randomValue(state)
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
const locationName = (state, id) => LOCATIONS[id]?.name || locationOf(state, id)?.name || String(id || '')
const locationTraitOf = (state, id, trait) =>
  (locationOf(state, id)?.traits || []).some(value => String(value).toLowerCase() === trait.toLowerCase())
const enemyScriptOf = code => registeredEntry(code)?.enemyScript || null

// ---------------------------------------------------------------------------
// 章节状态（标靶 / 幕间 / 阴影锚点）；纯 JSON，随存档往返。
// ---------------------------------------------------------------------------
export function chapterState(state) {
  const flags = (state.scenarioFlags ||= {})
  const data = flags.sanguineShadows ||= {}
  data.version ||= STATE_VERSION
  data.targets ||= {}
  data.referenceTargets = Number(data.referenceTargets) || 0
  data.laChicaRojaTargets = Number(data.laChicaRojaTargets) || 0
  if (data.introResolved == null) data.introResolved = false
  if (data.seeingRed == null) data.seeingRed = false
  return data
}

export const targetsOn = (state, locationId) =>
  Number(state?.scenarioFlags?.sanguineShadows?.targets?.[locationId]) || 0

/** 有标靶的地点 id（按地点在场顺序）。 */
export function targetLocations(state) {
  const data = state?.scenarioFlags?.sanguineShadows
  if (!data?.targets) return []
  return (state.locations || []).filter(location => (Number(data.targets[location.id]) || 0) > 0)
    .map(location => location.id)
}
export function placeTarget(state, locationId, amount = 1) {
  if (!locationOf(state, locationId)) return 0
  const data = chapterState(state)
  const next = Math.max(0, (Number(data.targets[locationId]) || 0) + amount)
  if (next === 0) delete data.targets[locationId]
  else data.targets[locationId] = next
  return next
}
export const removeTarget = (state, locationId, amount = 1) => placeTarget(state, locationId, -amount)
export const referenceTargetCount = state => Number(state?.scenarioFlags?.sanguineShadows?.referenceTargets) || 0
export function addReferenceTarget(state, amount = 1) {
  const data = chapterState(state)
  data.referenceTargets = Math.max(0, (Number(data.referenceTargets) || 0) + amount)
  return data.referenceTargets
}
export const laChicaRojaTargetCount = state =>
  Number(state?.scenarioFlags?.sanguineShadows?.laChicaRojaTargets) || 0
export function addLaChicaRojaTarget(state, amount = 1) {
  const data = chapterState(state)
  data.laChicaRojaTargets = Math.max(0, (Number(data.laChicaRojaTargets) || 0) + amount)
  return data.laChicaRojaTargets
}

/** 离参照点（红衣女郎或她的迷你卡）最近的有标靶地点：同地点 → 相邻 → 距离 → 首个。 */
export function nearestTargetLocation(state, fromId, api = null) {
  const candidates = targetLocations(state)
  if (!candidates.length) return null
  if (fromId && candidates.includes(fromId)) return fromId
  const from = locationOf(state, fromId)
  if (from) {
    const direct = candidates.find(id => (from.connections || []).includes(id))
    if (direct) return direct
  }
  if (fromId && typeof api?.locationDistance === 'function') {
    let best = null
    let bestDistance = Infinity
    for (const id of candidates) {
      const distance = Number(api.locationDistance(fromId, [id]))
      if (!Number.isFinite(distance) || distance < 0) continue
      if (distance < bestDistance) { best = id; bestDistance = distance }
    }
    if (best) return best
  }
  return candidates[0]
}

// ---------------------------------------------------------------------------
// 隐匿迷你卡（Concealed X）
// ---------------------------------------------------------------------------
/** 隐匿 X：优先读卡条目声明的 `enemyRule.concealed`（声明即接线），缺省用 definition 的印刷表。 */
export const concealedAmountOf = code => {
  const declared = enemyRuleFor(code)?.concealed
  if (declared != null) return Number(declared) || 0
  return Number(CONCEALED_AMOUNTS[code]) || 0
}
export const miniCardsAt = (state, locationId) =>
  concealedMiniCards(state).filter(card => card.locationId === locationId)

/** 该敌人应把迷你卡分成在哪些地点：红衣女郎 → 有标靶的地点；分裂精魂 → 没有标靶的非中心地点。 */
export function concealedSpotsFor(state, code) {
  const inPlay = (state.locations || []).map(location => location.id)
  if (code === LA_CHICA_ROJA) {
    const withTargets = targetLocations(state)
    return withTargets.length ? withTargets : inPlay.filter(id => id !== AVENIDA_DE_MAYO)
  }
  if (code === APPORTIONED_KA) {
    return inPlay.filter(id => targetsOn(state, id) === 0 && !locationTraitOf(state, id, CENTRAL_TRAIT))
  }
  return inPlay
}

/**
 * 尽可能平均地分配 `cards` 到 `locationIds`；除不尽时多出的 1 张按地点顺序补足
 * （参考实现让领队选择，这里取确定性顺序，见 scenarioApproximations）。
 */
export function evenPlacements(cards, locationIds) {
  const ids = [...new Set(locationIds)]
  if (!ids.length) return []
  const placements = ids.map(locationId => ({ locationId, count: 0 }))
  cards.forEach((_, index) => { placements[index % ids.length].count += 1 })
  return placements.filter(entry => entry.count > 0)
}

/** 该敌人当前的一套迷你卡（真身 + 它自己的诱饵）。 */
export function concealedGroupOf(state, code) {
  const trueKind = kindOf(code)
  const decoyKind = decoyKindOf(code)
  return concealedMiniCards(state).filter(card => card.kind === trueKind || card.kind === decoyKind)
}

/** 回收该敌人已有的整套迷你卡（重新结算隐匿前调用；不触碰其他敌人的卡）。 */
export function clearConcealedFor(state, code) {
  const group = concealedGroupOf(state, code)
  for (const card of group) {
    try { exposeMiniCard(state, card.id) } catch { /* 已移除 */ }
  }
  return group.length
}

/** 结算「隐匿 X」：真身迷你卡 + X 张诱饵混洗后平均分配到地点。返回创建的迷你卡。 */
export function resolveConcealed(state, code, { locations = null, shuffle = null } = {}) {
  const amount = concealedAmountOf(code)
  if (!amount) return []
  const spots = locations && locations.length ? locations : concealedSpotsFor(state, code)
  if (!spots.length) return []
  clearConcealedFor(state, code)
  const cards = [{ kind: kindOf(code), code, decoy: false }]
  for (let index = 0; index < amount; index += 1) cards.push({ kind: decoyKindOf(code), decoy: true })
  const placements = evenPlacements(cards, spots)
  return distributeConcealed(state, { cards, placements, position: null, ...(shuffle ? { shuffle } : {}) })
}

/** 敌人「返回阴影」：从场上移出（放进放一边区，不算击败、不进胜利区）。 */
export function returnEnemyToShadows(state, code, api = null) {
  const enemy = enemyOf(state, code)
  if (!enemy) return false
  if (typeof api?.setEnemyAside === 'function') return Boolean(api.setEnemyAside(enemy))
  state.enemies = (state.enemies || []).filter(item => item !== enemy)
  return true
}

/** 揭露（Expose）一张迷你卡：诱饵翻面移除；真身把对应敌人放到该地点并派发条目声明。 */
export function exposeAt(state, inv, miniCardId, api = null) {
  const card = concealedMiniCards(state).find(item => item.id === miniCardId)
  if (!card) return null
  const locationId = card.locationId
  const result = exposeWithReaction(state, api, miniCardId, { seat: inv?.seat ?? null })
  const data = chapterState(state)
  if (result.decoy) {
    data.decoyExposedCount = (Number(data.decoyExposedCount) || 0) + 1
    decoyExposedForced(state, inv, api)
    return { ...result, locationId }
  }
  const exposedCode = codeOfKind(result.kind)
  const aside = (state.setAsideEnemies || []).find(enemy => codeOf(enemy) === exposedCode)
  let enemy = null
  if (aside && typeof api?.restoreEnemyFromAside === 'function') {
    enemy = api.restoreEnemyFromAside(aside.id, locationId)
  }
  if (!enemy && typeof api?.spawn === 'function') enemy = api.spawn(exposedCode, locationId)
  if (exposedCode === LA_CHICA_ROJA) data.laChicaRojaExposed = true
  if (exposedCode === SANGUINE_WATCHER) data.watcherId = enemy?.id || null
  api?.info?.(`🔓 揭露了「${cardNameOf(exposedCode)}」的真身：它出现在「${locationName(state, locationId)}」。`)
  // 条目声明 enemyScript.exposedDamage / returnToShadowsOnExposed（09564 分裂精魂）。
  const script = enemyScriptOf(exposedCode)
  if (script?.exposedDamage) {
    const target = enemyOf(state, String(script.exposedDamage.code || ''))
    const amount = Number(script.exposedDamage.amount) || 0
    if (target && amount > 0) {
      if (typeof api?.damageEnemy === 'function') api.damageEnemy(target.id, amount, inv?.seat ?? null, exposedCode)
      else target.damageTaken = (Number(target.damageTaken) || 0) + amount
      api?.info?.(`💥 「${cardNameOf(exposedCode)}」被揭露：对「${cardNameOf(codeOf(target))}」造成 ${amount} 点伤害。`)
    }
  }
  if (script?.returnToShadowsOnExposed) {
    returnEnemyToShadows(state, exposedCode, api)
    resolveConcealed(state, exposedCode)
    api?.info?.(`🌫️ 「${cardNameOf(exposedCode)}」返回阴影，迷你卡重新分发。`)
  }
  return { ...result, kind: result.kind, code: exposedCode, locationId, enemyId: enemy?.id || null }
}

/** 揭露诱饵后的强制能力：密谋 1 → 红衣女郎攻击你；见红 → 在该密谋上放 1 个毁灭。 */
function decoyExposedForced(state, inv, api = null) {
  const agendaCode = codeOf((state.agendas || [])[state.agendaIndex])
  if (agendaCode === RAW_CODES.seeingRed) {
    addDoomOnAgenda(state, 1, api)
    api?.info?.('🩸 揭露诱饵：在「见红」上放置 1 个毁灭标记。')
    return
  }
  if (agendaCode !== RAW_CODES.agenda1 || !inv) return
  const enemy = enemyOf(state, LA_CHICA_ROJA)
  if (!enemy) return
  api?.info?.(`🩸 揭露诱饵：${inv.name || '调查员'} 被红衣女郎攻击。`)
  if (typeof api?.attack === 'function') api.attack(enemy, state.investigators?.[inv.seat] || inv)
}

function addDoomOnAgenda(state, amount, api = null) {
  if (typeof api?.addDoom === 'function') return api.addDoom(amount)
  state.doom = (Number(state.doom) || 0) + amount
  return state.doom
}

/**
 * 重洗某组地点上的隐匿迷你卡位置（[cultist] 的失败后果也用它）：
 * 只在该组迷你卡之间重排 kind/decoy，地点与位置槽不变（不增删、不跨出该组）。
 */
export function reshuffleConcealedAt(state, locationIds, shuffle = null) {
  const container = state.scenarioFlags?.mechanics?.tsk?.concealed
  if (!container?.miniCards?.length) return []
  const ids = new Set(locationIds)
  const group = container.miniCards.filter(card => ids.has(card.locationId))
  if (group.length < 2) return group.map(card => ({ ...card }))
  const kinds = group.map(card => ({ kind: card.kind, decoy: card.decoy }))
  const mixed = typeof shuffle === 'function'
    ? shuffle(kinds.map(card => ({ ...card })))
    : fisherYates(state, kinds)
  if (!Array.isArray(mixed) || mixed.length !== kinds.length) {
    throw new TypeError('重洗回调必须返回同一数量')
  }
  group.forEach((card, index) => {
    card.kind = mixed[index].kind
    card.decoy = mixed[index].decoy === true
  })
  return group.map(card => ({ ...card }))
}
function fisherYates(state, list) {
  const copy = list.map(item => ({ ...item }))
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomValue(state) * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
function placeLocationInstance(state, id, { revealed = false } = {}) {
  const definition = LOCATIONS[id]
  if (!definition) return null
  state.locations ||= []
  const existing = state.locations.find(location => location.id === id)
  if (existing) return existing
  const maxClues = clueValueOf(state, id)
  const location = {
    ...definition,
    id,
    code: definition.originalCode || definition.code,
    connections: [...(definition.connections || [])],
    revealed,
    clues: revealed ? maxClues : 0,
    maxClues,
    ...(id === AVENIDA_DE_MAYO
      ? { shroud: AVENIDA_SHROUD_BY_DIFFICULTY[difficultyKey(state)], resign: true }
      : {}),
  }
  state.locations.push(location)
  return location
}

/** 运行时连接：中心 ↔ 入场地点；同符号的两张互连（被移除的那张没有边）。 */
function connectPlacedLocations(state, placedIds) {
  const placed = new Set(placedIds)
  const bySymbol = new Map()
  for (const id of placedIds) {
    const own = LOCATION_SYMBOLS[id]?.own
    if (!own) continue
    if (!bySymbol.has(own)) bySymbol.set(own, [])
    bySymbol.get(own).push(id)
  }
  for (const location of state.locations || []) {
    if (location.id !== AVENIDA_DE_MAYO && !placed.has(location.id)) continue
    const next = new Set()
    if (location.id === AVENIDA_DE_MAYO) {
      for (const id of placedIds) if (id !== AVENIDA_DE_MAYO) next.add(id)
    } else {
      next.add(AVENIDA_DE_MAYO)
      for (const other of bySymbol.get(LOCATION_SYMBOLS[location.id]?.own) || []) {
        if (other !== location.id) next.add(other)
      }
    }
    location.connections = [...next]
  }
}

function setupTargets(state) {
  for (const location of state.locations || []) {
    if (location.id === AVENIDA_DE_MAYO) continue
    placeTarget(state, location.id, 1)
  }
}

function drawLaChicaRoja(state) {
  const data = chapterState(state)
  if (data.laChicaRojaResolved) return []
  data.laChicaRojaResolved = true
  return resolveConcealed(state, LA_CHICA_ROJA)
}

// ---------------------------------------------------------------------------
// 幕间「云开见日」（Cast a Light 7）
// ---------------------------------------------------------------------------
export function enterSeeingRed(state, api = null) {
  const data = chapterState(state)
  if (data.seeingRed) return false
  data.seeingRed = true
  returnEnemyToShadows(state, LA_CHICA_ROJA, api)
  clearConcealedFor(state, LA_CHICA_ROJA)
  // 见红既是当前幕也是当前密谋。
  state.acts = [structuredClone(SEEING_RED_ACT)]
  state.actIndex = 0
  state.agendas = [structuredClone(SEEING_RED_AGENDA)]
  state.agendaIndex = 0
  state.doom = 0
  addDoomOnAgenda(state, 1, api)
  // 随机选一个有标靶的地点生成血色监视者，移除其余标靶。
  const candidates = targetLocations(state)
  const index = candidates.length
    ? Math.min(candidates.length - 1, Math.floor(randomValue(state) * candidates.length)) : -1
  const chosen = index >= 0 ? candidates[index] : null
  for (const id of candidates) removeTarget(state, id, targetsOn(state, id))
  if (chosen) {
    const watcher = typeof api?.spawn === 'function' ? api.spawn(SANGUINE_WATCHER, chosen) : null
    data.watcherId = watcher?.id || null
    api?.info?.(`🩸 血色监视者在「${locationName(state, chosen)}」现身。`)
  }
  resolveConcealed(state, APPORTIONED_KA)
  if (typeof api?.shuffleEncounterDiscardBackIn === 'function') api.shuffleEncounterDiscardBackIn()
  api?.info?.('🩸 见红：幕与密谋牌库被替换，「见红」同时是当前幕与当前密谋。')
  return true
}

/**
 * 幕间故事「云开见日」（Cast a Light 1–7）：09548b 在冒险参考卡有 3 个标靶时进入。
 * 2026-11-13 P1-14：此前进入点直接调用 enterSeeingRed（= Cast a Light 7），跳过了
 * 1/2/3 的分支——「红衣女郎身上还有标靶 / 领队不相信她」本应直接 →R1（结局 1），
 * 且从不生成 09557b 剧情支援面。本函数按印刷补齐分支。
 */
export function enterCastALight(state, api = null) {
  const data = chapterState(state)
  if (data.castALight) return false
  data.castALight = true
  // Cast a Light 1：检查红衣女郎身上的标靶；有标靶则她带着标靶消失 → 结局 1。
  if (laChicaRojaTargetCount(state) > 0) {
    api?.info?.('🎭 云开见日 1：红衣女郎身上仍有标靶，她消失在阴影中 → 结局 1。')
    if (typeof api?.finish === 'function') api.finish('resolution1')
    return 'resolution1'
  }
  // Cast a Light 2：领队决定是否相信她。
  const seat = aliveInvestigators(state)[0]?.seat ?? state.investigators?.[0]?.seat ?? 0
  const answer = choiceFor(api, {
    kind: 'story', source: 'castALight2', seat,
    prompt: '云开见日 2：领队必须决定是否相信红衣女郎。',
    options: [
      { id: 'believe', label: '“我相信你。”（前往云开见日 3）' },
      { id: 'disbelieve', label: '“抱歉，但我不能相信你。”（→ 结局 1）' },
    ],
  }) || 'disbelieve'
  if (answer === 'disbelieve') {
    api?.info?.('🎭 云开见日 4：特别小组不相信红衣女郎，她消失在阴影中 → 结局 1。')
    if (typeof api?.finish === 'function') api.finish('resolution1')
    return 'resolution1'
  }
  // Cast a Light 3→5/6：玻利瓦尔警长的信任决定叙事分支，但 5/6 都汇入 7。
  const records = recordsFor(state)
  if (records.matiasBolivarTrustsYou === true) {
    api?.info?.('🎭 云开见日 5：玻利瓦尔警长信任特别小组……警队破门而入，红衣女郎带着你们从窗口逃脱。')
  } else if (records.matiasBolivarDoesntTrustYou === true) {
    api?.info?.('🎭 云开见日 6：玻利瓦尔警长不信任特别小组，警队破门而入，红衣女郎带着你们从窗口逃脱。')
  }
  // Cast a Light 7：红衣女郎翻至剧情支援面交给一名调查员，然后进入「见红」。
  grantLaChicaRojaAlly(state, api)
  enterSeeingRed(state, api)
  api?.info?.('🎭 云开见日 7：红衣女郎成为剧情支援；「见红」同时是当前幕与当前密谋。')
  return 'seeingRed'
}

/** 09557b 生成：红衣女郎翻到剧情支援面，由领队选择的调查员控制。 */
function grantLaChicaRojaAlly(state, api = null) {
  const invs = aliveInvestigators(state)
  if (!invs.length) return null
  const answer = choiceFor(api, {
    kind: 'investigator', source: 'castALight7', seat: aliveInvestigators(state)[0]?.seat ?? state.investigators?.[0]?.seat ?? 0,
    prompt: '云开见日 7：选择一位调查员控制红衣女郎（剧情支援面）。',
    options: invs.map(inv => ({ id: String(inv.seat), label: inv.name })),
  })
  const seat = Number.isInteger(Number(answer)) && state.investigators[Number(answer)]
    ? Number(answer) : invs[0].seat
  const inv = state.investigators[seat] || invs[0]
  returnEnemyToShadows(state, LA_CHICA_ROJA, api)
  // 引擎的剧情资产入口在 `api.storyAsset`（scenarioRuntime 顶层）；兼容旧命名空间写法。
  const spawnStoryAsset = api?.storyAsset || api?.scenario?.storyAsset
  const asset = typeof spawnStoryAsset === 'function' ? spawnStoryAsset(RAW_CODES.laChicaRojaAlly, inv.location) : null
  if (!asset) return null
  const index = (state.storyAssets || []).indexOf(asset)
  if (index >= 0) state.storyAssets.splice(index, 1)
  asset.uncontrolled = false
  asset.controllerSeat = inv.seat
  asset.location = inv.location
  inv.assets.push(asset)
  api?.info?.(`🃏 红衣女郎翻至剧情支援面，由 ${inv.name} 控制。`)
  return asset
}

// ---------------------------------------------------------------------------
// 幕/密谋推进效果
// ---------------------------------------------------------------------------
function laChicaRojaMiniCardLocation(state) {
  const mini = concealedMiniCards(state).find(card => card.kind === kindOf(LA_CHICA_ROJA) && !card.decoy)
  return mini?.locationId || null
}
const laChicaRojaReferenceLocation = state =>
  enemyOf(state, LA_CHICA_ROJA)?.location || laChicaRojaMiniCardLocation(state)

/** 密谋 1 背面：红衣女郎收集最近的有标靶地点上的 1 个标靶；3 个即 → 结局 3。 */
export function collectTargetForLaChicaRoja(state, api = null) {
  const locationId = nearestTargetLocation(state, laChicaRojaReferenceLocation(state), api)
  if (!locationId) return null
  removeTarget(state, locationId, 1)
  const total = addLaChicaRojaTarget(state, 1)
  api?.info?.(`🩸 红衣女郎从「${locationName(state, locationId)}」取走 1 个标靶（共 ${total} 个）。`)
  if (total >= 3) {
    chapterState(state).pendingResolution = 'resolution3'
    if (typeof api?.finish === 'function') api.finish('resolution3')
  }
  return locationId
}

/** 幕 2 背面：把最近的有标靶地点的标靶放到冒险参考卡上。 */
export function advanceTargetToReference(state, api = null) {
  const locationId = nearestTargetLocation(state, laChicaRojaReferenceLocation(state), api)
  if (!locationId) return null
  removeTarget(state, locationId, 1)
  const total = addReferenceTarget(state, 1)
  api?.info?.(`🎯 「${locationName(state, locationId)}」的标靶被放到冒险参考卡上（共 ${total} 个）。`)
  return locationId
}

/** 幕/密谋重置：治愈红衣女郎、返回阴影、重洗隐匿、双牌库回到幕 1/密谋 1。 */
export function resetStageDecks(state, api = null) {
  const data = chapterState(state)
  const enemy = enemyOf(state, LA_CHICA_ROJA)
  if (enemy) enemy.damageTaken = 0
  returnEnemyToShadows(state, LA_CHICA_ROJA, api)
  data.parleyed = false
  resolveConcealed(state, LA_CHICA_ROJA)
  state.acts = structuredClone(acts)
  state.actIndex = 0
  state.agendas = structuredClone(agendas)
  state.agendaIndex = 0
  state.doom = 0
  addDoomOnAgenda(state, Number(state.numInvestigators) || 1, api)
  return true
}

/** 把每个已揭示地点补到它的线索值。 */
export function refillLocationClues(state) {
  for (const location of state.locations || []) {
    if (!location.revealed) continue
    const max = clueValueOf(state, location.id)
    if ((Number(location.clues) || 0) < max) location.clues = max
  }
}

// ---------------------------------------------------------------------------
// 时间 / 记录
// ---------------------------------------------------------------------------
export function markTime(state, amount) {
  const value = Math.max(0, Math.floor(Number(amount) || 0))
  if (!value) return 0
  const records = recordsFor(state)
  records.time = (Number(records.time) || 0) + value
  const map = state.campaign?.tsk?.map
  if (map) map.time = Number(records.time)
  return records.time
}
function recordFact(state, key, value = true) {
  const records = recordsFor(state)
  if (value === false) delete records[key]
  else records[key] = value
  return records[key]
}

// ---------------------------------------------------------------------------
// 遭遇卡分派
// ---------------------------------------------------------------------------
function nearestCoterieEnemy(state, inv, api = null) {
  const enemies = (state.enemies || []).filter(enemy => !enemy.defeated
    && (enemy.traits || []).some(trait => String(trait).toLowerCase() === COTERIE_TRAIT.toLowerCase()))
  if (!enemies.length) return null
  if (!inv?.location) return enemies[0]
  const here = enemies.find(enemy => enemy.location === inv.location)
  if (here) return here
  if (typeof api?.locationDistance === 'function') {
    let best = null
    let bestDistance = Infinity
    for (const enemy of enemies) {
      const distance = Number(api.locationDistance(inv.location, [enemy.location]))
      if (Number.isFinite(distance) && distance >= 0 && distance < bestDistance) {
        best = enemy
        bestDistance = distance
      }
    }
    if (best) return best
  }
  return enemies[0]
}

function choiceFor(api, request) {
  const choose = api?.choose || api?.choice
  if (typeof choose !== 'function') return null
  try {
    return choose(request)
  } catch (error) {
    // 引擎用异常表达「等待玩家选择 / 事务检查点」；吞掉会让选择静默默认或事务游标失配。
    if (isPendingChoice(error)) throw error
    return null
  }
}

function doomOrCoterieAttack(state, inv, api) {
  const enemy = nearestCoterieEnemy(state, inv, api)
  const options = [{ id: 'doom', label: '在当前密谋上放置 1 个毁灭标记' }]
  if (enemy) options.push({ id: 'attack', label: `最近的[[结社]]敌人「${enemy.name || codeOf(enemy)}」攻击你` })
  const answer = choiceFor(api, {
    kind: 'choice', source: 'sanguineElderThing', seat: inv?.seat ?? 0,
    prompt: '[elderthing]：选择一个后果。', options,
  }) || 'doom'
  if (answer === 'attack' && enemy) {
    api?.info?.(`🩸 最近的[[结社]]敌人「${enemy.name || codeOf(enemy)}」攻击 ${inv.name || '调查员'}。`)
    if (typeof api?.attack === 'function') api.attack(enemy, state.investigators?.[inv.seat] || inv)
    return 'attack'
  }
  addDoomOnAgenda(state, 1, api)
  api?.info?.('🌑 [elderthing]：在当前密谋上放置 1 个毁灭标记。')
  return 'doom'
}

function outsmarted(state, inv, card, api) {
  api?.test?.(inv.seat, 'intellect', 4, result => {
    if (result?.success) return
    doomOrCoterieAttack(state, inv, api)
  }, 0, { type: 'encounter', label: card?.name || '技高一筹', code: RAW_CODES.outsmarted })
}

function catAndMouse(state, inv, card, api) {
  const here = miniCardsAt(state, inv.location)
  if (!here.length) return
  const options = [{ id: 'skip', label: '不揭露' }, ...here.map((mini, index) =>
    ({ id: mini.id, label: `揭露第 ${index + 1} 张迷你卡` }))]
  const answer = choiceFor(api, {
    kind: 'choice', source: RAW_CODES.catAndMouse, seat: inv.seat,
    prompt: '「猫抓老鼠」：你可以揭露你所在地点的一张迷你卡。', options,
  })
  if (!answer || answer === 'skip') return
  const mini = here.find(item => item.id === answer)
  if (!mini) return
  if (mini.decoy) { exposeAt(state, inv, mini.id, api); return }
  api?.info?.(`🃏 「猫抓老鼠」把「${cardNameOf(codeOfKind(mini.kind))}」的迷你卡翻回并混洗。`)
  reshuffleConcealedAt(state, [inv.location])
}

function callingCard(state, inv, card, api) {
  const candidates = (state.locations || []).filter(location => targetsOn(state, location.id) === 0
    && !(location.attachments || []).some(attachment => codeOf(attachment) === RAW_CODES.callingCard))
  if (!candidates.length) return
  const picked = candidates.length === 1 ? candidates[0].id
    : choiceFor(api, {
      kind: 'location', source: RAW_CODES.callingCard, seat: inv.seat,
      prompt: '「来访名片」：附属到一个没有标的、且没有来访名片的地点。',
      options: candidates.map(location => ({ id: location.id, label: location.name })),
    })
  const target = locationOf(state, picked) || candidates[0]
  target.attachments ||= []
  target.attachments.push({
    id: `callingCard${target.id}${target.attachments.length + 1}`,
    code: RAW_CODES.callingCard, originalCode: RAW_CODES.callingCard,
  })
  api?.info?.(`🪪 「来访名片」附属到「${locationName(state, target.id)}」：线索不能花费，直到它被弃掉。`)
}

const TREACHERY_HANDLERS = Object.freeze({ catAndMouse, callingCard, outsmarted })

/** 章节分派：优先用条目声明的 `treacheryRule.resolveKind`，未声明时退回按卡号。 */
function treacheryHandlerFor(code) {
  const rule = treacheryRuleFor(code) || {}
  if (rule.resolveKind && TREACHERY_HANDLERS[rule.resolveKind]) return TREACHERY_HANDLERS[rule.resolveKind]
  return TREACHERY_HANDLERS[code] || null
}

// ---------------------------------------------------------------------------
// 地点行动（地点不建条目，按卡面模板统一实现）
// ---------------------------------------------------------------------------
// 「花费 1 线索 → 检定 → 查看已揭示面」模板：09550 玫瑰宫（智力）/09551 主教座堂（敏捷）/
// 09553 伊拉祖里兹宫（战斗）/09556 哥伦布剧院（意志）。
const LOOK_ACTIONS = Object.freeze({
  casaRosada: { rule: 'observeStaff', label: '花费 1 个线索：检定[智力](4) 观察员工', skill: 'intellect', difficulty: 4 },
  catedralMetropolitana: { rule: 'watchRooftops', label: '花费 1 个线索：检定[敏捷](4) 查看教堂天顶', skill: 'agility', difficulty: 4 },
  palacioErrazuriz: { rule: 'breakIn', label: '花费 1 个线索：检定[战斗](4) 闯入庄园', skill: 'combat', difficulty: 4 },
  teatroColon: { rule: 'stakeOutRafters', label: '花费 1 个线索：检定[意志](4) 留心剧院梁柱', skill: 'willpower', difficulty: 4 },
})
// 「花费 X 线索（另有代价）→ 查看 X 张已揭示面」：09552 雷科莱塔公墓（另受 X 点恐惧）、
// 09555 省立银行（另付三倍资源）。
const SPEND_LOOK_ACTIONS = Object.freeze({
  recoleta: { rule: 'readTombs', label: '花费 X 个线索并受到 X 点恐惧：查看 X 张迷你卡的已揭示面', resourceFactor: 0 },
  bancoDeLaProvincia: { rule: 'bribeTellers', label: '花费 X 个线索与三倍资源：查看 X 张迷你卡的已揭示面', resourceFactor: 3 },
})

function lookAtMiniCards(state, inv, api, count) {
  const candidates = miniCardsAt(state, inv.location)
  if (!candidates.length) return []
  const seen = candidates.slice(0, Math.max(0, Math.min(count, candidates.length)))
  const container = state.scenarioFlags?.mechanics?.tsk?.concealed
  for (const card of seen) {
    const record = container?.miniCards?.find(item => item.id === card.id)
    if (!record) continue
    // 2026-11-13 P1-15：只要「合法看过」的座位可见（knownBy），不再写全局 known
    // —— 此前任意座位都能从投影里看出真身/诱饵身份。
    const markKnown = api?.mechanics?.tsk?.concealed?.markKnown
    if (typeof markKnown === 'function') markKnown(card.id, inv.seat)
    else record.knownBy = [...new Set([...(record.knownBy || []), inv.seat])]
  }
  // 公开日志只写「看了几张」，不写卡名/真身/诱饵（观看者本人从面板/投影获得信息）。
  api?.info?.(`🔍 ${inv.name || '调查员'} 查看了 ${seen.length} 张隐匿迷你卡的已揭示面（不揭露）。`)
  return seen
}

function performLookAction(state, inv, api, spec) {
  if (cluesSpendBlocked(state)) return false
  if ((Number(inv.clues) || 0) < 1) return false
  if (typeof api?.spendClues === 'function') api.spendClues(inv.seat, 1)
  else inv.clues = (Number(inv.clues) || 0) - 1
  api?.test?.(inv.seat, spec.skill, spec.difficulty, result => {
    if (!result?.success) return
    const extra = Math.floor(Math.max(0, (Number(result.value) || 0) - spec.difficulty) / 2)
    lookAtMiniCards(state, inv, api, 1 + extra)
  }, 0, { type: 'scenario', label: spec.rule, code: inv.location })
  return true
}

function performSpendLookAction(state, inv, api, move) {
  if (cluesSpendBlocked(state)) return false
  const max = Math.max(0, Number(move.xMax) || 0)
  if (!max) return false
  const answer = choiceFor(api, {
    kind: 'choice', source: inv.location, seat: inv.seat,
    prompt: '选择要花费的 X（查看同样数量的迷你卡）。',
    options: Array.from({ length: max }, (_, index) => ({ id: String(index + 1), label: `X = ${index + 1}` })),
  })
  const x = Math.min(max, Math.max(1, Number(answer) || 1))
  if (typeof api?.spendClues === 'function') api.spendClues(inv.seat, x)
  else inv.clues = (Number(inv.clues) || 0) - x
  const spec = SPEND_LOOK_ACTIONS[inv.location]
  if (spec?.resourceFactor) {
    const cost = x * spec.resourceFactor
    if (typeof api?.loseResources === 'function') api.loseResources(inv.seat, cost)
    else inv.resources = Math.max(0, (Number(inv.resources) || 0) - cost)
  } else {
    if (typeof api?.directHorror === 'function') api.directHorror(inv.seat, x)
    else inv.horror = (Number(inv.horror) || 0) + x
  }
  lookAtMiniCards(state, inv, api, x)
  return true
}

/** 幕 2 谈判：检定[智力]或[敏捷](6)（可花 1 线索把难度降低 2）；失败被红衣女郎攻击。 */
function performParley(state, inv, api) {
  const enemy = enemyOf(state, LA_CHICA_ROJA)
  if (!enemy || enemy.location !== inv.location) return false
  const canSpend = (Number(inv.clues) || 0) >= 1 && !cluesSpendBlocked(state)
  const answer = canSpend ? choiceFor(api, {
    kind: 'choice', source: RAW_CODES.act2, seat: inv.seat,
    prompt: '花费 1 个线索把本次检定难度降低 2 点？',
    options: [{ id: 'spend', label: '花费 1 个线索（难度 -2）' }, { id: 'skip', label: '不花费' }],
  }) : null
  const difficulty = 6 - (answer === 'spend' ? 2 : 0)
  if (answer === 'spend') {
    if (typeof api?.spendClues === 'function') api.spendClues(inv.seat, 1)
    else inv.clues = (Number(inv.clues) || 0) - 1
  }
  const skillAnswer = choiceFor(api, {
    kind: 'choice', source: RAW_CODES.act2, seat: inv.seat,
    prompt: '选择技能：智力或敏捷。',
    options: [{ id: 'intellect', label: '智力' }, { id: 'agility', label: '敏捷' }],
  })
  const skill = skillAnswer === 'agility' ? 'agility' : 'intellect'
  api?.test?.(inv.seat, skill, difficulty, result => {
    if (result?.success) {
      chapterState(state).parleyed = true
      api?.info?.('🤝 谈判成功：红衣女郎愿意听你说完。')
      return
    }
    api?.info?.('🤝 谈判失败：红衣女郎攻击你。')
    if (typeof api?.attack === 'function') api.attack(enemy, state.investigators?.[inv.seat])
  }, 0, { type: 'scenario', label: '谈判', code: RAW_CODES.act2 })
  return true
}

// ---------------------------------------------------------------------------
// 恸哭女士（09565a/b）：Shift 结算。密钥实体由 api.mechanics.tsk.keys 管理，
// 本函数只读条目声明的 `assetRule.shift`（当前面）再翻面。
// ---------------------------------------------------------------------------
export function shiftWeepingLady(state, seat, api = null) {
  const record = state.campaign?.tsk?.keys?.keys?.[WEEPING_LADY_KEY.id]
  if (!record) return null
  const faceCode = record.stable ? record.stableFace : record.unstableFace
  const rule = assetRuleFor(faceCode)?.shift
  if (!rule) return null
  const inv = (state.investigators || []).find(item => item.seat === seat)
  if (rule.kind === 'discoverClue' && inv) {
    const targets = [inv.location, ...(locationOf(state, inv.location)?.connections || [])]
      .filter(id => locationOf(state, id))
    const picked = choiceFor(api, {
      kind: 'location', source: faceCode, seat,
      prompt: '「恸哭女士」：在你所在地点或连接地点发现 1 个线索。',
      options: targets.map(id => ({ id, label: locationName(state, id) })),
    })
    const locationId = locationOf(state, picked) ? picked : inv.location
    if (typeof api?.discoverClue === 'function') api.discoverClue(seat, 1, locationId)
    else {
      const location = locationOf(state, locationId)
      if (location && (Number(location.clues) || 0) > 0) {
        location.clues = (Number(location.clues) || 0) - 1
        inv.clues = (Number(inv.clues) || 0) + 1
      }
    }
    api?.info?.(`💧 「恸哭女士」（稳定面）：在「${locationName(state, locationId)}」发现 1 个线索。`)
  } else if (rule.kind === 'discardAsset') {
    for (const owner of aliveInvestigators(state)) {
      const asset = (owner.assets || [])[0]
      if (!asset) continue
      if (typeof api?.discardAsset === 'function') api.discardAsset(owner.seat, asset.id)
      else owner.assets = owner.assets.filter(item => item !== asset)
    }
    api?.info?.('💧 「恸哭女士」（动荡面）：每位调查员弃掉自己控制的一个支援。')
  }
  const shifted = typeof api?.mechanics?.tsk?.keys?.shift === 'function'
    ? api.mechanics.tsk.keys.shift(WEEPING_LADY_KEY.id) : null
  return { faceCode, kind: rule.kind, stable: shifted?.stable ?? !record.stable }
}

/** 「来访名片」在场时（任意地点）不能花费线索：读条目声明的 blocksClueSpendingEverywhere。 */
export function cluesSpendBlocked(state) {
  for (const location of state.locations || []) {
    for (const attachment of location.attachments || []) {
      if (treacheryRuleFor(codeOf(attachment))?.blocksClueSpendingEverywhere === true) return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// 结局辅助
// ---------------------------------------------------------------------------
function resolutionStory(key, fallbackTitle) {
  return { title: fallbackTitle, paragraphs: [resolutions[key] || ''] }
}
function chooseBearerSeat(state, api) {
  const alive = aliveInvestigators(state)
  if (!alive.length) return null
  if (alive.length === 1) return alive[0].seat
  const answer = choiceFor(api, {
    kind: 'story', source: 'weepingLady', seat: alive[0].seat,
    prompt: '选择一位调查员持有「恸哭女士」。',
    options: alive.map(inv => ({ id: String(inv.seat), label: inv.name || `调查员${inv.seat + 1}` })),
  })
  const seat = Number(answer)
  return alive.some(inv => inv.seat === seat) ? seat : alive[0].seat
}
/** 恸哭女士的归属：调查员走 tsk-scarlet-keys 的绑定；对手持有只写记录。 */
function bindWeepingLady(state, api, bearer) {
  const keys = api?.mechanics?.tsk?.keys
  if (!keys || typeof keys.bind !== 'function') return false
  try {
    if (typeof bearer === 'number') keys.bind(WEEPING_LADY_KEY.id, { type: 'investigator', seat: bearer })
    else keys.bind(WEEPING_LADY_KEY.id, { type: 'none' })
    return true
  } catch {
    return false
  }
}
function swapChaosToken(state, from, to, api = null) {
  const bag = Array.isArray(state.chaosBag) ? state.chaosBag : (state.chaosBag = [])
  if (bag.filter(token => token === to).length >= 4) {
    for (const inv of state.investigators || []) inv.scenarioXpBonus = (Number(inv.scenarioXpBonus) || 0) + 1
    api?.info?.('混乱袋里已经有 4 个该标记：改为每位调查员取得 1 点经验值。')
    return false
  }
  const index = bag.indexOf(from)
  if (index >= 0) bag.splice(index, 1)
  bag.push(to)
  return true
}
function enemyHealthOf(enemy) {
  if (!enemy || enemy.health == null) return null
  return Number(enemy.health)
}

// ---------------------------------------------------------------------------
// behavior
// ---------------------------------------------------------------------------
export const behavior = {
  id: CHAPTER_ID,
  implementedEncounterCodes: Object.freeze([
    RAW_CODES.laChicaRoja, RAW_CODES.laChicaRojaAlly, RAW_CODES.boundNightgaunt,
    RAW_CODES.catAndMouse, RAW_CODES.callingCard, RAW_CODES.outsmarted,
    RAW_CODES.sanguineWatcher, RAW_CODES.apportionedKa,
    RAW_CODES.weepingLadyStable, RAW_CODES.weepingLadyUnstable,
  ]),
  scenarioApproximations,
  scenarioGaps,
  tokenMeanings: SANGUINE_SHADOWS_TOKEN_MEANINGS,
  recordReads: RECORD_READS,
  recordWrites: RECORD_WRITES,
  resolutions: Object.keys(resolutions),
  gatherGroups: GATHER_GROUPS,

  // ---- 开场：三选一决定玻利瓦尔是否信任你，并交换混乱标记 ----
  preScenarioSetup(state, events, api) {
    const data = chapterState(state)
    if (data.introResolved) return
    data.introResolved = true
    const labels = scenario.introChoices || []
    const seat = aliveInvestigators(state)[0]?.seat ?? 0
    const answer = choiceFor(api, {
      kind: 'story', source: 'sanguineShadowsIntro', seat,
      prompt: '你要告诉玻利瓦尔多少情报？',
      options: labels.map(entry => ({ id: entry.id, label: entry.label })),
    })
    const choice = labels.some(entry => entry.id === answer) ? answer : 'everything'
    data.intro = choice
    if (choice === 'everything') {
      recordFact(state, 'matiasBolivarTrustsYou', true)
      recordFact(state, 'matiasBolivarDoesntTrustYou', false)
      swapChaosToken(state, 'elderthing', 'tablet', api)
      api?.info?.('🤝 玻利瓦尔信任你：移除 1 个 [elderthing]，加入 1 个 [tablet]。')
    } else if (choice === 'insist') {
      recordFact(state, 'matiasBolivarDoesntTrustYou', true)
      recordFact(state, 'matiasBolivarTrustsYou', false)
      swapChaosToken(state, 'tablet', 'elderthing', api)
      api?.info?.('🤝 玻利瓦尔不信任你：移除 1 个 [tablet]，加入 1 个 [elderthing]。')
    } else {
      api?.info?.('🤝 你只给了玻利瓦尔一点边角料：混乱袋不变。')
    }
  },

  // ---- 布置：中心 + 六张候选地点、六个标靶、红衣女郎的隐匿 5 ----
  setupLocations(state, events, helper = {}) {
    const data = chapterState(state)
    behavior.preScenarioSetup(state, events, helper.api)
    placeLocationInstance(state, AVENIDA_DE_MAYO, { revealed: true })
    const removed = CANDIDATE_LOCATION_IDS.includes(data.removedLocation)
      ? data.removedLocation
      : shuffleWith(state, CANDIDATE_LOCATION_IDS, helper)[0]
    data.removedLocation = removed
    const placed = CANDIDATE_LOCATION_IDS.filter(id => id !== removed)
    for (const id of placed) placeLocationInstance(state, id, { revealed: false })
    connectPlacedLocations(state, placed)
    state.scenarioZones ||= {}
    state.scenarioZones.removed = [LOCATIONS[removed]?.originalCode || removed]
    state.scenarioZones.setAside ||= []
    state.scenarioZones.victory ||= []
    for (const code of [SANGUINE_WATCHER, APPORTIONED_KA, RAW_CODES.seeingRed]) {
      if (!state.scenarioZones.setAside.includes(code)) state.scenarioZones.setAside.push(code)
    }
    setupTargets(state)
    data.laChicaRojaTargets = 0
    data.referenceTargets = 0
    drawLaChicaRoja(state)
    helper.info?.(state, events, `🏙️ 血色阴影：五月大道居中，移除「${locationName(state, removed)}」；`
      + `${placed.length} 张地点各放 1 个标靶；红衣女郎以隐匿 ${concealedAmountOf(LA_CHICA_ROJA)} 入场。`)
    // 已把地点写进 state.locations；返回空数组避免引擎再把 startLocation 字符串当数组迭代。
    return []
  },

  // ---- 混乱标记：X 依赖冒险参考卡上的标靶数量，静态表表达不了 ----
  resolveChaosToken(state, inv, token) {
    return sanguineShadowsChaosToken(state, inv, token)
  },

  // ---- 检定之后的标记连带效果 ----
  afterTest(state, inv, result, api) {
    const riders = sanguineShadowsAfterTest(state, inv, result)
    for (const rider of riders) {
      if (rider === 'reshuffleConcealed') {
        const ids = [inv?.location, ...(locationOf(state, inv?.location)?.connections || [])].filter(Boolean)
        const affected = reshuffleConcealedAt(state, ids)
        api?.info?.(`🌀 [cultist]：把你所在地点与连接地点的 ${affected.length} 张隐匿迷你卡重新混洗。`)
      } else if (rider === 'doomOrCoterie') {
        doomOrCoterieAttack(state, inv, api)
      }
    }
    return riders
  },

  // ---- 密谋 ----
  // 见红：毁灭达到阈值时不推进，改为每位调查员被击败并承受 1 点精神创伤。
  agendaWouldAdvance(state, api) {
    const agenda = (state.agendas || [])[state.agendaIndex]
    if (codeOf(agenda) !== RAW_CODES.seeingRed) return false
    const threshold = Number(agenda?.doomThreshold) || 0
    if (!((Number(state.doom) || 0) >= threshold)) return false
    api?.info?.('🩸 「见红」的毁灭达到阈值：每位调查员被击败并承受 1 点精神创伤。')
    for (const inv of aliveInvestigators(state)) {
      if (typeof api?.addTrauma === 'function') api.addTrauma(inv.seat, 'mental', 1)
      if (typeof api?.defeatInvestigator === 'function') api.defeatInvestigator(inv.seat)
      else inv.defeated = true
    }
    return true
  },

  agendaAdvancing(state, agenda) {
    chapterState(state).pendingAgenda = codeOf(agenda)
  },

  // 密谋背面：密谋 1 让红衣女郎收集 1 个标靶；见红背面 → 结局 2。
  agendaReveal(state, agenda, api) {
    const code = codeOf(agenda)
    if (code === RAW_CODES.seeingRed) {
      if (typeof api?.finish === 'function') api.finish('resolution2')
      return
    }
    if (code !== RAW_CODES.agenda1) return
    collectTargetForLaChicaRoja(state, api)
    returnEnemyToShadows(state, LA_CHICA_ROJA, api)
    resolveConcealed(state, LA_CHICA_ROJA)
    resetStageDecks(state, api)
    refillLocationClues(state)
  },

  // 见红的「血色监视者被击败 → 推进」：密谋声明 forced.enemyDefeated 后由引擎派发。
  agendaForcedEnemyDefeated(state, enemy, api) {
    if (codeOf(enemy) !== SANGUINE_WATCHER) return false
    if (codeOf((state.agendas || [])[state.agendaIndex]) !== RAW_CODES.seeingRed) return false
    if (typeof api?.advanceAgenda === 'function') api.advanceAgenda()
    return true
  },

  // ---- 幕 ----
  actReveal(state, act, api) {
    if (codeOf(act) !== RAW_CODES.act2) return
    advanceTargetToReference(state, api)
    if (referenceTargetCount(state) >= 3) {
      api?.info?.('🎬 冒险参考卡上已有 3 个标靶：跳过本场景剩余部分，进入幕间故事「云开见日」。')
      // 2026-11-13 P1-14：进入 Cast a Light 1–7（会按分支决定结局 1 或进入「见红」），
      // 不能直接跳到 Cast a Light 7（enterSeeingRed）。
      enterCastALight(state, api)
      return
    }
    resetStageDecks(state, api)
    for (const inv of state.investigators || []) inv.clues = 0
    refillLocationClues(state)
  },

  // 幕 1 背面正常进入幕 2；幕 2 背面把牌库重置回幕 1（不结束场景）；见红之后一直停在见红幕。
  actIndexAfterAdvance(state, act) {
    if (chapterState(state).seeingRed) return 0
    if (codeOf(act) === RAW_CODES.act2) return 0
    return undefined
  },

  // ---- 幕目标 ----
  checkObjectives(state, api) {
    const data = chapterState(state)
    const code = codeOf((state.acts || [])[state.actIndex])
    const advance = () => {
      if (typeof api?.advanceAct !== 'function') return false
      api.advanceAct()
      return true
    }
    if (code === RAW_CODES.act1) {
      const enemy = enemyOf(state, LA_CHICA_ROJA)
      return enemy && enemy.engagedSeat != null ? advance() : false
    }
    if (code === RAW_CODES.act2) {
      if (data.parleyed) return advance()
      const enemy = enemyOf(state, LA_CHICA_ROJA)
      const health = enemyHealthOf(enemy)
      if (enemy && health != null && (Number(enemy.damageTaken) || 0) >= health) return advance()
      return false
    }
    return false
  },

  // 「如果红衣女郎将要被击败，改为推进」：幕 2 期间她不能被击败（血量见底的判定在 checkObjectives）。
  enemyCanBeDefeated(state, enemy) {
    if (codeOf(enemy) !== LA_CHICA_ROJA) return true
    if (codeOf((state.acts || [])[state.actIndex]) !== RAW_CODES.act2) return true
    return false
  },

  // 血色监视者：敌军阶段结束时若重整，每位调查员受 2 伤害或 2 恐惧（条目 enemyScript.onEnemyPhaseEnd）。
  enemyPhaseEnd(state, api = {}) {
    const watcher = enemyOf(state, SANGUINE_WATCHER)
    if (!watcher) return
    const script = enemyScriptOf(SANGUINE_WATCHER)
    if (typeof script?.onEnemyPhaseEnd === 'function') {
      script.onEnemyPhaseEnd(state, watcher, api)
      return
    }
    for (const inv of aliveInvestigators(state)) {
      const answer = choiceFor(api, {
        kind: 'choice', source: SANGUINE_WATCHER, seat: inv.seat,
        prompt: '「血色监视者」：受到 2 点伤害或 2 点恐惧。',
        options: [{ id: 'damage', label: '受到 2 点伤害' }, { id: 'horror', label: '受到 2 点恐惧' }],
      }) || 'damage'
      if (answer === 'horror') api?.harm?.(inv.seat, { horror: 2 })
      else api?.harm?.(inv.seat, { damage: 2 })
    }
  },

  // 红衣女郎：与该调查员交战的她在其移动时解除交战（引擎传入移动前的交战名单）。
  locationEntered(state, inv, destination, api, companions = []) {
    for (const enemyId of companions || []) {
      const enemy = (state.enemies || []).find(item => item.id === enemyId)
      if (!enemy || codeOf(enemy) !== LA_CHICA_ROJA) continue
      const script = enemyScriptOf(LA_CHICA_ROJA)
      if (typeof script?.onEngagedInvestigatorMoved === 'function') {
        script.onEngagedInvestigatorMoved(state, inv, enemy, api)
        continue
      }
      if (typeof api?.disengage === 'function') api.disengage(enemy)
      else if (enemy.engagedSeat != null) delete enemy.engagedSeat
      api?.info?.(`💨 ${inv?.name || '调查员'} 移动：红衣女郎与其解除交战。`)
    }
    void destination
  },

  // 09557b 的「在阴影中」：回合开始时把移动过的调查员移回锚点。
  turnBegins(state, inv, api) {
    const flags = state.scenarioFlags || {}
    const key = `${SHADOW_ANCHOR_PREFIX}${inv.seat}`
    const anchor = flags[key]
    if (!anchor) return
    delete flags[key]
    if (inv.location !== anchor && typeof api?.moveInvestigator === 'function') {
      api.moveInvestigator(inv.seat, anchor)
    }
    api?.info?.(`🌑 ${inv.name || '调查员'} 从阴影中回到「${locationName(state, anchor)}」。`)
  },

  // ---- 遭遇卡 ----
  resolveEncounter(state, inv, card, api) {
    const handler = treacheryHandlerFor(codeOf(card))
    if (!handler) return false
    handler(state, inv, card, api)
    return true
  },

  // ---- 剧本行动 ----
  actions(state, inv) {
    const moves = []
    const locationId = inv?.location
    const here = miniCardsAt(state, locationId)
    const spendBlocked = cluesSpendBlocked(state)
    for (const mini of here) {
      moves.push({
        action: 'scenarioAction', rule: `expose:${mini.id}`, miniCardId: mini.id, locationId,
        label: mini.known ? '揭露一张迷你卡（已知面）' : '揭露一张迷你卡',
      })
    }
    const look = LOOK_ACTIONS[locationId]
    if (look) {
      const reason = spendBlocked ? '「来访名片」在场时不能花费线索'
        : (Number(inv.clues) || 0) < 1 ? '需要 1 个线索' : null
      moves.push({
        action: 'scenarioAction', rule: `loc:${look.rule}`, locationId,
        label: look.label, ...(reason ? { reason } : {}),
      })
    }
    const spend = SPEND_LOOK_ACTIONS[locationId]
    if (spend) {
      const clues = Number(inv.clues) || 0
      const resources = spend.resourceFactor
        ? Math.floor((Number(inv.resources) || 0) / spend.resourceFactor) : clues
      const max = Math.min(here.length, clues, resources)
      const reason = spendBlocked ? '「来访名片」在场时不能花费线索'
        : max < 1 ? '线索或资源不足' : null
      moves.push({
        action: 'scenarioAction', rule: `loc:${spend.rule}`, locationId, xMax: Math.max(0, max),
        label: spend.label, ...(reason ? { reason } : {}),
      })
    }
    // 幕 2 的谈判：红衣女郎在场上且与你在同一地点。
    if (codeOf((state.acts || [])[state.actIndex]) === RAW_CODES.act2) {
      const enemy = enemyOf(state, LA_CHICA_ROJA)
      if (enemy && enemy.location === locationId) {
        moves.push({
          action: 'scenarioAction', rule: `parley:${LA_CHICA_ROJA}`, enemyId: enemy.id, locationId,
          label: '谈判：检定[智力]或[敏捷](6) 胜过窃贼一筹（可花 1 线索降低 2 难度）',
          noOpportunityAttack: true,
        })
      }
    }
    return moves
  },

  performAction(state, inv, move, api) {
    const rule = String(move?.rule || '')
    if (rule.startsWith('expose:')) {
      const id = rule.slice('expose:'.length)
      if (!miniCardsAt(state, inv.location).some(mini => mini.id === id)) return false
      exposeAt(state, inv, id, api)
      return true
    }
    if (rule.startsWith('loc:')) {
      const key = rule.slice('loc:'.length)
      if (LOOK_ACTIONS[inv.location]?.rule === key) return performLookAction(state, inv, api, LOOK_ACTIONS[inv.location])
      if (SPEND_LOOK_ACTIONS[inv.location]?.rule === key) return performSpendLookAction(state, inv, api, move)
      return false
    }
    if (rule.startsWith('parley:')) return performParley(state, inv, api)
    return false
  },

  // ---- 结局 ----
  resolution(state, key, events, api = {}) {
    const records = recordsFor(state)
    const targets = referenceTargetCount(state)
    const finish = record => recordFact(state, record, true)
    if (key === 'noResolution') {
      if (chapterState(state).seeingRed) return behavior.resolution(state, 'noResolutionSeeingRed', events, api)
      // 参考实现：幕 1/2 的「未达成」跳到结局 3。
      finish('youHaventSeenTheLastOfLaChicaRoja')
      records.weepingLadyBearer = LA_CHICA_ROJA
      bindWeepingLady(state, api, 'laChicaRoja')
      markTime(state, 1)
      return { bonus: targets, story: resolutionStory('resolution3', '结局3') }
    }
    if (key === 'noResolutionSeeingRed') {
      finish('theSanguineWatchersTormentContinues')
      finish('laChicaRojaIsOnYourSide')
      records.weepingLadyBearer = SANGUINE_WATCHER
      bindWeepingLady(state, api, 'watcher')
      markTime(state, 2)
      return { bonus: 3 }
    }
    if (key === 'resolution1') {
      finish('youHaventSeenTheLastOfLaChicaRoja')
      const seat = chooseBearerSeat(state, api)
      records.weepingLadyBearer = seat
      bindWeepingLady(state, api, seat)
      markTime(state, 1)
      return { bonus: targets }
    }
    if (key === 'resolution2') {
      finish('youHaventSeenTheLastOfTheSanguineWatcher')
      finish('laChicaRojaIsOnYourSide')
      const seat = chooseBearerSeat(state, api)
      records.weepingLadyBearer = seat
      bindWeepingLady(state, api, seat)
      markTime(state, 3)
      return { bonus: 3 }
    }
    if (key === 'resolution3') {
      finish('youHaventSeenTheLastOfLaChicaRoja')
      records.weepingLadyBearer = LA_CHICA_ROJA
      bindWeepingLady(state, api, 'laChicaRoja')
      markTime(state, 1)
      return { bonus: targets }
    }
    return {}
  },

  finalResolution(state) {
    const data = chapterState(state)
    if (data.pendingResolution) return data.pendingResolution
    if (data.seeingRed) return 'resolution2'
    return referenceTargetCount(state) > 0 ? 'resolution1' : 'resolution3'
  },
}

// 只读投影：桌面/测试读得懂的章节摘要（不写状态）。
export function chapterSummary(state) {
  const data = state?.scenarioFlags?.sanguineShadows || {}
  return {
    intro: data.intro || null,
    removedLocation: data.removedLocation || null,
    targets: { ...(data.targets || {}) },
    referenceTargets: Number(data.referenceTargets) || 0,
    laChicaRojaTargets: Number(data.laChicaRojaTargets) || 0,
    seeingRed: data.seeingRed === true,
    concealed: concealedMiniCards(state).map(card => ({
      kind: card.kind, code: codeOfKind(card.kind), decoy: card.decoy, locationId: card.locationId,
    })),
  }
}

export const implementedEncounterCodes = behavior.implementedEncounterCodes
export const entryCodes = () => [...implementedEncounterCodes]
export default behavior
