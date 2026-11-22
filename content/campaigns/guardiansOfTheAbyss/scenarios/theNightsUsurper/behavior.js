// 深渊守卫 · 第二章《夜之篡位者》（theNightsUsurper · 83016）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/GuardiansOfTheAbyss/TheNightsUsurper.hs +
//       Campaigns/GuardiansOfTheAbyss/Helpers.hs + 各 CardDefs 的印刷文本（cards-data）。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup / startLocation / setupLocations / locationPlaced / afterDeckSetup → 布置、
//     探索牌库、兄弟会特工（战役记录 / 独立 3 名）、深渊之力（记录 dreamersInTheAbyss / 调查员人数）
//   actions / performAction → 幕 3 与伊扎法拉谈判（耗尽/击败后推进）、幕 2 支付线索进入门
//   actReveal → 幕 1 背面（把超凡之门洗入探索牌库）→ 幕 2 背面（进入梦境之间并生成伊扎法拉）
//                → 幕 3 背面（达成 3 项条件 → 结局 2，否则翻回 a 面）
//   agendaReveal → 议程 1 背面（按玩家顺序生成参考卡下方的兄弟会特工）
//                   议程 2 背面（所有调查员被击败并「被深渊吞没」→ 结局 1）
//   checkObjectives → 幕 1（7 张探险地点入场）/ 幕 2（回合结束时全员在超凡之门并支付线索）/
//                      幕 3（伊扎法拉被耗尽且调查员在其地点）
//   enemyDefeated / enemyEvadedSuccessfully → 伊扎法拉被击败/耗尽
//   resolveChaosToken / tokenMeanings → 混乱标记
//   resolution → 结局记录（noResolution 按参考直接结算结局 1）/ 战役资产（召唤夜魇、深渊弯刀）
//
// 近似（写入 status.json risks）：
//   1. 幕 2「支付所需数量的线索」按 Haskell Act 2b 为 3[per_investigator]（已核对，见
//      GUARDIANS_ACT2_CLUE_COST；非近似）。
//   2. 异界地点/故事卡的逐张翻面文本以 definition 数据声明为主；核心流程（探索、门、伊扎法拉、结局）完整。
//   3. 伊扎法拉「不能因伤害被击败」：按卡面数据 health 仍然可被战斗削减；本实现以「耗尽/被击败」两种
//      条件推进幕 3，未接线「不可被伤害击败」的免疫。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import {
  BROTHERHOOD_ENEMY_CODES, activeInvestigators, codeOf, guardiansOf, investigatorCount,
  isHardSide, locationOf, setGuardians, shuffleWith,
} from '../../shared.js'
import {
  ACT1_CODE, ACT2_CODE, ACT3_CODE, AGENDA1_CODE, AGENDA2_CODE,
  ANCIENT_ANKH_CODE, DREADED_SHANTAK_CODE, DREAM_BETWIXT_ID, ELDRITCH_GATE_ID, ENCOUNTER_DECK,
  EXPEDITION_LOCATION_IDS, EXPLORATION_DECK, KHOPESH_CODE, LOCATIONS,
  OTHERWORLD_LOCATION_IDS, SCENARIO_TEXT, SET_ASIDE_ALIASES, SET_ASIDE_LOCATION_IDS,
  START_LOCATION, SUMMONED_NIGHTGAUNT_CODE, XZHARAH_CODE,
} from './definition.js'

const CHAPTER_ID = 'theNightsUsurper'
const GUARDIANS_ACT2_CLUE_COST = 3 // 参考 Haskell Act 2b：perPlayer 3（已核对，非近似）
const clone = value => structuredClone(value)
const info = (api, message) => api?.info?.(message)
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const currentActCode = state => codeOf((state.acts || [])[state.actIndex ?? 0])
const currentAgendaCode = state => codeOf((state.agendas || [])[state.agendaIndex ?? 0])
const scenarioOf = state => guardiansOf(state)
const groupCluesAt = state => activeInvestigators(state).reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
const label = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code
const isCampaignMode = state => Boolean(state.campaign && (state.campaign.scenarioResults || []).length)
const record = (state, key) => state.campaign?.records?.[key]

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function prepareScenario(state, api = {}) {
  if (scenarioOf(state).setup) return scenarioOf(state)
  // 深渊之力：战役模式读记录；独立模式 = 调查员人数。
  const recordedDreamers = Number(record(state, 'dreamersInTheAbyss'))
  const strength = isCampaignMode(state) && Number.isFinite(recordedDreamers) ? recordedDreamers : investigatorCount(state)
  // 兄弟会特工：战役模式 = 记录里逃脱的敌人；独立模式 = 随机 3 名。
  const escapedRecord = record(state, 'brotherhoodAgentsWhoEscaped')
  let brotherhood
  if (isCampaignMode(state) && Array.isArray(escapedRecord)) {
    const names = new Set(escapedRecord)
    brotherhood = BROTHERHOOD_ENEMY_CODES.filter(code =>
      names.has(code) || names.has(label(code)) || names.has(ALL_CARDS[code]?.name))
  } else {
    brotherhood = shuffleWith(api, [...BROTHERHOOD_ENEMY_CODES]).slice(0, 3)
  }
  const setup = {
    setup: true,
    strength,
    brotherhood,
    campaignMode: isCampaignMode(state),
    xzharahDefeated: false,
    xzharahSpawned: false,
    gateShuffled: false,
    enteredDreamlands: false,
    dreamerLocations: [...EXPEDITION_LOCATION_IDS],
    remembered: {
      freedTheNightgaunts: Boolean(record(state, 'freedTheNightgaunts')),
      executedTheNightgaunts: Boolean(record(state, 'executedTheNightgaunts')),
      warnedTheDenizensOfSarkomand: Boolean(record(state, 'warnedTheDenizensOfSarkomand')),
      cutOffAllEscape: Boolean(record(state, 'cutOffAllEscape')),
      pledForHelp: Boolean(record(state, 'pledForHelp')),
      affrontedTheRulerOfThisRealm: Boolean(record(state, 'affrontedTheRulerOfThisRealm')),
    },
  }
  setGuardians(state, setup)
  info(api, `夜之篡位者：深渊之力 ${strength}；参考卡下方兄弟会特工 ${brotherhood.length} 名（${setup.campaignMode ? '战役' : '独立'}模式）。`)
  return scenarioOf(state)
}

export function preScenarioSetup(state, events, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  return prepareScenario(state, api)
}

export function startLocation() {
  return START_LOCATION
}

export function setupLocations(state, events, helper = {}) {
  void events
  const api = helper?.api || {}
  prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  state.scenarioZones.setAsideLocations = [...SET_ASIDE_LOCATION_IDS]
  if (!state.encounterDeck?.length) state.encounterDeck = [...ENCOUNTER_DECK]
  info(api, `夜之篡位者布置：探险营地入场；探索牌库 ${EXPLORATION_DECK.length} 张；遭遇牌库 ${state.encounterDeck.length} 张。`)
  return [START_LOCATION]
}

export function locationPlaced(state, location, api = {}, seat = null) {
  void api
  void seat
  if (!location) return
  location.revealed = true
  const card = ALL_CARDS[codeOf(location)] || {}
  const perPlayer = Number(location.cluesPerInvestigator)
  if (Number.isFinite(perPlayer)) location.clues = perPlayer * investigatorCount(state)
  else if (Number.isFinite(Number(card.clues))) location.clues = Number(card.clues) * investigatorCount(state)
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside ||= [...SET_ASIDE_ALIASES]
  state.scenarioZones.setAsideLocations ||= [...SET_ASIDE_LOCATION_IDS]
  if (!state.encounterDeck?.length) state.encounterDeck = [...ENCOUNTER_DECK]
  if (!state.explorationDeck?.length) {
    if (typeof api?.buildExplorationDeck === 'function') api.buildExplorationDeck([...EXPLORATION_DECK])
    else state.explorationDeck = shuffleWith(api, [...EXPLORATION_DECK])
  }
  info(api, `夜之篡位者布置完成：${state.locations.length} 张地点入场；探索牌库 ${state.explorationDeck.length} 张；深渊之力 ${scenarioOf(state).strength}。`)
  return { strength: scenarioOf(state).strength, brotherhood: [...(scenarioOf(state).brotherhood || [])] }
}

/** 单测/直调入口（不经过大厅）。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.guardians
  const report = prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  state.scenarioZones.setAsideLocations = [...SET_ASIDE_LOCATION_IDS]
  const instance = { ...clone(LOCATIONS[START_LOCATION]), clues: 0, revealed: true, connections: [...LOCATIONS[START_LOCATION].connections] }
  state.locations.push(instance)
  locationPlaced(state, instance, api)
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = START_LOCATION
  state.encounterDeck = [...ENCOUNTER_DECK]
  afterDeckSetup(state, null, { api })
  return { ...report, placedIds: state.locations.map(location => location.id) }
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const moves = []
  const act = currentActCode(state)
  const current = scenarioOf(state)
  const xzharah = (state.enemies || []).find(enemy => codeOf(enemy) === XZHARAH_CODE)
  // 幕 2：全员在超凡之门、支付线索进入门（近似为剧本行动；正常也可由回合结束自动判定）。
  if (act === ACT2_CODE && inv.location === ELDRITCH_GATE_ID) {
    const required = GUARDIANS_ACT2_CLUE_COST * investigatorCount(state)
    moves.push({
      action: 'scenarioAction', rule: 'guardiansEnterTheGate', locationId: inv.location, actions: 0,
      label: `团队支付 ${required} 个线索：进入门（推进幕 2）`,
      reason: groupCluesAt(state) >= required ? null : `团队需要 ${required} 个线索（现有 ${groupCluesAt(state)}）`,
    })
  }
  // 幕 3：伊扎法拉已被击败/耗尽 → 推进幕 3。
  if (act === ACT3_CODE && xzharah && !current.xzharahDefeated) {
    if (Number(xzharah.damageTaken) >= Number(xzharah.health) || xzharah.exhausted) {
      moves.push({
        action: 'scenarioAction', rule: 'guardiansUsurpNight', locationId: inv.location, actions: 0,
        label: '伊扎法拉已无力反抗：推进幕 3 并结算「夜之篡位者」',
        reason: inv.location === xzharah.location ? null : '需要与伊扎法拉位于同一地点',
      })
    }
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  const current = scenarioOf(state)
  if (move.rule === 'guardiansEnterTheGate') {
    const required = GUARDIANS_ACT2_CLUE_COST * investigatorCount(state)
    if (groupCluesAt(state) < required) return false
    let remaining = required
    for (const investigator of activeInvestigators(state)) {
      const spend = Math.min(Number(investigator.clues) || 0, remaining)
      investigator.clues -= spend
      remaining -= spend
      if (remaining <= 0) break
    }
    info(api, `🌀 团队支付 ${required} 个线索，跨过超凡之门。`)
    safeCall(api, 'advanceAct')
    return true
  }
  if (move.rule === 'guardiansUsurpNight') {
    setGuardians(state, { xzharahDefeated: true })
    info(api, '🌑 伊扎法拉被击败/耗尽：调查员们要决定如何结束这一切。')
    safeCall(api, 'advanceAct')
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
function spawnXzharah(state, api) {
  if ((state.enemies || []).some(enemy => codeOf(enemy) === XZHARAH_CODE)) return
  if (typeof api?.spawn === 'function') api.spawn(XZHARAH_CODE, DREAM_BETWIXT_ID, {})
  else {
    state.enemies ||= []
    const def = (state.scenario?.enemies || {})[XZHARAH_CODE] || {}
    state.enemies.push({
      id: `${XZHARAH_CODE}-${state.round}`, code: XZHARAH_CODE, originalCode: XZHARAH_CODE, name: label(XZHARAH_CODE),
      fight: def.fight ?? 4, evade: def.evade ?? 4, health: def.health ?? 5,
      damage: def.damage || 0, horror: def.horror || 2, damageTaken: 0, doom: 0,
      location: DREAM_BETWIXT_ID, engagedSeat: null, exhausted: false, traits: [...(def.traits || [])], hunter: true,
    })
  }
  setGuardians(state, { xzharahSpawned: true })
  info(api, `🌑 伊扎法拉现身于「梦境之间」。`)
}

export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  const current = scenarioOf(state)
  if (code === ACT1_CODE) {
    if (!current.gateShuffled) {
      if (typeof api?.addToExplorationDeck === 'function') api.addToExplorationDeck([ELDRITCH_GATE_ID])
      else {
        state.explorationDeck = shuffleWith(api, [...(state.explorationDeck || []), ELDRITCH_GATE_ID])
      }
      setGuardians(state, { gateShuffled: true })
    }
    info(api, '🌀 幕 1 背面「远古造物」：超凡之门洗入探索牌库。')
    return true
  }
  if (code === ACT2_CODE) {
    const here = locationOf(state, DREAM_BETWIXT_ID)
    if (!here) {
      if (typeof api?.place === 'function') api.place(DREAM_BETWIXT_ID)
      else state.locations.push({ ...clone(LOCATIONS['83022a']), clues: Number(ALL_CARDS['83022a']?.clues || 0) * investigatorCount(state), revealed: true })
    }
    const betwixt = locationOf(state, DREAM_BETWIXT_ID)
    if (betwixt) betwixt.revealed = true
    state.locations = (state.locations || []).filter(location => location.id === DREAM_BETWIXT_ID)
    for (const inv of activeInvestigators(state)) inv.location = DREAM_BETWIXT_ID
    spawnXzharah(state, api)
    for (let index = 0; index < 2; index += 1) state.encounterDeck.push(DREADED_SHANTAK_CODE)
    if (typeof api?.shuffle === 'function') state.encounterDeck = api.shuffle(state.encounterDeck)
    setGuardians(state, { enteredDreamlands: true })
    info(api, '🌀 幕 2 背面「潜入梦境」：梦境之间入场；其余地点移出游戏；调查员被带到梦境之间；伊扎法拉现身；2 张可怖山克洗入遭遇牌库。')
    return true
  }
  if (code === ACT3_CODE) {
    const xzharah = (state.enemies || []).find(enemy => codeOf(enemy) === XZHARAH_CODE)
    const groupClues = groupCluesAt(state)
    const requiredClues = 3 * investigatorCount(state)
    const remembered = current.remembered || {}
    const conditions = [
      current.xzharahDefeated || !xzharah || Number(xzharah.damageTaken) >= Number(xzharah.health),
      groupClues >= requiredClues,
      Number(current.strength) <= 4,
      remembered.freedTheNightgaunts === true && remembered.warnedTheDenizensOfSarkomand === true && remembered.pledForHelp === true,
    ]
    const met = conditions.filter(Boolean).length
    if (met >= 3) {
      info(api, `🌑 幕 3 背面「击败伊扎法拉」：${met}/4 项条件达成（需 3 项）。（→ 结局 2）`)
      safeCall(api, 'finish', 'resolution2')
    } else {
      info(api, `🌑 幕 3 背面「击败伊扎法拉」：仅 ${met}/4 项条件达成，幕翻回 a 面。`)
    }
    return true
  }
  return false
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  const current = scenarioOf(state)
  if (code === AGENDA1_CODE) {
    const under = [...(current.brotherhood || [])]
    const spawned = []
    for (const [index, inv] of activeInvestigators(state).entries()) {
      const code = under.shift()
      if (!code) break
      spawned.push(code)
      if (typeof api?.spawn === 'function') api.spawn(code, inv.location, { engagedSeat: inv.seat })
    }
    for (const code of under) {
      const here = (state.locations || [])[0]?.id || START_LOCATION
      spawned.push(code)
      if (typeof api?.spawn === 'function') api.spawn(code, here, {})
    }
    setGuardians(state, { brotherhood: [] })
    info(api, `🩸 议程 1 背面「兄弟会的复仇」：参考卡下方的兄弟会特工全部现身（${spawned.length} 名）。`)
    return true
  }
  if (code === AGENDA2_CODE) {
    const taken = activeInvestigators(state).map(inv => inv.name)
    for (const inv of state.investigators) {
      if (!inv.defeated && !inv.resigned) inv.defeated = true
    }
    setGuardians(state, { strength: Number(scenarioOf(state).strength) + 1, takenByAbyss: [...taken] })
    info(api, '☠️ 议程 2 背面「预言实现」：每名调查员被击败并被深渊吞没。（→ 结局 1）')
    safeCall(api, 'finish', 'resolution1')
    return true
  }
  return false
}

export function checkObjectives(state, api = {}) {
  const act = currentActCode(state)
  const current = scenarioOf(state)
  if (act === ACT1_CODE) {
    const missing = EXPEDITION_LOCATION_IDS.filter(id => !locationOf(state, id))
    if (!missing.length) {
      info(api, '🧭 7 张探险地点全部入场。（推进幕 1）')
      safeCall(api, 'advanceAct')
      return true
    }
    return false
  }
  if (act === ACT2_CODE) {
    const all = activeInvestigators(state)
    const atGate = all.length > 0 && all.every(inv => inv.location === ELDRITCH_GATE_ID)
    const required = GUARDIANS_ACT2_CLUE_COST * investigatorCount(state)
    if (atGate && groupCluesAt(state) >= required) {
      info(api, `🌀 所有调查员都在超凡之门，团队支付 ${required} 个线索。（推进幕 2）`)
      safeCall(api, 'advanceAct')
      return true
    }
    return false
  }
  if (act === ACT3_CODE) {
    const xzharah = (state.enemies || []).find(enemy => codeOf(enemy) === XZHARAH_CODE)
    const ready = current.xzharahDefeated || !xzharah || xzharah.exhausted
    if (ready) {
      info(api, '🌑 伊扎法拉已无力反抗。（推进幕 3）')
      safeCall(api, 'advanceAct')
      return true
    }
    return false
  }
  return false
}

export function enemyDefeated(state, enemy, api = {}) {
  if (codeOf(enemy) !== XZHARAH_CODE) return false
  setGuardians(state, { xzharahDefeated: true })
  info(api, '🌑 伊扎法拉被击败。')
  return true
}

export function enemyEvadedSuccessfully(state, inv, enemy, api = {}) {
  void inv
  if (codeOf(enemy) !== XZHARAH_CODE) return false
  info(api, '🌑 伊扎法拉被耗尽。')
  return true
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  void inv
  const face = String(token || '').toLowerCase().replace('_', '')
  const hard = isHardSide(state)
  const strength = Number(scenarioOf(state).strength) || 0
  if (face === 'skull') return { delta: -(strength + (hard ? 1 : 0)) }
  if (face === 'cultist') return { delta: 0, onFail: [{ type: 'scenarioToken', token: 'cultist', mode: 'abyssStrength', hard }] }
  if (face === 'tablet') return { delta: hard ? -3 : -1, ignoreSkillBonuses: true }
  if (face === 'elderthing') return { delta: hard ? -5 : -4, onPass: [{ type: 'scenarioToken', token: 'elderthing', mode: 'abyssReduction' }] }
  return null
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  void inv
  const current = scenarioOf(state)
  if (effect.mode === 'abyssStrength') {
    const threshold = effect.hard ? 5 : 3
    if (Number(current.strength) <= threshold) {
      setGuardians(state, { strength: Number(current.strength) + 1 })
      info(api, `[cultist]：深渊之力 +1（现 ${scenarioOf(state).strength}）。`)
    }
    return true
  }
  if (effect.mode === 'abyssReduction') {
    if (Number(current.strength) >= 4) {
      setGuardians(state, { strength: Number(current.strength) - 1 })
      info(api, `[elder_thing]：深渊之力 -1（现 ${scenarioOf(state).strength}）。`)
    }
    return true
  }
  return false
}

export function tokenMeanings() {
  return SCENARIO_TEXT.tokens
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export function resolution(state, key, events = null, api = {}) {
  void events
  const infoApi = api?.info ? api : api?.api || {}
  const current = scenarioOf(state)
  const taken = [...new Set(current.takenByAbyss || [])]
  // 参考：noResolution 直接进入结局 1。
  const finalKey = String(key) === 'noResolution' ? 'resolution1' : String(key)
  const effects = []
  if (finalKey === 'resolution1') {
    effects.push({ record: { theDayOfReckoningIsComing: true } })
    if (taken.length) effects.push({ record: { wasTakenByTheAbyss: taken } })
    info(infoApi, '结局 1：记录「清算之日即将到来」；结算经验。')
  } else if (finalKey === 'resolution2') {
    effects.push({ record: { theAbyssWasSaved: true } })
    if (taken.length) effects.push({ recordRemove: { wasTakenByTheAbyss: taken } })
    info(infoApi, '结局 2：记录「深渊已被拯救」，划掉所有「被深渊吞没」；关间可选择让召唤夜魇加入一位调查员牌组。')
  } else if (finalKey === 'resolution3') {
    effects.push({ record: { youJoinedForcesWithXzharah: true } })
    if (taken.length) effects.push({ record: { wasTakenByTheAbyss: taken } })
    info(infoApi, '结局 3：记录「你们与伊扎法拉联手」；关间可选择让深渊弯刀加入一位调查员牌组。')
  }
  void ANCIENT_ANKH_CODE
  return { bonus: 0, award: true, effects, flowData: { resolution: finalKey, strength: current.strength } }
}

// ---------------------------------------------------------------------------
// 只读投影 / 具名助手
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  const current = scenarioOf(state)
  const xzharah = (state.enemies || []).find(enemy => codeOf(enemy) === XZHARAH_CODE) || null
  return {
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    strength: Number(current.strength) || 0,
    brotherhood: [...(current.brotherhood || [])],
    xzharahSpawned: current.xzharahSpawned === true,
    xzharahDefeated: current.xzharahDefeated === true,
    xzharah: xzharah ? { location: xzharah.location, damageTaken: xzharah.damageTaken, health: xzharah.health, exhausted: xzharah.exhausted } : null,
    explorationDeck: [...(state.explorationDeck || [])],
    remembered: { ...(current.remembered || {}) },
  }
}

export function implementedEntryFlags(code) {
  return registeredEntry(String(code || ''))?.flags || {}
}

export const events = {
  guardiansEnterTheGate(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat || 0]
    return inv ? performAction(state, inv, { rule: 'guardiansEnterTheGate' }, api) : false
  },
}

export const behavior = {
  id: CHAPTER_ID,
  locationsStartRevealed: true,
  startLocation,
  preScenarioSetup,
  prepareScenario,
  setupLocations,
  locationPlaced,
  afterDeckSetup,
  setupScenario,
  actions,
  performAction,
  actReveal,
  agendaReveal,
  checkObjectives,
  enemyDefeated,
  enemyEvadedSuccessfully,
  resolveChaosToken,
  applyTokenEffect,
  tokenMeanings,
  resolution,
  events,
  scenarioSummary,
  currentActCode,
  currentAgendaCode,
  guardiansOf: scenarioOf,
  codeOf,
}
