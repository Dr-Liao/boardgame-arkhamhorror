// 外神之战（warOfTheOuterGods · 86001）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/WarOfTheOuterGods.hs + Helpers.hs + Act|Agenda|Location|Enemy|Treachery
//       /CardDefs/WarOfTheOuterGods.hs。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup / startLocation / setupLocations / locationPlaced / afterDeckSetup → 布置
//   actions / performAction → 幕 2/3 封 portal（放线索到 Hub Dimension 周围）、Hub 行动、地点一次性行动、
//                             「结算战争」（warring 移动/攻击的单桌近似入口）
//   phaseBegan → 神话阶段：按阵营顺序给三套议程各放 1 毁灭并检查 6 点阈值（终局→战争结束）
//   actReveal / agendaReveal → 幕 1 背面 / 阵营终局议程（warIsOver：Hub 翻面、上古存在入场、败方退场）
//   agendaWouldAdvance → 三套议程由本文件记账，禁用引擎单议程轨自动推进
//   checkObjectives → 幕 1（战争结束）、幕 2（封住 Hub）、幕 3（每个阵营都封住→结局 1）
//   enemySpawned / enemyDefeated → 记录上古存在；击败 Silenus/Magh'an Ark'at/Ezel-zen-rezl → 结局 3/4/2
//   spawnLocation → 阵营敌人 Spawn 指示
//   resolveChaosToken / applyTokenEffect / tokenMeanings → 混乱标记（普通/困难两档）
//   resolution → 声明式结局 effects（记录 / 故事资产奖励 / 战败）
//
// 近似（status.json risks 同口径）：
//   · 引擎只有单议程轨：三套阵营议程进度记在 scenarioFlags.wog.factions，state.agendas 同时持有
//     三张 1a 供 UI 展示；终局时替换为胜方终局议程。跨桌 epic multiplayer 的「每桌阈值/共享结局」
//     需要引擎支持（primitive request wog-epic-multiplayer）。
//   · warring 的敌人阶段自动移动/攻击未接入引擎敌人阶段，改为 scenarioAction「结算战争」手动结算
//     （tests 用它推进；普通流程需玩家点一次，属近似）。
//   · 线索「around Hub Dimension」用计数记账（scenarioFlags.wog.cluesAroundHub），不放实体标记。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT1_CODE, ACT2_CODE, ACT3_CODE, ACT_CODES, ACT_STAGES, ACTS,
  FACTION_KEYS, FACTION_LABEL, FACTION_AGENDA_CODES, FACTION_FINAL_AGENDA, FACTION_ANCIENT_ONE,
  FACTION_ENEMIES, AGENDA_STAGES, INITIAL_AGENDAS, FINAL_AGENDAS, STAGE_CARDS, RESOLUTION_KEYS,
  ENCOUNTER_DECK, ENCOUNTER_GROUPS, LOCATION_TABLE, LOCATIONS, STATIC_CONNECTIONS,
  START_LOCATION, HUB_CODE, HUB_REVEALED_CODE, RITUAL_SITE_IDS, SET_ASIDE_ALIASES,
  STORY_ASSET_CODES, ANCIENT_ONE_CODES, FINAL_AGENDA_CODES, SET_ASIDE_CODES, SCENARIO_TEXT,
} from './definition.js'

const CHAPTER_ID = 'warOfTheOuterGods'
const clone = value => structuredClone(value)
const codeOf = value => String(value?.originalCode || value?.code || '')
const info = (api, message) => api?.info?.(message)
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const flagsFor = state => (state.scenarioFlags ||= {})
const flagValue = (state, key) => flagsFor(state)[key]
const setFlag = (state, key, value = true) => { flagsFor(state)[key] = value; return value }
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const currentActCode = state => codeOf((state.acts || [])[state.actIndex ?? 0])
const currentAgendaCode = state => codeOf((state.agendas || [])[state.agendaIndex ?? 0])
const isHardSide = state => state.difficulty === 'hard' || state.difficulty === 'expert'
const wogState = state => flagValue(state, 'wog') || {}
const setWogState = (state, patch) => setFlag(state, 'wog', { ...wogState(state), ...patch })
const factionOfCard = code => FACTION_KEYS.find(key => FACTION_ENEMIES[key].includes(code)
  || FACTION_AGENDA_CODES[key].includes(code) || FACTION_FINAL_AGENDA[key] === code
  || FACTION_ANCIENT_ONE[key] === code) || null
const locLabel = (state, id) => LOCATIONS[id]?.name || locationOf(state, id)?.name || id

function defaultFactions() {
  return Object.fromEntries(FACTION_KEYS.map(key => [key, { step: 1, doom: 0, wards: 0 }]))
}

function spawnEnemyAt(state, code, locationId, api, options = {}) {
  if (typeof api?.spawn === 'function') {
    const enemy = api.spawn(code, locationId, options)
    if (enemy) return enemy
  }
  const definition = (state.scenario?.enemies || {})[code] || {}
  const enemy = {
    id: `${code}-${state.round}-${(state.enemies?.length || 0) + 1}`, code, originalCode: code,
    name: definition.name || ALL_CARDS[code]?.name || code,
    fight: definition.fight ?? ALL_CARDS[code]?.fight ?? 1,
    evade: definition.evade ?? ALL_CARDS[code]?.evade ?? 1,
    health: definition.health ?? ALL_CARDS[code]?.health ?? 1,
    damage: definition.damage || 0, horror: definition.horror || 0,
    damageTaken: 0, doom: 0, location: locationId ?? null, engagedSeat: options.engagedSeat ?? null,
    exhausted: false,
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  return enemy
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function prepareScenario(state, api = {}) {
  if (flagValue(state, 'wog')) return wogState(state)
  state.acts = ACT_CODES.map(code => clone(STAGE_CARDS[code] || ACT_STAGES[code]))
  state.agendas = INITIAL_AGENDAS.map(card => clone(card))
  state.actIndex = Number.isInteger(state.actIndex) ? state.actIndex : 0
  state.agendaIndex = Number.isInteger(state.agendaIndex) ? state.agendaIndex : 0
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  setWogState(state, {
    factions: defaultFactions(),
    ancients: {}, warOver: false, winner: null,
    cluesAroundHub: 0, sealedGroups: 0, defeatedFactions: [],
  })
  info(api, '外神之战：三方阵营各 1 张 1a 议程入场（绿→蓝→红），毁灭阈值各 6。')
  return wogState(state)
}

export function preScenarioSetup(state, events, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  return prepareScenario(state, api)
}

export function startLocation() {
  return START_LOCATION
}

export function applyHubConnections(state) {
  const hub = locationOf(state, HUB_CODE)
  if (!hub) return []
  const ritual = RITUAL_SITE_IDS.filter(id => locationOf(state, id))
  hub.connections = [...ritual]
  for (const id of ritual) {
    const location = locationOf(state, id)
    location.connections = [...new Set([...(location.connections || []), HUB_CODE])]
  }
  return ritual
}

export function setupLocations(state, events, helper = {}) {
  void events
  const api = helper?.api || {}
  prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...SET_ASIDE_ALIASES]
  state.encounterDeck ||= [...ENCOUNTER_DECK]
  const placed = LOCATION_TABLE.filter(([, , setAside]) => setAside !== true).map(([id]) => id)
  applyHubConnections(state)
  info(api, `外神之战：${placed.length} 张地点入场（Hub Dimension 放一边），阵营议程 3 套。`)
  return placed
}

export function locationPlaced(state, location, api = {}, seat = null) {
  void api
  void seat
  if (!location) return
  const id = location.id || codeOf(location)
  if (id === 'hubDimension') { location.revealed = false; return }
  location.revealed = true
  const card = ALL_CARDS[codeOf(location)] || {}
  const perPlayer = Number(card.clues ?? location.clues)
  location.clues = Math.max(0, (Number.isFinite(perPlayer) ? perPlayer : 0) * investigatorCount(state))
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  prepareScenario(state, api)
  state.scenarioZones ||= {}
  state.scenarioZones.setAside ||= [...SET_ASIDE_ALIASES]
  if (!state.encounterDeck?.length) state.encounterDeck = [...ENCOUNTER_DECK]
  applyHubConnections(state)
  // 布置：3 张邪教徒按 Spawn 指示生成（Disciple→Burning Pit / Stargazer→Athenaeum / Zealot→Shrine）。
  const spawns = [['86029', 'theBurningPit'], ['86025', 'athenaeumOfTheEmptySky'], ['86027', 'shrineOfMaghanArkat']]
  for (const [code, locationId] of spawns) {
    if (!(state.enemies || []).some(enemy => codeOf(enemy) === code)) spawnEnemyAt(state, code, locationId, api)
  }
  info(api, '外神之战布置完成：3 名邪教徒入场、5 件故事资产放一边、剩余遭遇牌洗为牌库。')
  return { locations: state.locations?.length || 0, factions: wogState(state).factions }
}

/** 单测/直调入口。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.wog
  const report = prepareScenario(state, api)
  for (const [id, , setAside] of LOCATION_TABLE) {
    if (setAside === true) continue
    const instance = { ...clone(LOCATIONS[id]), clues: 0, revealed: true, connections: [...(STATIC_CONNECTIONS[id] || [])] }
    state.locations.push(instance)
    locationPlaced(state, instance, api)
  }
  applyHubConnections(state)
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = START_LOCATION
  state.encounterDeck = [...ENCOUNTER_DECK]
  afterDeckSetup(state, null, { api })
  return { ...report, placedIds: state.locations.map(location => location.id) }
}

// ---------------------------------------------------------------------------
// 战争进度（三套阵营议程）
// ---------------------------------------------------------------------------
export function factionStates(state) {
  return wogState(state).factions || defaultFactions()
}

export function addDoomToFaction(state, faction, amount = 1, api = {}) {
  const factions = factionStates(state)
  const entry = factions[faction]
  if (!entry || wogState(state).warOver) return null
  entry.doom = Number(entry.doom || 0) + Number(amount || 0)
  setWogState(state, { factions })
  let result = null
  while (!wogState(state).warOver && Number(entry.doom || 0) >= 6) {
    const excess = Number(entry.doom) - 6
    entry.doom = 0
    entry.step = Number(entry.step || 1) + 1
    setWogState(state, { factions })
    result = { step: entry.step, excess }
    info(api, `⚔️ ${FACTION_LABEL[faction]}方阵营议程推进到第 ${entry.step} 张；超额毁灭 ${excess} 移到同阵营下一张。`)
    if (entry.step > 3) {
      entry.step = 4
      setWogState(state, { factions })
      warIsOver(state, faction, api)
      break
    }
    entry.doom = excess
    setWogState(state, { factions })
  }
  return result
}

/** 单次阈值检查（phaseBegan 等钩子复用 addDoomToFaction；此入口保留给直接调用/测试）。 */
export function resolveFactionThreshold(state, faction, api = {}) {
  if (Number(factionStates(state)[faction]?.doom || 0) < 6) return null
  return addDoomToFaction(state, faction, 0, api)
}

function removeFactionEnemies(state, factions) {
  const cards = new Set(factions.flatMap(key => FACTION_ENEMIES[key]))
  state.enemies = (state.enemies || []).filter(enemy => !cards.has(codeOf(enemy)))
}

/** 战争结束：Hub 翻面入场、胜方上古存在生成、败方阵营卡退场、胜方终局议程入场、幕 1 背面。 */
export function warIsOver(state, winner, api = {}) {
  if (wogState(state).warOver) return wogState(state)
  const losers = FACTION_KEYS.filter(key => key !== winner)
  const current = wogState(state)
  current.warOver = true
  current.winner = winner
  current.defeatedFactions = losers
  setFlag(state, 'wog', current)
  // Hub Dimension 翻面入场。
  if (!locationOf(state, 'hubDimension')) {
    const hub = { ...clone(LOCATIONS.hubDimension), revealed: true, connections: [...RITUAL_SITE_IDS] }
    state.locations.push(hub)
  } else {
    const hub = locationOf(state, 'hubDimension')
    hub.revealed = true
    hub.connections = [...RITUAL_SITE_IDS]
  }
  // 胜方终局议程入场。
  const finalAgenda = FINAL_AGENDAS[FACTION_FINAL_AGENDA[winner]]
  if (finalAgenda) {
    state.agendas = [clone(finalAgenda)]
    state.agendaIndex = 0
  }
  // 败方敌人退场；胜方上古存在生成在 Hub Dimension。
  removeFactionEnemies(state, losers)
  const ancient = spawnEnemyAt(state, FACTION_ANCIENT_ONE[winner], 'hubDimension', api)
  if (ancient) {
    const ancients = { ...(wogState(state).ancients || {}), [winner]: ancient.id }
    setWogState(state, { ancients })
  }
  info(api, `⚔️ 战争结束：${FACTION_LABEL[winner]}方阵营胜出！Hub Dimension 翻面，${ALL_CARDS[FACTION_ANCIENT_ONE[winner]]?.name || '上古存在'}入场。`)
  return wogState(state)
}

/** 终局议程：某阵营上古存在被击败 → 默认按阵营映射结局 2/3/4（胜方=红→2，蓝→3，绿→4）。 */
const ANCIENT_RESOLUTION = Object.freeze({ red: 'resolution2', blue: 'resolution3', green: 'resolution4' })

export function enemySpawned(state, enemy, api = {}) {
  void api
  const code = codeOf(enemy)
  if (!ANCIENT_ONE_CODES.includes(code)) return false
  const faction = factionOfCard(code)
  if (!faction) return false
  const ancients = { ...(wogState(state).ancients || {}), [faction]: enemy.id }
  setWogState(state, { ancients })
  return true
}

export function enemyDefeated(state, enemy, api = {}) {
  const code = codeOf(enemy)
  if (!ANCIENT_ONE_CODES.includes(code)) return false
  const faction = factionOfCard(code)
  if (!faction) return false
  if (!wogState(state).warOver || wogState(state).winner !== faction) return false
  info(api, `💀 ${ALL_CARDS[code]?.name || code} 被击败！（→ ${ANCIENT_RESOLUTION[faction]}）`)
  safeCall(api, 'finish', ANCIENT_RESOLUTION[faction])
  return true
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === ACT1_CODE) {
    info(api, '⚔️ 幕 1 背面：战争蔓延。任意终局议程入场后推进到「关闭传送门」。')
    return true
  }
  if (code === ACT2_CODE) {
    info(api, '🚪 幕 2 背面：你们找到了关闭 Hub Dimension 传送门的方法。')
    return true
  }
  if (code === ACT3_CODE) {
    info(api, '🚪 幕 3 背面：所有传送门开始关闭。')
    return true
  }
  return false
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  const faction = factionOfCard(code)
  if (!faction) return false
  if (FINAL_AGENDA_CODES.includes(code)) {
    info(api, `📜 终局议程「${ALL_CARDS[code]?.name || code}」入场：${FACTION_LABEL[faction]}方敌人失去冷漠/战争并获猎手。`)
    warIsOver(state, faction, api)
    return true
  }
  info(api, `📜 ${FACTION_LABEL[faction]}方阵营议程「${ALL_CARDS[code]?.name || code}」入场（全局毁灭阈值 6）。`)
  return true
}

/** 三套阵营议程由本文件记账：禁用引擎单议程轨的默认推进（终局议程阶段例外）。 */
export function agendaWouldAdvance(state, api = {}) {
  void api
  return !FINAL_AGENDA_CODES.includes(currentAgendaCode(state))
}

// ---------------------------------------------------------------------------
// 阶段 / 目标
// ---------------------------------------------------------------------------
export function phaseBegan(state, phase, api = {}) {
  if (phase !== 'mythos' || wogState(state).warOver) return false
  // 神话阶段「放置毁灭」步骤：按阵营顺序给 3 套议程各放 1 毁灭，再逐阵营检查阈值。
  for (const faction of FACTION_KEYS) addDoomToFaction(state, faction, 1, api)
  for (const faction of FACTION_KEYS) {
    if (wogState(state).warOver) break
    resolveFactionThreshold(state, faction, api)
  }
  return true
}

export function checkObjectives(state, api = {}) {
  const actCode = currentActCode(state)
  if (actCode === ACT1_CODE) {
    if (wogState(state).warOver) {
      info(api, '⚔️ 任一终局议程已入场：推进幕 1（关闭传送门）。')
      safeCall(api, 'advanceAct')
      return true
    }
    return false
  }
  if (actCode === ACT2_CODE) {
    const around = Number(wogState(state).cluesAroundHub || 0)
    if (around >= 3) {
      setWogState(state, { sealedGroups: Number(wogState(state).sealedGroups || 0) + 1 })
      info(api, '🚪 本桌已封住 Hub Dimension（3 个线索放在它周围）：推进幕 2。')
      safeCall(api, 'advanceAct')
      return true
    }
    return false
  }
  if (actCode === ACT3_CODE) {
    if (Number(wogState(state).sealedGroups || 0) >= 1) {
      info(api, '✅ 每个阵营的传送门都被封住：阻止了所有外神！（→ 结局 1）')
      safeCall(api, 'finish', 'resolution1')
      return true
    }
    return false
  }
  return false
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
function addCluesAroundHub(state, amount = 1) {
  const current = wogState(state)
  setWogState(state, { cluesAroundHub: Number(current.cluesAroundHub || 0) + Number(amount || 0) })
  return wogState(state).cluesAroundHub
}

export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const moves = []
  const actCode = currentActCode(state)
  const atRitual = RITUAL_SITE_IDS.includes(inv.location)
  if (actCode === ACT2_CODE && atRitual) {
    moves.push({
      action: 'scenarioAction', rule: 'wogSealPortal', locationId: inv.location, actions: 1,
      label: '尝试封住传送门：把自己的 1 个线索放到 Hub Dimension 周围，然后测试意志(2)或智识(2)',
      reason: (inv.clues || 0) >= 1 ? null : '需要 1 个线索',
    })
  }
  if (actCode === ACT3_CODE && atRitual) {
    moves.push({
      action: 'scenarioAction', rule: 'wogSealAnotherPortal', locationId: inv.location, actions: 1,
      label: '尝试封住另一道传送门：测试意志(3)或智识(3)，成功则把 1 个线索放到 Hub Dimension 周围',
      reason: null,
    })
  }
  if (inv.location === 'hubDimension') {
    moves.push({
      action: 'scenarioAction', rule: 'wogDamageAncientOne', locationId: inv.location, actions: 1,
      label: '测试意志(2)或智识(2)：成功可花费 3 线索或移除 Hub 周围 2 线索，对上古存在造成 2 伤害（大成功 3）',
      reason: wogState(state).warOver ? null : '战争尚未结束（没有上古存在）',
    })
  }
  const oneShot = { theArcade: 'wogTestArcade', chateauRamezay: 'wogTestChateau', thePenthouse: 'wogTestPenthouse' }[inv.location]
  if (oneShot) moves.push({ action: 'scenarioAction', rule: oneShot, locationId: inv.location, actions: 1, label: '测试以获得 1 个线索（来自标记池）' })
  if (!wogState(state).warOver && (state.enemies || []).some(enemy => isWarring(state, enemy))) {
    moves.push({
      action: 'scenarioAction', rule: 'wogResolveWarring', actions: 0,
      label: '结算战争：warring 敌人向敌对阵营移动/攻击（单桌近似入口）',
    })
  }
  return moves
}

function isWarring(state, enemy) {
  const code = codeOf(enemy)
  const faction = factionOfCard(code)
  if (!faction || ANCIENT_ONE_CODES.includes(code)) return false
  return /warring/i.test(String(ALL_CARDS[code]?.text || ''))
}

function nearestEnemyOfOtherFaction(state, enemy) {
  const faction = factionOfCard(codeOf(enemy))
  if (!faction) return null
  const candidates = (state.enemies || []).filter(other => other !== enemy
    && factionOfCard(codeOf(other)) && factionOfCard(codeOf(other)) !== faction)
  let best = Infinity, nearest = []
  for (const other of candidates) {
    const distance = distanceBetween(state, enemy.location, other.location)
    if (distance < best) { best = distance; nearest = [other] } else if (distance === best) nearest.push(other)
  }
  return nearest.length ? { enemy: nearest[0], distance: best } : null
}

function distanceBetween(state, from, to) {
  if (!from || !to) return Infinity
  if (from === to) return 0
  const seen = new Set([from])
  const queue = [[from, 0]]
  while (queue.length) {
    const [id, steps] = queue.shift()
    for (const next of locationOf(state, id)?.connections || []) {
      if (next === to) return steps + 1
      if (!seen.has(next)) { seen.add(next); queue.push([next, steps + 1]) }
    }
  }
  return Infinity
}

/** warring 单桌近似：先移动（向不同阵营最近敌人走一步），再攻击同地点不同阵营敌人。 */
export function resolveWarring(state, api = {}) {
  const factionState = wogState(state)
  if (factionState.warOver) return false
  const warring = (state.enemies || []).filter(enemy => isWarring(state, enemy) && !enemy.exhausted && enemy.engagedSeat == null)
  // 移动：按阵营顺序，未与敌对阵营同地点者向最近敌对敌人走一步。
  for (const faction of FACTION_KEYS) {
    for (const enemy of warring.filter(item => factionOfCard(codeOf(item)) === faction)) {
      const coLocated = (state.enemies || []).some(other => other !== enemy
        && other.location === enemy.location && factionOfCard(codeOf(other))
        && factionOfCard(codeOf(other)) !== faction)
      if (coLocated) continue
      const target = nearestEnemyOfOtherFaction(state, enemy)
      if (!target || target.distance === Infinity || target.distance <= 1) continue
      const route = shortestNextStep(state, enemy.location, target.enemy.location)
      if (route) { enemy.location = route; info(api, `⚔️ ${enemy.name} 向敌对阵营移动（→「${locLabel(state, route)}」）。`) }
    }
  }
  // 攻击：同地点不同阵营，目标取剩余生命最低者；伤害=伤害+恐惧；击败→攻击方阵营 +1 毁灭。
  for (const faction of FACTION_KEYS) {
    for (const enemy of warring.filter(item => factionOfCard(codeOf(item)) === faction)) {
      if (!state.enemies.includes(enemy)) continue
      const targets = (state.enemies || []).filter(other => other !== enemy && other.location === enemy.location
        && factionOfCard(codeOf(other)) && factionOfCard(codeOf(other)) !== faction)
      if (!targets.length) continue
      const healthOf = item => (Number(item.health) || 0) - (Number(item.damageTaken) || 0)
      targets.sort((a, b) => healthOf(a) - healthOf(b))
      const target = targets[0]
      const total = (Number(enemy.damage) || 0) + (Number(enemy.horror) || 0)
      target.damageTaken = (Number(target.damageTaken) || 0) + total
      info(api, `⚔️ ${enemy.name} 攻击 ${target.name}（${total} 伤害）。`)
      if (healthOf(target) <= 0 && !target.elite && !/swarm/i.test(String(ALL_CARDS[codeOf(target)]?.text || ''))) {
        state.enemies = state.enemies.filter(item => item !== target)
        addDoomToFaction(state, faction, 1, api)
        info(api, `💀 ${target.name} 被击败：${FACTION_LABEL[faction]}方议程 +1 毁灭。`)
      }
    }
  }
  return true
}

function shortestNextStep(state, from, to) {
  const distance = distanceBetween(state, from, to)
  if (!Number.isFinite(distance) || distance <= 0) return null
  for (const next of locationOf(state, from)?.connections || []) {
    if (distanceBetween(state, next, to) === distance - 1) return next
  }
  return null
}

/** 行动结算：场景自定义规则（act-agenda / dispatch 的 performAction 钩子）。 */
export function performAction(state, inv, move, api = {}) {
  const rule = String(move?.rule || '')
  if (rule === 'wogSealPortal' || rule === 'wogSealAnotherPortal') {
    const testDifficulty = rule === 'wogSealPortal' ? 2 : 3
    if (rule === 'wogSealPortal') {
      if ((inv.clues || 0) < 1) { info(api, '需要 1 个线索才能封住传送门。'); return false }
      inv.clues -= 1
      addCluesAroundHub(state, 1)
      info(api, '🚪 你把 1 个线索放到 Hub Dimension 周围。')
    }
    const onSuccess = () => {
      addCluesAroundHub(state, 1)
      info(api, '🚪 检定成功：再放置 1 个线索到 Hub Dimension 周围。')
      if (rule === 'wogSealAnotherPortal') setWogState(state, { sealedGroups: Number(wogState(state).sealedGroups || 0) + 1 })
    }
    if (typeof api?.test === 'function') {
      api.test(inv.seat, rule === 'wogSealPortal' ? 'willpower' : 'willpower', testDifficulty, result => {
        if (result?.success) onSuccess()
      })
    } else onSuccess()
    return true
  }
  if (rule === 'wogDamageAncientOne') {
    const ancient = Object.values(wogState(state).ancients || {})
      .map(id => (state.enemies || []).find(enemy => enemy.id === id))
      .find(enemy => enemy && !enemy.defeated)
    if (!ancient) { info(api, '场上没有上古存在。'); return false }
    const hit = extra => {
      ancient.damageTaken = (Number(ancient.damageTaken) || 0) + extra
      info(api, `⚔️ 对 ${ancient.name} 造成 ${extra} 点伤害。`)
      if ((Number(ancient.health) || 0) - (Number(ancient.damageTaken) || 0) <= 0) {
        enemyDefeated(state, ancient, api)
      }
    }
    if ((inv.clues || 0) >= 3) inv.clues -= 3
    else if (Number(wogState(state).cluesAroundHub || 0) >= 2) addCluesAroundHub(state, -2)
    if (typeof api?.test === 'function') {
      api.test(inv.seat, 'willpower', 2, result => hit(result && (result.successBy ?? 0) >= 3 ? 3 : 2))
    } else hit(2)
    return true
  }
  if (rule === 'wogTestArcade' || rule === 'wogTestChateau' || rule === 'wogTestPenthouse') {
    const skill = rule === 'wogTestArcade' ? 'agility' : rule === 'wogTestChateau' ? 'willpower' : 'combat'
    if (typeof api?.test === 'function') {
      api.test(inv.seat, skill, 4, result => {
        if (result?.success) { inv.clues = (Number(inv.clues) || 0) + 1; info(api, '🧩 检定成功：获得 1 个线索（来自标记池）。') }
      })
    } else {
      inv.clues = (Number(inv.clues) || 0) + 1
      info(api, '🧩 获得 1 个线索（来自标记池）。')
    }
    return true
  }
  if (rule === 'wogResolveWarring') return resolveWarring(state, api)
  return false
}

// ---------------------------------------------------------------------------
// 敌人 Spawn 指示
// ---------------------------------------------------------------------------
const SPAWN_LOCATIONS = Object.freeze({
  86025: 'athenaeumOfTheEmptySky', // Nihilistic Stargazer
  86027: 'shrineOfMaghanArkat', // Zealot of Paradise
  86029: 'theBurningPit', // Disciple of the Swarm
  86044: 'shrineOfMaghanArkat', // Bringer of Paradise
  '86044a': 'shrineOfMaghanArkat',
  86038: 'athenaeumOfTheEmptySky', // Ethereal Entity
  '86038a': 'athenaeumOfTheEmptySky',
  86049: 'theBurningPit', // Trylogog
  '86049a': 'theBurningPit',
})

export function spawnLocation(state, code, fallback) {
  void state
  return SPAWN_LOCATIONS[String(code)] || fallback
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  const face = String(token || '').toLowerCase().replace('_', '')
  const hard = isHardSide(state)
  const clues = Number(inv?.clues) || 0
  if (face === 'skull') return { delta: -clues * (hard ? 2 : 1) }
  if (face === 'cultist') {
    return { delta: hard ? -4 : -3, onFail: [{ type: 'scenarioToken', token: 'cultist', mode: hard ? 'mutateAll' : 'mutateNearest' }] }
  }
  if (face === 'tablet') {
    return { delta: hard ? -4 : -3, onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'drawHexOnFail' }] }
  }
  if (face === 'elderthing') {
    return { delta: hard ? -5 : -4, onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: hard ? 'swarmAllCommitted' : 'swarmOneCommitted' }] }
  }
  return null
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  const mode = effect.mode
  if (mode === 'mutateNearest' || mode === 'mutateAll') {
    const targets = (state.enemies || []).filter(enemy => (ALL_CARDS[codeOf(enemy)]?.traits || [])
      .some(trait => String(trait).toLowerCase() === 'mutated'))
    for (const enemy of mode === 'mutateAll' ? targets : targets.slice(0, 1)) {
      enemy.mutations = (Number(enemy.mutations) || 0) + 1
    }
    info(api, '🧬 [cultist]：在最近的[[变异]]敌人上放置 1 个资源，作为变异。')
    return true
  }
  if (mode === 'drawHexOnFail') {
    const index = (state.encounterDiscard || []).map((code, i) => [code, i])
      .filter(([code]) => (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'hex'))
      .map(([, i]) => i)
    if (index.length) {
      const [code] = state.encounterDiscard.splice(index[index.length - 1], 1)
      safeCall(api, 'drawEncounterCard', code, inv?.seat)
      info(api, '🃏 [tablet]：抽取遭遇弃牌堆顶的[[妖术]]卡。')
    }
    return true
  }
  if (mode === 'swarmOneCommitted' || mode === 'swarmAllCommitted') {
    info(api, '🐛 [elder_thing]：把本次检定投入的卡面朝下放到[[昆虫]]敌人下面作为虫群卡（本实现：记录日志）。')
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
const RESOLUTION_RECORDS = Object.freeze({
  resolution1: 'preventedAllOuterGods',
  resolution2: 'theSwarmOfEzelScattered',
  resolution3: 'silenusBanished',
  resolution4: 'maghanArkatDestroyed',
  resolution5: 'redFactionWon',
  resolution6: 'blueFactionWon',
  resolution7: 'greenFactionWon',
})

export function resolution(state, key, events = null, api = {}) {
  void events
  const infoApi = api?.info ? api : api?.api || {}
  let finalKey = String(key)
  // 无结局：按「领先阵营」映射到 5/6/7（参考 NoResolution 分支）。
  if (finalKey === 'noResolution') {
    const leads = leadFactions(state)
    finalKey = leads.length === 1 && leads[0] ? `resolution${leads[0] === 'red' ? 5 : leads[0] === 'blue' ? 6 : 7}` : 'resolution5'
    info(infoApi, `无结局：按领先阵营进入 ${finalKey}。`)
  }
  const effects = []
  const record = RESOLUTION_RECORDS[finalKey]
  if (record) effects.push({ record: { [record]: true } })
  if (finalKey === 'resolution1' || finalKey === 'resolution2' || finalKey === 'resolution3' || finalKey === 'resolution4') {
    for (const code of STORY_ASSET_CODES) effects.push({ storyCard: code })
  }
  if (finalKey === 'resolution5' || finalKey === 'resolution6' || finalKey === 'resolution7') {
    effects.push({ defeatAll: true })
  }
  return { bonus: finalKey === 'resolution1' ? 2 : 0, award: true, effects, flowData: { resolution: finalKey } }
}

/** 领先阵营：议程走得最远；平局比毁灭；再平比在场敌人数。 */
export function leadFactions(state) {
  const factions = factionStates(state)
  const rows = FACTION_KEYS.map(faction => ({
    faction,
    step: Number(factions[faction]?.step || 1),
    doom: Number(factions[faction]?.doom || 0),
    enemies: (state.enemies || []).filter(enemy => factionOfCard(codeOf(enemy)) === faction && !enemy.defeated).length,
  }))
  const best = (rows2, key) => { const max = Math.max(...rows2.map(row => row[key])); return rows2.filter(row => row[key] === max) }
  let pool = best(rows, 'step')
  if (pool.length > 1) pool = best(pool, 'doom')
  if (pool.length > 1) pool = best(pool, 'enemies')
  return pool.map(row => row.faction)
}

// ---------------------------------------------------------------------------
// 只读投影 / 具名助手
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  const current = wogState(state)
  return {
    act: currentActCode(state),
    agenda: currentAgendaCode(state),
    warOver: Boolean(current.warOver),
    winner: current.winner || null,
    factions: clone(current.factions || {}),
    cluesAroundHub: Number(current.cluesAroundHub || 0),
    sealedGroups: Number(current.sealedGroups || 0),
    ancients: { ...(current.ancients || {}) },
    leads: leadFactions(state),
  }
}

export const events = {
  wogPlaceDoom(state, payload = {}, api = {}) {
    return addDoomToFaction(state, String(payload.faction || 'green'), Number(payload.amount) || 1, api)
  },
  wogResolveWarring(state, payload = {}, api = {}) {
    void payload
    return resolveWarring(state, api)
  },
  wogSealPortal(state, payload = {}, api = {}) {
    const inv = (state.investigators || []).find(item => item.seat === Number(payload.seat ?? state.currentSeat))
    if (!inv) return false
    return performAction(state, inv, { rule: payload.rule || 'wogSealPortal' }, api)
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
  applyHubConnections,
  actions,
  performAction,
  actReveal,
  agendaReveal,
  agendaWouldAdvance,
  phaseBegan,
  checkObjectives,
  spawnLocation,
  enemySpawned,
  enemyDefeated,
  resolveChaosToken,
  applyTokenEffect,
  tokenMeanings,
  resolution,
  events,
  scenarioSummary,
  leadFactions,
  factionStates,
  addDoomToFaction,
  resolveFactionThreshold,
  warIsOver,
  resolveWarring,
  currentActCode,
  currentAgendaCode,
  codeOf,
}
