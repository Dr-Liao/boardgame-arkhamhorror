// 万象无终（The Circle Undone）· 跨章遭遇规则（P8）。
//
// 12 个循环共享遭遇组（agentsOfAzathoth / anettesCoven / cityOfSins / inexorableFate /
// musicOfTheDamned / realmOfDeath / secretsOfTheUniverse / silverTwilightLodge /
// spectralPredators / theWatcher / trappedSpirits / witchcraft）在 9 章里重复出现，
// 组级效果只写在这一份文件里；逐卡效果仍写单卡条目（不可把函数放进 enemyRule /
// treacheryRule——它们会并进场景定义并被 structuredClone，函数会让开局直接报错）。
//
// ============================ 章节覆盖约定 ============================
// 九章 behavior.js 的约定：`export const behavior = { ...encounterRules, id: '<chapterId>', ... }`。
// 如果章节覆盖下面任一钩子，**必须在函数体内显式调用** `encounterRules.<hook>?.(...)`，
// 否则共享组会静默失效（WORKER-BRIEF §2.5 坑 4）。会被章节覆盖的钩子清单：
//   afterTest / canFightEnemy / canEvadeEnemy / statModifier /
//   enemySpawned / enemyMoved / enemyDamaged / enemyDefeated / enemyAttackResolved /
//   enemyPhaseEnd / mythosEnded / turnBegins / turnEnded / roundEnded /
//   encounterDrawn / resolveEncounter / encounterActions / performEncounterAction
//
// 本文件只 import 内容层允许的读点：cards-data（印刷数据）、card-rules（条目规则读点）、
// campaign/mementos（看守人记录）。不 import 引擎模块；需要引擎能力时走钩子参数 `api`
//（scenarioRuntime）。单卡行为不得把卡号写回这里：所有分派都通过 card-rules 的条目读点
// 或条目声明的数据字段完成。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import {
  encounterResolveFor, enemyScriptFor, enemySpawnRuleFor, enemyStatRuleFor,
  threatActionFor, threatActionByRule, treacheryRuleFor,
} from '../../../src/cards/card-rules.js'
import {
  clearHunted, isBeingHunted, markHunted, markTakenByWatcher, takenByWatcher,
} from '../../../src/campaign/mementos.js'

export const original = card => card?.originalCode || card?.code
export const activeInvestigators = state => (state?.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
// 玩家顺序：从队长座位起按座位环绕（章节抽牌/选择顺序用；参考 beforeTheBlackThrone 的同名 helper）。
export const playerOrder = state => {
  const count = Number(state?.numInvestigators) || (state?.investigators || []).length
  const lead = Number(state?.campaign?.leadSeat) || 0
  const seats = []
  for (let offset = 0; offset < count; offset++) {
    const seat = (lead + offset) % count
    if (state?.investigators?.[seat]) seats.push(seat)
  }
  return seats
}
export const here = (state, inv) => (state?.locations || []).find(location => location.id === inv?.location) || null
export const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}

export const traitsOf = card => (ALL_CARDS[original(card)]?.traits || card?.traits || []).map(trait => String(trait).toLowerCase())
export const hasTrait = (card, trait) => traitsOf(card).includes(String(trait).toLowerCase())

// 幽灵地点判定：与 src/engine/locations.js 的 spectralFaceOf 同口径（单面 spectral 或翻面标志）。
export const isSpectralLocation = location => location?.spectral === true || location?.spectralFace === 'spectral'

// 地点是否闹鬼（内容层纯读点）：印刷能力（地点定义/实例上的 haunted）在前，授予能力在后。
// 引擎自己的读点是 api.hauntedAt(id)（包含授予），这里只给单元测试与「有没有」判断用。
export const hauntedAt = (state, locationId) => {
  const placed = (state?.locations || []).find(location => location.id === locationId)
  const printed = placed?.haunted || state?.scenario?.locations?.[locationId]?.haunted || []
  const granted = (state?.hauntedGrants || [])
    .filter(grant => grant.locationId === 'all' || grant.locationId === locationId)
    .map(grant => grant.ability)
  return [...printed, ...granted]
}

// 失败检定的闹鬼窗口辅助：默认只认「攻击/躲避」两类失败——调查失败由引擎
// （src/engine/actions.js 的 hauntedAfterFail）自动结算，章节不能再调一次，否则会双结算。
// 章节在 behavior.afterTest 里显式调用 `resolveHauntedOnFailure(state, inv, result, api)`；
// 想让哪类失败触发由 `state.scenario.hauntedOn`（纯数据）配置，例如
//   hauntedOn: ['investigate', 'fight', 'evade']   // 引擎负责 investigate，本函数负责其余
export const TEST_ACTION_LABELS = Object.freeze({ 调查: 'investigate', 攻击: 'fight', 躲避: 'evade' })

export function testActionKind(result) {
  const source = result?.source || {}
  const byLabel = TEST_ACTION_LABELS[source.label]
  if (byLabel) return byLabel
  const explicit = source.kind || source.action || result?.kind
  if (typeof explicit === 'string' && ['investigate', 'fight', 'evade'].includes(explicit)) return explicit
  return null
}

export function resolveHauntedOnFailure(state, inv, result, api, { kinds = null, times = 1 } = {}) {
  if (!result || result.success) return false
  if (!inv?.location || typeof api?.haunted !== 'function') return false
  const kind = testActionKind(result)
  if (!kind) return false
  const configured = state?.scenario?.hauntedOn
  const allowed = kinds || (Array.isArray(configured) ? configured.filter(entry => entry !== 'investigate') : [])
  if (!allowed.includes(kind)) return false
  api.haunted(inv.seat, { locationId: inv.location, times, kind, source: result.source || null })
  return true
}

// 距离（BFS）与最近敌人：共享组规则常用。
export function locationDistance(state, from, to) {
  if (from === to) return 0
  const seen = new Set([from])
  const queue = [[from, 0]]
  while (queue.length) {
    const [id, steps] = queue.shift()
    for (const next of (state.locations || []).find(entry => entry.id === id)?.connections || []) {
      if (next === to) return steps + 1
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return Number.POSITIVE_INFINITY
}

export function nearestEnemyWithTrait(state, from, trait) {
  const candidates = (state.enemies || []).filter(enemy => hasTrait(enemy, trait))
  if (!candidates.length) return null
  return candidates
    .map(enemy => ({ enemy, steps: locationDistance(state, from, enemy.location) }))
    .sort((left, right) => left.steps - right.steps)[0].enemy
}

// 场上毁灭总数（[skull] 与若干议程阈值共用；不含全局 state.doom）。
export function doomOn(state, predicate = () => true) {
  const cards = [
    ...(state.locations || []),
    ...(state.enemies || []),
    ...(state.storyAssets || []),
    ...(state.investigators || []).flatMap(inv => [...(inv.assets || []), ...(inv.threat || [])]),
  ]
  return cards.filter(predicate).reduce((sum, card) => sum + (Number(card.doom) || 0), 0)
}

// 单卡条目的规则面向章节的分派读点。
export const enemyRuleReads = Object.freeze({
  enemyScriptFor, enemySpawnRuleFor, enemyStatRuleFor, threatActionFor, threatActionByRule,
})

// ---------------------------------------------------------------------------
// 看守人（watcher）：跨章记录读点。记录本身由 src/campaign/mementos.js 维护
//（youAreBeingHunted：新形态为 boolean「团队被追捕」（05045 参考实现口径）；旧存档/按座位
//  追踪的机制仍是 string[] 座位数组，两个形状都要兼容。wasTakenByTheWatcher = 调查员卡号 string[]。）
// ---------------------------------------------------------------------------
const huntedRecordValue = state => recordsFor(state).youAreBeingHunted
const aliveSeats = state => (state.investigators || [])
  .filter(inv => !inv.defeated && !inv.resigned)
  .map(inv => Number(inv.seat))
export const watcherHuntedSeats = state => {
  const value = huntedRecordValue(state)
  if (Array.isArray(value)) return value.map(Number)
  return value === true ? aliveSeats(state) : []
}
export const isHunted = (state, seat) => {
  const value = huntedRecordValue(state)
  if (Array.isArray(value)) return value.map(String).includes(String(seat))
  return value === true
}
// 座位级写入：boolean（团队）已为 true 时维持团队语义；否则继续用座位数组。
export const markHuntedSeat = (state, seat) => {
  if (huntedRecordValue(state) === true) return watcherHuntedSeats(state)
  return markHunted(state, seat)
}
// 座位级清除：boolean 团队记录无法按座位清除，转成「除该座位外的显式座位数组」保持净语义。
export const clearHuntedSeat = (state, seat) => {
  if (huntedRecordValue(state) === true) {
    const remaining = watcherHuntedSeats(state).filter(value => value !== Number(seat))
    recordsFor(state).youAreBeingHunted = remaining.map(String)
    return remaining
  }
  return clearHunted(state, seat)
}
export const watcherTaken = state => takenByWatcher(state)
export const markWatcherTaken = (state, code) => markTakenByWatcher(state, code)
export const watcherSummary = state => ({
  huntedSeats: watcherHuntedSeats(state),
  taken: watcherTaken(state),
})

// ---------------------------------------------------------------------------
// 「放在密谋牌库旁边」的共享区（05089 魔鬼的笛声 / 05087 / 05102 等）：纯 JSON，
// 挂在 state.scenarioZones.agendaAside = [{ id, code }]，不进 manifest 区域。
// 单卡条目直接读写这个区；轮末清理走 encounterRules.roundEnded 的通用分支。
// ---------------------------------------------------------------------------
export function agendaAside(state) {
  const zones = (state.scenarioZones ||= {})
  return (zones.agendaAside ||= [])
}
export function agendaAsideCount(state, code) {
  return agendaAside(state).filter(entry => entry.code === code).length
}
export function placeAgendaAside(state, code, extra = {}) {
  const entry = { id: `${code}:${state.round}:${agendaAside(state).length}`, code, ...extra }
  agendaAside(state).push(entry)
  return entry
}
export function removeAgendaAside(state, predicate) {
  const list = agendaAside(state)
  const removed = list.filter(predicate)
  if (!removed.length) return []
  state.scenarioZones.agendaAside = list.filter(entry => !predicate(entry))
  return removed
}

// ---------------------------------------------------------------------------
// 幽灵界：幽灵敌人在非幽灵地点上的目标限制。
// 口径（docs/tcu-primitives.md P2.3 / tcu-interactions.md）：不是全局规则，由剧本读
// `isSpectral` 决定。默认「本章地点表里存在幽灵地点」才启用；章节也可以在 definition 里写
// `spectralTargetLimit: false/true` 或开局写 `state.scenarioFlags.spectralTargetLimit` 覆盖。
// 引擎只提供 canFightEnemy / canEvadeEnemy 两个读点；「不能交战」没有引擎钩子（gaps 记录）。
// ---------------------------------------------------------------------------
export function scenarioHasSpectralLocations(state) {
  return Object.values(state?.scenario?.locations || {})
    .some(location => location?.spectral === true || Boolean(location?.back))
}

export function spectralTargetRestricted(state) {
  const flag = state?.scenario?.spectralTargetLimit
  if (flag === true || flag === false) return flag
  if (state?.scenarioFlags?.spectralTargetLimit != null) return state.scenarioFlags.spectralTargetLimit === true
  return scenarioHasSpectralLocations(state)
}

export function spectralEnemyTargetBlocked(state, inv, enemy) {
  if (!enemy || !hasTrait(enemy, 'Spectral')) return false
  if (!spectralTargetRestricted(state)) return false
  return !isSpectralLocation(here(state, inv) || (state?.locations || []).find(location => location.id === enemy.location))
}

// ---------------------------------------------------------------------------
// 遭遇牌库「耗尽」的共享事件（05091 女祭司 / 05090 学徒 / 05098 邪恶往昔）。
//
// 引擎在抽牌前发现牌库为空会先把弃牌堆洗回，所以「本次抽牌后牌库为 0」= 本次抽牌耗尽了
// 牌库（encounterDrawn 钩子里直接结算，比旧实现「下一次抽牌才触发」早一轮）。
// 弃牌效果（05090/05099、discardEncounterTop）同样能耗尽牌库，由调用方在同一结算里通知。
// ---------------------------------------------------------------------------
export function resolveEncounterDeckEmptyForced(state, api) {
  api?.info?.('🌀 遭遇牌库耗尽，结算相关强制能力。')
  for (const enemy of [...(state.enemies || [])]) {
    enemyScriptFor(original(enemy))?.onEncounterDeckEmpty?.(state, enemy, api)
  }
  for (const owner of activeInvestigators(state)) {
    for (const threat of [...(owner.threat || [])]) {
      const rule = treacheryRuleFor(original(threat))
      // 数据声明式：条目 treacheryRule.encounterDeckEmpty 是一段纯 JSON（不能放函数——
      // 条目规则会并进场景定义并被 structuredClone），语义由这里统一解释。
      const data = rule?.encounterDeckEmpty
      if (data) {
        applyEncounterDeckEmptyData(state, owner, threat, data, api)
        continue
      }
      const forced = rule?.encounterDeckEmptyForced
      if (!forced) continue
      if (forced.horror) api.horror(owner.seat, Number(forced.horror))
      if (forced.test) {
        api.test(owner.seat, forced.test.skill || 'willpower', Number(forced.test.difficulty ?? 3), result => {
          if (result.success && forced.test.discardOnSuccess) discardThreatCard(state, owner, threat)
        })
      }
    }
  }
}

// 05147 不安的梦：「弃掉本卡，揭示你牌库顶 10 张牌，抽取其中的弱点」。
// revealTop：从拥有者牌库顶揭示张数；drawWeaknesses：把其中的弱点按揭示顺序抽到手牌
// （非弱点进弃牌堆）。弱点先压回牌库顶再走 api.drawCards，保持正常抽牌管线/钩子。
function applyEncounterDeckEmptyData(state, owner, threat, data, api) {
  const code = String(original(threat))
  if (data.discardSelf !== false) {
    const index = (owner.threat || []).indexOf(threat)
    if (index >= 0) owner.threat.splice(index, 1)
    state.encounterDiscard.push(code)
  }
  if (!data.revealTop) return
  const count = Math.max(0, Math.floor(data.revealTop))
  const revealed = []
  for (let index = 0; index < count && owner.deck.length; index++) revealed.push(owner.deck.pop())
  const isWeakness = card => ['weakness', 'basicweakness'].includes(ALL_CARDS[card]?.subtype)
  const weaknesses = []
  for (const card of revealed) {
    if (data.drawWeaknesses && isWeakness(card)) weaknesses.push(card)
    else owner.discard.push(card)
  }
  // 按揭示顺序压回牌库顶（数组尾 = 顶），再正常抽回来。
  for (let index = weaknesses.length - 1; index >= 0; index--) owner.deck.push(weaknesses[index])
  if (weaknesses.length && typeof api?.drawCards === 'function') api.drawCards(owner.seat, weaknesses.length)
  else for (const card of weaknesses) owner.hand.push(card)
  api?.info?.(`😴 「${ALL_CARDS[code]?.nameZh || code}」：揭示牌库顶 ${revealed.length} 张，抽取 ${weaknesses.length} 张弱点。`)
}

// 当前正在结算的遭遇牌堆：《恶罪报应》有两套牌堆，来源由该章 encounterDeckFor 写在
// scenarioFlags.lastEncounterDeck；其余章节只有基础牌堆。
function activeEncounterDeckLength(state) {
  const spectral = state?.scenarioFlags?.lastEncounterDeck === 'spectral'
    ? state?.extraEncounterDecks?.spectral
    : null
  return spectral ? (spectral.deck || []).length : (state?.encounterDeck || []).length
}

// 弃牌效果把当前遭遇牌堆「由有牌弃到 0」时，立即结算「牌库耗尽」强制（05091/05090/05098）。
// 引擎没有「遭遇牌堆变空」的通用窗口；05090 的 onSpawn 与 05099 的弃牌都会直接改 state，
// 因此共享钩子用调用前后对比补上通知（卡面语义：牌库一旦耗尽立即结算一次）。
export function watchEncounterDeckEmpty(state) {
  const before = activeEncounterDeckLength(state)
  let fired = false
  return api => {
    if (fired) return
    if (before <= 0) return
    if (activeEncounterDeckLength(state) !== 0) return
    fired = true
    resolveEncounterDeckEmptyForced(state, api)
  }
}

// 最近一次抽到的遭遇卡（单卡条目用来区分「抽到」与「被剧本效果生成」，例如 05090 的显现）。
export function lastEncounterDrawn(state) {
  const last = state?.scenarioFlags?.lastEncounterDrawn
  return last && typeof last === 'object' ? last : null
}
export function consumeLastEncounterDrawn(state, code) {
  const last = lastEncounterDrawn(state)
  if (!last || String(last.code) !== String(code)) return null
  delete state.scenarioFlags.lastEncounterDrawn
  return last
}

// ---------------------------------------------------------------------------
// 遭遇牌库顶弃牌（05099 百年秘事 / 05090 女巫集会学徒共用）。
// `reshuffle`：牌库中途耗尽时是否把弃牌堆洗回继续（「一直弃到某张」类效果需要；
//   「弃顶 2 张」类效果不应把刚弃掉的牌洗回来，05090 显式传 false）。
// `notifyEmpty`：弃牌造成「由有到无」时是否触发共享的「遭遇牌库耗尽」强制（05091/05098）。
// ---------------------------------------------------------------------------
export function discardEncounterTop(state, api, count = 1, options = {}) {
  const { reshuffle = true, notifyEmpty = true } = options
  const startedWithCards = (state.encounterDeck || []).length > 0
  const discarded = []
  for (let index = 0; index < Math.max(0, count); index++) {
    if (!state.encounterDeck.length) {
      if (!reshuffle || !state.encounterDiscard.length) break
      if (typeof api?.shuffleDiscard === 'function') api.shuffleDiscard()
      else {
        state.encounterDeck = [...state.encounterDiscard]
        state.encounterDiscard = []
      }
    }
    if (!state.encounterDeck.length) break
    const code = state.encounterDeck.pop()
    state.encounterDiscard.push(code)
    discarded.push(code)
  }
  if (notifyEmpty && startedWithCards && discarded.length > 0 && (state.encounterDeck || []).length === 0) {
    resolveEncounterDeckEmptyForced(state, api)
  }
  return discarded
}

export function witchEnemyEncountersInDiscard(state) {
  return (state.encounterDiscard || []).filter(code => {
    const card = ALL_CARDS[code]
    return card?.type === 'enemy' && (card.traits || []).some(trait => String(trait).toLowerCase() === 'witch')
  }).length
}

// 威胁区/附属卡的弃置口径（与引擎 removeThreat 一致：诡计回遭遇弃牌堆）。
export function discardThreatCard(state, inv, threat) {
  const index = (inv.threat || []).indexOf(threat)
  if (index >= 0) inv.threat.splice(index, 1)
  const code = original(threat)
  if (code) state.encounterDiscard.push(code)
  return code
}

export function discardLocationAttachment(state, location, attachment) {
  const index = (location.attachments || []).indexOf(attachment)
  if (index >= 0) location.attachments.splice(index, 1)
  const code = original(attachment)
  if (code) state.encounterDiscard.push(code)
  return code
}

// 伤害来源是否为「法术/遗物」：引擎可能传支援实例 id（见 03093 条目），也可能传
// { code / traits / kind } 形状的来源对象（事件卡、效果伤害）。两种形状都要识别，
// 否则 05103 会把事件/效果伤害误判成普通伤害。
const SPELL_RELIC_TRAITS = Object.freeze(['spell', 'relic'])
const isSpellRelicCode = code => (ALL_CARDS[code]?.traits || [])
  .some(trait => SPELL_RELIC_TRAITS.includes(String(trait).toLowerCase()))
export function isSpellOrRelicSource(state, source) {
  if (source == null) return false
  if (typeof source === 'string') {
    if (isSpellRelicCode(source)) return true
    for (const inv of state.investigators || []) {
      const asset = (inv.assets || []).find(item => item.id === source)
      if (asset) return isSpellRelicCode(original(asset))
    }
    return false
  }
  if (typeof source !== 'object') return false
  const kind = String(source.kind || source.type || '').toLowerCase()
  if (SPELL_RELIC_TRAITS.includes(kind)) return true
  const traits = source.traits || (source.code ? ALL_CARDS[source.code]?.traits : null) || []
  if (traits.some(trait => SPELL_RELIC_TRAITS.includes(String(trait).toLowerCase()))) return true
  for (const key of ['code', 'assetCode', 'cardCode', 'sourceCode']) {
    if (typeof source[key] === 'string' && isSpellRelicCode(source[key])) return true
  }
  return false
}

// 05097 秘社玄仪写下的「直到一轮结束，对该敌人攻击/躲避/谈判的难度 +2」。
// 攻击/躲避由本文件 enemyStatModifier 汇总；谈判由条目级 performEncounterAction 读这个 helper。
export function parleyDifficultyBonus(state, enemy) {
  const bonus = enemy?.roundFightEvadeBonus
  if (!bonus || bonus.round !== state?.round) return 0
  return Number(bonus.amount) || 0
}

// 幽灵目标限制的旧名（章节若已引用）：与 spectralEnemyTargetBlocked 同义。
export const spectralTargetError = spectralEnemyTargetBlocked

// 多技能威胁行动展开：威胁区[action]「检定 A 或 B」每个技能一条（与 TFA encounter-rules 同形）。
const SKILL_LABELS = { willpower: '意志', intellect: '智识', combat: '战斗', agility: '敏捷' }
function threatMoves(base, spec) {
  if (!(spec.skills?.length > 1)) return [{ ...base, label: `♻️ ${spec.label}` }]
  return spec.skills.map(skill => ({
    ...base, skill,
    label: `♻️ ${spec.skillLabels?.[skill] || `检定${SKILL_LABELS[skill] || skill}(${spec.difficulty})${spec.label}`}`,
  }))
}

// 威胁行动「自动成功」条件表（数据驱动，避免把卡号写回内容层）。
const THREAT_AUTO_SUCCESS = Object.freeze({
  exhaustedWitchHere(state, inv) {
    return (state.enemies || []).some(enemy => enemy.exhausted
      && hasTrait(enemy, 'Witch') && enemy.location === inv.location)
  },
})

// ---------------------------------------------------------------------------
// 共享钩子集合（九章 behavior.js 用 `...encounterRules` 展开）。
// ---------------------------------------------------------------------------
export const encounterRules = Object.freeze({
  // ---- 闹鬼：失败检定的共享窗口（仅 fight/evade 等非调查失败；调查由引擎负责） ----
  afterTest(state, inv, result, api) {
    resolveHauntedOnFailure(state, inv, result, api)
    // 「每轮第一次技能检定」类修正（05093 崩毁离析）在检定结算后记一笔。
    if (inv) inv.firstTestRound = state.round
  },

  // ---- 05104 被困的灵魂：本次技能检定中「在闹鬼地点投入卡牌」的额外费用 ----
  // 条目在自身检定期间写 state.hauntedCommitCost = { locationId, paidSeats }（检定结束清除）；
  // 引擎在投入循环前调用本钩子（src/engine/tests.js 第四轮新增 commit-extra-cost-hook，
  // 第 4 参为场景运行时）。每位 owner（本人/协助/远程投入者）每次检定只结算一次。
  beforeCommitCard(state, owner, context = {}, api) {
    const cost = state?.hauntedCommitCost
    if (!cost || !owner) return false
    if (typeof api?.haunted !== 'function') return false
    if (!hauntedAt(state, cost.locationId).length) return false
    const paid = (cost.paidSeats ||= [])
    if (paid.includes(owner.seat)) return false
    paid.push(owner.seat)
    api.haunted(owner.seat, { locationId: cost.locationId, kind: 'effect', source: '05104' })
    return true
  },

  // ---- 幽灵界：幽灵敌人在非幽灵地点的目标限制 ----
  canFightEnemy(state, inv, enemy) {
    return !spectralEnemyTargetBlocked(state, inv, enemy)
  },
  canEvadeEnemy(state, inv, enemy) {
    return !spectralEnemyTargetBlocked(state, inv, enemy)
  },

  // ---- 敌人条目脚本分派（函数只写在单卡条目的 enemyScript 里，不进场景定义） ----
  enemySpawned(state, enemy, api) {
    const code = original(enemy)
    // 05090 的显现会弃遭遇牌库顶：若把牌库弃空，立即结算「牌库耗尽」强制。
    const watchDeckEmpty = watchEncounterDeckEmpty(state)
    const rule = enemySpawnRuleFor(code)
    if (rule?.doomOnSpawn) api.doomOn?.(enemy, rule.doomOnSpawn)
    enemyScriptFor(code)?.onSpawn?.(state, enemy, api)
    watchDeckEmpty(api)
  },

  // ---- 敌人移动：第三参兼容两种引擎语义 ----
  // 旧引擎（movement.js）传「移动前地点」；Lead 修好后传「新地点」。这里统一成
  // onMoved(state, enemy, 新地点, api, 旧地点)，单卡条目不用关心引擎版本。
  enemyMoved(state, enemy, locationArg, api, previousArg) {
    const script = enemyScriptFor(original(enemy))
    if (typeof script?.onMoved !== 'function') return
    const current = enemy.location
    const previous = locationArg === current ? (previousArg ?? null) : (locationArg ?? null)
    script.onMoved(state, enemy, current, api, previous)
  },

  // ---- 敌人阶段开始：给条目一个可刷新「每阶段猎物/状态」的窗口（05100 的猎物）----
  // 章节若覆盖该钩子需转发 encounterRules.enemyPhaseStart（theSecretName/atDeathsDoorstep 已转发）。
  enemyPhaseStart(state, api) {
    for (const enemy of [...(state.enemies || [])]) {
      enemyScriptFor(original(enemy))?.onEnemyPhaseStart?.(state, enemy, api)
    }
  },

  enemyDamaged(state, enemy, api, seat, source) {
    enemyScriptFor(original(enemy))?.onDamaged?.(state, enemy, api, seat, source)
  },

  enemyDefeated(state, enemy, api) {
    const script = enemyScriptFor(original(enemy))
    if (typeof script?.onDefeated !== 'function') return false
    return script.onDefeated(state, enemy, api) === true
  },

  enemyAttackResolved(state, enemy, inv, api) {
    enemyScriptFor(original(enemy))?.onAttackResolved?.(state, enemy, inv, api)
  },

  enemyPhaseEnd(state, api) {
    for (const enemy of [...(state.enemies || [])]) {
      enemyScriptFor(original(enemy))?.onEnemyPhaseEnd?.(state, enemy, api)
    }
  },

  mythosEnded(state, api) {
    for (const enemy of [...(state.enemies || [])]) {
      const rule = enemySpawnRuleFor(original(enemy))
      if (rule?.doomAtMythosEnd) api.doomOn?.(enemy, rule.doomAtMythosEnd)
      enemyScriptFor(original(enemy))?.onMythosEnd?.(state, enemy, api)
    }
  },

  // ---- 敌人常驻修正（05091 女巫集会女祭司 / 05097 秘社玄仪 的 +2） ----
  enemyStatModifier(state, enemy, stat) {
    if (stat !== 'fight' && stat !== 'evade') return 0
    let bonus = 0
    const rule = enemyStatRuleFor(original(enemy))
    if (rule?.fightEvadePerWitchInDiscard) {
      const cap = Number(rule.fightEvadePerWitchInDiscard.cap ?? 3)
      bonus += Math.min(cap, witchEnemyEncountersInDiscard(state))
    }
    const instance = enemy.roundFightEvadeBonus
    if (instance && instance.round === state.round) bonus += Number(instance.amount) || 0
    return bonus
  },

  // ---- 威胁区持续规则（05093 崩毁离析 / 05105 苦痛之地 等） ----
  statModifier(state, inv, skill) {
    let total = 0
    for (const threat of inv.threat || []) {
      const rule = treacheryRuleFor(original(threat))
      const amount = Number(rule?.firstTestStatModifier || 0)
      if (!amount) continue
      if (inv.firstTestRound === state.round) continue
      total += amount
    }
    return total
  },

  turnBegins(state, inv, api) {
    for (const threat of inv.threat || []) {
      const rule = treacheryRuleFor(original(threat))
      if (!rule?.turnBeginsHaunted) continue
      api.haunted?.(inv.seat, { locationId: inv.location, kind: 'effect', source: original(threat) })
    }
    for (const enemy of state.enemies || []) {
      if (enemy.location !== inv.location) continue
      enemyScriptFor(original(enemy))?.onTurnBegins?.(state, inv, enemy, api)
    }
  },

  turnEnded(state, inv, api) {
    for (const threat of [...(inv.threat || [])]) {
      const rule = treacheryRuleFor(original(threat))
      const test = rule?.turnEndTest
      if (!test) continue
      api.test(inv.seat, test.skill || 'willpower', Number(test.difficulty ?? 3), result => {
        if (result.success) discardThreatCard(state, inv, threat)
      })
    }
  },

  roundEnded(state, api) {
    // 密谋牌库旁的诡计：轮末弃掉（05102 黑暗中的低语）；同时清理它授予的闹鬼能力。
    const aside = state.scenarioZones?.agendaAside
    if (Array.isArray(aside)) {
      for (const entry of [...aside]) {
        const rule = treacheryRuleFor(entry.code)
        if (!rule?.discardAtRoundEnd) continue
        removeAgendaAside(state, candidate => candidate.id === entry.id)
        if (entry.hauntGrantId && typeof api.clearHauntedGrants === 'function') {
          api.clearHauntedGrants(grant => grant.ability?.id === entry.hauntGrantId)
        }
        state.encounterDiscard.push(entry.code)
        api.info?.(`🌀 「${ALL_CARDS[entry.code]?.nameZh || entry.code}」在轮末被弃掉。`)
      }
    }
    // 敌人轮末强制（条目 enemyScript.onRoundEnd）。
    for (const enemy of [...(state.enemies || [])]) {
      enemyScriptFor(original(enemy))?.onRoundEnd?.(state, enemy, api)
    }
    // 每轮实例标记清理。
    for (const inv of state.investigators || []) delete inv.firstTestRound
    for (const enemy of state.enemies || []) {
      if (enemy.roundFightEvadeBonus && enemy.roundFightEvadeBonus.round !== state.round) delete enemy.roundFightEvadeBonus
    }
  },

  // ---- 遭遇牌库耗尽（05091 女巫集会女祭司 / 05098 邪恶往昔 的强制） ----
  // 引擎在抽牌前发现牌库为空会把弃牌堆洗回；因此「本次抽牌后牌库为 0」就是本次抽牌
  // 耗尽了牌库——立即结算，不再等下一次抽牌（旧实现在下一次抽牌时才触发，且那之前
  // 弃牌堆可能已经被洗回，导致永不触发）。
  encounterDrawn(state, inv, code, api) {
    const flags = (state.scenarioFlags ||= {})
    flags.encounterDeckSizeAfterDraw = state.encounterDeck.length
    // 05090 的显现只在「抽到」时结算：记录最近一次抽到的卡号供条目区分「效果生成」。
    flags.lastEncounterDrawn = { code: String(code), round: state.round, seat: inv?.seat ?? null }
    if (state.encounterDeck.length === 0) resolveEncounterDeckEmptyForced(state, api)
  },

  // ---- 共享诡计结算：分派到单卡条目的 encounterResolve ----
  resolveEncounter(state, inv, treachery, api) {
    const code = original(treachery)
    const entryResolve = encounterResolveFor(code)
    if (!entryResolve) return false
    // 05099 这类「弃遭遇牌库顶」的条目会直接改 state：结算后对比牌库长度，弃空则立即结算强制。
    const watchDeckEmpty = watchEncounterDeckEmpty(state)
    const result = entryResolve(state, inv, treachery, api, { location: here(state, inv) })
    watchDeckEmpty(api)
    return result
  },

  // ---- 威胁区「行动：检定 X 弃掉本卡」 + 敌人谈判/遭遇行动 ----
  encounterActions(state, inv) {
    const moves = []
    for (const threat of inv.threat || []) {
      const spec = threatActionFor(original(threat))
      if (spec) moves.push(...threatMoves({
        action: 'encounterAction', rule: spec.rule, threatId: threat.id, actions: spec.actions ?? 1,
      }, spec))
    }
    const location = here(state, inv)
    for (const attachment of location?.attachments || []) {
      const spec = threatActionFor(original(attachment))
      if (spec?.target === 'location') moves.push(...threatMoves({
        action: 'encounterAction', rule: spec.rule, attachmentId: attachment.id, actions: spec.actions ?? 1,
      }, spec))
    }
    for (const enemy of (state.enemies || []).filter(candidate => candidate.location === inv.location)) {
      const action = enemyScriptFor(original(enemy))?.encounterAction?.(state, inv, enemy)
      if (action) moves.push(action)
    }
    return moves
  },

  performEncounterAction(state, inv, move, api) {
    if (move.enemyId) {
      const enemy = (state.enemies || []).find(candidate => candidate.id === move.enemyId
        && candidate.location === inv.location)
      if (!enemy) return false
      const handler = enemyScriptFor(original(enemy))?.performEncounterAction
      if (typeof handler !== 'function') return false
      return handler(state, inv, enemy, move, api) === true
    }
    const spec = threatActionByRule(move.rule)
    if (!spec) return false
    const threat = move.threatId ? (inv.threat || []).find(card => card.id === move.threatId) : null
    const location = here(state, inv)
    const attachment = move.attachmentId
      ? (location?.attachments || []).find(card => card.id === move.attachmentId)
      : null
    const target = threat || attachment
    if (!target) return false
    const finish = () => (threat ? discardThreatCard(state, inv, threat) : discardLocationAttachment(state, location, attachment))
    if (spec.noTest) {
      finish()
      return true
    }
    const skill = move.skill || spec.skills?.[0] || 'willpower'
    const autoSuccess = spec.autoSuccessWhen ? THREAT_AUTO_SUCCESS[spec.autoSuccessWhen]?.(state, inv) === true : false
    if (autoSuccess) {
      api.info?.(`✔️ 条件满足，「${move.label}」自动成功。`)
      finish()
      return true
    }
    api.test(inv.seat, skill, Number(spec.difficulty ?? 0), result => {
      if (result.success) finish()
    }, 0, { type: 'scenario', name: move.label, ability: true, code: original(target) })
    return true
  },
})
