// 食梦者（The Dream Eaters）· 战役共享规则层（P8）。
//
// 职责与 TCU 的 `content/campaigns/theCircleUndone/encounter-rules.js` 相同：
//   1. 把「单卡条目」的规则组（enemyScript / encounterResolve / locationRule / actRule / agendaRule /
//      threatAction / enemyStatRule …）分派到引擎钩子上，章节 behavior 只写流程；
//   2. 提供章节与条目共用的窄工具（玩家顺序、最后抽到的遭遇卡、弃遭遇牌库顶、蜂拥/掩藏/警报读点）；
//   3. 承载本循环新增机制里**可以共享**的部分：Swarming X 的蜂拥放置/击败门槛/溢出伤害、
//      Veiled 的 [fast] 翻面行动、Hidden 敌人（引擎声明式，不在本层）。
//
// 覆盖约定（最容易静默失效的坑）：章节 `behavior = { ...encounterRules, id, ...章节钩子 }`；
// 一旦覆盖下列任一钩子，**必须在函数体内显式转发** `encounterRules.<hook>(...)`，否则共享组失效：
//   afterTest / canFightEnemy / canEvadeEnemy / enemySpawned / enemyMoved / enemyDamaged /
//   enemyDefeated / enemyAttackResolved / enemyPhaseStart / enemyPhaseEnd / mythosEnded /
//   turnBegins / turnEnded / roundEnded / encounterDrawn / resolveEncounter /
//   encounterActions / performEncounterAction / enemyStatModifier / actions / performAction
//
// 本层是**内容层**（不是卡条目），可以 import 纯引擎模块（swarming/swarm/veiled）与 `card-rules.js` 读点；
// 卡片文件不允许 import 本文件（卡条目只能拿 ctx.api）。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import {
  actRuleFor, agendaRuleFor, enemyScriptFor, enemyStatRuleFor, encounterResolveFor, entryFlags,
  resolveDeclarativeTreacheryTest, threatActionByRule, threatActionFor, treacheryRuleFor,
  treacheryTestFor,
} from '../../../src/cards/card-rules.js'
import { isWeaknessCode } from '../../../src/engine/card-lookup.js'
import { swarmCardsOf, swarmCountOf } from '../../../src/engine/swarm.js'
import { swarmingCount, swarmingXFromState } from '../../../src/engine/swarming.js'

export const original = card => card?.originalCode || card?.code || card
export const activeInvestigators = state => (state?.investigators || []).filter(inv => !inv.defeated && !inv.resigned)

// 玩家顺序：从队长座位起（与 TCU/引擎的 table-decisions 同口径）。
export const playerOrder = state => {
  const list = activeInvestigators(state)
  const lead = Number(state?.campaign?.leadSeat ?? 0)
  const count = state?.investigators?.length || list.length || 1
  return [...list].sort((left, right) =>
    (((left.seat - lead) % count) + count) % count - ((((right.seat - lead) % count) + count) % count))
}

export const here = (state, inv) => (state?.locations || []).find(location => location.id === inv?.location) || null

export const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}

export const traitsOf = card => (ALL_CARDS[original(card)]?.traits || card?.traits || [])
  .map(trait => String(trait).toLowerCase())

export const hasTrait = (card, trait) => traitsOf(card).includes(String(trait).toLowerCase())

export const encounterDeckSize = state => (Array.isArray(state?.encounterDeck) ? state.encounterDeck.length : 0)

// ---------------------------------------------------------------------------
// 条目 flags 数据分派（12 个跨章共享组的规则数据 → 本文件的唯一读者）
// ---------------------------------------------------------------------------
// 约定（声明即接线）：卡条目只声明 `flags`，具体行为由本层或章节 behavior 读 flag 实现。
// 本章用到的 flag 见各卡注释；新增 flag 必须在同一轮补读点与测试。

/** 条目顶层 flags（副本；调用方不要修改）。 */
export const flagOf = code => entryFlags(original(code)) || {}

/** 威胁区里带某个 flag 的卡。 */
export function threatCardsWithFlag(inv, key) {
  return (inv?.threat || []).filter(card => flagOf(original(card))[key] != null)
}

/** 本轮由「检定失败限制」封锁的行动（fight / investigate / move ...）。 */
export function restrictionActive(state, seat, action) {
  const entry = state?.scenarioFlags?.failRestricts?.[seat]
  if (!entry) return false
  return entry.round === state.round && (entry.cannot || []).includes(action)
}

/** 记录「本轮不能做 X」（06085 蛛后的意志失败分支）。 */
export function applyFailRestrictions(state, inv, spec) {
  state.scenarioFlags ||= {}
  state.scenarioFlags.failRestricts ||= {}
  state.scenarioFlags.failRestricts[inv.seat] = {
    round: state.round,
    until: spec.until || 'endOfRound',
    cannot: [...(spec.cannot || [])],
  }
}

/** 是否因「failRestricts」而在本轮不能做该行动（给 behavior 转发/测试用）。 */
export const isActionRestricted = restrictionActive

// 从牌库顶揭示 N 张并结算「抽走弱点、其余移出游戏」（06098 黑夜恐怖）。
function revealTopAndRemoveRest(state, inv, api, spec) {
  if (!inv || !Array.isArray(inv.deck)) return []
  const count = Math.min(Math.max(0, Number(spec.revealTop) || 0), inv.deck.length)
  if (!count) return []
  const revealed = inv.deck.splice(inv.deck.length - count, count)
  const weaknesses = spec.drawWeaknesses === false ? [] : revealed.filter(code => isWeaknessCode(code))
  const rest = revealed.filter(code => !weaknesses.includes(code))
  for (const code of weaknesses) inv.hand.push(code)
  if (spec.removeRest !== false && rest.length) {
    state.removedFromGame ||= []
    state.removedFromGame.push(...rest)
  }
  const names = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code
  if (weaknesses.length) api.info?.(`🃏 揭示牌库顶 ${count} 张：抽取弱点 ${weaknesses.map(names).join('、')}。`)
  if (rest.length) api.info?.(`🃏 其余 ${rest.length} 张移出游戏：${rest.map(names).join('、')}。`)
  return revealed
}

// ---------------------------------------------------------------------------
// 遭遇牌库：最近抽到的卡 / 牌库耗尽强制 / 顶部弃牌
// ---------------------------------------------------------------------------

/** 最近一次抽到的遭遇卡（`{ code, round, seat }`）；效果生成的卡没有该记录。 */
export function lastEncounterDrawn(state) {
  return state?.scenarioFlags?.lastEncounterDrawn || null
}

/** 消费「最近抽到」记录；卡号匹配时返回 true（条目用来区分「抽到」与「被效果生成」）。 */
export function consumeLastEncounterDrawn(state, code) {
  const last = state?.scenarioFlags?.lastEncounterDrawn
  if (!last || String(last.code) !== String(code)) return false
  delete state.scenarioFlags.lastEncounterDrawn
  return true
}

/**
 * 牌库耗尽的共享强制：遍历威胁区里声明 `treacheryRule.encounterDeckEmptyForced` 的卡，
 * 以及场上声明 `enemyScript.onEncounterDeckEmpty` 的敌人。
 * 由 `watchEncounterDeckEmpty` 包装「牌库从有牌变空」的时机调用。
 */
export function resolveEncounterDeckEmptyForced(state, api) {
  for (const inv of activeInvestigators(state)) {
    for (const threat of (inv.threat || []).slice()) {
      const rule = treacheryRuleFor(original(threat))
      const forced = rule?.encounterDeckEmptyForced
      if (!forced) continue
      if (typeof forced.horror === 'number' && forced.horror > 0) {
        api.directHorror?.(inv.seat, forced.horror)
        api.info?.(`遭遇牌库耗尽：「${threat.name || threat.code}」对「${inv.name}」造成 ${forced.horror} 点恐惧。`)
      }
      if (forced.test) {
        api.test?.(inv.seat, forced.test.skill, forced.test.difficulty, result => {
          if (!result.success) return
          if (forced.test.discardOnSuccess) api.removeThreat?.(threat)
          else api.discardThreat?.()
        })
      }
    }
  }
  for (const enemy of (state.enemies || []).slice()) {
    enemyScriptFor(original(enemy))?.onEncounterDeckEmpty?.(state, enemy, api)
  }
}

/**
 * 包装「一次可能让遭遇牌库变空的操作」：返回 `(api) => boolean`，在操作结束后调用。
 * 返回是否发生「从有牌变空」。
 */
export function watchEncounterDeckEmpty(state) {
  const before = encounterDeckSize(state)
  let fired = false
  return api => {
    if (fired) return false
    const after = encounterDeckSize(state)
    if (before > 0 && after === 0) {
      fired = true
      api.info?.('遭遇牌库耗尽：结算「牌库耗尽时」的强制能力。')
      resolveEncounterDeckEmptyForced(state, api)
      return true
    }
    return false
  }
}

/**
 * 弃遭遇牌库顶 N 张（内容层唯一入口，等价于 `api.discardEncounterTop`，带兜底）：
 * `options.reshuffle` 默认 true；返回弃掉的卡号数组。
 */
export function discardEncounterTop(state, api, count = 1, options = {}) {
  if (typeof api.discardEncounterTop === 'function') return api.discardEncounterTop(count, options)
  state.encounterDeck ||= []
  state.encounterDiscard ||= []
  const discarded = []
  for (let index = 0; index < count; index += 1) {
    if (!state.encounterDeck.length) break
    const code = state.encounterDeck.pop()
    state.encounterDiscard.push(code)
    discarded.push(code)
  }
  return discarded
}

/** 把指定卡从遭遇牌库弃掉（`fromDiscard` 时连弃牌堆一起找）；返回是否命中。 */
export function discardEncounterCard(state, api, code) {
  if (typeof api.discardEncounterCard === 'function') return api.discardEncounterCard(code, { includeDiscard: true })
  state.encounterDeck ||= []
  state.encounterDiscard ||= []
  const deckIndex = state.encounterDeck.lastIndexOf(String(code))
  if (deckIndex >= 0) {
    state.encounterDiscard.push(state.encounterDeck.splice(deckIndex, 1)[0])
    return true
  }
  const discardIndex = state.encounterDiscard.lastIndexOf(String(code))
  if (discardIndex >= 0) {
    state.encounterDiscard.splice(discardIndex, 1)
    return true
  }
  return false
}

/** 遭遇弃牌堆洗回遭遇牌库（`api.shuffleDiscard` 的语义化别名）。 */
export function shuffleEncounterDiscardIntoDeck(state, api) {
  if (typeof api.shuffleDiscard === 'function') return api.shuffleDiscard()
  state.encounterDeck ||= []
  state.encounterDiscard ||= []
  state.encounterDeck = [...state.encounterDeck, ...state.encounterDiscard]
  state.encounterDiscard = []
  return state.encounterDeck.length
}

/** 遭遇弃牌堆里带某特性的敌人数（TCU 的「女巫」口径；TDE 共享组/章节也可用）。 */
export function enemiesWithTraitInDiscard(state, trait) {
  return (state?.encounterDiscard || []).filter(code => {
    const card = ALL_CARDS[code]
    return card?.type === 'enemy' && (card.traits || []).some(item => String(item).toLowerCase() === String(trait).toLowerCase())
  }).length
}

// ---------------------------------------------------------------------------
// 蜂拥（Swarming X）
// ---------------------------------------------------------------------------

/** 蜂拥敌人定义里的 `swarming` 规格（definition 的解析结果；兼容卡文重新解析）。 */
export function swarmingSpecOf(state, code) {
  const definition = state?.scenario?.enemies?.[code]
  return definition?.swarming || null
}

/** 求值 X（报警等级 / 参考卡伤害需要状态；fixed/perInvestigator 用人数）。 */
export function swarmingCountOf(state, spec, { seat = null } = {}) {
  const x = spec?.kind === 'alarmLevel' || spec?.kind === 'scenarioDamage'
    ? swarmingXFromState(state, spec.kind, seat)
    : null
  return swarmingCount(spec, { numInvestigators: state?.numInvestigators || 1, x })
}

/**
 * 敌人入场时放置蜂拥卡（按 X 从遭遇牌库顶抽卡）。
 * 单卡条目不需要自己调用：共享 `enemySpawned` 会做。
 */
export function placeSwarmCardsFor(state, enemy, api) {
  if (!enemy || swarmCountOf(enemy) > 0) return []
  const code = original(enemy)
  const spec = enemy.swarming || swarmingSpecOf(state, code)
  if (!spec) return []
  const count = swarmingCountOf(state, spec, { seat: enemy.engagedSeat })
  if (!count) return []
  const placed = api.swarm?.place?.(enemy, count, { source: 'swarming' }) || []
  if (placed.length) {
    api.info?.(`🐝 「${enemy.name}」蜂拥 ${placed.length} 张卡（Swarming ${count}）。`)
  }
  return placed
}

/** 蜂拥头领不能被击败的原因（没有蜂拥卡返回 null）。 */
export function swarmBlockedReasonOf(enemy) {
  const count = swarmCountOf(enemy)
  return count > 0 ? `头领仍有 ${count} 张蜂拥卡，清空前不能被击败` : null
}

/**
 * 溢出伤害：头领生命被打空后，多余伤害转给蜂拥卡。
 * 由共享 `enemyDamaged` 调用（引擎在扣伤害后派发；这里把超出生命的伤害从头上撤回并结算给蜂拥卡）。
 */
export function applySwarmOverflow(state, enemy, api) {
  if (!enemy || !swarmCountOf(enemy)) return 0
  const health = Number(enemy.health) || Number(enemy.maxHealth) || 0
  const overkill = Number(enemy.damageTaken || 0) - health
  if (overkill <= 0) return 0
  const cards = swarmCardsOf(enemy)
  const split = api.swarm?.splitDamage?.(enemy, overkill, 0) || { defeatedSwarm: [], toSwarm: overkill }
  api.healEnemy?.(enemy, overkill)
  let defeated = 0
  for (const id of split.defeatedSwarm || []) {
    const card = cards.find(item => item.id === id)
    if (!card) continue
    api.swarm?.remove?.(enemy, id)
    defeated += 1
    // 蜂拥卡被击败后回到遭遇弃牌堆（规则：它们不是敌人实体，不进胜利区）。
    if (Array.isArray(state.encounterDiscard) && card.code) state.encounterDiscard.push(card.code)
  }
  if (defeated) api.info?.(`🐝 溢出伤害击败了「${enemy.name}」的 ${defeated} 张蜂拥卡。`)
  return defeated
}

// ---------------------------------------------------------------------------
// 掩藏地点（Veiled）：[fast] 翻面读背面故事卡
// ---------------------------------------------------------------------------

export const veiledLocations = state => (state?.locations || []).filter(location => location.veiled === true)

/** 背面故事卡印刷数据（`storyFaces` 优先，退回卡池）。 */
export function storyCardFor(state, code) {
  if (!code) return null
  return state?.scenario?.storyFaces?.[code] || ALL_CARDS[code] || null
}

/** 掩藏地点的 [fast] 翻面行动（A2《寻觅卡达斯》/ B3《无归之地》共用）。 */
export function veiledFastActions(state, inv) {
  const moves = []
  if (!state?.locations) return moves
  const location = state.locations.find(item => item.id === inv?.location)
  if (!location || location.veiled !== true || location.veiledRevealed) return moves
  const canFlip = (location.clues || 0) === 0
  moves.push({
    action: 'scenarioAction',
    rule: `flipVeiled:${location.id}`,
    fast: true,
    actions: 0,
    label: canFlip
      ? `🗺️ 翻面「${location.name || location.id}」的掩藏面（读背面故事卡）`
      : `🗺️ 「${location.name || location.id}」上还有线索，不能翻面`,
    ...(canFlip ? {} : { reason: '掩藏地点上还有线索：翻面前必须拿走全部线索' }),
  })
  return moves
}

/** 执行 `veiledFastActions` 产出的翻面行动；非本规则返回 false。 */
export function performVeiledFlip(state, inv, move, api) {
  const rule = String(move?.rule || '')
  if (!rule.startsWith('flipVeiled:')) return false
  const locationId = rule.slice('flipVeiled:'.length)
  const result = api.veiled?.flip(locationId) || { changed: false, reason: '缺少掩藏原语' }
  if (!result.changed) {
    api.info?.(`不能翻面：${result.reason || '条件不满足'}`)
    return true
  }
  const story = storyCardFor(state, result.storyCode)
  if (story) api.info?.(`📖 翻面：${story.text || story.textEn || ''}`)
  const location = (state.locations || []).find(item => item.id === locationId)
  if (location?.shuffleBack) {
    api.veiled?.shuffleBack(locationId)
    api.info?.(`「${location.name || locationId}」已翻面并洗回遭遇牌库。`)
  }
  return true
}

// ---------------------------------------------------------------------------
// 计数器 / 参考卡计数（警报等级、神迹、桥梁进度）
// ---------------------------------------------------------------------------

export const alarmLevelOf = (state, api, seat = null) => {
  if (api?.counters) {
    return seat == null ? api.counters.highestOf('alarmLevel') : api.counters.get(seat, 'alarmLevel')
  }
  const seats = state?.investigatorCounters?.alarmLevel?.seats || []
  return seat == null ? seats.reduce((max, value) => Math.max(max, Number(value) || 0), 0) : Number(seats[seat] || 0)
}

export const markerCountOf = (state, api, id = 'reference') =>
  (api?.markers ? api.markers.get(id) : Number(state?.scenarioFlags?.markers?.[id] || 0))

// ---------------------------------------------------------------------------
// 威胁区摆脱行动（threatAction）通用实现
// ---------------------------------------------------------------------------

function threatCardById(inv, cardId) {
  return (inv?.threat || []).find(card => String(card.id) === String(cardId)) || null
}

function threatRulesFor(card) {
  return threatActionFor(original(card))
}

// ---------------------------------------------------------------------------
// 章节共享钩子（TCU 同构；章节覆盖时须转发）
// ---------------------------------------------------------------------------

export const encounterRules = Object.freeze({
  // 「最近一次抽到的遭遇卡」记录 + 牌库耗尽强制。
  encounterDrawn(state, inv, code, api) {
    state.scenarioFlags ||= {}
    state.scenarioFlags.lastEncounterDrawn = { code, round: state.round, seat: inv?.seat ?? null }
    if (encounterDeckSize(state) === 0) resolveEncounterDeckEmptyForced(state, api)
  },

  // 诡计结算：条目 encounterResolve > 声明式 treacheryRule.test > 放弃。
  resolveEncounter(state, inv, treachery, api) {
    const code = original(treachery)
    const entryResolve = encounterResolveFor(code)
    if (!entryResolve) {
      const declarative = treacheryTestFor(code)
      return declarative ? resolveDeclarativeTreacheryTest(state, inv, treachery, api, declarative) : false
    }
    const watchDeckEmpty = watchEncounterDeckEmpty(state)
    const result = entryResolve(state, inv, treachery, api, { location: here(state, inv) })
    watchDeckEmpty(api)
    return result
  },

  // 敌人入场：放置蜂拥卡 + 派发条目 onSpawn。
  enemySpawned(state, enemy, api) {
    placeSwarmCardsFor(state, enemy, api)
    enemyScriptFor(original(enemy))?.onSpawn?.(state, enemy, api)
  },

  // 生成地点数据分派（条目 flags.spawn；共享组 6 张卡使用）。
  // 返回地点 id（引擎要求）；返回 null/不存在时按生成失败处理（进遭遇弃牌堆 + spawnFailed）。
  spawnLocation(state, code, defaultLocation, engagedSeat, api) {
    const flags = flagOf(code)
    const spec = flags.spawn
    if (!spec) return defaultLocation
    const locations = Array.isArray(state.locations) ? state.locations : []
    const active = activeInvestigators(state)
    const invAt = id => active.filter(inv => inv.location === id)
    const traitsAt = location => (ALL_CARDS[location.originalCode || location.code]?.traits || [])
      .map(trait => String(trait).toLowerCase())
    const pickFrom = (pool, prompt) => {
      if (!pool.length) return null
      if (pool.length === 1) return pool[0].id
      if (typeof api?.choose !== 'function') return pool[0].id
      const answer = api.choose({
        kind: 'location', source: original(code), seat: state.currentSeat ?? state.campaign?.leadSeat ?? 0,
        prompt, options: pool.map(location => ({ id: location.id, label: location.name || location.id })),
      })
      return pool.find(location => String(location.id) === String(answer))?.id || pool[0].id
    }
    const emptyPool = pool => pool.filter(location => invAt(location.id).length === 0)
    // 「任意无人地点」/「离某地最近」等通用过滤。
    const nearestOf = (pool, from) => {
      const scored = pool.map(location => ({
        location,
        distance: api?.locationDistance ? api.locationDistance(from, [location.id]) : 0,
      })).filter(entry => entry.distance >= 0)
      if (!scored.length) return null
      scored.sort((left, right) => left.distance - right.distance)
      return scored[0].location
    }
    const seatInv = engagedSeat != null ? state.investigators[engagedSeat] : null
    const origin = seatInv?.location ?? state.investigators?.[state.currentSeat ?? 0]?.location ?? defaultLocation
    switch (spec.kind) {
      case 'anyEmptyLocation': {
        const pool = emptyPool(locations)
        return pickFrom(pool, `选择「${ALL_CARDS[original(code)]?.nameZh || code}」生成的无人地点。`) || null
      }
      case 'nearestTrait': {
        const wanted = (spec.traits || []).map(trait => String(trait).toLowerCase())
        let pool = locations.filter(location => traitsAt(location).some(trait => wanted.includes(trait)))
        if (spec.emptyIfAble) pool = emptyPool(pool)
        const nearest = nearestOf(pool, origin)
        return nearest ? nearest.id : null
      }
      case 'titles': {
        const titles = (spec.titles || []).map(title => String(title).toLowerCase())
        const matches = title => titles.some(needle =>
          String(title || '').toLowerCase().includes(needle))
        let pool = locations.filter(location => matches(location.name) || matches(ALL_CARDS[location.originalCode || location.code]?.name))
        if (spec.emptyIfAble) pool = emptyPool(pool)
        return pickFrom(pool, `选择「${ALL_CARDS[original(code)]?.nameZh || code}」生成的地点。`) || null
      }
      case 'nearestLocationWithAttachment': {
        const wantedCode = String(spec.code)
        const attachmentHere = location =>
          (location.attachments || []).some(attachment => String(attachment?.code || attachment) === wantedCode)
          || (state.playerLocationAttachments || []).some(entry => entry.location === location.id && String(entry.code) === wantedCode)
        const candidates = locations.filter(attachmentHere)
        const nearest = nearestOf(candidates, origin)
        return nearest ? nearest.id : null
      }
      case 'engagedWithLowestSkill': {
        const candidates = spec.colocated ? active.filter(inv => inv.location === origin) : active
        if (!candidates.length) return spec.colocated ? origin : null
        const statOf = inv => (api?.investigatorStat ? api.investigatorStat(inv.seat, spec.skill || 'combat')
          : Number(inv[spec.skill || 'combat']) || 0)
        const lowest = candidates.reduce((best, inv) => (statOf(inv) < statOf(best) ? inv : best), candidates[0])
        return lowest.location || origin
      }
      case 'anyConnectingLocation': {
        const location = locations.find(item => item.id === origin)
        const pool = (location?.connections || []).map(id => locations.find(item => item.id === id)).filter(Boolean)
        return pickFrom(pool, `选择「${ALL_CARDS[original(code)]?.nameZh || code}」生成的连接地点。`) || null
      }
      default:
        api?.info?.(`⚠️ 未知的生成地点规则：${String(spec.kind)}（按生成失败处理）`)
        return null
    }
  },

  // 生成失败的数据分派（条目 flags.spawnFailed）。
  spawnFailed(state, code, engagedSeat, api) {
    const flags = flagOf(code).spawnFailed
    if (!flags) return
    if (flags.shuffleBack) {
      if (typeof api?.takeEncounterDiscard === 'function') api.takeEncounterDiscard(code)
      api?.shuffleIntoEncounterDeck?.([String(code)], { shuffle: true })
      api?.info?.(`🔄 「${ALL_CARDS[original(code)]?.nameZh || code}」生成失败：洗回遭遇牌库。`)
    }
    if (flags.surge && engagedSeat != null) api?.drawEncounter?.(engagedSeat)
  },

  // 蜂拥头领清空前不能被击败（引擎读点：hidden-rules.js 的 enemyCanBeDefeated）。
  enemyCanBeDefeated(state, enemy) {
    return swarmCountOf(enemy) === 0
  },

  // 敌人受伤：先结算蜂拥溢出伤害，再派发条目 onDamaged。
  enemyDamaged(state, enemy, api, seat, source) {
    applySwarmOverflow(state, enemy, api)
    enemyScriptFor(original(enemy))?.onDamaged?.(state, enemy, api, seat, source)
  },

  // 敌人被击败：条目 onDefeated 返回 true 表示接管（胜利区/弃牌堆由条目处理）。
  enemyDefeated(state, enemy, api) {
    const result = enemyScriptFor(original(enemy))?.onDefeated?.(state, enemy, api)
    if (result === true) return true
    return undefined
  },

  enemyMoved(state, enemy, locationArg, api, previousArg) {
    enemyScriptFor(original(enemy))?.onMoved?.(state, enemy, locationArg, api, previousArg)
  },

  enemyEngaged(state, enemy, inv, api) {
    enemyScriptFor(original(enemy))?.onEngaged?.(state, enemy, inv, api)
  },

  // 敌人攻击结算后：把第 5 实参 `attack` 一并转发（06084/06105 需要按 attack.kind 判定警戒反击等）。
  enemyAttackResolved(state, enemy, inv, api, attack) {
    enemyScriptFor(original(enemy))?.onAttackResolved?.(state, enemy, inv, api, attack)
  },

  // 躲避结算后：派发条目 enemyScript.onEvade（06346–06350 的躲避替代/保护）。
  afterEvade(state, inv, enemy, result, api) {
    enemyScriptFor(original(enemy))?.onEvade?.(state, inv, enemy, result, api)
  },

  enemyPhaseStart(state, api) {
    for (const enemy of (state.enemies || []).slice()) {
      enemyScriptFor(original(enemy))?.onEnemyPhaseStart?.(state, enemy, api)
    }
  },

  enemyPhaseEnd(state, api) {
    for (const enemy of (state.enemies || []).slice()) {
      enemyScriptFor(original(enemy))?.onEnemyPhaseEnd?.(state, enemy, api)
    }
  },

  mythosEnded(state, api) {
    for (const enemy of (state.enemies || []).slice()) {
      enemyScriptFor(original(enemy))?.onMythosEnd?.(state, enemy, api)
    }
  },

  // 敌人战斗/躲避修正：条目 `enemyStatRule` 的通用求值（数据形状见文件头）。
  // `inv` 是正在应对该敌人的调查员（引擎 P8 起传入），用于按手牌/按人修正。
  enemyStatModifier(state, enemy, stat, inv = null) {
    const rule = enemyStatRuleFor(original(enemy))
    if (!rule) return 0
    let value = 0
    if (Number.isFinite(rule[stat])) value += rule[stat]
    for (const entry of rule.per || []) {
      if (entry.stat !== stat) continue
      const source = entry.source
      let count = 0
      if (source === 'doom') count = Number(state.doom || 0)
      else if (source === 'alarmLevel') count = alarmLevelOf(state, null, null)
      else if (source === 'swarmCards') count = swarmCountOf(enemy)
      else if (source === 'doomOnSelf') count = Number(enemy.doom || 0)
      else if (source === 'cluesOnLocation') {
        const location = (state.locations || []).find(item => item.id === enemy.location)
        count = Number(location?.clues || 0)
      } else if (source === 'traitInEncounterDiscard') {
        count = enemiesWithTraitInDiscard(state, entry.trait || '')
      } else if (source === 'traitInVictory') {
        count = (state.victoryDisplay || []).filter(card => hasTrait(card, entry.trait || '')).length
      } else if (source === 'encounterCardsInHand') {
        // 06086 的「按手牌中的遭遇卡数」：手牌里 type=enemy/treachery 的卡数量。
        count = (inv?.hand || []).filter(code => ['enemy', 'treachery'].includes(ALL_CARDS[code]?.type)).length
      }
      const amount = Number(entry.amount ?? 1) * count
      value += amount
    }
    if (Number.isFinite(rule.cap)) value = Math.min(value, rule.cap)
    return value
  },

  // 回合开始：敌人 onTurnBegins + 威胁区「回合开始闹鬼」。
  turnBegins(state, inv, api) {
    for (const enemy of (state.enemies || []).slice()) {
      enemyScriptFor(original(enemy))?.onTurnBegins?.(state, inv, enemy, api)
    }
    for (const threat of (inv.threat || []).slice()) {
      if (treacheryRuleFor(original(threat))?.turnBeginsHaunted === true) api.haunted?.(inv.seat, { source: original(threat) })
    }
  },

  // 回合结束：威胁区强制（turnEnd / turnEndTest）。
  turnEnded(state, inv, api) {
    for (const threat of (inv.threat || []).slice()) {
      const rule = treacheryRuleFor(original(threat))
      if (!rule) continue
      if (rule.turnEnd) {
        if (rule.turnEnd.kind === 'horrorIfNotMoved' && !inv.movedThisTurn) {
          api.directHorror?.(inv.seat, Number(rule.turnEnd.amount) || 1)
        } else if (rule.turnEnd.kind === 'discardEncounterTop') {
          discardEncounterTop(state, api, Number(rule.turnEnd.amount) || 1, { reshuffle: false })
        }
      }
      if (rule.turnEndTest) {
        api.test?.(inv.seat, rule.turnEndTest.skill, rule.turnEndTest.difficulty, result => {
          if (result.success) api.removeThreat?.(threat)
        })
      }
    }
  },

  // 回合末：敌人 onRoundEnd + 议程 forced.roundEnd + `discardAtRoundEnd` 威胁卡。
  roundEnded(state, api) {
    for (const enemy of (state.enemies || []).slice()) {
      enemyScriptFor(original(enemy))?.onRoundEnd?.(state, enemy, api)
    }
    const scenarioId = state.scenario?.id || null
    for (const agenda of (state.agendas || []).slice()) {
      const rule = agendaRuleFor(original(agenda), scenarioId)
      rule?.forced?.roundEnd?.(state, agenda, api)
    }
    for (const inv of activeInvestigators(state)) {
      for (const threat of (inv.threat || []).slice()) {
        if (treacheryRuleFor(original(threat))?.discardAtRoundEnd === true) api.removeThreat?.(threat)
      }
    }
  },

  // 检定后：条目 flag 的数据分派（共享组跨章规则）。引擎会在自动失败与正常路径各调一次，
  // 本函数按 `result` 幂等（同一个 result 对象只结算一次）。
  afterTest(state, inv, result, api) {
    if (!inv || !result || result.success !== false) return
    if (result.__tdeAfterFailHandled === true) return
    result.__tdeAfterFailHandled = true
    for (const threat of (inv.threat || []).slice()) {
      const flags = flagOf(original(threat))
      if (flags.failRestricts) {
        applyFailRestrictions(state, inv, flags.failRestricts)
        api.info?.(`⛔ 「${threat.name || threat.code}」：本轮不能再${flags.failRestricts.cannot
          .map(action => ({ fight: '攻击', investigate: '调查', move: '移动' }[action] || action)).join('/')}。`)
      }
      if (flags.afterFailTest) revealTopAndRemoveRest(state, inv, api, flags.afterFailTest)
    }
  },

  // 目标限制/属性修正的共享默认值：章节覆盖后转发时同样不会改变引擎语义
  //（引擎用 `=== false` 判断禁止，`|| 0` 累加修正）。
  canFightEnemy(state, inv) {
    return restrictionActive(state, inv.seat, 'fight') ? false : undefined
  },

  canEvadeEnemy(state, inv) {
    return restrictionActive(state, inv.seat, 'evade') ? false : undefined
  },

  // 调查/移动的行动限制（06085 蛛后的意志失败分支 / 06084 灰织蛛重整封锁）。
  investigationError(state, inv) {
    return restrictionActive(state, inv.seat, 'investigate') ? '本轮已因「蛛后的意志」无法调查' : undefined
  },

  moveError(state, inv) {
    if (restrictionActive(state, inv.seat, 'move')) return '本轮不能移动'
    const blocker = (state.enemies || []).find(enemy => enemy.location === inv.location
      && !enemy.exhausted && flagOf(original(enemy)).moveBlockWhileReady)
    return blocker ? `「${blocker.name}」处于重整状态：不能进行移动行动` : undefined
  },

  // P8：Hidden 敌人在手牌时的攻击/躲避入口限制（《神居之所》5 形态只能经塔/议程揭示）。
  canFightHidden() {
    return undefined
  },

  canEvadeHidden() {
    return undefined
  },

  // P8：投入限制（《神居之所》06319–06321 已在引擎 hiddenRule 处理；这里处理共享组的数据化限制）。
  canCommitCard(state, owner) {
    for (const threat of (owner?.threat || [])) {
      const flags = flagOf(original(threat))
      if (!flags.spiderHereBlocksCommit) continue
      const spiderHere = (state.enemies || []).some(enemy => enemy.location === owner.location
        && (ALL_CARDS[original(enemy)]?.traits || []).some(trait => String(trait).toLowerCase() === 'spider'))
      if (spiderHere) return false
    }
    return undefined
  },

  // P8：掩藏地点翻面后的章节钩子（读背面故事卡 / B3 洗回遭遇牌库）；引擎在 flipVeiled 后派发。
  veiledFlipped() {},

  // 「无眠之旅」06090：本轮每位调查员所选技能 -2（数据写在 scenarioFlags.whispersOfHypnos）。
  statModifier(state, inv, skill) {
    const record = state.scenarioFlags?.whispersOfHypnos
    if (!record || record.round !== state.round) return 0
    return (record.skills || []).includes(skill) ? -2 : 0
  },

  // Veiled 翻面由引擎原生 `flipVeiled` 行动处理（moves.js/dispatch.js），章节用 `veiledFlipped` 读正文；
  // 共享 actions/performAction 保留空实现，方便章节覆盖时转发。
  actions() {
    return []
  },

  performAction() {
    return false
  },

  // 威胁区摆脱行动（条目 threatAction）+ 敌人条目的 enemyScript.encounterAction（TCU 同构）。
  encounterActions(state, inv) {
    const moves = []
    for (const card of inv.threat || []) {
      const rule = threatRulesFor(card)
      if (!rule) continue
      moves.push({
        action: 'encounterAction',
        rule: rule.rule,
        cardId: card.id,
        label: rule.label || `摆脱「${card.name || card.code || '威胁'}」`,
        ...(rule.actions != null ? { actions: rule.actions } : { actions: 1 }),
      })
    }
    for (const enemy of (state.enemies || []).slice()) {
      const script = enemyScriptFor(original(enemy))
      if (typeof script?.encounterAction !== 'function') continue
      const move = script.encounterAction(state, inv, enemy)
      if (move) moves.push({ ...move, enemyId: enemy.id, action: 'encounterAction' })
    }
    return moves
  },

  performEncounterAction(state, inv, move, api) {
    // 先派发敌人条目的 encounterAction（大祭司 06311「打晕祭司」等）。
    if (move.enemyId != null) {
      const enemy = (state.enemies || []).find(item => String(item.id) === String(move.enemyId))
      const script = enemyScriptFor(original(enemy))
      if (enemy && typeof script?.performEncounterAction === 'function') {
        return Boolean(script.performEncounterAction(state, inv, enemy, move, api))
      }
      return false
    }
    const card = threatCardById(inv, move.cardId)
    const rule = threatRulesFor(card) || threatActionByRule(move.rule)
    if (!rule) return false
    // 摆脱成功后的附加结算（数据：条目 flags.fastDiscardFollowUp，如 06099「弃掉后受到 1 伤 1 恐」）。
    const applyFollowUp = () => {
      const flags = flagOf(original(card))
      const followUp = rule.followUp || flags.fastDiscardFollowUp || flags.followUp
      if (!followUp) return
      if (Number(followUp.damage) > 0) api.damage?.(inv.seat, Number(followUp.damage))
      if (Number(followUp.horror) > 0) api.horror?.(inv.seat, Number(followUp.horror))
      if (followUp.text) api.info?.(followUp.text)
    }
    const run = () => {
      if (rule.noTest === true || (rule.autoSuccessWhen?.() ?? false)) {
        api.removeThreat?.(card)
        applyFollowUp()
        return true
      }
      const skills = rule.skills || [rule.skill || 'willpower']
      const runTest = skill => api.test?.(inv.seat, skill, rule.difficulty ?? 3, result => {
        if (result.success) {
          api.removeThreat?.(card)
          api.info?.(`摆脱了「${card?.name || move.rule}」。`)
          applyFollowUp()
        }
      })
      if (skills.length === 1) return runTest(skills[0])
      const answer = api.choose?.({
        kind: 'skill', source: rule.rule, seat: inv.seat,
        prompt: rule.prompt || '选择用于摆脱的检定技能。',
        options: skills.map(skill => ({ id: skill, label: skill })),
      })
      return runTest(String(answer || skills[0]))
    }
    run()
    return true
  },
})
