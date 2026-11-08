// 亡命冰原 III · 引擎钩子（章节流程 + 渗出梦魇）。
//
// 约定同 TDE 章节：behavior 只做章节分派与本章机械；逐卡规则在单卡条目。
// 本文件同时服务于引擎 scenarioBehavior 分派与单测（测试直接调用这些函数）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { actRuleFor, agendaRuleFor, enemyRuleFor, entryFlags } from '../../../../../src/cards/card-rules.js'
import {
  campLocationId, revealedLocations, setCampLocation,
} from '../../../../../src/engine/eote-camp.js'
import { initializeTekeliDeck, tekeliShuffleIn } from '../../../../../src/engine/eote-tekeli.js'
import { part3ChaosFailureSpec, part3ChaosTokenValue, shelterValueOf } from './chaos.js'
import {
  CAMPS, DEFAULT_CAMP, EIDOLON_ENEMY_CODES, LOCATIONS, RAW_CODES as RAW, SEEDING_NIGHTMARE_CODE,
  SEEDING_NIGHTMARE_COPIES, scenario,
} from './definition.js'

const CHAPTER_ID = 'iceAndDeathPart3'
const lo = code => String(code || '').toLowerCase()
const codeOfCard = card => card?.originalCode || card?.code || card
const traitsOf = code => (ALL_CARDS[code]?.traits || []).map(lo)
const isEidolon = code => traitsOf(code).includes('eidolon')
const activeInvestigators = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const recordsOf = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const numInvestigators = state => Math.max(1, Number(state.numInvestigators)
  || (state.investigators || []).length || 1)
const locationOf = (state, id) => (state.locations || []).find(location => location.id === id)
const campId = state => {
  const record = recordsOf(state).camp || campLocationId(state)
  return CAMPS.includes(record) ? record : DEFAULT_CAMP
}
const revealedRecordIds = state => new Set([
  ...(Array.isArray(recordsOf(state).locationsRevealed) ? recordsOf(state).locationsRevealed : []),
  ...(revealedLocations(state) || []),
])

// Haskell#Setup：放置 13 个地点（已记录揭示的按揭示面入场并带线索；营地清空线索）→
// 每调查员 1 张渗出梦魇放在不同地点 → 8 张幻灵均分压在它们底下 → 形成忒咳哩-哩牌库。
export function setupScenario(state, api = {}) {
  state.scenarioFlags ||= {}
  state.scenarioZones ||= {}
  state.campaign ||= {}
  state.campaign.records ||= {}
  const camp = campId(state)
  state.scenarioFlags.camp = camp
  const perInvestigator = numInvestigators(state)
  const revealed = revealedRecordIds(state)

  // 地点：已记录揭示的入场即揭示（带印刷线索）；其余未揭示；营地始终揭示且无线索。
  state.locations = Object.entries(LOCATIONS).map(([id, data]) => {
    const clueCount = data.cluesFixed != null
      ? data.cluesFixed
      : (data.cluesPerInvestigator || 0) * perInvestigator
    const isCamp = id === camp
    const shown = isCamp || revealed.has(id)
    return {
      ...structuredClone(data), id, revealed: shown,
      clues: isCamp ? 0 : (shown ? clueCount : 0),
      maxClues: isCamp ? 0 : clueCount,
      ...(isCamp ? { startedAt: true } : {}),
      doom: 0,
    }
  })
  try { setCampLocation(state, camp) } catch { /* 地点已重置时忽略 */ }
  for (const inv of state.investigators || []) inv.location = camp

  // 遭遇牌库：gather 组敌人/诡计（definition 已排除幻灵/渗出梦魇/忒咳哩-哩弱点组）。
  state.encounterDeck = [...(scenario.encounterDeck || [])]
  state.encounterDiscard ||= []
  state.victoryDisplay ||= []
  state.enemies ||= []
  initializeTekeliDeck(state, { cards: [...RAW.tekeliliFaces], copies: [...RAW.tekeliliCopies] })

  // 渗出梦魇：每调查员 1 张，放在不同的非营地地点（印刷 sidebar 的近似：按地图顺序均摊）。
  const spawnCount = Math.min(perInvestigator, Math.max(1, state.locations.length - 1))
  const candidates = state.locations.filter(location => location.id !== camp).map(location => location.id)
  const placed = candidates.slice(0, spawnCount)
  const eidolons = [...EIDOLON_ENEMY_CODES]
  // 确定性洗牌：helper.randomValue 是 `randomValue(state)` 的裸函数，必须绑定本 state 后
  // 才能作为 shuffle 的 rng（setup.js:796 传的是 `{ randomValue, shuffle, info }`）。
  const rng = typeof api.randomValue === 'function' ? api.randomValue : () => 0.5
  const shuffled = typeof api.shuffle === 'function' ? api.shuffle(eidolons, rng) : eidolons
  const beneathByHost = placed.map(() => [])
  shuffled.forEach((code, index) => { beneathByHost[index % Math.max(1, placed.length)].push(code) })
  state.enemies = placed.map((locationId, index) => {
    const code = SEEDING_NIGHTMARE_CODE
    const card = ALL_CARDS[code] || {}
    const beneath = beneathByHost[index]
    return {
      id: `${code}-${index + 1}`, code, originalCode: code,
      name: card.nameZh || card.name || '渗出梦魇', location: locationId,
      fight: card.fight ?? 3, evade: card.evade ?? 3, health: card.health ?? 6,
      damage: card.damage ?? 2, horror: card.horror ?? 2,
      hunter: beneath.length === 0, exhausted: false, damageTaken: 0,
      beneath, beneathFaceDown: beneath.map(() => true),
    }
  })
  const removedNightmares = Array(Math.max(0, SEEDING_NIGHTMARE_COPIES - placed.length)).fill(SEEDING_NIGHTMARE_CODE)
  state.scenarioZones.setAside = []
  state.scenarioZones.removed = [...(state.scenarioZones.removed || []), ...removedNightmares]
  state.scenarioZones.putIntoPlay = state.locations.map(location => location.id)
  const eidolonsBeneath = beneathByHost.reduce((sum, list) => sum + list.length, 0)
  api.info?.(`🧊 亡命冰原 III：营地「${LOCATIONS[camp]?.name || camp}」；${placed.length} 个渗出梦魇压在冰原上，${eidolonsBeneath} 张幻灵正面朝下压在它们底下。`)
  return {
    camp, nightmareCount: placed.length, eidolonCount: eidolonsBeneath,
    eidolonsBeneath, removed: removedNightmares.length,
  }
}

/**
 * 08544 邪灵现身（强制，密谋将要推进时）：若有渗出梦魇底下有正面朝下的卡牌 → 不推进，改为移除 2 毁灭，
 * 并找到底下卡最多的渗出梦魇，随机翻出 1 张卡并生成在其地点。
 * 引擎读点 act-agenda.js#advanceAgenda：返回 true 表示阻止本次推进。
 */
export function agendaWouldAdvance(state, api = {}) {
  const agenda = (state.agendas || [])[state.agendaIndex]
  if ((agenda?.originalCode || agenda?.code) !== RAW.agendaEidolons) return false
  const holders = (state.enemies || []).filter(enemy =>
    codeOfCard(enemy) === RAW.seepingNightmare && (enemy.beneath || []).length)
  if (!holders.length) return false
  // 声明即读点：08544 条目的 agendaRule.forcedAdvanceHold / removeDoomOnHold / spawnFromBeneath。
  const rule = agendaRuleFor(RAW.agendaEidolons) || {}
  if (rule.forcedAdvanceHold === false) return false
  const removeDoom = Number.isSafeInteger(rule.removeDoomOnHold) ? rule.removeDoomOnHold : 2
  const spawnCount = Number.isSafeInteger(rule.spawnFromBeneath) ? rule.spawnFromBeneath : 1
  state.doom = Math.max(0, Number(state.doom || 0) - removeDoom)
  const host = holders.reduce((best, enemy) => (enemy.beneath.length > best.beneath.length ? enemy : best), holders[0])
  for (let count = 0; count < spawnCount && host.beneath.length; count += 1) {
    const index = typeof api.random === 'function'
      ? Math.floor(api.random() * host.beneath.length)
      : 0
    const [code] = host.beneath.splice(index, 1)
    ;(host.beneathFaceDown ||= []).splice(index, 1)
    state.scenarioFlags ||= {}
    state.scenarioFlags.spawnedFrom = { seepingNightmare: host.id, code, location: host.location }
    if (typeof api.spawn === 'function') api.spawn(code, host.location)
    else {
      const card = ALL_CARDS[code] || {}
      state.enemies.push({
        id: `${code}-${state.enemies.length + 1}`, code, originalCode: code,
        name: card.nameZh || card.name || code, location: host.location, engagedSeat: null,
        fight: card.fight ?? null, evade: card.evade ?? null, health: card.health ?? null,
        damage: card.damage || 0, horror: card.horror || 0, traits: [...(card.traits || [])],
        exhausted: false, damageTaken: 0,
      })
    }
    api.info?.(`🌑 邪灵现身：不移除密谋，改为移除 ${removeDoom} 点毁灭；翻出底下的「${ALL_CARDS[code]?.nameZh || code}」生成在「${host.name || host.location}」。`)
  }
  host.hunter = host.beneath.length === 0
  return true
}

/**
 * 08547 渗出梦魇被击败（强制）：将其底下的所有正面朝下的卡移出游戏。
 * 引擎读点 enemies.js#defeatEnemy → behavior.enemyDefeated；返回 false 保留正常弃置流程。
 */
export function enemyDefeated(state, enemy, api = {}) {
  const code = codeOfCard(enemy)
  const rule = enemyRuleFor(code)
  if (rule?.removeBeneathOnDefeat === false) return false
  if (!rule && code !== RAW.seepingNightmare) return false
  const beneath = [...(enemy.beneath || [])]
  if (!beneath.length) return false
  state.scenarioZones ||= {}
  state.scenarioZones.removed = [...(state.scenarioZones.removed || []), ...beneath]
  enemy.beneath = []
  enemy.beneathFaceDown = []
  api.info?.(`🌑 渗出梦魇被击败：底下 ${beneath.length} 张正面朝下的卡移出游戏。`)
  return false
}

/** 08544 背面：调查员队长二选一（加入 1 个 [frost] / 每人洗入忒咳哩-哩牌库顶 2 张）。 */
function manifestationsOfEvilBack(state, api = {}) {
  const leadSeat = Number(state.campaign?.leadSeat ?? 0)
  const options = [
    { id: 'frost', label: '在混乱袋里加入 1 个 [frost] 标记' },
    { id: 'tekelili', label: '每位调查员将忒咳哩-哩牌库顶 2 张洗入牌库（不能者受到 1 点伤害和 1 点恐惧）' },
  ]
  const answer = typeof api.choice === 'function'
    ? api.choice({ kind: 'story', source: RAW.agendaEidolons, seat: leadSeat,
      prompt: '邪灵现身：调查员队长必须决定（选择一项）。', options })
    : 'frost'
  if (answer !== 'tekelili') {
    state.chaosBag ||= []
    state.chaosBag.push('frost')
    api.addChaosToken?.('frost')
    api.info?.('🌑 邪灵现身背面：混乱袋加入 1 个 [frost] 标记。')
    return { choice: 'frost' }
  }
  const results = []
  for (const inv of state.investigators || []) {
    let shuffled = 0
    for (let count = 0; count < 2; count += 1) {
      const got = tekeliShuffleIn(state, inv.seat, 1)
      if (got) shuffled += 1
    }
    const missing = 2 - shuffled
    if (missing > 0) {
      inv.damage = (inv.damage || 0) + missing
      inv.horror = (inv.horror || 0) + missing
    }
    results.push({ seat: inv.seat, shuffled, damage: missing, horror: missing })
  }
  api.info?.('🌑 邪灵现身背面：每位调查员将忒咳哩-哩牌库顶 2 张洗入牌库。')
  return { choice: 'tekelili', results }
}

/** 08545 背面：剩下的每位调查员被击败并承受 1 点肉体创伤。 */
function icyDepthsBack(state, api = {}) {
  for (const inv of activeInvestigators(state)) {
    if (typeof api.defeatInvestigator === 'function') api.defeatInvestigator(inv.seat, { cause: 'killed' })
    if (!inv.defeated) inv.defeated = true
    api.addTrauma?.(inv.seat, 'physical', 1)
  }
  api.info?.('🌑 冰雪深处背面：剩下的调查员全部被击败（1 点肉体创伤）。')
  return { defeated: (state.investigators || []).filter(inv => inv.defeated).length }
}

/** 议程背面分派（引擎 phases.js#runAgendaReveal）：读条目 agendaRule.chapterFlow。 */
export function agendaReveal(state, agenda, api = {}) {
  const code = codeOfCard(agenda) || String(agenda || '')
  const flow = agendaRuleFor(code)?.chapterFlow || (state.agendas || [])[state.agendaIndex]?.chapterFlow
  if (flow === 'seepingNightmares' || code === RAW.agendaEidolons) {
    manifestationsOfEvilBack(state, api)
    return true
  }
  if (flow === 'icyDepths' || code === RAW.agendaDeeper) {
    icyDepthsBack(state, api)
    return true
  }
  return false
}

/** 幕 08546 背面：无幻灵敌人 → 结局 1；通过撤退推进 → 结局 2（引擎 reveal.js#runActReveal）。 */
export function actReveal(state, act, api = {}) {
  const code = codeOfCard(act) || String(act || '')
  const flow = actRuleFor(code)?.chapterFlow || (state.acts || [])[state.actIndex]?.chapterFlow
  if (flow !== 'breakTheSiege' && code !== RAW.actSiege) return false
  const eidolons = (state.enemies || []).filter(enemy => !enemy.defeated && isEidolon(codeOfCard(enemy)))
  if (!eidolons.length) {
    api.finish?.('resolution1')
    return true
  }
  const active = activeInvestigators(state)
  if (!active.length && (state.investigators || []).some(inv => inv.resigned)) {
    api.finish?.('resolution2')
    return true
  }
  return false
}

/** 08546 目标：场上没有幻灵敌人，或所有未被击败的调查员都已撤退。 */
export function actObjectiveMet(state) {
  const eidolons = (state.enemies || []).filter(enemy => !enemy.defeated && isEidolon(codeOfCard(enemy)))
  if (!eidolons.length) return { met: true, reason: 'noEidolonEnemies' }
  const active = activeInvestigators(state)
  const resigned = (state.investigators || []).some(inv => inv.resigned)
  if (!active.length && resigned) return { met: true, reason: 'allResigned' }
  return { met: false, reason: null }
}

/** 引擎读点（act-agenda.js#checkLinearAct）：目标达成即由引擎推进场景。 */
export function checkObjectives(state, api = {}) {
  if (!actObjectiveMet(state).met) return false
  api.advanceAct?.()
  return true
}

// 08546 营地获得 [action] 共同花 4 线索：撤退（条目 flags.campResign 为读点）。
export function actions(state, inv) {
  const actFlags = entryFlags(codeOfCard((state.acts || [])[state.actIndex]))
  if (actFlags && actFlags.campResign !== true) return []
  const camp = state.scenarioFlags?.camp || campId(state)
  if (!camp || inv?.location !== camp) return []
  const group = activeInvestigators(state).filter(other => other.location === camp)
  const clues = group.reduce((sum, other) => sum + (other.clues || 0), 0)
  return [{
    action: 'scenarioAction', rule: 'campResign', actions: 1,
    label: '⛺ 营地：共同花费 4 个线索，撤退',
    ...(clues < 4 ? { reason: `线索不足：营地的调查员需要共同花费 4 个线索（当前 ${clues}）` } : {}),
  }]
}

export function performAction(state, inv, move, api = {}) {
  if (move?.rule !== 'campResign') return false
  const camp = state.scenarioFlags?.camp || campId(state)
  const group = activeInvestigators(state).filter(other => other.location === camp)
  const clues = group.reduce((sum, other) => sum + (other.clues || 0), 0)
  if (clues < 4) {
    api.info?.('线索不足：营地的调查员们需要共同花费 4 个线索才能撤退。')
    return false
  }
  let left = 4
  for (const other of group) {
    const spend = Math.min(left, other.clues || 0)
    other.clues -= spend
    left -= spend
  }
  for (const other of group) other.resigned = true
  api.info?.('⛺ 调查队从营地撤退。')
  return true
}

// 引擎读点：treachery-tokens.js#resolveSpecialToken → behavior.resolveChaosToken。
export function resolveChaosToken(state, inv, token) {
  return part3ChaosTokenValue(state, token, inv)
}

/** 检定失败：执行 [cultist]/[tablet] 后果（08501 参考卡；Part III 与 I/II 同一套）。 */
export function afterTest(state, inv, result, api = {}) {
  if (!result || result.success) return []
  const failedBy = Math.max(0, Number(result.difficulty || 0) - Number(result.value || 0))
  const tokens = result.drawn || []
  const applied = []
  if (tokens.includes('cultist')) {
    const spec = part3ChaosFailureSpec(state, 'cultist', failedBy)
    if (spec) {
      const shuffled = tekeliShuffleIn(state, inv.seat, spec.count)
      const got = shuffled ? Number(shuffled.length ?? spec.count) : 0
      const missing = spec.count - got
      if (missing > 0) inv.horror = (inv.horror || 0) + missing
      applied.push({ token: 'cultist', count: spec.count, shuffled: got })
    }
  }
  if (tokens.includes('tablet')) {
    const spec = part3ChaosFailureSpec(state, 'tablet', failedBy)
    if (spec && typeof api.discardTop === 'function') {
      const discarded = api.discardTop(inv.seat, spec.count) || []
      for (const code of discarded) {
        if (!['weakness', 'basicweakness'].includes(ALL_CARDS[code]?.subtype)) continue
        const index = (inv.discard || []).lastIndexOf(code)
        if (index < 0) continue
        inv.discard.splice(index, 1)
        api.putInHand?.(inv.seat, code)
      }
      applied.push({ token: 'tablet', count: spec.count, discarded })
    }
  }
  return applied
}

/** 结局：胜利/失败记录（引擎 campaign-flow.js#applyResolutionEffects → behavior.resolution）。 */
export function scenarioResolution(state, resolution = 'resolution1', events = [], api = {}) {
  const records = recordsOf(state)
  const camp = state.scenarioFlags?.camp || campId(state)
  const shelter = shelterValueOf(state, camp)
  records.shelterValue = shelter
  records.iceAndDeathPart3Resolution = resolution
  if (resolution === 'resolution1') {
    records.eidolonsVanquished = 1
    records.seepingNightmaresEnded = true
    records.theTeamDefeatedTheHuntingCreatures = true
  } else if (resolution === 'resolution2') {
    records.theTeamFledToTheMountains = true
  } else if (resolution === 'noResolution') {
    records.theTeamBarelyEscapedTheIceShelf = true
  }
  api.info?.(`📖 亡命冰原 III 结局：${resolution}；营地庇护值 ${shelter}。`)
  return { resolution, shelterValue: shelter, records: { ...records } }
}

export const behavior = {
  id: CHAPTER_ID,
  setupScenario,
  // 引擎真实路径入口：setupScenario 已建立地点/遭遇牌库等，引擎不再重复放置。
  setupLocations(state, events, helper = {}) {
    setupScenario(state, {
      info: text => helper.info?.(state, events, text),
      shuffle: helper.shuffle,
      // engine setup helper 的 randomValue 是 `randomValue(state)` 裸函数：绑定 state 后传入。
      randomValue: typeof helper.randomValue === 'function' ? () => helper.randomValue(state) : null,
    })
    return []
  },
  // 引擎读点：act-agenda.js#advanceAgenda / phases.js#runAgendaReveal / reveal.js#runActReveal。
  agendaWouldAdvance,
  agendaReveal,
  actReveal,
  actObjectiveMet,
  checkObjectives,
  // 引擎读点：moves.js#legalMoves / dispatch.js#executeAction。
  actions,
  performAction,
  resolveChaosToken,
  afterTest,
  enemyDefeated,
  resolution: scenarioResolution,
  scenarioResolution,
  campId,
}

// 本章单卡条目（08544–08548）在合并后由 Lead 登记；behavior 通过 entryFlags 读取卡面声明。
export function implementedEntryFlags(code) {
  return entryFlags(code) || {}
}
