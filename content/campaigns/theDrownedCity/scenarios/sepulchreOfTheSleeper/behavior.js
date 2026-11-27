// 沉睡者墓穴（sepulchreOfTheSleeper · 11673）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheDrownedCity/SepulchreOfTheSleeper.hs +
//       Scenarios/TheDrownedCity/SepulchreOfTheSleeper/Helpers.hs +
//       Agenda|Location|Enemy/Cards/TheDrownedCity/SepulchreOfTheSleeper/*.hs +
//       Campaigns/TheDrownedCity.hs（DoStep 1–3 入场/跳过分支）+
//       frontend/src/locales/en/theDrownedCity/sepulchreOfTheSleeper.json。
//
// 引擎读点：preScenarioSetup / setupLocations / afterDeckSetup / canPlaceDoomOn / doomPlaced /
//   agendaReveal / checkObjectives / roundEnded / actions + performAction / enemyMoved /
//   enemyDefeated / enemyStatModifier / resolveChaosToken / applyTokenEffect / resolution。
//
// 任务/记录：入场门槛读 campaign.records 的 5 件神器与 discoveredGlyphs；resolution1 写
// theInvestigatorsHaltedCthulhusAwakening。
import { spliceHand } from '../../../../../src/engine/hand-icons.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { tdcCannotGainUpkeepResources } from '../../campaign-rules.js'
import {
  CHAPTER_ID, REFERENCE_CODE, CTHULHU_CODE, BENEATH_THE_CITY_CODE, CTHULHU_AWAKENED_CODE,
  AGENDA_CODES, AGENDA_STAGES, STAGE_CARDS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES,
  LOCATIONS, LOCATION_IDS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, START_LOCATION,
  ALCove_IDS, ALCove_OPTIONS, ALCove_CODE, ARTIFACT_RECORDS, ARTIFACT_RECORD_KEYS, ARTIFACT_CODE_BY_RECORD,
  GLYPH_TOTAL, EXPEDITION_ITEM_CODES, EXPEDITION_CODES, RESOLUTION_KEYS, RESOLUTIONS,
  disturbance as disturbanceOfDefinition,
} from './definition.js'
import {
  isHardSide, disturbance, setDisturbance, increaseDisturbance, disturbanceThreshold, skullValue,
  sepulchreChaosToken, sepulchreChaosTokenValue, DISTURBANCE_KEY,
} from './chaos.js'

const clone = value => structuredClone(value)
const info = (api, message) => api?.info?.(message)
const codeOf = value => String(value?.originalCode || value?.code || '')
const flagsFor = state => (state.scenarioFlags ||= {})
const setFlag = (state, key, value = true) => { flagsFor(state)[key] = value; return value }
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const activeInvestigators = state => (state.investigators || [])
  .filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const entryOf = code => (code ? registeredEntry(String(code)) : null)
const currentAgenda = state => (state.agendas || [])[state.agendaIndex ?? 0] || null
const currentAgendaCode = state => codeOf(currentAgenda(state))
const activeEnemy = (state, code) => (state.enemies || []).find(enemy => !enemy.defeated && codeOf(enemy) === code) || null

function addTrauma(state, api, seat, kind, amount) {
  if (typeof api?.addTrauma === 'function') return api.addTrauma(seat, kind, amount)
  state.campaign ||= {}
  state.campaign.trauma ||= {}
  state.campaign.trauma[seat] ||= { physical: 0, mental: 0 }
  state.campaign.trauma[seat][kind] += amount
  return true
}

// ---------------------------------------------------------------------------
// 入场门槛（Campaigns/TheDrownedCity.hs DoStep 1–3；战役流程层调用）
// ---------------------------------------------------------------------------
export function artifactsEarned(state) {
  const records = state?.campaign?.records || {}
  return ARTIFACT_RECORDS.filter(item => records[item.record] === true)
}
export function translatedGlyphCount(state) {
  const glyphs = state?.campaign?.records?.discoveredGlyphs
  if (!Array.isArray(glyphs)) return 0
  return new Set(glyphs.map(value => String(value).toUpperCase())).size
}
/** DoStep 1：至少 1 件神器且至少 10 个字形已翻译才读故事 2，否则跳 Interlude III。 */
export function entryPrepared(state) {
  return artifactsEarned(state).length >= 1 && translatedGlyphCount(state) >= 10
}
/** DoStep 2：5 件神器 + 26 个字形 + 内殿已解封 才读故事 3，否则加 0 标记并跳 Interlude III。 */
export function entryFullyPrepared(state) {
  const records = state?.campaign?.records || {}
  return artifactsEarned(state).length >= ARTIFACT_RECORDS.length
    && translatedGlyphCount(state) >= GLYPH_TOTAL
    && records.theInnerSanctumWasUnsealed === true
}
/**
 * 战役流程（DoStep 1–3）的只读判定：返回该用哪个入口分支。
 *   skip1 → 直接 Interlude III；skip2 → 加 0 标记后 Interlude III；
 *   choice → 读故事 3，由调查员选择「知道得更清楚 / 让它安息」；
 *   entry  → 已选择「让它安息」，开始本关 Setup。
 */
export function sepulchreEntry(state) {
  const artifacts = artifactsEarned(state).length
  const glyphs = translatedGlyphCount(state)
  const innerSanctum = state?.campaign?.records?.theInnerSanctumWasUnsealed === true
  if (artifacts < 1 || glyphs < 10) {
    return { branch: 'skip1', next: 'theAwakening', artifacts, glyphs, innerSanctum }
  }
  if (artifacts < ARTIFACT_RECORDS.length || glyphs < GLYPH_TOTAL || !innerSanctum) {
    return { branch: 'skip2', next: 'theAwakening', addZeroToken: true, artifacts, glyphs, innerSanctum }
  }
  return { branch: 'choice', choices: ['knowBetter', 'layItToRest'], artifacts, glyphs, innerSanctum }
}
/** DoStep 3「知道得更清楚」：记录 theInvestigatorsDidNotConfrontTheNightmare 并跳 Interlude III。 */
export function declineTheNightmare(state) {
  recordsFor(state).theInvestigatorsDidNotConfrontTheNightmare = true
  return { next: 'theAwakening', record: 'theInvestigatorsDidNotConfrontTheNightmare' }
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function prepareScenario(state, api = {}) {
  if (flagsFor(state).sepulchrePrepared) return flagsFor(state).sepulchreReport
  const source = state.scenario?.stageCards || STAGE_CARDS
  state.acts = [clone(ACT_STAGES_FALLBACK)].filter(Boolean)
  state.agendas = AGENDA_CODES.map(code => clone(source[code] || AGENDA_STAGES[code])).filter(Boolean)
  state.actIndex = 0
  state.agendaIndex = 0
  if (flagsFor(state)[DISTURBANCE_KEY] == null) setDisturbance(state, 0)
  const report = { agendaCodes: [...AGENDA_CODES], disturbance: disturbance(state),
    threshold: disturbanceThreshold(state), artifactRecords: ARTIFACT_RECORD_KEYS }
  setFlag(state, 'sepulchrePrepared', true)
  setFlag(state, 'sepulchreReport', report)
  info(api, `沉睡者墓穴：扰动 0（阈值 ${report.threshold}），议程 ${AGENDA_CODES.join(' / ')}。`)
  return report
}

const ACT_STAGES_FALLBACK = Object.freeze({
  id: 'act11673', code: REFERENCE_CODE, type: 'act', stage: '1a',
  name: '沉睡者墓穴', reveal: { type: 'campaignRule' },
  objective: { type: 'scenario', kind: 'defeatCthulhu' },
})

function locationInstance(state, id, revealed = false) {
  const base = state.scenario?.locations?.[id] || LOCATIONS[id]
  if (!base) return null
  const def = clone(base)
  const clues = def.cluesFixed ?? (def.cluesPerInvestigator != null
    ? def.cluesPerInvestigator * investigatorCount(state) : Number(def.clues) || 0)
  return {
    ...def, id, revealed,
    clues: revealed ? clues : 0, maxClues: clues,
    connections: [...(def.connections || [])], symbolLinks: [],
    attachments: [], damage: 0, horror: 0, resources: 0, doom: 0,
  }
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  prepareScenario(state, api)
  state.locations = []
  for (const id of LOCATION_IDS) {
    const instance = locationInstance(state, id, id === START_LOCATION)
    if (!instance) continue
    state.locations.push(instance)
    instance.grid = { ...LOCATION_COORDINATES[id] }
  }
  for (const location of state.locations) {
    location.connections = [...(LOCATION_CONNECTIONS[location.id] || [])]
    location.symbolLinks = [...(LOCATION_CONNECTIONS[location.id] || [])]
  }
  setFlag(state, 'sepulchreSetup', { locationIds: [...LOCATION_IDS], startLocation: START_LOCATION })
  info(api, `沉睡者墓穴：${state.locations.length} 处地点入场，调查员从「梦者安息地」开始。`)
  return [...LOCATION_IDS]
}

export function modifyDeck(state, deck, events = null, helper = {}) {
  void state
  void events
  void helper
  return [...deck]
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const report = { artifacts: 0, expeditionItems: 0 }
  report.artifacts = distributeArtifacts(state, api)
  report.expeditionItems = distributeExpeditionItems(state, api)
  setFlag(state, 'sepulchreSetupReport', report)
  info(api, `沉睡者墓穴：${report.artifacts} 件已获得神器与 ${report.expeditionItems} 件远征物品入场。`)
  return report
}

/** Setup：把已获得的神器尽量平均地分给调查员（每人神器数最少者优先）。 */
export function distributeArtifacts(state, api = {}) {
  const earned = artifactsEarned(state)
  let placed = 0
  for (const artifact of earned) {
    if ((state.investigators || []).some(inv => (inv.assets || []).some(asset => codeOf(asset) === artifact.code))) continue
    const counts = (state.investigators || []).map(inv => ({
      seat: inv.seat, count: (inv.assets || []).filter(asset => ARTIFACT_RECORDS.some(item => item.code === codeOf(asset))).length,
    }))
    if (!counts.length) break
    const fewest = Math.min(...counts.map(item => item.count))
    const candidates = counts.filter(item => item.count === fewest)
    const choice = typeof api?.choose === 'function' ? api.choose({
      kind: 'investigator', source: '11673-artifacts', seat: state.campaign?.leadSeat ?? candidates[0].seat, canSkip: false,
      prompt: `选择「${artifact.name}」的控制者（神器数最少者优先）。`,
      options: candidates.map(item => ({ id: String(item.seat), label: state.investigators[item.seat]?.name || `调查员${item.seat + 1}` })),
    }) : String(candidates[0].seat)
    const seat = candidates.find(item => String(item.seat) === String(choice))?.seat ?? candidates[0].seat
    const asset = { id: `artifact-${artifact.code}-${seat}`, code: artifact.code, originalCode: artifact.code,
      name: ALL_CARDS[artifact.code]?.nameZh || artifact.name, controllerSeat: seat, ownerSeat: seat,
      exhausted: false, tokens: 0, attachments: [], damage: 0, horror: 0, doom: 0, storyAsset: true }
    state.investigators[seat].assets ||= []
    state.investigators[seat].assets.push(asset)
    placed += 1
  }
  return placed
}

/** Setup：「按玩家顺序，每位玩家可以选择遭遇组的 1 件 Item 开始游戏时在自己的控制下」。 */
export function distributeExpeditionItems(state, api = {}) {
  const pool = [...EXPEDITION_ITEM_CODES]
  let placed = 0
  for (const inv of state.investigators || []) {
    if (!pool.length) break
    const choice = typeof api?.choose === 'function' ? api.choose({
      kind: 'card', source: '11673-expedition', seat: inv.seat, canSkip: true,
      prompt: '选择 1 件远征物品开始游戏时在自己的控制下。',
      options: [{ id: 'none', label: '不拿远征物品' }, ...pool.map((code, index) => ({ id: String(index), cardCode: code, label: ALL_CARDS[code]?.nameZh || code }))],
    }) : 'none'
    const index = pool.findIndex((_, itemIndex) => String(itemIndex) === String(choice))
    if (index < 0) continue
    const code = pool.splice(index, 1)[0]
    const asset = { id: `expedition-${code}-${inv.seat}`, code, originalCode: code,
      name: ALL_CARDS[code]?.nameZh || code, controllerSeat: inv.seat, ownerSeat: inv.seat,
      exhausted: false, tokens: 0, attachments: [], damage: 0, horror: 0 }
    inv.assets ||= []
    inv.assets.push(asset)
    placed += 1
  }
  setFlag(state, 'expeditionItemPool', pool)
  return placed
}

/** 直调/单测入口。 */
export function setupScenario(state, api = {}) {
  state.scenario ||= clone({
    id: CHAPTER_ID, originalCode: REFERENCE_CODE, locations: LOCATIONS, agendas: AGENDAS_FALLBACK(),
    stageCards: STAGE_CARDS, enemies: {}, treacheries: {}, storyAssets: {},
  })
  state.locations = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.sepulchrePrepared
  delete state.scenarioFlags.sepulchreReport
  state.enemies = []
  state.storyAssets ||= []
  const report = prepareScenario(state, api)
  setupLocations(state, null, { api })
  state.encounterDeck = typeof api?.shuffle === 'function' ? api.shuffle([...ENCOUNTER_DECK]) : [...ENCOUNTER_DECK]
  afterDeckSetup(state, null, { api })
  for (const inv of state.investigators || []) if (!inv.location) inv.location = START_LOCATION
  return { ...report, locationIds: [...LOCATION_IDS], encounterDeckSize: state.encounterDeck.length }
}

function AGENDAS_FALLBACK() {
  return AGENDA_CODES.map(code => clone(AGENDA_STAGES[code]))
}

// ---------------------------------------------------------------------------
// 扰动 / 毁灭替换 / Cthulhu
// ---------------------------------------------------------------------------
export function canPlaceDoomOn(state, card) {
  const agenda = currentAgendaCode(state)
  if (agenda !== BENEATH_THE_CITY_CODE) return true
  if (!card) return true
  const isEnemy = (state.enemies || []).includes(card) || card.type === 'enemy'
  if (!isEnemy) return true
  // 「一张非剧情支援卡牌将要被放置毁灭标记时：改为在剧本辅助卡上放置 1 个资源，作为扰动。」
  increaseDisturbance(state, 1)
  const current = disturbance(state)
  if (current >= disturbanceThreshold(state)) setFlag(state, 'sepulchreAdvancePending', true)
  return false
}

export function maybeAdvanceBeneathTheCity(state, api = {}) {
  if (!flagsFor(state).sepulchreAdvancePending) return false
  if (currentAgendaCode(state) !== BENEATH_THE_CITY_CODE) return false
  if (disturbance(state) < disturbanceThreshold(state)) return false
  setFlag(state, 'sepulchreAdvancePending', false)
  info(api, `扰动达到阈值（${disturbance(state)}）：立刻推进「城市之下」。`)
  if (typeof api.advanceAgenda === 'function') { api.advanceAgenda(); return true }
  return advanceBeneathTheCityLocal(state, api)
}

export function advanceBeneathTheCityLocal(state, api = {}) {
  const agenda = currentAgenda(state)
  if (!agenda) return false
  agenda.face = 'back'
  spawnCthulhu(state, api)
  state.doom = 0
  state.agendaIndex = (state.agendaIndex ?? 0) + 1
  if (!state.agendas[state.agendaIndex]) {
    if (typeof api.finish === 'function') api.finish('noResolution')
    else state.resolution = 'noResolution'
  }
  return true
}

export function spawnCthulhu(state, api = {}) {
  if (activeEnemy(state, CTHULHU_CODE)) return activeEnemy(state, CTHULHU_CODE)
  const def = state.scenario?.enemies?.[CTHULHU_CODE] || {}
  if (typeof api.spawn === 'function') {
    const spawned = api.spawn(CTHULHU_CODE, START_LOCATION, { exhausted: false })
    if (spawned) enemySpawned(state, spawned, api)
    return spawned
  }
  const enemy = {
    id: `cthulhu-${(state.enemies || []).length + 1}`, code: CTHULHU_CODE, originalCode: CTHULHU_CODE,
    name: ALL_CARDS[CTHULHU_CODE]?.nameZh || '克苏鲁', location: START_LOCATION,
    fight: def.fight ?? 5, evade: def.evade ?? 5, health: def.health ?? 20,
    damage: def.damage ?? 3, horror: def.horror ?? 3, traits: [...(def.traits || ['Ancient One', 'Elite'])],
    exhausted: false, engagedSeat: null, damageTaken: 0, doom: 0, clues: 0, attachments: [],
    victory: Number(def.victory) || 5, massive: true, relentless: true, hunter: true,
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  enemySpawned(state, enemy, api)
  info(api, '克苏鲁在「梦者安息地」生成。')
  return enemy
}

export function cthulhuInPlay(state) {
  return activeEnemy(state, CTHULHU_CODE)
}
export function cthulhuDefeated(state) {
  const victory = state.victoryDisplay || []
  if (victory.some(entry => codeOf(entry) === CTHULHU_CODE)) return true
  return Boolean(flagsFor(state).cthulhuDefeated)
}

/** 议程推进前（引擎 clearDoomInPlay 之前）：快照场上神器（含玩家控制与剧情资产）上的毁灭。 */
export function agendaAdvancing(state, agenda, api = {}) {
  void api
  if (codeOf(agenda) !== BENEATH_THE_CITY_CODE) return false
  const snapshot = []
  for (const inv of state.investigators || []) {
    for (const asset of inv.assets || []) {
      if (!ARTIFACT_RECORDS.some(item => item.code === codeOf(asset))) continue
      if ((Number(asset.doom) || 0) > 0) snapshot.push({ id: asset.id, code: codeOf(asset), doom: Number(asset.doom) })
    }
  }
  for (const asset of state.storyAssets || []) {
    if (!ARTIFACT_RECORDS.some(item => item.code === codeOf(asset))) continue
    if ((Number(asset.doom) || 0) > 0) snapshot.push({ id: asset.id, code: codeOf(asset), doom: Number(asset.doom) })
  }
  setFlag(state, 'sepulchreArtifactDoomBeforeAdvance', snapshot)
  return snapshot.length > 0
}

/** 推进后回填神器毁灭（其他卡牌上的毁灭按规则清空）。 */
export function restoreArtifactDoom(state, api = {}) {
  const snapshot = flagsFor(state).sepulchreArtifactDoomBeforeAdvance
  if (!Array.isArray(snapshot) || !snapshot.length) return 0
  const assets = [
    ...(state.investigators || []).flatMap(inv => inv.assets || []),
    ...(state.storyAssets || []),
  ]
  let restored = 0
  for (const entry of snapshot) {
    const asset = assets.find(item => item.id === entry.id)
      || assets.find(item => codeOf(item) === entry.code && (Number(item.doom) || 0) === 0)
    if (!asset) continue
    asset.doom = Math.max(Number(asset.doom) || 0, entry.doom)
    restored += 1
  }
  setFlag(state, 'sepulchreArtifactDoomBeforeAdvance', [])
  info(api, `城市之下推进：保留神器上的毁灭（${restored} 件）。`)
  return restored
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === BENEATH_THE_CITY_CODE) {
    spawnCthulhu(state, api)
    restoreArtifactDoom(state, api)
    info(api, '城市之下（背面）：克苏鲁在梦者安息地生成。')
    return true
  }
  if (code === CTHULHU_AWAKENED_CODE) {
    for (const inv of activeInvestigators(state)) {
      if (typeof api.drivenInsane === 'function') api.drivenInsane(inv.seat)
      else { inv.defeated = true; inv.drivenInsane = true; inv.defeatCause = 'insane' }
    }
    info(api, '你无法逃避的毁灭：每位存活调查员陷入发疯，战役失败。')
    if (typeof api.finish === 'function') api.finish('noResolution')
    else state.resolution = 'noResolution'
    return true
  }
  return false
}

/** 11676 梦者安息地：一位调查员在本地点检定失败后 → +1 扰动。 */
export function afterTest(state, inv, result, api = {}, context = {}) {
  if (!inv || result?.success === true) return false
  const here = locationOf(state, inv.location)
  if (!here || here.id !== START_LOCATION) return false
  const value = increaseDisturbance(state, 1)
  info(api, `[梦者安息地] ${inv.name || inv.seat} 检定失败：扰动 +${1}（当前 ${value}）。`)
  void context
  return true
}

/** 印刷「无情」用 P7 关键词覆盖声明：生成与每轮神话阶段开始时按印刷值重新启用。 */
function setEnemyRelentless(state, enemy, enabled, api = {}) {
  const scenarioApi = api?.scenario || api
  if (typeof scenarioApi?.setEnemyKeywords !== 'function') return false
  return scenarioApi.setEnemyKeywords(enemy, ['relentless'], { enabled, throughRound: state.round })
}

export function enemySpawned(state, enemy, api = {}) {
  if (!enemy || codeOf(enemy) !== CTHULHU_CODE) return false
  return setEnemyRelentless(state, enemy, true, api)
}

export function phaseBegan(state, phase, api = {}) {
  if (String(phase) !== 'mythos') return false
  const cthulhu = cthulhuInPlay(state)
  if (!cthulhu) return false
  return setEnemyRelentless(state, cthulhu, true, api)
}

/** 11674b 克苏鲁：被躲避后 → 重整他，或他所在地点每位调查员受 1 点直接伤害。 */
export function afterEvade(state, inv, enemy, result = null, api = {}) {
  if (!enemy || codeOf(enemy) !== CTHULHU_CODE) return false
  const here = locationOf(state, enemy.location)
  const choice = typeof api?.choose === 'function' ? api.choose({ kind: 'effect', source: CTHULHU_CODE, seat: inv?.seat ?? 0,
    prompt: '克苏鲁被躲避：重整他，或他所在地点每位调查员受到 1 点直接伤害。',
    options: [{ id: 'ready', label: '重整克苏鲁' }, { id: 'damage', label: '每位调查员受到 1 点直接伤害' }] }) : 'ready'
  if (choice === 'damage') {
    for (const other of (state.investigators || []).filter(item => !item.defeated && item.resigned !== true && item.location === enemy.location)) {
      if (typeof api.damage === 'function') api.damage(other.seat, 1, { code: codeOf(enemy), sourceEnemyId: enemy.id })
      else other.damage = (Number(other.damage) || 0) + 1
    }
    info(api, '克苏鲁被躲避：他所在地点每位调查员受到 1 点直接伤害。')
  } else {
    enemy.exhausted = false
    if (typeof api.readyEnemy === 'function') api.readyEnemy(enemy)
    info(api, '克苏鲁被躲避：重整他。')
  }
  void here
  void result
  return true
}

/** Good Money（11611）「下一章维护阶段不能获得资源」：跨章标记由 campaign-rules.js 统一判定（phases.js 补给阶段读点）。 */
export function canGainResources(state, inv) {
  return !tdcCannotGainUpkeepResources(state, inv)
}

export function doomPlaced(state, context = {}, api = {}) {
  if (!context?.agenda || Number(context.amount) <= 0) return false
  if (currentAgendaCode(state) !== CTHULHU_AWAKENED_CODE) return false
  for (const inv of activeInvestigators(state)) {
    if (typeof api.horror === 'function') api.horror(inv.seat, 1)
    else inv.horror = (Number(inv.horror) || 0) + 1
  }
  info(api, '[克苏鲁苏醒] 本密谋放置毁灭：每位调查员受到 1 点直接恐惧。')
  return true
}

export function enemyMoved(state, enemy, previous, api = {}) {
  if (!enemy || codeOf(enemy) !== CTHULHU_CODE) return false
  const here = locationOf(state, enemy.location)
  if (!here || !ALCove_IDS.includes(here.id)) return false
  const alcove = ALCove_OPTIONS[here.id] || {}
  for (const inv of activeInvestigators(state)) {
    switch (here.id) {
      case 'sigilCarvedAlcoveAmbition':
        if (typeof api.discardRandom === 'function') api.discardRandom(inv.seat, 1)
        else if ((inv.hand || []).length) spliceHand(inv, -1, 1)[0]
        break
      case 'sigilCarvedAlcoveResilience':
        if (typeof api.damage === 'function') api.damage(inv.seat, 1)
        else inv.damage = (Number(inv.damage) || 0) + 1
        break
      case 'sigilCarvedAlcoveInfinity':
        if (typeof api.horror === 'function') api.horror(inv.seat, 1)
        else inv.horror = (Number(inv.horror) || 0) + 1
        break
      case 'sigilCarvedAlcoveDefiance':
        inv.resources = Math.max(0, (Number(inv.resources) || 0) - 2)
        break
      case 'sigilCarvedAlcoveVoyage':
        inv.removedFromGame ||= []
        if ((inv.deck || []).length) inv.removedFromGame.push(inv.deck.pop())
        break
      default:
        break
    }
  }
  info(api, `克苏鲁进入「${here.name}」：结算该壁龛的强制效果（${alcove.artifactRecord || '—'}）。`)
  return true
}

export function enemyDefeated(state, enemy, api = {}) {
  if (!enemy || codeOf(enemy) !== CTHULHU_CODE) return false
  setFlag(state, 'cthulhuDefeated', true)
  info(api, '克苏鲁被击败：调查员阻止了古老邪恶的苏醒（结局 1）。')
  if (typeof api.finish === 'function') api.finish('resolution1')
  else state.resolution = 'resolution1'
  return true
}

/** 以神器削弱克苏鲁：[fast] 从你控制的一件神器上移除 1 点毁灭 → 克苏鲁本回合失去无情且 -1 战斗/-1 躲避。 */
export function weakenCthulhu(state, inv, api = {}) {
  const cthulhu = cthulhuInPlay(state)
  if (!cthulhu || !inv) return false
  if (flagsFor(state).cthulhuWeakenedRound === state.round) return false
  const artifact = (inv.assets || []).find(asset => ARTIFACT_RECORDS.some(item => item.code === codeOf(asset))
    && (Number(asset.doom) || 0) > 0 && flagsFor(state)[`weakened-${asset.id}-${state.round}`] !== true)
  if (!artifact) return false
  artifact.doom = Math.max(0, (Number(artifact.doom) || 0) - 1)
  // 印刷：「克苏鲁本轮失去无情」——用 P7 关键词覆盖（throughRound=当前轮），过期自动回到印刷值。
  setEnemyRelentless(state, cthulhu, false, api)
  setFlag(state, `weakened-${artifact.id}-${state.round}`, true)
  setFlag(state, 'cthulhuWeakenedRound', state.round)
  info(api, `从「${artifact.name}」移除 1 点毁灭：克苏鲁本回合失去无情，且战斗/躲避 -1。`)
  return true
}

export function enemyStatModifier(state, enemy, stat) {
  if (!enemy || codeOf(enemy) !== CTHULHU_CODE) return 0
  if (flagsFor(state).cthulhuWeakenedRound !== state.round) return 0
  return stat === 'fight' || stat === 'evade' ? -1 : 0
}

// ---------------------------------------------------------------------------
// 行动（刻印壁龛）
// ---------------------------------------------------------------------------
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here || !ALCove_IDS.includes(here.id)) return []
  const options = ALCove_OPTIONS[here.id] || {}
  const artifact = artifactInPlay(state, options.artifactRecord)
  if (!artifact) {
    return [{ action: 'scenarioAction', rule: 'sepulchreAlcove', locationId: here.id, actions: 1,
      reason: `对应的神器（${artifactRecordName(options.artifactRecord)}）不在场上` }]
  }
  const groupClues = activeInvestigators(state).filter(other => other.location === here.id)
    .reduce((sum, other) => sum + (Number(other.clues) || 0), 0)
  const cost = investigatorCount(state)
  return [{
    action: 'scenarioAction', rule: 'sepulchreAlcove', locationId: here.id, actions: 1,
    label: options.skill
      ? `检定[${options.skill}](5)：成功在「${artifact.name}」上放置 1 个毁灭标记；随后可团队花费 ${cost} 个线索再放 1 个`
      : `团队花费 ${cost} 个线索：在「${artifact.name}」上放置 1 个毁灭标记`,
    reason: options.skill || groupClues >= cost ? null : '线索不足',
  }]
}

const artifactRecordName = record => ARTIFACT_RECORDS.find(item => item.record === record)?.name || record
export function artifactInPlay(state, record) {
  const code = ARTIFACT_CODE_BY_RECORD[record]
  if (!code) return null
  for (const inv of state.investigators || []) {
    const asset = (inv.assets || []).find(item => codeOf(item) === code)
    if (asset) return asset
  }
  return (state.storyAssets || []).find(asset => codeOf(asset) === code) || null
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || move.rule !== 'sepulchreAlcove') return false
  const options = ALCove_OPTIONS[move.locationId] || {}
  const artifact = artifactInPlay(state, options.artifactRecord)
  if (!artifact) return false
  const placeDoom = () => {
    if (typeof api.placeDoomOnCard === 'function') api.placeDoomOnCard(artifact, 1)
    else artifact.doom = (Number(artifact.doom) || 0) + 1
    return true
  }
  if (!options.skill) {
    const groupClues = activeInvestigators(state).filter(other => other.location === move.locationId)
      .reduce((sum, other) => sum + (Number(other.clues) || 0), 0)
    if (groupClues < investigatorCount(state)) return false
    spendGroupClues(state, move.locationId, investigatorCount(state))
    return placeDoom()
  }
  if (typeof api.test !== 'function') return false
  let success = false
  api.test(inv.seat, options.skill, 5, result => { success = result?.success === true })
  if (!success) return true
  placeDoom()
  const required = investigatorCount(state)
  const groupClues = activeInvestigators(state).filter(other => other.location === move.locationId)
    .reduce((sum, other) => sum + (Number(other.clues) || 0), 0)
  if (groupClues >= required) {
    const choice = typeof api?.choose === 'function' ? api.choose({
      kind: 'effect', source: move.locationId, seat: inv.seat, canSkip: true,
      prompt: `团队花费 ${required} 个线索，在「${artifact.name}」上额外放置 1 个毁灭标记？`,
      options: [{ id: 'skip', label: '不额外放置' }, { id: 'place', label: '额外放置 1 个毁灭标记' }],
    }) : 'skip'
    if (choice === 'place' && spendGroupClues(state, move.locationId, required)) placeDoom()
  }
  return true
}

function spendGroupClues(state, locationId, amount) {
  let remaining = Math.max(0, Math.trunc(Number(amount) || 0))
  for (const inv of activeInvestigators(state)) {
    if (inv.location !== locationId || remaining <= 0) continue
    const spend = Math.min(remaining, Number(inv.clues) || 0)
    inv.clues -= spend
    remaining -= spend
  }
  return remaining === 0
}

// ---------------------------------------------------------------------------
// 目标 / 回合 / 混乱标记
// ---------------------------------------------------------------------------
export function checkObjectives(state, api = {}) {
  if (maybeAdvanceBeneathTheCity(state, api)) return true
  if (cthulhuDefeated(state) && state.scenarioFlags?.cthulhuResolved !== true) {
    setFlag(state, 'cthulhuResolved', true)
    if (typeof api.finish === 'function') api.finish('resolution1')
    else state.resolution = 'resolution1'
    return true
  }
  return false
}

export function roundEnded(state, api = {}) {
  return maybeAdvanceBeneathTheCity(state, api)
}

export function resolveChaosToken(state, inv, token) {
  return sepulchreChaosToken(state, inv, token)
}
export function chaosTokenValue(state, tokenFace) {
  return sepulchreChaosTokenValue(state, tokenFace)
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  const mode = effect?.mode
  if (mode === 'revealAnother') {
    if (typeof api.revealToken !== 'function') return false
    const token = api.revealToken(inv?.seat ?? 0)
    info(api, `[elder_thing]：再揭示一个标记（${token}）。`)
    return true
  }
  if (mode === 'drawEncounterOnFail') {
    if (typeof api.drawEncounter !== 'function') return false
    const failedBy = Number(effect?.test?.failedBy) || 0
    api.drawEncounter(inv?.seat ?? 0, failedBy >= 3 ? { peril: true, grantSurge: true } : undefined)
    info(api, `[cultist]：检定失败，抽取遭遇牌库顶牌${failedBy >= 3 ? '（该牌获得险境与涌动）' : ''}。`)
    return true
  }
  if (mode === 'horrorOrDiscardPerFail') {
    const failedBy = Math.max(0, Number(effect?.test?.failedBy) || 0)
    let handled = 0
    for (let index = 0; index < failedBy; index++) {
      const hasCards = (inv?.hand || []).length > 0
      const choice = typeof api?.choose === 'function' ? api.choose({
        kind: 'effect', source: '11673-tablet', seat: inv?.seat ?? 0, canSkip: false,
        prompt: '[tablet]：选择受到 1 点恐惧或弃 1 张手牌。',
        options: [...(hasCards ? [{ id: 'discard', label: '弃 1 张手牌' }] : []), { id: 'horror', label: '受到 1 点恐惧' }],
      }) : (hasCards ? 'discard' : 'horror')
      if (choice === 'discard' && hasCards) {
        if (typeof api.discardRandom === 'function') api.discardRandom(inv.seat, 1)
        else spliceHand(inv, -1, 1)[0]
      } else if (typeof api.horror === 'function') api.horror(inv.seat, 1)
      else inv.horror = (Number(inv.horror) || 0) + 1
      handled += 1
    }
    info(api, `[tablet]：失败 ${handled} 点，逐点选择恐惧或弃牌。`)
    return handled > 0
  }
  return false
}

/** 败退附加结算（印刷 Investigator Defeat）：败退调查员发疯；若无人存活则战役失败。 */
export function investigatorDefeatResolution(state, api = {}) {
  const defeated = (state.investigators || []).filter(inv => inv.defeated)
  const survivors = (state.investigators || []).filter(inv => !inv.defeated)
  for (const inv of defeated) {
    inv.drivenInsane = true
    if (typeof api.drivenInsane === 'function') api.drivenInsane(inv.seat)
  }
  return { defeated: defeated.map(inv => inv.seat), survivors: survivors.length, campaignLost: survivors.length === 0 }
}

export function resolution(state, key, events = null, api = {}) {
  void events
  const records = recordsFor(state)
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const defeat = investigatorDefeatResolution(state, api)
  if (finalKey === 'resolution1') {
    records.theInvestigatorsHaltedCthulhusAwakening = true
    for (const inv of state.investigators || []) {
      addTrauma(state, api, inv.seat, 'mental', 2)
    }
    info(api, '结局 1：调查员阻止了克苏鲁的苏醒，赢得战役（+10 奖励经验、每人 2 点精神创伤）。')
    return { bonus: 10, award: true, campaignWin: true, next: 'epilogue', defeat }
  }
  info(api, '无结局：所有调查员都被击败或发疯，战役失败。')
  return { bonus: 0, award: true, campaignWin: false, next: null, defeat }
}

// ---------------------------------------------------------------------------
// 只读投影
// ---------------------------------------------------------------------------
export function implementedEntryFlags(code) {
  return entryOf(code)?.flags || {}
}

export function scenarioSummary(state) {
  const cthulhu = cthulhuInPlay(state)
  return {
    agenda: currentAgendaCode(state),
    disturbance: disturbance(state),
    threshold: disturbanceThreshold(state),
    skull: skullValue(state),
    artifacts: artifactsEarned(state).map(item => item.record),
    glyphs: translatedGlyphCount(state),
    cthulhu: cthulhu ? { location: cthulhu.location, health: cthulhu.health } : null,
    cthulhuDefeated: cthulhuDefeated(state),
    locations: (state.locations || []).length,
    encounterDeck: (state.encounterDeck || []).length,
  }
}

export function neighborsOf(state, locationId) {
  return (LOCATION_CONNECTIONS[locationId] || []).filter(id => locationOf(state, id))
}

export const behavior = {
  id: CHAPTER_ID,
  startLocation: () => START_LOCATION,
  locationsStartRevealed: false,
  preScenarioSetup,
  prepareScenario,
  setupScenario,
  setupLocations,
  modifyDeck,
  afterDeckSetup,
  canPlaceDoomOn,
  canGainResources,
  doomPlaced,
  afterTest,
  afterEvade,
  agendaReveal,
  agendaAdvancing,
  restoreArtifactDoom,
  checkObjectives,
  roundEnded,
  actions,
  performAction,
  enemyMoved,
  enemySpawned,
  phaseBegan,
  enemyDefeated,
  enemyStatModifier,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  resolution,
  scenarioSummary,
  // 具名助手
  artifactsEarned,
  translatedGlyphCount,
  entryPrepared,
  entryFullyPrepared,
  sepulchreEntry,
  declineTheNightmare,
  distributeArtifacts,
  distributeExpeditionItems,
  spawnCthulhu,
  cthulhuInPlay,
  cthulhuDefeated,
  weakenCthulhu,
  artifactInPlay,
  maybeAdvanceBeneathTheCity,
  advanceBeneathTheCityLocal,
  afterTest,
  afterEvade,
  canGainResources,
  agendaAdvancing,
  restoreArtifactDoom,
  investigatorDefeatResolution,
  neighborsOf,
  locationOf,
  disturbance,
  disturbanceThreshold,
}

export function preScenarioSetup(state) {
  prepareScenario(state)
  return { entry: sepulchreEntry(state), agendaCodes: [...AGENDA_CODES] }
}

export { CTHULHU_CODE, BENEATH_THE_CITY_CODE, CTHULHU_AWAKENED_CODE, AGENDA_CODES, RESOLUTION_KEYS, START_LOCATION }
