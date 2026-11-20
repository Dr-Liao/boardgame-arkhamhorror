// 金盆洗手（oneLastJob · 11501）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheDrownedCity/OneLastJob.hs +
//       Act|Agenda|Location|Enemy|Treachery/Cards/TheDrownedCity/OneLastJob/*.hs +
//       frontend/src/locales/en/theDrownedCity/oneLastJob.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   startLocation / preScenarioSetup → 幕 1 两版二选一、幕/议程牌库
//   setupLocations / locationPlaced / afterDeckSetup → 6 张阿卡姆地点入场、放一边区
//   actions / performAction → 幕 1 谈判（弃罪犯敌人并把线索放上幕）、幕 2 酒馆谈判（把线索放到头目上）、
//     蒂林哈斯特密所「发现外星语言」
//   11502/11503 的「阿卡姆地点最后一个线索被发现后」由条目 abilities（clueDiscovered 窗口）结算；
//   afterParley → 11516 谈判破裂：附属敌人攻击该调查员（dispatch.js#dispatchParleyHooks）。
//   roundEnded / checkObjectives → 幕 1 线索目标、幕 2 头目伤害/线索目标、幕 3 精英在胜利区
//   actReveal → 幕 1 背面（入酒馆/生成头目/补幕牌库）、幕 2 背面（对手帮派找上门）、幕 3 背面（结局 1）
//   agendaReveal → 议程背面（生成执行者/洗回遭遇弃牌；或全员被击败 + 肉体创伤 + 无结局）
//   enemyStatModifier → 萨迪·谢尔顿 +1 生命/调查员、每点伤害 +1 战斗（最多 +3）
//   resolveChaosToken / applyTokenEffect → 11501 混乱标记（skull/tablet/elder_thing）
//   resolution → noResolution（露比赢）/ resolution1（露比输）+ 外星语言符文 A
//
// 本章状态只写 state.scenarioFlags / state.scenarioZones / state.campaign.records（纯 JSON）。
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { tdcCannotGainUpkeepResources } from '../../campaign-rules.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { mechanicState } from '../../../../../src/engine/mechanic-state.js'
import {
  isHardSide, criminalsInPlay, criminalAtInvestigator, skullValue,
  oneLastJobChaosToken, oneLastJobTokenValue, ONE_LAST_JOB_TOKEN_MEANINGS, hasTrait,
} from './chaos.js'
import {
  ACT_CODES, ALT_ACT_CODES, ACT1_V1_CODE, ACT1_V2_CODE, ACT2_SHELDON_CODE, ACT2_OBANNION_CODE,
  ACT3_CODE, ACT2_CODE_BY_ACT1, LINKED_LOCATION_BY_ACT1, AGENDA_CODES, AGENDA1_CODE, AGENDA2_CODE,
  ACT_STAGES, STAGE_CARDS, ACTS, AGENDAS, ENCOUNTER_DECK, SET_ASIDE_ALIASES,
  SETUP_LOCATION_IDS, LINKED_LOCATION_IDS, LOCATIONS, LOCATION_COORDINATES, START_LOCATION,
  START_LOCATION_IDS, RESOLUTION_KEYS, REMOVED_LOCATION_CODES, SCENARIO_TEXT, scenario,
} from './definition.js'

const CHAPTER_ID = 'oneLastJob'
const GANG_BOSS_BY_ACT2 = Object.freeze({
  [ACT2_SHELDON_CODE]: '11510',
  [ACT2_OBANNION_CODE]: '11511',
})
const GANG_BOSS_CODES = Object.freeze(['11510', '11511'])
export { GANG_BOSS_CODES }
const GANG_ENFORCER_CODE = '11513'
const GANG_SOLDIER_CODE = '11512'
const GANG_INFORMANT_CODE = '11514'

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const info = (api, message) => api?.info?.(message)
const codeOf = value => String(value?.originalCode || value?.code || '')
const clone = value => structuredClone(value)
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const flagsFor = state => (state.scenarioFlags ||= {})
const setFlag = (state, key, value = true) => { flagsFor(state)[key] = value; return value }
const flagValue = (state, key) => flagsFor(state)[key]
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const currentAct = state => (state.acts || [])[state.actIndex ?? 0] || null
const currentActCode = state => codeOf(currentAct(state))
const currentAgenda = state => (state.agendas || [])[state.agendaIndex ?? 0] || null
const currentAgendaCode = state => codeOf(currentAgenda(state))
const entryOf = code => (code ? registeredEntry(String(code)) : null)
const flagsOf = code => entryOf(code)?.flags || {}
const actFlags = state => flagsOf(currentActCode(state))
const agendaFlags = state => flagsOf(currentAgendaCode(state))
const locationFlags = state => flagsOf(codeOf(locationOf(state, state?.investigators?.[0]?.location || '')))
const actClueThreshold = state => (Number(actFlags(state).clueThreshold) || 2)
  + (Number(actFlags(state).perInvestigatorBonus) || 1) * investigatorCount(state)
const bossClueGoal = state => Number(actFlags(state).bossClueGoal) || 3
const randomOf = api => (typeof api?.random === 'function' ? api.random : () => Math.random())
const enemiesInPlay = state => (state.enemies || []).filter(enemy => !enemy.defeated)
const bossesInPlay = state => enemiesInPlay(state).filter(enemy => GANG_BOSS_CODES.includes(codeOf(enemy)))
const cluesOnAct = state => Number(state.actClues) || 0
const setCluesOnAct = (state, amount) => {
  state.actClues = Math.max(0, Number(amount) || 0)
  return state.actClues
}
const groupCluesAt = (state, locationId) => activeInvestigators(state)
  .filter(inv => inv.location === locationId)
  .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
const spendGroupClues = (state, locationId, amount) => {
  let remaining = Math.max(0, Number(amount) || 0)
  for (const inv of activeInvestigators(state).filter(item => item.location === locationId)) {
    if (remaining <= 0) break
    const spend = Math.min(Number(inv.clues) || 0, remaining)
    inv.clues -= spend
    remaining -= spend
  }
  return remaining === 0
}

function addGlyph(state, letter, meaning) {
  const records = recordsFor(state)
  const glyphs = new Set(Array.isArray(records.discoveredGlyphs) ? records.discoveredGlyphs : [])
  glyphs.add(letter)
  records.discoveredGlyphs = [...glyphs]
  setFlag(state, 'tdcGlyphTranslation', { ...(flagsFor(state).tdcGlyphTranslation || {}), [letter]: meaning })
  return true
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function prepareScenario(state, api = {}) {
  if (flagValue(state, 'oneLastJobPrepared')) return flagValue(state, 'oneLastJobPrepared')
  const random = randomOf(api)
  // 幕 1 两版随机二选一（Haskell sample2）。默认数据是 Hibbs 线（11504/11506）。
  const useV2 = random() >= 0.5
  const actCodes = useV2 ? [...ALT_ACT_CODES] : [...ACT_CODES]
  const actSource = state.scenario?.stageCards || STAGE_CARDS
  state.acts = actCodes.map(code => clone(actSource[code] || ACTS.find(act => codeOf(act) === code)))
  state.agendas = AGENDA_CODES.map(code => clone((state.scenario?.agendas || AGENDAS)
    .find(agenda => codeOf(agenda) === code) || AGENDAS[AGENDA_CODES.indexOf(code)]))
  state.actIndex = Number.isInteger(state.actIndex) ? state.actIndex : 0
  state.agendaIndex = Number.isInteger(state.agendaIndex) ? state.agendaIndex : 0
  setCluesOnAct(state, Number.isInteger(state.actClues) ? state.actClues : 0)
  const report = {
    act1Code: actCodes[0],
    act1Variant: useV2 ? 'v2' : 'v1',
    actCodes,
    agendaCodes: [...AGENDA_CODES],
    linkedLocationId: LINKED_LOCATION_BY_ACT1[actCodes[0]],
    bossCode: GANG_BOSS_BY_ACT2[actCodes[1]],
  }
  setFlag(state, 'oneLastJobVariant', report)
  setFlag(state, 'oneLastJobPrepared', report)
  info(api, `金盆洗手：幕 1 采用 ${useV2 ? 'La Bella Luna' : "Hibb's Roadhouse"} 线。`)
  return report
}

export const VARIANT_OF = prepareScenario

export function preScenarioSetup(state, events, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  return prepareScenario(state, api)
}

export function startLocation() {
  return START_LOCATION
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  state.scenarioZones.setAsideLocations = []
  state.encounterDeck ||= [...ENCOUNTER_DECK]
  info(api, `金盆洗手：${SETUP_LOCATION_IDS.length} 处阿卡姆地点入场；`
    + `${SET_ASIDE_ALIASES.length} 张卡放一边。`)
  return [...SETUP_LOCATION_IDS]
}

export function locationPlaced(state, location, api = {}, seat = null) {
  void seat
  if (!location) return
  location.revealed = true
  const card = ALL_CARDS[codeOf(location)] || {}
  const fixed = Number(location.cluesFixed)
  const perPlayer = Number(location.cluesPerInvestigator)
  if (Number.isFinite(fixed)) location.clues = Math.max(0, fixed)
  else if (Number.isFinite(perPlayer)) location.clues = perPlayer * investigatorCount(state)
  else if (Number.isFinite(Number(card.clues))) location.clues = Number(card.clues) * investigatorCount(state)
  const cell = LOCATION_COORDINATES[location.id]
  if (cell) {
    location.grid = { x: cell.x, y: cell.y }
    const data = mechanicState(state, true)
    data.grid ||= {}
    data.grid[location.id] = { x: cell.x, y: cell.y, isolated: false, connections: [...(location.connections || [])] }
  }
  void api
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const report = prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside ||= [...SET_ASIDE_ALIASES]
  state.scenarioZones.setAsideLocations ||= []
  setCluesOnAct(state, Number(state.actClues) || 0)
  info(api, `金盆洗手布置完成：幕 1 为 ${report.act1Variant}；`
    + `放一边 ${(state.scenarioZones.setAside || []).length} 张。`)
  return report
}

/** 单测/直调入口：本地放好 6 处地点、遭遇牌库与放一边区。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.oneLastJobPrepared
  const report = prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  state.scenarioZones.setAsideLocations = []
  for (const id of SETUP_LOCATION_IDS) {
    const card = ALL_CARDS[LOCATIONS[id].code]
    const instance = {
      ...structuredClone(LOCATIONS[id]),
      clues: 0,
      revealed: true,
      connections: [...LOCATIONS[id].connections],
    }
    if (card.victory != null) instance.victory = card.victory
    state.locations.push(instance)
    locationPlaced(state, instance, api)
  }
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = START_LOCATION
  if (!state.encounterDeck?.length) state.encounterDeck = [...ENCOUNTER_DECK]
  afterDeckSetup(state, null, { api })
  info(api, `金盆洗手：${state.locations.length} 处地点入场（幕 1 ${report.act1Variant}）。`)
  return { ...report, placedIds: state.locations.map(location => location.id) }
}

// ---------------------------------------------------------------------------
// 行动（幕 1 谈判 / 幕 2 头目谈判 / 密所外星语言）
// ---------------------------------------------------------------------------
function act1ParleyCandidates(state, inv) {
  return enemiesInPlay(state).filter(enemy => enemy.location === inv.location
    && enemy.engagedSeat === inv.seat
    && hasTrait(enemy, 'Criminal')
    && (Number(enemy.health) || 0) - (Number(enemy.damageTaken) || 0) <= (Number(inv.clues) || 0))
}

function act2ParleySpec(state, inv) {
  const actCode = currentActCode(state)
  const bossCode = actFlags(state).bossCode || GANG_BOSS_BY_ACT2[actCode]
  if (!bossCode) return null
  const boss = enemiesInPlay(state).find(enemy => codeOf(enemy) === bossCode && enemy.location === inv.location)
  return boss || null
}

export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here) return []
  const moves = []
  const actCode = currentActCode(state)
  // 幕 1「[fast] 花费 X 个线索：谈判。弃掉一名与你交战、剩余生命值为 X 的罪犯敌人。」
  if ([ACT1_V1_CODE, ACT1_V2_CODE].includes(actCode)) {
    const parleyFlags = actFlags(state).parley || {}
    const candidates = act1ParleyCandidates(state, inv)
    moves.push({
      action: 'scenarioAction', rule: 'oneLastJobParley', locationId: here.id, actions: 1,
      label: '谈判：弃掉一名与你交战、剩余生命值不超过你线索数的[[罪犯]]敌人，并在幕上放置 1 个线索',
      reason: parleyFlags.discardEngagedCriminal !== true
        ? '该行动尚未在条目中实现'
        : (candidates.length ? null : '你所在地点没有与你交战且剩余生命值不超过你线索数的[[罪犯]]敌人'),
    })
  }
  // 幕 2 头目谈判（萨迪·谢尔顿 / 内奥米·欧巴尼恩）。
  if ([ACT2_SHELDON_CODE, ACT2_OBANNION_CODE].includes(actCode)) {
    const boss = act2ParleySpec(state, inv)
    const flags = actFlags(state)
    moves.push({
      action: 'scenarioAction', rule: 'oneLastJobBossParley', locationId: here.id, actions: 1,
      label: '花费至多 4 个资源：与帮派头目谈判（检定难度 5，每花 1 资源难度 -1；每成功超过 1 点放置 1 个线索）',
      reason: (Number(flags.parleyResourcesUpTo) || 0) <= 0
        ? '该行动尚未在条目中实现'
        : (boss ? null : '你所在地点没有帮派头目'),
    })
  }
  // 幕 3「[action] 从你所在地点一名[[罪犯]]敌人移除 1 个线索：谈判。该敌人把其伤害值造成给
  // 同地点的另一名敌人。」（11508 flags.gangWarsParley）
  if (actCode === ACT3_CODE && actFlags(state).gangWarsParley) {
    const sources = enemiesInPlay(state).filter(enemy => enemy.location === here.id
      && hasTrait(enemy, 'Criminal') && (Number(enemy.clues) || 0) > 0)
    const hasOther = (source) => enemiesInPlay(state).some(enemy => enemy.location === here.id
      && enemy !== source)
    moves.push({
      action: 'scenarioAction', rule: 'oneLastJobGangWarsParley', locationId: here.id, actions: 1,
      label: '谈判：从一名有线索的[[罪犯]]敌人移除 1 个线索，让其对同地点另一名敌人造成等于其伤害值的伤害',
      reason: sources.some(hasOther) ? null : '你所在地点没有「有线索的罪犯敌人 + 另一名敌人」组合',
    })
  }
  // 蒂林哈斯特密所：团队共付 1[per_investigator] 线索记录外星语言（每场游戏限一次）。
  if (here.id === START_LOCATION) {
    const flags = flagsOf(codeOf(here))
    const required = (Number(flags.clueCostPerInvestigator) || 1) * investigatorCount(state)
    const available = groupCluesAt(state, here.id)
    moves.push({
      action: 'scenarioAction', rule: 'oneLastJobAlienLanguage', locationId: here.id, actions: 1,
      label: `团队共同花费 ${required} 个线索：在剧本日志中记录调查员发现了一种外星语言`,
      reason: flags.alienLanguageAction !== true
        ? '该行动尚未在条目中实现'
        : flagValue(state, 'oneLastJobAlienLanguageRecorded')
          ? '本场游戏已记录过外星语言'
          : (available >= required ? null : `需要本地点共 ${required} 个线索（现有 ${available}）`),
    })
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  if (move.rule === 'oneLastJobParley') return parleyAction(state, inv, api)
  if (move.rule === 'oneLastJobGangWarsParley') return gangWarsParleyAction(state, inv, api)
  if (move.rule === 'oneLastJobBossParley') return bossParleyAction(state, inv, api)
  if (move.rule === 'oneLastJobAlienLanguage') return alienLanguageAction(state, inv, api)
  return false
}

function parleyAction(state, inv, api) {
  const candidates = act1ParleyCandidates(state, inv)
  if (!candidates.length) return false
  const enemy = candidates[0]
  const health = Math.max(1, (Number(enemy.health) || 1) - (Number(enemy.damageTaken) || 0))
  const clues = Number(inv.clues) || 0
  const pay = Math.min(clues, health)
  inv.clues -= pay
  safeCall(api, 'defeatEnemy', enemy)
  if (Array.isArray(state.enemies)) state.enemies = state.enemies.filter(item => item !== enemy)
  setCluesOnAct(state, cluesOnAct(state) + 1)
  info(api, `${inv.name} 花费 ${pay} 个线索与「${enemy.name || codeOf(enemy)}」谈判：弃掉该敌人，幕上放置 1 个线索。`)
  return true
}

/** 11508 幕 3 谈判：移除线索 + 让该敌人对同地点另一敌人造成其伤害值的伤害。 */
function gangWarsParleyAction(state, inv, api) {
  const here = locationOf(state, inv.location)
  if (!here) return false
  const sources = enemiesInPlay(state).filter(enemy => enemy.location === here.id
    && hasTrait(enemy, 'Criminal') && (Number(enemy.clues) || 0) > 0)
  if (!sources.length) return false
  const sourceOptions = sources.map(enemy => ({ id: enemy.id, label: enemy.name || codeOf(enemy) }))
  const sourceId = typeof api?.choose === 'function'
    ? api.choose({ kind: 'enemy', source: ACT3_CODE, seat: inv.seat,
      prompt: '选择移除线索的[[罪犯]]敌人。', options: sourceOptions })
    : sourceOptions[0].id
  const source = sources.find(enemy => enemy.id === sourceId) || sources[0]
  const targets = enemiesInPlay(state).filter(enemy => enemy.location === here.id && enemy !== source)
  if (!targets.length) return false
  const targetOptions = targets.map(enemy => ({ id: enemy.id, label: enemy.name || codeOf(enemy) }))
  const targetId = typeof api?.choose === 'function'
    ? api.choose({ kind: 'enemy', source: ACT3_CODE, seat: inv.seat,
      prompt: '选择被该敌人的伤害值命中的另一名敌人。', options: targetOptions })
    : targetOptions[0].id
  const target = targets.find(enemy => enemy.id === targetId) || targets[0]
  if (!target) return false
  // 移除 1 个线索（takeEnemyClues → 调查员，再 loseClues 归还到池：净移除）。
  let removed = 0
  if (typeof api?.takeEnemyClues === 'function') removed = api.takeEnemyClues(source, inv.seat, 1) || 0
  if (removed && typeof api?.loseClues === 'function') api.loseClues(inv.seat, removed)
  if (!removed) {
    // 无运行时 api 时退回直写（behavior 允许写 state；条目仍只走 ctx.api）。
    source.clues = Math.max(0, (Number(source.clues) || 0) - 1)
  }
  const damage = Number(source.damage) || 0
  if (damage > 0) {
    if (typeof api?.damageEnemy === 'function') api.damageEnemy(target.id, damage, inv.seat)
    else target.damageTaken = (Number(target.damageTaken) || 0) + damage
  }
  info(api, `${inv.name} 与「${source.name || codeOf(source)}」谈判：移除 1 个线索，`
    + `该敌人对「${target.name || codeOf(target)}」造成 ${damage} 点伤害。`)
  syncCriminalAloof(state, api)
  return true
}

function bossParleyAction(state, inv, api) {
  const boss = act2ParleySpec(state, inv)
  if (!boss) return false
  const resources = Math.min(4, Number(inv.resources) || 0)
  if (typeof api.test === 'function') {
    api.test(inv.seat, 'willpower', 5 - resources, result => {
      if (!result?.success) return
      const successes = Math.max(0, Number(result.successes ?? 0))
      const clues = Math.min(Number(inv.clues) || 0, successes)
      inv.clues -= clues
      boss.clues = (Number(boss.clues) || 0) + clues
      info(api, `${inv.name} 与「${boss.name}」谈判成功 ${successes} 点：把 ${clues} 个线索放到她/他身上。`)
      syncCriminalAloof(state, api)
    })
    return true
  }
  return false
}

function alienLanguageAction(state, inv, api) {
  if (flagValue(state, 'oneLastJobAlienLanguageRecorded')) return false
  const here = locationOf(state, START_LOCATION)
  if (!here || inv.location !== START_LOCATION) return false
  const flags = flagsOf(codeOf(here))
  if (flags.alienLanguageAction !== true) {
    info(api, '蒂林哈斯特密所的外星语言行动缺少条目声明，按未实现处理。')
    return false
  }
  const required = (Number(flags.clueCostPerInvestigator) || 1) * investigatorCount(state)
  if (groupCluesAt(state, START_LOCATION) < required) return false
  spendGroupClues(state, START_LOCATION, required)
  recordsFor(state).theInvestigatorsDiscoveredAnAlienLanguage = true
  setFlag(state, 'oneLastJobAlienLanguageRecorded', true)
  info(api, '调查员们在蒂林哈斯特密所发现了一种外星语言。')
  return true
}

// ---------------------------------------------------------------------------
// 幕 1/2/3 背面 + 议程背面
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === ACT1_V1_CODE || code === ACT1_V2_CODE) return act1Back(state, api, code)
  if (code === ACT2_SHELDON_CODE || code === ACT2_OBANNION_CODE) return act2Back(state, api, code)
  if (code === ACT3_CODE) return act3Back(state, api)
  return false
}

function armBossForAct(state, actCode) {
  const bossCode = GANG_BOSS_BY_ACT2[actCode]
  if (!bossCode) return null
  const definition = (state.scenario?.enemies || scenario.enemies)?.[bossCode]
  if (!definition) return null
  const boss = {
    id: `${bossCode}-1`, code: bossCode, originalCode: bossCode,
    name: definition.name, nameEn: definition.nameEn,
    location: LINKED_LOCATION_BY_ACT1[actCode] ? actCode === ACT2_SHELDON_CODE
      ? 'hibbsRoadhouse' : 'laBellaLuna' : null,
    fight: definition.fight ?? 2, evade: definition.evade ?? 3,
    health: definition.health ?? 4, damage: definition.damage || 0, horror: definition.horror || 0,
    traits: [...(definition.traits || [])], exhausted: false, engagedSeat: null,
    damageTaken: 0, doom: 0, clues: 0, attachments: [], victory: Number(definition.victory) || 0,
    elite: true,
  }
  state.enemies ||= []
  if (!state.enemies.some(enemy => codeOf(enemy) === bossCode)) state.enemies.push(boss)
  return boss
}

function spawnAt(state, code, locationId, api, options = {}) {
  if (typeof api.spawn === 'function') return api.spawn(code, locationId, options)
  const definition = (state.scenario?.enemies || scenario.enemies)?.[code] || {}
  const enemy = {
    id: `${code}-${(state.enemies || []).length + 1}`, code, originalCode: code,
    name: definition.name, location: locationId, fight: definition.fight ?? null,
    evade: definition.evade ?? null, health: definition.health ?? null,
    damage: definition.damage || 0, horror: definition.horror || 0,
    traits: [...(definition.traits || [])], exhausted: options.exhausted === true,
    engagedSeat: options.engagedSeat ?? null, damageTaken: 0, doom: 0, clues: 0,
    attachments: [], victory: Number(definition.victory) || 0, elite: Boolean(definition.elite),
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  return enemy
}

function placeLocationLite(state, id, api) {
  if (locationOf(state, id)) return locationOf(state, id)
  const definition = (state.scenario?.locations || LOCATIONS)[id]
  if (!definition) return null
  const instance = { ...structuredClone(definition), clues: 0, revealed: true, connections: [...definition.connections] }
  const card = ALL_CARDS[definition.code] || {}
  const perPlayer = Number(instance.cluesPerInvestigator)
  if (Number.isFinite(perPlayer)) instance.clues = perPlayer * investigatorCount(state)
  else if (Number.isFinite(Number(card.clues))) instance.clues = Number(card.clues) * investigatorCount(state)
  if (card.victory != null) instance.victory = card.victory
  state.locations ||= []
  state.locations.push(instance)
  safeCall(api, 'place', id)
  locationPlaced(state, instance, api)
  return instance
}

function act1Back(state, api, code) {
  const linkedId = actFlags(state).linkedLocationId || LINKED_LOCATION_BY_ACT1[code] || 'hibbsRoadhouse'
  placeLocationLite(state, linkedId, api)
  const bossCode = actFlags(state).bossCode || GANG_BOSS_BY_ACT2[code]
  spawnAt(state, bossCode, linkedId, api)
  // 幕 2 与幕 3 加入幕牌库（Haskell setActDeck + advanceActDeck）。
  state.acts = [code, code === ACT1_V1_CODE ? ACT2_SHELDON_CODE : ACT2_OBANNION_CODE, ACT3_CODE]
    .map(stageCode => clone((state.scenario?.stageCards || STAGE_CARDS)[stageCode]))
    .filter(Boolean)
  state.actIndex = 0
  setFlag(state, 'oneLastJobAct1Advanced', { linkedId, bossCode })
  info(api, `幕 1 背面：${linkedId} 入场；生成${bossCode === '11510' ? '萨迪·谢尔顿' : '内奥米·欧巴尼恩'}；`
    + '幕 2/幕 3 加入幕牌库。')
  return true
}

/**
 * 11506/11507 幕 2 正面/背面「其上有线索的[[罪犯]]敌人获得冷漠」：
 * 通过 api.setEnemyKeywords(enemy,['aloof'],{enabled,throughRound}) 同步（enemy-keyword-movement 既有读点）；
 * phaseBegan / enemySpawned / 线索变动后调用，throughRound=本轮，靠这些时点续期。
 */
export function syncCriminalAloof(state, api = {}) {
  const actCode = currentActCode(state)
  if (!actFlags(state).criminalCluesGainAloof) return false
  const setKeywords = api?.setEnemyKeywords || api?.scenario?.setEnemyKeywords
  let synced = 0
  for (const enemy of enemiesInPlay(state)) {
    if (!hasTrait(enemy, 'Criminal')) continue
    const enabled = (Number(enemy.clues) || 0) > 0
    if (typeof setKeywords === 'function') {
      ;(api?.setEnemyKeywords ? api : api.scenario).setEnemyKeywords(enemy, ['aloof'],
        { enabled, throughRound: Number(state.round) || 0 })
    } else {
      enemy.aloof = enabled
      enemy.printedAloof = enemy.printedAloof === undefined ? Boolean(enemy.aloof) : enemy.printedAloof
    }
    synced += 1
  }
  return synced > 0
}

function act2Back(state, api, code) {
  const isSheldonAct = code === ACT2_SHELDON_CODE
  const here = isSheldonAct ? 'hibbsRoadhouse' : 'laBellaLuna'
  const rivalBossCode = isSheldonAct ? '11511' : '11510'
  const rivalName = isSheldonAct ? '内奥米·欧巴尼恩' : '萨迪·谢尔顿'
  spawnAt(state, rivalBossCode, here, api)
  spawnAt(state, GANG_ENFORCER_CODE, here, api)
  spawnAt(state, GANG_SOLDIER_CODE, here, api)
  // 领队从遭遇牌库找到帮派士兵并生成在酒馆（引擎 encounter 管线由 api.drawEncounter/setAside 处理；
  // 直接调用按 spawAt 生成，保持与参考 findEncounterCard+createEnemyAt 等价的目标状态）。
  const boss = enemiesInPlay(state).find(enemy => GANG_BOSS_CODES.includes(codeOf(enemy)))
  const leadSeat = state.campaign?.leadSeat ?? state.currentSeat ?? 0
  if (boss && (Number(boss.clues) || 0) >= 1) {
    const rival = enemiesInPlay(state).find(enemy => codeOf(enemy) === rivalBossCode)
    if (rival && typeof api?.damageEnemy === 'function') api.damageEnemy(rival.id, 2, leadSeat)
    // 领队选择移动至多 2 个线索到同地点另一名非精英敌人（EnemyAt location, NonEliteEnemy）。
    const others = enemiesInPlay(state).filter(enemy => enemy.location === here && enemy !== boss
      && !enemy.elite && !GANG_BOSS_CODES.includes(codeOf(enemy)))
    const maxMove = Math.min(2, Number(boss.clues) || 0, others.length ? Number(boss.clues) || 0 : 0)
    if (others.length && maxMove > 0) {
      const options = Array.from({ length: maxMove + 1 }, (_, amount) => ({
        id: String(amount), label: amount === 0 ? '不移动线索' : `移动 ${amount} 个线索`,
      }))
      const picked = typeof api?.choose === 'function'
        ? api.choose({ kind: 'choice', source: code, seat: leadSeat,
          prompt: '欧巴尼恩帮/谢尔顿帮：选择从帮派头目身上移动到另一名非精英敌人的线索数量（至多 2）。', options })
        : String(maxMove)
      const amount = Math.max(0, Math.min(maxMove, Number(picked) || 0))
      for (let moved = 0; moved < amount; moved += 1) {
        const targetOptions = others.map(enemy => ({
          id: enemy.id, label: enemy.name || codeOf(enemy),
        }))
        const targetId = typeof api?.choose === 'function'
          ? api.choose({ kind: 'enemy', source: code, seat: leadSeat,
            prompt: '选择另一名位于本地点的非精英敌人接收 1 个线索。', options: targetOptions })
          : targetOptions[0]?.id
        const target = others.find(enemy => enemy.id === targetId) || others[0]
        if (!target) break
        let movedClues = 0
        if (typeof api?.takeEnemyClues === 'function' && typeof api?.moveClueToEnemy === 'function') {
          movedClues = api.takeEnemyClues(boss, leadSeat, 1) || 0
          if (movedClues > 0) {
            api.moveClueToEnemy(target, { from: 'investigator', seat: leadSeat })
            if (typeof api?.loseClues === 'function') api.loseClues(leadSeat, movedClues)
          }
        }
        if (!movedClues) break
      }
    }
  }
  for (const enemy of enemiesInPlay(state)) if ((Number(enemy.clues) || 0) > 0) enemy.engagedSeat = null
  syncCriminalAloof(state, api)
  info(api, `幕 2 背面：${rivalName} 与帮手找上门（${here}）；线索已按印刷转移，有线索的[[罪犯]]敌人获得冷漠。`)
  return true
}

/** 敌人生成：有线索的[[罪犯]]敌人冷漠保持同步。 */
export function enemySpawned(state, enemy, api = {}) {
  void enemy
  syncCriminalAloof(state, api)
  return false
}

/** 阶段开始：有线索的[[罪犯]]敌人冷漠保持同步（throughRound=本轮，逐阶段续期）。 */
export function phaseBegan(state, phase, api = {}) {
  void phase
  syncCriminalAloof(state, api)
  return false
}

function act3Back(state, api) {
  info(api, '幕 3 背面（帮派战争）：进入结局 1。')
  safeCall(api, 'finish', 'resolution1')
  setFlag(state, 'oneLastJobResolution', 'resolution1')
  return true
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === AGENDA1_CODE) return agenda1Back(state, api)
  if (code === AGENDA2_CODE) return agenda2Back(state, api)
  return false
}

function agenda1Back(state, api) {
  const mostClues = Math.max(0, ...activeInvestigators(state).map(inv => Number(inv.clues) || 0))
  const candidates = activeInvestigators(state).filter(inv => (Number(inv.clues) || 0) === mostClues)
  const target = candidates[0] || activeInvestigators(state)[0] || null
  const enforcer = target
    ? spawnAt(state, GANG_ENFORCER_CODE, target.location, api, { engagedSeat: target.seat })
    : null
  if (typeof api.shuffleDiscard === 'function') api.shuffleDiscard()
  else {
    state.encounterDeck = [...(state.encounterDeck || []), ...(state.encounterDiscard || [])]
    state.encounterDiscard = []
  }
  info(api, `议程 1 背面：帮派执行者${enforcer ? `生成并与${target.name}交战` : '未能生成'}；遭遇弃牌堆洗回遭遇牌库。`)
  return true
}

function agenda2Back(state, api) {
  let count = 0
  for (const inv of activeInvestigators(state)) {
    safeCall(api, 'addTrauma', inv.seat, 'physical', 1)
    if (typeof api.defeat === 'function') api.defeat(inv)
    else inv.defeated = true
    count += 1
  }
  info(api, `议程 2 背面：${count} 位调查员被击败并各承受 1 点肉体创伤。`)
  safeCall(api, 'finish', 'noResolution')
  setFlag(state, 'oneLastJobResolution', 'noResolution')
  return true
}


// ---------------------------------------------------------------------------
// 回合/目标
// ---------------------------------------------------------------------------
/** 11516 谈判破裂：一位调查员在本地点谈判后，附属敌人攻击该调查员（dispatch.js 既有钩子）。 */
export function afterParley(state, inv, enemy, api = {}) {
  if (!inv || inv.defeated || inv.resigned) return false
  const candidates = enemy ? [enemy] : (state.enemies || []).filter(item => item.location === inv.location)
  let attacked = 0
  for (const target of candidates) {
    if (!target || !state.enemies?.includes(target) || target.defeated) continue
    const attached = (target.attachments || []).some(item => codeOf(item) === '11516')
    if (!attached) continue
    safeCall(api, 'attack', target, inv)
    attacked += 1
  }
  if (attacked) info(api, `谈判破裂：${attacked} 名被附属的[[罪犯]]敌人攻击${inv.name}。`)
  return attacked > 0
}

export function checkObjectives(state, api = {}) {
  if (state.status && state.status !== 'playing') return false
  const code = currentActCode(state)
  if ([ACT1_V1_CODE, ACT1_V2_CODE].includes(code)) {
    const threshold = actClueThreshold(state)
    if (cluesOnAct(state) >= threshold) {
      info(api, `幕 1 目标达成：幕上线索 ${cluesOnAct(state)} / ${threshold}。`)
      safeCall(api, 'advanceAct')
      return true
    }
  }
  if ([ACT2_SHELDON_CODE, ACT2_OBANNION_CODE].includes(code)) {
    const boss = bossesInPlay(state)[0]
    const goal = bossClueGoal(state)
    if (boss && ((Number(boss.damageTaken) || 0) > 0 || (Number(boss.clues) || 0) >= goal)) {
      info(api, `幕 2 目标达成：${boss.name} 已被伤害/线索标记（${goal} 个线索目标）。`)
      safeCall(api, 'advanceAct')
      return true
    }
  }
  return false
}

export function roundEnded(state, api = {}) {
  const code = currentActCode(state)
  if ([ACT1_V1_CODE, ACT1_V2_CODE].includes(code)) {
    return checkObjectives(state, api)
  }
  if (code === ACT3_CODE) {
    const requireElite = Number(actFlags(state).eliteInVictory) || 0
    const eliteInVictory = (state.victoryDisplay || []).some(entry => {
      const card = ALL_CARDS[codeOf(entry)] || {}
      return (card.traits || []).includes('Elite') || entry.elite === true
    })
    if (requireElite > 0 && eliteInVictory) {
      info(api, '幕 3 目标达成：胜利区有[[精英]]敌人，进入结局 1。')
      safeCall(api, 'advanceAct')
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// 数值修正
// ---------------------------------------------------------------------------
/** 11513 帮派执行者：每轮首次「同地点调查员攻击另一名[[罪犯]]敌人」后重整并攻击该调查员。 */
/** 11511 内奥米·欧巴尼恩：每轮首次被成功躲避后重整；同地点任一调查员可受 1 伤害取消。 */
export function afterEvade(state, inv, enemy, result = null, api = {}) {
  if (!enemy || codeOf(enemy) !== '11511') return false
  void result
  const key = `${enemy.id}:${Number(state.round) || 0}`
  const handled = new Set(flagValue(state, 'oneLastJobNaomiRounds') || [])
  if (handled.has(key)) return false
  handled.add(key)
  setFlag(state, 'oneLastJobNaomiRounds', [...handled])
  const candidates = activeInvestigators(state).filter(item => item.location === enemy.location)
  let prevented = false
  if (candidates.length && typeof api?.choose === 'function') {
    const options = candidates.map(item => ({
      id: String(item.seat), label: `${item.name} 受到 1 点伤害，以取消重整`,
    }))
    options.push({ id: 'none', label: '不取消（内奥米重整）' })
    const pick = api.choose({ kind: 'choice', source: '11511', seat: inv?.seat ?? 0,
      prompt: '内奥米首次被躲避：是否有调查员受到 1 点伤害以取消她的重整？', options })
    const target = state.investigators?.[Number(pick)]
    if (pick !== 'none' && target && target.location === enemy.location && !target.defeated) {
      safeCall(api, 'damage', target.seat, 1)
      prevented = true
    }
  }
  if (!prevented) {
    enemy.exhausted = false
    info(api, '内奥米·欧巴尼恩本轮首次被躲避：重整她。')
  }
  return true
}

export function enemyAttackedSuccessfully(state, inv, enemy, api = {}) {
  if (!enemy || !inv || !hasTrait(enemy, 'Criminal')) return false
  const enforcer = (state.enemies || []).find(item => codeOf(item) === GANG_ENFORCER_CODE
    && item !== enemy && item.location === enemy.location)
  if (!enforcer) return false
  const key = `${enforcer.id}:${Number(state.round) || 0}`
  const handled = new Set(flagValue(state, 'oneLastJobEnforcerRounds') || [])
  if (handled.has(key)) return false
  handled.add(key)
  setFlag(state, 'oneLastJobEnforcerRounds', [...handled])
  enforcer.exhausted = false
  safeCall(api, 'attack', enforcer, inv)
  info(api, `帮派执行者：${inv.name} 攻击另一名罪犯敌人后，执行者重整并攻击。`)
  return true
}

/** 11514 帮派线人：发现线索后必须花费 3 资源或在当前议程放 1 毁灭。 */
export function cluesGained(state, inv, amount, api = {}) {
  if (!inv || Number(amount) <= 0) return false
  const informant = (state.enemies || []).find(item => codeOf(item) === GANG_INFORMANT_CODE
    && !item.exhausted && item.location === inv.location)
  if (!informant) return false
  const resources = Number(inv.resources) || 0
  const options = []
  if (resources >= 3) options.push({ id: 'spend', label: '花费 3 个资源' })
  options.push({ id: 'doom', label: '在当前议程上放置 1 个毁灭标记' })
  const choice = typeof api?.choose === 'function'
    ? api.choose({ kind: 'choice', source: GANG_INFORMANT_CODE, seat: inv.seat,
      prompt: '帮派线人：花费 3 个资源，或在当前议程上放置 1 个毁灭标记。', options })
    : (resources >= 3 ? 'spend' : 'doom')
  if (choice === 'spend' && resources >= 3) {
    safeCall(api, 'loseResources', inv.seat, 3)
    info(api, `帮派线人：${inv.name} 花费 3 个资源。`)
  } else {
    if (typeof api?.addDoom === 'function') api.addDoom(1)
    else state.doom = (Number(state.doom) || 0) + 1
    info(api, `帮派线人：${inv.name} 在当前议程上放置 1 个毁灭标记。`)
  }
  return true
}

/** 无图距离原语时的本地 BFS（连接图；不可达不计，按地点列表顺序稳定取第一个最近）。 */
function nearestByConnections(state, from, eligible) {
  const locations = state.locations || []
  if (!from) return null
  const seen = new Set([from])
  const queue = [from]
  while (queue.length) {
    const current = queue.shift()
    const location = locations.find(item => item.id === current)
    if (!location) continue
    const neighbors = [...(location.connections || [])]
    for (const id of neighbors) {
      if (seen.has(id)) continue
      seen.add(id)
      const candidate = locations.find(item => item.id === id)
      if (candidate && eligible(candidate)) return candidate.id
      queue.push(id)
    }
  }
  return null
}

/** 11514 生成：最近的、有线索的[[阿卡姆]]地点（api.mechanics.map.nearest；无原语时本地 BFS）。 */
export function spawnLocation(state, code, fallback, engagedSeat, api = {}) {
  if (String(code) !== GANG_INFORMANT_CODE) return fallback
  const eligible = location => Boolean(location) && hasTrait(location, 'Arkham')
    && (Number(location.clues) || 0) > 0
  const from = (state.investigators || [])[engagedSeat]?.location || fallback
  if (from && typeof api?.mechanics?.map?.nearest === 'function') {
    const [nearest] = api.mechanics.map.nearest(from, eligible)
    if (nearest) return nearest
  }
  const fromLocation = (state.locations || []).find(location => location.id === from)
  if (eligible(fromLocation)) return fromLocation.id
  const byGraph = nearestByConnections(state, from, eligible)
  if (byGraph) return byGraph
  return fallback
}

export function enemyStatModifier(state, enemy, stat) {
  const code = codeOf(enemy)
  if (code === '11510') {
    if (stat === 'health') return investigatorCount(state)
    if (stat === 'fight') return Math.min(3, Number(enemy.damageTaken) || 0)
  }
  if (code === '11511' && stat === 'health') return investigatorCount(state)
  return 0
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  return oneLastJobChaosToken(state, inv, token)
}

export function chaosTokenValue(state, inv, tokenFace) {
  return oneLastJobTokenValue(state, inv, tokenFace)
}

export function tokenMeanings() {
  return ONE_LAST_JOB_TOKEN_MEANINGS
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  const token = String(effect.token || '')
  if (token !== 'elderthing') return false
  if (effect.mode !== 'discardSpawnCriminal') return false
  const count = Number(effect.count) || (isHardSide(state) ? 6 : 3)
  const discarded = typeof api.discardEncounterTop === 'function'
    ? api.discardEncounterTop(count)
    : (() => {
      const cards = []
      for (let index = 0; index < count; index += 1) {
        if (!(state.encounterDeck || []).length) break
        cards.push(state.encounterDeck.pop())
      }
      state.encounterDiscard = [...(state.encounterDiscard || []), ...cards]
      return cards
    })()
  const criminals = (discarded || []).map(entry => typeof entry === 'string' ? entry : codeOf(entry))
    .filter(code => {
      const card = ALL_CARDS[code] || {}
      return card.type === 'enemy' && hasTrait(card, 'Criminal')
    })
  if (!criminals.length) {
    info(api, `[elder_thing]：弃掉 ${(discarded || []).length} 张遭遇牌，其中没有[[罪犯]]敌人。`)
    return true
  }
  const enemy = spawnAt(state, criminals[0], inv?.location || null, api, { engagedSeat: inv?.seat ?? null })
  if (enemy && effect.immediateAttack === true) safeCall(api, 'attack', enemy, inv)
  info(api, `[elder_thing]：生成「${enemy?.name || criminals[0]}」并与${inv?.name || '调查员'}交战。`)
  return true
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export function resolution(state, key, events = null, api = {}) {
  void events
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const records = recordsFor(state)
  if (finalKey === 'resolution1') records.rubyLostTheBet = true
  else records.rubyWonTheBet = true
  setFlag(state, 'oneLastJobResolvedTo', finalKey)
  const infoApi = api?.info ? api : api?.api || {}
  if (records.theInvestigatorsDiscoveredAnAlienLanguage === true) {
    addGlyph(state, 'A', 'Depths')
    info(infoApi, '结局：调查员发现的外星语言被翻译，符文 A = “深渊”。')
  }
  info(infoApi, finalKey === 'resolution1'
    ? '结局 1：记录「露比输了赌局」；进入幕间 I：无法拒绝的提议。'
    : '无结局：记录「露比赢了赌局」；进入幕间 I：无法拒绝的提议。')
  return { bonus: 0, award: true, flowData: { resolution: finalKey } }
}

// ---------------------------------------------------------------------------
// 只读投影
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  return {
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    actClues: cluesOnAct(state),
    clueThreshold: 2 + investigatorCount(state),
    criminals: criminalsInPlay(state).length,
    bosses: bossesInPlay(state).map(enemy => codeOf(enemy)),
    variant: flagValue(state, 'oneLastJobVariant') || null,
    setAside: [...(state.scenarioZones?.setAside || [])],
  }
}

export function implementedEntryFlags(code) {
  return flagsOf(code)
}

export function currencyOf(state, inv) {
  return criminalAtInvestigator(state, inv)
}

export function skullModifier(state) {
  return skullValue(state)
}

export const events = {
  oneLastJobParley(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat]
    return inv ? parleyAction(state, inv, api) : false
  },
  oneLastJobAlienLanguage(state, payload = {}, api = {}) {
    const inv = (state.investigators || [])[payload.seat]
    return inv ? alienLanguageAction(state, inv, api) : false
  },
}

export const behavior = {
  id: CHAPTER_ID,
  // Good Money（11611）跨章限制：campaign.ruleFlags.tdcNoUpkeepResources 命中时补给阶段不获得资源。
  canGainResources: (state, inv) => !tdcCannotGainUpkeepResources(state, inv),
  startLocation,
  locationsStartRevealed: true,
  roundEndActIndex: 0,
  preScenarioSetup,
  prepareScenario,
  setupScenario,
  setupLocations,
  locationPlaced,
  afterDeckSetup,
  actions,
  performAction,
  checkObjectives,
  afterParley,
  enemySpawned,
  phaseBegan,
  syncCriminalAloof,
  roundEnded,
  actReveal,
  agendaReveal,
  enemyStatModifier,
  enemyAttackedSuccessfully,
  afterEvade,
  cluesGained,
  spawnLocation,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  tokenMeanings,
  resolution,
  events,
  scenarioSummary,
  // 具名助手（测试/验收）
  act1ParleyCandidates,
  act2ParleySpec,
  currentActCode,
  currentAgendaCode,
  cluesOnAct,
  addGlyph,
  codeOf,
  GANG_BOSS_CODES,
  GANG_BOSS_BY_ACT2,
}

export { ACT_CODES, ALT_ACT_CODES, ACT1_V1_CODE, ACT1_V2_CODE, ACT2_SHELDON_CODE, ACT2_OBANNION_CODE, ACT3_CODE, AGENDA_CODES, START_LOCATION, SET_ASIDE_ALIASES, REMOVED_LOCATION_CODES }
