// 深渊守卫 · 第一章《永恒沉睡》（theEternalSlumber · 83001）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/GuardiansOfTheAbyss/TheEternalSlumber.hs +
//       Campaigns/GuardiansOfTheAbyss/Helpers.hs + 各 CardDefs 的印刷文本（cards-data）。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup / startLocation / setupLocations / locationPlaced / afterDeckSetup → 布置与深渊之力
//   actions / performAction → 幕 1 审讯兄弟会特工（团队花线索从参考卡下方生成）、幕 3 唤醒沉梦者
//   actReveal → 幕 1 背面（建探索牌库）→ 幕 2 背面（放沉梦者 + 生成奈斯）→ 幕 3 背面（结局二选一）
//   agendaReveal → 议程 1 背面（收回兄弟会特工/洗入深渊亡魂/深渊之力 +1/必要时推进幕）
//                   议程 2 背面（洗回遭遇弃牌堆/深渊之力 +1）
//                   议程 3 背面（深渊之力 +1，未撤退者被深渊吞没 → 无结局）
//   checkObjectives → 幕 1（6 张证据）/ 幕 2（7 张探险地点入场）/ 幕 3（奈斯被击败）
//   enemyDefeated → 击败兄弟会特工 → 背面证据入胜利区；击败奈斯 → 幕 3 目标达成
//   resolveChaosToken / tokenMeanings → 混乱标记（[skull]/[cultist]/[tablet]/[elder_thing]）
//   resolution → 结局记录 / 战役资产（约翰和杰西·伯克、古老圣甲虫护符）/ 跨章记录
//
// 近似（写入 status.json risks）：
//   1. 兄弟会敌人卡面的「[action] 以团队弃牌/支付进行谈判」逐张语义未逐字实现；本章用团队花费
//      1[per_investigator] 线索的剧本行动「审讯」代替（与议程 1 正面同额），并允许以战斗击败；
//      击败/审讯后翻面为证据故事卡（与参考「进入胜利区后翻面」一致）。
//   2. 地点/遭遇卡上的文字效果（伤害/恐惧/谈判加值等）以 definition 数据声明为主，未逐张实现；
//      核心流程（深渊之力、沉梦者、证据、探索、结局）完整。
//   3. 奈斯「梦者替她抵消伤害」按字面在 awaken 行动里结算（移除 1 沉梦者 + 1 点伤害），
//      战斗伤害的抵消近似未接线。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import {
  BROTHERHOOD_ENEMY_CODES, BROTHERHOOD_STORY_BY_ENEMY, activeInvestigators,
  codeOf, guardiansOf, investigatorCount, isHardSide, locationOf, setGuardians, shuffleWith,
} from '../../shared.js'
import {
  ABYSSAL_REVENANT_CODE, ACT1_CODE, ACT2_CODE, ACT3_CODE, AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE,
  ANCIENT_ANKH_CODE, CAIRO_LOCATION_IDS, ENCOUNTER_DECK, EXPEDITION_LOCATION_IDS,
  EXPLORATION_DECK, JOHN_AND_JESSIE_CODE, LOCATIONS, NEITH_CODE, SCENARIO_TEXT,
  SET_ASIDE_ALIASES, SET_ASIDE_LOCATION_IDS, START_LOCATION,
} from './definition.js'

const CHAPTER_ID = 'theEternalSlumber'
const clone = value => structuredClone(value)
const info = (api, message) => api?.info?.(message)
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const currentActCode = state => codeOf((state.acts || [])[state.actIndex ?? 0])
const currentAgendaCode = state => codeOf((state.agendas || [])[state.agendaIndex ?? 0])
const scenarioOf = state => guardiansOf(state)
const groupCluesAt = state => activeInvestigators(state).reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
const label = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function prepareScenario(state, api = {}) {
  if (scenarioOf(state).setup) return scenarioOf(state)
  const setup = {
    setup: true,
    strength: investigatorCount(state),
    evidence: [],
    dreamersPlaced: false,
    neithSpawned: false,
    neithDefeated: false,
    takenByAbyss: [],
    escaped: [],
    brotherhood: shuffleWith(api, [...BROTHERHOOD_ENEMY_CODES]),
  }
  setGuardians(state, setup)
  info(api, `永恒沉睡：深渊之力初始为 ${setup.strength}（调查员人数）；6 名兄弟会特工洗混置于剧本参考卡下方。`)
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
  info(api, `永恒沉睡布置：6 张开罗/探险地点入场；7 张探险地点放一边；遭遇牌库 ${state.encounterDeck.length} 张。`)
  return [...CAIRO_LOCATION_IDS, 'expeditionCamp']
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
  info(api, `永恒沉睡布置完成：${state.locations.length} 张地点入场；深渊之力 ${scenarioOf(state).strength}。`)
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
  for (const id of [...CAIRO_LOCATION_IDS, 'expeditionCamp']) {
    const instance = { ...clone(LOCATIONS[id]), clues: 0, revealed: true, connections: [...LOCATIONS[id].connections] }
    state.locations.push(instance)
    locationPlaced(state, instance, api)
  }
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
  const current = scenarioOf(state)
  const act = currentActCode(state)
  const agenda = currentAgendaCode(state)
  const required = investigatorCount(state)
  const clues = groupCluesAt(state)
  const underRef = current.brotherhood || []
  // 议程 1 正面 / 幕 1：团队花费 1[per_investigator] 线索，从参考卡下方随机生成 1 名兄弟会特工。
  if ((agenda === AGENDA1_CODE || act === ACT1_CODE) && underRef.length) {
    moves.push({
      action: 'scenarioAction', rule: 'guardiansInterrogate', locationId: inv.location, actions: 1,
      label: `团队花费 ${required} 个线索：从参考卡下方随机生成 1 名兄弟会特工`,
      reason: clues >= required ? null : `团队需要 ${required} 个线索（现有 ${clues}）`,
    })
  }
  // 幕 3：唤醒沉梦者（把地点上的 1 个沉梦者移给奈斯，作为 1 点伤害）。
  if (act === ACT3_CODE) {
    const here = locationOf(state, inv.location)
    if (here && Number(here.dreamers) > 0) {
      moves.push({
        action: 'scenarioAction', rule: 'guardiansAwakenDreamer', locationId: inv.location, actions: 1,
        label: '唤醒沉梦者：意志检定（X = 深渊之力），成功把 1 个沉梦者移给奈斯作为 1 点伤害',
        reason: null,
      })
    }
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  const current = scenarioOf(state)
  if (move.rule === 'guardiansInterrogate') {
    const required = investigatorCount(state)
    if (groupCluesAt(state) < required) return false
    let remaining = required
    for (const investigator of activeInvestigators(state)) {
      if (remaining <= 0) break
      const spend = Math.min(Number(investigator.clues) || 0, remaining)
      investigator.clues -= spend
      remaining -= spend
    }
    const pool = [...(current.brotherhood || [])]
    if (!pool.length) { info(api, '剧本参考卡下方没有兄弟会特工了。'); return true }
    const picked = shuffleWith(api, pool)[0]
    setGuardians(state, { brotherhood: pool.filter(code => code !== picked) })
    const here = inv.location
    if (typeof api?.spawn === 'function') api.spawn(picked, here, { engagedSeat: inv.seat })
    else {
      state.enemies ||= []
      const def = (state.scenario?.enemies || {})[picked] || {}
      state.enemies.push({
        id: `${picked}-${state.round}-${state.enemies.length + 1}`, code: picked, originalCode: picked,
        name: label(picked), fight: def.fight ?? 3, evade: def.evade ?? 2, health: def.health ?? 4,
        damage: def.damage || 0, horror: def.horror || 0, damageTaken: 0, doom: 0,
        location: here, engagedSeat: inv.seat, exhausted: false, traits: [...(def.traits || [])],
      })
      inv.engaged ||= []
      inv.engaged.push(state.enemies.at(-1).id)
    }
    info(api, `🕵️ ${inv.name} 审讯了一名兄弟会特工：「${label(picked)}」现身于「${api.locName?.(here) || here}」。`)
    return true
  }
  if (move.rule === 'guardiansAwakenDreamer') {
    const here = locationOf(state, inv.location)
    if (!here || !(Number(here.dreamers) > 0)) return false
    const strength = Number(scenarioOf(state).strength) || 0
    if (typeof api?.test !== 'function') return false
    api.test(inv.seat, 'willpower', strength, result => {
      if (!result?.success) {
        info(api, `🌙 ${inv.name} 没能唤醒沉梦者。`)
        return
      }
      here.dreamers = Math.max(0, Number(here.dreamers) - 1)
      const neith = (state.enemies || []).find(enemy => codeOf(enemy) === NEITH_CODE)
      if (neith) {
        neith.damageTaken = (Number(neith.damageTaken) || 0) + 1
        info(api, `🌙 一名沉梦者被唤醒并化作奈斯身上 1 点伤害（奈斯已受伤 ${neith.damageTaken}）。`)
      } else {
        info(api, '🌙 一名沉梦者被唤醒（奈斯不在场）。')
      }
    }, 0, { code: NEITH_CODE, name: '唤醒沉梦者' })
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
function spawnNeith(state, api) {
  if ((state.enemies || []).some(enemy => codeOf(enemy) === NEITH_CODE)) return
  const here = CAIRO_LOCATION_IDS[0]
  if (typeof api?.spawn === 'function') api.spawn(NEITH_CODE, here, {})
  else {
    state.enemies ||= []
    const def = (state.scenario?.enemies || {})[NEITH_CODE] || {}
    state.enemies.push({
      id: `${NEITH_CODE}-${state.round}`, code: NEITH_CODE, originalCode: NEITH_CODE, name: label(NEITH_CODE),
      fight: def.fight ?? 4, evade: def.evade ?? 4, health: def.health ?? 5,
      damage: def.damage || 0, horror: def.horror || 2, damageTaken: 0, doom: 0,
      location: here, engagedSeat: null, exhausted: false, traits: [...(def.traits || [])], hunter: true,
    })
  }
  setGuardians(state, { neithSpawned: true })
  info(api, `🌙 奈斯现身于「${label(here)}」。`)
}

export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === ACT1_CODE) {
    const codes = [...EXPLORATION_DECK]
    if (typeof api?.buildExplorationDeck === 'function') api.buildExplorationDeck(codes)
    else state.explorationDeck = shuffleWith(api, codes)
    for (const inv of activeInvestigators(state)) inv.clues = 0
    for (const id of CAIRO_LOCATION_IDS) {
      const here = locationOf(state, id)
      if (here) here.clues = 0
    }
    info(api, `🏜️ 幕 1 背面「进入沙漠」：探索牌库建立（${codes.length} 张）；所有调查员与开罗地点失去线索。`)
    return true
  }
  if (code === ACT2_CODE) {
    const per = investigatorCount(state)
    for (const id of CAIRO_LOCATION_IDS) {
      const here = locationOf(state, id)
      if (here) here.dreamers = per
    }
    setGuardians(state, { dreamersPlaced: true })
    spawnNeith(state, api)
    info(api, `🌙 幕 2 背面「全为选民」：每个开罗地点放置 ${per} 个沉梦者；奈斯现身。`)
    return true
  }
  if (code === ACT3_CODE) {
    const choice = typeof api?.choose === 'function'
      ? api.choose({
        kind: 'choice', source: 'theHourOfJudgment', seat: activeInvestigators(state)[0]?.seat ?? 0,
        prompt: '奈斯已无力抵抗。要永远消灭她，还是听她说完？',
        options: [
          { id: 'destroy', label: '永远消灭奈斯（→ 结局 1：长眠诅咒被解除）' },
          { id: 'spare', label: '饶过奈斯，听她说话（→ 结局 2：知晓伊扎法拉的阴谋）' },
        ],
      })
      : 'destroy'
    const resolution = choice === 'spare' ? 'resolution2' : 'resolution1'
    setGuardians(state, { neithOutcome: resolution })
    info(api, resolution === 'resolution1'
      ? '🗡️ 调查员决定永远消灭奈斯。（→ 结局 1）'
      : '🕯️ 调查员决定饶过奈斯。（→ 结局 2）')
    safeCall(api, 'finish', resolution)
    return true
  }
  return false
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  const current = scenarioOf(state)
  if (code === AGENDA1_CODE) {
    const inPlay = (state.enemies || []).filter(enemy => BROTHERHOOD_ENEMY_CODES.includes(codeOf(enemy)))
    for (const enemy of inPlay) {
      for (const inv of state.investigators) {
        inv.engaged = (inv.engaged || []).filter(id => id !== enemy.id)
      }
      state.enemies = state.enemies.filter(item => item.id !== enemy.id)
    }
    const back = [...new Set([...(current.brotherhood || []), ...inPlay.map(enemy => codeOf(enemy))])]
    setGuardians(state, { brotherhood: back, strength: Number(current.strength) + 1 })
    for (let index = 0; index < 2; index += 1) state.encounterDeck.push(ABYSSAL_REVENANT_CODE)
    if (typeof api?.shuffle === 'function') state.encounterDeck = api.shuffle(state.encounterDeck)
    info(api, `🩸 议程 1 背面「他们盯上你了」：兄弟会特工收回参考卡下方；2 张深渊亡魂洗入遭遇牌库；深渊之力 +1（现 ${scenarioOf(state).strength}）。`)
    if (currentActCode(state) === ACT1_CODE) {
      info(api, '⏫ 议程 1 背面：当前为幕 1，推进幕。')
      safeCall(api, 'advanceAct')
    }
    return true
  }
  if (code === AGENDA2_CODE) {
    state.encounterDeck = [...(state.encounterDeck || []), ...(state.encounterDiscard || [])]
    state.encounterDiscard = []
    if (typeof api?.shuffle === 'function') state.encounterDeck = api.shuffle(state.encounterDeck)
    setGuardians(state, { strength: Number(scenarioOf(state).strength) + 1 })
    info(api, `🩸 议程 2 背面「深渊渐长」：遭遇弃牌堆洗回；深渊之力 +1（现 ${scenarioOf(state).strength}）。`)
    return true
  }
  if (code === AGENDA3_CODE) {
    const taken = activeInvestigators(state).map(inv => inv.name)
    setGuardians(state, { strength: Number(scenarioOf(state).strength) + 1, takenByAbyss: [...taken] })
    for (const inv of state.investigators) {
      if (!inv.defeated && !inv.resigned) inv.defeated = true
    }
    info(api, '☠️ 议程 3 背面「永恒沉睡」：深渊之力 +1；每名未撤退的调查员被深渊吞没。')
    safeCall(api, 'finish', 'noResolution')
    return true
  }
  return false
}

export function checkObjectives(state, api = {}) {
  const act = currentActCode(state)
  const current = scenarioOf(state)
  if (act === ACT1_CODE) {
    if ((current.evidence || []).length >= 6) {
      info(api, '🔍 胜利区已有 6 张证据。（推进幕 1）')
      safeCall(api, 'advanceAct')
      return true
    }
    return false
  }
  if (act === ACT2_CODE) {
    const missing = EXPEDITION_LOCATION_IDS.filter(id => !locationOf(state, id))
    if (!missing.length) {
      info(api, '🏜️ 7 张探险地点全部入场。（推进幕 2）')
      safeCall(api, 'advanceAct')
      return true
    }
    return false
  }
  if (act === ACT3_CODE) {
    const neithAlive = (state.enemies || []).some(enemy => codeOf(enemy) === NEITH_CODE)
    if (current.neithDefeated || !neithAlive) {
      info(api, '🕯️ 奈斯被击败。（推进幕 3）')
      safeCall(api, 'advanceAct')
      return true
    }
    return false
  }
  return false
}

export function enemyDefeated(state, enemy, api = {}) {
  const code = codeOf(enemy)
  if (code === NEITH_CODE) {
    setGuardians(state, { neithDefeated: true })
    info(api, '🕯️ 奈斯被击败。')
    return true
  }
  const storyCode = BROTHERHOOD_STORY_BY_ENEMY[code]
  if (!storyCode) return false
  const current = scenarioOf(state)
  const evidence = [...new Set([...(current.evidence || []), storyCode])]
  setGuardians(state, { evidence })
  if (typeof api?.addStoryToVictory === 'function') api.addStoryToVictory(storyCode)
  else (state.victoryDisplay ||= []).push({ id: storyCode, code: storyCode, originalCode: storyCode, name: label(storyCode) })
  info(api, `📜 兄弟会特工「${label(code)}」翻面为证据「${label(storyCode)}」并加入胜利区`
    + `（证据 ${evidence.length}/6）。`)
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
  if (face === 'tablet') return { delta: hard ? -2 : 0, ignoreSkillBonuses: true }
  if (face === 'elderthing') {
    return { delta: hard ? -6 : -5, onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'abyssStrengthOption', hard }] }
  }
  return null
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  const current = scenarioOf(state)
  if (effect.mode === 'abyssStrength') {
    const threshold = effect.hard ? 5 : 3
    if (Number(current.strength) <= threshold) {
      setGuardians(state, { strength: Number(current.strength) + 1 })
      info(api, `[cultist]：深渊之力 +1（现 ${scenarioOf(state).strength}）。`)
    }
    return true
  }
  if (effect.mode === 'abyssStrengthOption') {
    const choice = typeof api?.choose === 'function'
      ? api.choose({
        kind: 'choice', source: 'elderThingAbyss', seat: inv?.seat ?? 0,
        prompt: '[elder_thing]：是否改为深渊之力 +1，从而自动成功？',
        options: [{ id: 'skip', label: '不' }, { id: 'add', label: '深渊之力 +1 并自动成功' }],
      })
      : 'skip'
    if (choice === 'add') {
      setGuardians(state, { strength: Number(scenarioOf(state).strength) + 1 })
      safeCall(api, 'passSkillTest')
      info(api, `[elder_thing]：深渊之力 +1（现 ${scenarioOf(state).strength}），本次检定自动成功。`)
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
function escapedNames(state) {
  const current = scenarioOf(state)
  const inPlay = (state.enemies || []).filter(enemy => BROTHERHOOD_ENEMY_CODES.includes(codeOf(enemy)))
  return [...new Set([
    ...(current.escaped || []),
    ...(current.brotherhood || []),
    ...inPlay.map(enemy => codeOf(enemy)),
  ])].map(code => label(code))
}

export function resolution(state, key, events = null, api = {}) {
  void events
  const infoApi = api?.info ? api : api?.api || {}
  const finalKey = String(key)
  const current = scenarioOf(state)
  const strength = Number(current.strength) || 0
  const escaped = escapedNames(state)
  const taken = [...new Set(current.takenByAbyss || [])]
  const effects = []
  effects.push({ record: { dreamersInTheAbyss: strength } })
  if (escaped.length) effects.push({ record: { brotherhoodAgentsWhoEscaped: escaped } })
  if (finalKey === 'noResolution') {
    effects.push({ record: { theBrotherhoodsSchemesContinueUnabated: true } })
    if (taken.length) effects.push({ record: { wasTakenByTheAbyss: taken } })
    info(infoApi, '无结局：记录「兄弟会的阴谋仍在继续」「深渊中的沉梦者（X）」与「逃脱的兄弟会特工」。（→无结局）')
  } else if (finalKey === 'resolution1') {
    effects.push({ record: { theCurseOfSlumberWasLifted: true } })
    if (taken.length) effects.push({ recordRemove: { wasTakenByTheAbyss: taken } })
    info(infoApi, '结局 1：记录「长眠诅咒已被解除」，划掉所有「被深渊吞没」；关间可选择让约翰和杰西·伯克加入一位调查员牌组。')
  } else if (finalKey === 'resolution2') {
    effects.push({ record: { youAreAwareOfXzharahsPlans: true } })
    if (taken.length) effects.push({ record: { wasTakenByTheAbyss: taken } })
    info(infoApi, '结局 2：记录「你们已知晓伊扎法拉的阴谋」；关间可选择让古老圣甲虫护符加入一位调查员牌组。')
  }
  return { bonus: 0, award: true, effects, flowData: { resolution: finalKey, strength, escaped } }
}

// ---------------------------------------------------------------------------
// 只读投影 / 具名助手
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  const current = scenarioOf(state)
  return {
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    strength: Number(current.strength) || 0,
    evidence: [...(current.evidence || [])],
    brotherhood: [...(current.brotherhood || [])],
    dreamersPlaced: current.dreamersPlaced === true,
    neithSpawned: current.neithSpawned === true,
    neithDefeated: current.neithDefeated === true,
    explorationDeck: [...(state.explorationDeck || [])],
  }
}

export function implementedEntryFlags(code) {
  return registeredEntry(String(code || ''))?.flags || {}
}

export const events = {
  guardiansInterrogate(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat || 0]
    return inv ? performAction(state, inv, { rule: 'guardiansInterrogate' }, api) : false
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
