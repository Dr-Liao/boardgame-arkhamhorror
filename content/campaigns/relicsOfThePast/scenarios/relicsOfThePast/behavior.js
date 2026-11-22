// 往昔遗物（Relics of the Past · 90065）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/RelicsOfThePast.hs + frontend/src/locales/en/standalone/relicsOfThePast.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   startLocation / setupLocations / afterDeckSetup → 遗迹入口、探索牌库、内部密室放一边、
//     古代遗物/复仇往昔/伊格之子放一边、中毒放一边、补给品选择、议程毁灭阈值修正。
//   canExplore / afterExplore → 失落的时代 Explore 行动（无线索才能探索、符号连接、
//     秘密通道 → 内部密室、指南针发现线索、进入地点后重算符号连接）。
//   actReveal / agendaReveal / allResigned / investigatorEliminated → 幕/议程推进与结局。
//   enemyDefeated / enemyStatModifier → 坑洞居住者的复仇加值。
//   resolveChaosToken / applyTokenEffect / tokenMeanings → 90065 提示卡的四类标记。
//   resolution → 声明式结局效果（古代遗物经验 + 探险日志额外经验 + 记录）。
//
// 本章状态只写 state.scenarioFlags / state.scenarioZones / state.explorationDeck /
// state.campaign.records（纯 JSON）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT1_CODE, ACT2_CODE, AGENDA1_CODE, AGENDA2_CODE, BROOD_OF_YIG_CODE, CHAPTER_ID,
  DWELLER_CODE, ENCOUNTER_DECK, EXPLORATION_LOCATION_IDS, EXPLORATION_TREACHERY_CODES,
  EXPLORATION_ENEMY_CODES, INNER_CHAMBER_ID, KEY_INVESTIGATOR, LOCATION_CODES, LOCATION_TABLE,
  MONTEREY_TITLE, POISONED_CODE, RELIC_CODES, RESOLUTION_KEYS, SCENARIO_ACT_TEXT,
  SCENARIO_AGENDA_TEXT, SCENARIO_TEXT, SECRET_PASSAGE_ID, SET_ASIDE_CODES, START_LOCATION,
  SUPPLY_LABELS, SUPPLY_NAMES, TOKEN_MEANINGS, VENGEANT_PAST_CODE, initialExplorationDeck, tokenTier,
} from './definition.js'

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const info = (api, message) => api?.info?.(message)
const codeOf = value => String(value?.originalCode || value?.code || '')
const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase().replace(/\s+/g, '') === String(trait).toLowerCase().replace(/\s+/g, ''))
const flagsFor = state => (state.scenarioFlags ||= {})
const flagValue = (state, key) => flagsFor(state)[key]
const setFlag = (state, key, value = true) => { flagsFor(state)[key] = value; return value }
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const randomOf = api => (typeof api?.random === 'function' ? api.random : () => Math.random())
export const isMonterey = inv => codeOf(inv) === KEY_INVESTIGATOR
  || String(inv?.nameEn || inv?.name || '').includes(MONTEREY_TITLE)
export const findMonterey = state => (state.investigators || []).find(inv => inv && isMonterey(inv)) || null
const currentActCode = state => codeOf(state.acts?.[state.actIndex]) || ''
const currentAgendaCode = state => codeOf(state.agendas?.[state.agendaIndex]) || ''
const isAncientAsset = value => hasTrait(value, 'Ancient')
  && (RELIC_CODES.includes(codeOf(value)) || (ALL_CARDS[codeOf(value)]?.traits || []).includes('Ancient'))

function localShuffle(list, rng) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Number(rng()) * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function spawnScenarioEnemy(state, code, locationId, options = {}) {
  const definition = (state.scenario?.enemies || {})[code]
  if (!definition) return null
  state.enemies ||= []
  const existing = state.enemies.find(enemy => codeOf(enemy) === code && !enemy.defeated)
  if (existing) return existing
  const health = definition.healthPerInvestigator
    ? Number(definition.health) * investigatorCount(state)
    : Number(definition.health) || 1
  const enemy = {
    id: `e${++state.instanceSeq.e}`,
    code,
    originalCode: code,
    name: definition.name,
    nameEn: definition.nameEn,
    location: locationId,
    fight: definition.fight ?? null,
    evade: definition.evade ?? null,
    health,
    damage: definition.damage || 0,
    horror: definition.horror || 0,
    traits: [...(definition.traits || [])],
    hunter: Boolean(definition.hunter),
    retaliate: Boolean(definition.retaliate),
    prey: definition.prey || null,
    elite: Boolean(definition.elite),
    exhausted: options.exhausted === true,
    engagedSeat: options.engagedSeat ?? null,
    damageTaken: 0,
    doom: 0,
    clues: 0,
    vengeance: Number(definition.vengeance) || 0,
    attachments: [],
    victory: Number(definition.victory) || 0,
  }
  state.enemies.push(enemy)
  if (enemy.engagedSeat != null) {
    const target = state.investigators[enemy.engagedSeat]
    if (target) target.engaged.push(enemy.id)
  }
  return enemy
}

export function spawnStoryAssetSafe(state, api, code, locationId) {
  if (typeof api?.storyAsset === 'function') {
    const asset = safeCall(api, 'storyAsset', code, locationId)
    if (asset) return asset
  }
  state.storyAssets ||= []
  const existing = state.storyAssets.find(asset => codeOf(asset) === code)
  if (existing) return existing
  const card = ALL_CARDS[code] || {}
  const asset = {
    id: `s${++state.instanceSeq.c}`, code, originalCode: code,
    name: card.nameZh || card.name || code, nameEn: card.name || code,
    location: locationId, controllerSeat: null, exhausted: false, global: false,
  }
  state.storyAssets.push(asset)
  return asset
}

function relicAssetsInPlay(state) {
  return (state.storyAssets || []).filter(asset => RELIC_CODES.includes(codeOf(asset)) && !asset.removedFromGame)
}

function shroudOf(state, id) {
  return Number(locationOf(state, id)?.shroud) || 0
}

function suppressAgendaDoomCap(state) {
  // 2 张议程都有「+1[per_investigator] 毁灭阈值」。
  const bonus = investigatorCount(state)
  for (const agenda of state.agendas || []) {
    if (agenda?.doomThreshold != null) agenda.doomThreshold = Number(agenda.doomThreshold) + bonus
  }
}

function connectPlacedLocations(state) {
  const placed = (state.locations || []).filter(location => location.symbols?.front)
  for (const location of placed) {
    const front = location.symbols.front
    const links = new Set(location.connections || [])
    for (const other of placed) {
      if (other === location || !other.symbols?.front) continue
      const otherFront = other.symbols.front
      if (front.links.includes(otherFront.symbol) || otherFront.links.includes(front.symbol)) links.add(other.id)
    }
    location.connections = [...links]
  }
}

function removeExploredLocation(state, id, api = {}) {
  const location = locationOf(state, id)
  if (!location) return false
  const removed = safeCall(api, 'removeLocation', id)
  if (!removed) {
    state.locations = (state.locations || []).filter(item => item.id !== id)
    for (const other of state.locations) other.connections = (other.connections || []).filter(to => to !== id)
  }
  return true
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function startLocation(state) {
  void state
  return START_LOCATION
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const zones = (state.scenarioZones ||= {})
  zones.setAside ||= []
  for (const code of SET_ASIDE_CODES) zones.setAside.push(code)
  // 内部密室放在一边（幕 1 探索到秘密通道时入场）。
  zones.setAside.push(LOCATION_CODES[INNER_CHAMBER_ID])
  const poisonedInDecks = Object.values(state.campaign?.investigators || {})
    .reduce((sum, record) => sum + (record?.deck || []).filter(code => code === POISONED_CODE).length, 0)
  const poisonedAside = Math.max(0, 4 - poisonedInDecks)
  for (let index = 0; index < poisonedAside; index += 1) zones.setAside.push(POISONED_CODE)
  info(api, `往昔遗物：放置遗迹入口；内部密室、${RELIC_CODES.length} 件古代遗物、复仇往昔、3 张伊格之子、${poisonedAside} 张中毒放在一边。`)
  return [START_LOCATION]
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const rng = randomOf(api)
  const hard = ['hard', 'expert'].includes(String(state.difficulty || 'standard'))

  // 1) 探索牌库（引擎原语 state.explorationDeck：顶在末尾）。
  state.scenarioZones ||= {}
  state.scenarioZones.explorationLocations = [...EXPLORATION_LOCATION_IDS]
  state.explorationDeck = localShuffle(initialExplorationDeck(hard ? 'hard' : state.difficulty), rng)
  state.explorationDiscard = []
  setFlag(state, 'explorationBuilt', true)

  // 2) 议程毁灭阈值 = 印刷值 + 调查员人数。
  suppressAgendaDoomCap(state)

  // 3) 补给品：1P 默认「指南针 + 探险日志」，其他人默认「指南针」（近似的确定性选择）。
  const supplies = {}
  for (const inv of activeInvestigators(state)) {
    supplies[inv.seat] = inv.seat === 0 && investigatorCount(state) === 1
      ? ['compass', 'journal'] : ['compass']
  }
  setFlag(state, 'supplies', supplies)

  // 4) 议程 1 上的初始毁灭（1/2/3/4 人：0/1/2/3）。
  const initialDoom = Math.max(0, investigatorCount(state) - 1)
  if (initialDoom > 0) safeCall(api, 'addDoom', initialDoom)

  // 5) 地点符号连接（内部密室在一边，已入场地点先按符号互连）。
  connectPlacedLocations(state)

  // 6) 蒙特雷·杰克的起始位置修正：从遗迹入口开始。
  const monterey = findMonterey(state)
  if (monterey) monterey.location = START_LOCATION
  for (const inv of activeInvestigators(state)) inv.location = START_LOCATION

  info(api, `探索牌库 ${state.explorationDeck.length} 张；补给品：` +
    activeInvestigators(state).map(inv => `${inv.name}（${(supplies[inv.seat] || []).map(name => SUPPLY_LABELS[name] || name).join('、')}）`).join('；') + '。')
  return { exploration: state.explorationDeck.length }
}

// ---------------------------------------------------------------------------
// 探索（Explore）：沿用失落的时代通用原语，补本关地点规则。
// ---------------------------------------------------------------------------
export function canExplore(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return false
  if (!state.explorationDeck?.length) return false
  const act = currentActCode(state)
  if (![ACT1_CODE, ACT2_CODE].includes(act)) return false
  const here = locationOf(state, inv.location)
  return !here || (Number(here.clues) || 0) === 0
}

export function afterExplore(state, inv, context = {}, api = {}) {
  const kind = context.kind
  const code = context.code
  if (kind === 'location' && code) {
    connectPlacedLocations(state)
    const here = locationOf(state, code)
    if (here) here.revealed = true
    if (code === 'secretPassage' && locationOf(state, INNER_CHAMBER_ID) === null) {
      const inner = safeCall(api, 'placeLocation', INNER_CHAMBER_ID)
      const chamber = locationOf(state, INNER_CHAMBER_ID)
      if (chamber) {
        chamber.connections = [...new Set([...(chamber.connections || []), SECRET_PASSAGE_ID])]
        const passage = locationOf(state, SECRET_PASSAGE_ID)
        if (passage) passage.connections = [...new Set([...(passage.connections || []), INNER_CHAMBER_ID])]
        info(api, `秘密通道与内部密室进入场${inner ? '' : '（本地兜底）'}。`)
      }
    }
    if (code === 'secretPassage' && hasSupply(state, inv, 'compass')) {
      safeCall(api, 'discoverClue', inv.seat, 1, SECRET_PASSAGE_ID)
      info(api, `${inv.name} 的指南针在秘密通道发现了 1 个线索。`)
    }
    return true
  }
  if (code === '04094' || code === '04088' || code === '04089' || code === '01174') {
    connectPlacedLocations(state)
    return false
  }
  return false
}

function hasSupply(state, inv, supply) {
  const supplies = flagValue(state, 'supplies') || {}
  return (supplies[inv?.seat] || []).includes(supply)
}

export function supplyFor(state, inv) {
  return (flagValue(state, 'supplies') || {})[inv?.seat] || []
}

// ---------------------------------------------------------------------------
// 幕 / 议程推进与结局
// ---------------------------------------------------------------------------
function innerChamberThreshold(state) {
  return Math.max(1, Math.ceil(2 / 2)) + investigatorCount(state)
}

export function checkObjectives(state, api = {}) {
  const act = currentActCode(state)
  if (act === ACT1_CODE) {
    const survivors = activeInvestigators(state)
    if (!survivors.length) return false
    if (!survivors.every(inv => inv.location === INNER_CHAMBER_ID)) return false
    const cost = 4 * investigatorCount(state)
    const paid = safeCall(api, 'payGroupClues', cost, { atLocation: INNER_CHAMBER_ID })
    if (!paid) {
      info(api, `需要共同花费 ${cost} 个线索才能推进幕 1。`)
      return false
    }
    info(api, `调查队在内部密室共同花费 ${cost} 个线索。`)
    safeCall(api, 'advanceAct')
    return true
  }
  if (act === ACT2_CODE) {
    const survivors = activeInvestigators(state)
    if (survivors.length && survivors.every(inv => inv.resigned)) {
      safeCall(api, 'advanceAct')
      return true
    }
  }
  return false
}

function shuffleIntoExploration(state, cards, api = {}) {
  const existing = [...(state.explorationDeck || [])]
  state.explorationDeck = localShuffle([...existing, ...cards], randomOf(api))
  safeCall(api, 'info', `将 ${cards.length} 张卡洗入探索牌库（现有 ${state.explorationDeck.length} 张）。`)
  return state.explorationDeck.length
}

export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === ACT1_CODE) {
    // 1) 未交战的精英敌人移动到内部密室。
    const chamber = locationOf(state, INNER_CHAMBER_ID)
    for (const enemy of state.enemies || []) {
      if (enemy.defeated || enemy.engagedSeat != null || !enemy.elite) continue
      if (chamber) safeCall(api, 'moveEnemy', enemy, INNER_CHAMBER_ID)
    }
    // 2) 放一边的古代遗物、复仇往昔、每点复仇 1 张伊格之子洗入探索牌库；
    //    场上每张单面地点也洗回探索牌库（内部密室除外）。
    const zones = (state.scenarioZones ||= {})
    zones.setAside ||= []
    const fromAside = []
    for (const codeValue of [...RELIC_CODES, VENGEANT_PAST_CODE]) {
      const index = zones.setAside.indexOf(codeValue)
      if (index >= 0) {
        zones.setAside.splice(index, 1)
        fromAside.push(codeValue)
      }
    }
    const vengeance = Number(state.vengeanceInVictoryDisplay) || 0
    let broods = 0
    for (let index = 0; index < vengeance; index += 1) {
      const at = zones.setAside.indexOf(BROOD_OF_YIG_CODE)
      if (at < 0) break
      zones.setAside.splice(at, 1)
      fromAside.push(BROOD_OF_YIG_CODE)
      broods += 1
    }
    const singleSided = (state.locations || [])
      .filter(location => EXPLORATION_LOCATION_IDS.includes(location.id))
      .map(location => location.id)
    for (const id of singleSided) removeExploredLocation(state, id, api)
    const returned = [...fromAside, ...singleSided]
    for (const id of singleSided) returned.push(LOCATION_CODES[id])
    shuffleIntoExploration(state, returned, api)
    // 3) 每张已揭示地点放置 1[per_player] 线索（不超过线索上限）。
    const perPlayer = investigatorCount(state)
    for (const location of state.locations || []) {
      if (location.revealed === false) continue
      const threshold = (Number(location.cluesPerInvestigator) || 0) * investigatorCount(state)
      location.clues = Math.min(threshold, (Number(location.clues) || 0) + perPlayer)
    }
    info(api, `幕 1 背面：古代遗物与复仇往昔洗回探索牌库（伊格之子 ${broods} 张）；单面地点 ${singleSided.length} 处重新洗入；已揭示地点各放 ${perPlayer} 线索。`)
    return true
  }
  if (code === ACT2_CODE) {
    setFlag(state, 'relicsResolution', 'resolution1')
    info(api, '幕 2 背面：调查队带着遗物逃出神庙，进入结局 1。')
    safeCall(api, 'finish', 'resolution1')
    return true
  }
  return false
}

export function agendaAdvancing(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code !== AGENDA1_CODE && code !== AGENDA2_CODE) return false
  // 90066a：「本密谋推进时不要从场上的地点移除毁灭标记」——记录地点上的毁灭，
  // 引擎 clearDoomInPlay 之后在 agendaReveal 里放回。
  const preserved = (state.locations || [])
    .filter(location => Number(location.doom) > 0)
    .map(location => [location.id, Number(location.doom)])
  setFlag(state, 'preservedLocationDoom', preserved)
  void api
  return true
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  const preserved = flagValue(state, 'preservedLocationDoom') || []
  if (preserved.length) {
    for (const [id, doom] of preserved) {
      const location = locationOf(state, id)
      if (location) location.doom = doom
    }
    setFlag(state, 'preservedLocationDoom', [])
    info(api, `议程推进：地点上的 ${preserved.reduce((sum, [, doom]) => sum + doom, 0)} 点毁灭被保留。`)
  }
  if (code === AGENDA1_CODE) {
    const monterey = findMonterey(state)
    const enemy = spawnScenarioEnemy(state, DWELLER_CODE, monterey?.location || START_LOCATION, {
      engagedSeat: monterey?.seat ?? 0,
    })
    if (enemy) {
      enemy.health = Number(enemy.health) || 6
      enemy.elite = true
    }
    info(api, `议程 1 背面：坑洞居住者（${enemy?.name || DWELLER_CODE}）从坑底爬出，与 ${monterey?.name || '蒙特雷'} 交战。`)
    return true
  }
  if (code === AGENDA2_CODE) {
    for (const inv of activeInvestigators(state)) {
      safeCall(api, 'addTrauma', inv.seat, 'physical', 1)
    }
    setFlag(state, 'relicsResolution', 'resolution2')
    info(api, '议程 2 背面：神庙坍塌，每位未离场调查员被击败并承受 1 点肉体创伤。')
    safeCall(api, 'finish', 'resolution2')
    return true
  }
  return false
}

export function allResigned(state, api = {}) {
  if (currentActCode(state) === ACT2_CODE) return false
  setFlag(state, 'relicsResolution', 'resolution2')
  info(api, '调查员全部撤退：进入结局 2。')
  safeCall(api, 'finish', 'resolution2')
  return true
}

export function investigatorEliminated(state, inv, clues, api = {}) {
  if (!inv) return false
  // 议程 1/2 正面：被击败调查员把其控制的古代遗物洗回探索牌库。
  if (inv.defeated) {
    const shuffed = relicAssetsInPlay(state).filter(asset => asset.controllerSeat === inv.seat)
    for (const asset of shuffed) {
      asset.removedFromGame = true
      asset.controllerSeat = null
    }
    if (shuffed.length) shuffleIntoExploration(state, shuffed.map(asset => codeOf(asset)), api)
  }
  // 撤退：控制的古代遗物强制加入胜利区（近似：离开场上并把数量记入场景标记）。
  if (inv.resigned) {
    const forced = relicAssetsInPlay(state).filter(asset => asset.controllerSeat === inv.seat)
    for (const asset of forced) {
      asset.removedFromGame = true
      asset.controllerSeat = null
    }
    if (forced.length) {
      setFlag(state, 'relicsResigned', (Number(flagValue(state, 'relicsResigned')) || 0) + forced.length)
      info(api, `${inv.name} 撤退：${forced.map(asset => ALL_CARDS[codeOf(asset)]?.nameZh || codeOf(asset)).join('、')} 强制加入胜利区。`)
    }
    return true
  }
  // 全员被击败 → 结局 2。
  if (!activeInvestigators(state).length) {
    setFlag(state, 'relicsResolution', 'resolution2')
    safeCall(api, 'finish', 'resolution2')
    return true
  }
  return false
}

export function enemyStatModifier(state, enemy, stat, base) {
  if (codeOf(enemy) !== DWELLER_CODE) return null
  if (stat === 'fight') {
    const vengeance = Number(state.vengeanceInVictoryDisplay) || 0
    return Math.min(3, vengeance)
  }
  return null
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
function currentDoomHere(state, api = {}) {
  const locationId = api?.currentLocationId?.() || state.investigators?.[state.currentSeat]?.location
  return Number(locationOf(state, locationId)?.doom) || 0
}

export function resolveChaosToken(state, inv, token, api = {}) {
  const hard = tokenTier(state) === 'hard'
  const poisoned = Boolean(inv?.poisoned) || Boolean(inv?.weaknesses?.includes?.(POISONED_CODE))
  switch (String(token)) {
    case 'skull': {
      const x = Number(state.doomOnCurrentLocation) || currentDoomHere(state, api)
      return { delta: -(hard ? x + 1 : x), onDraw: [], onFail: [] }
    }
    case 'cultist':
      return {
        delta: poisoned ? (hard ? -3 : -2) : (hard ? -2 : -1),
        drawAnother: poisoned, onDraw: [],
        onFail: [],
      }
    case 'tablet':
      return {
        delta: hard ? -4 : -3, onDraw: [],
        onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'placeDoomHere' }],
      }
    case 'elderthing':
      return {
        delta: hard ? -5 : -3, onDraw: [],
        onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'nearestSerpentMove' }],
      }
    default:
      return null
  }
}

function nearestReadySerpent(state, fromId) {
  const serpents = (state.enemies || []).filter(enemy => !enemy.defeated && enemy.engagedSeat == null && hasTrait(enemy, 'Serpent'))
  const from = locationOf(state, fromId)
  let best = null
  let bestDistance = Infinity
  const distance = (startId, targetId) => {
    const queue = [[startId, 0]]
    const seen = new Set([startId])
    while (queue.length) {
      const [id, depth] = queue.shift()
      if (id === targetId) return depth
      const node = locationOf(state, id)
      for (const next of node?.connections || []) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push([next, depth + 1])
      }
    }
    return Infinity
  }
  for (const enemy of serpents) {
    const d = distance(enemy.location, fromId)
    if (d < bestDistance) { best = enemy; bestDistance = d }
  }
  void from
  return best
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  if (!effect || effect.type !== 'scenarioToken') return false
  if (effect.mode === 'placeDoomHere') {
    const location = locationOf(state, inv.location)
    if (!location) return false
    safeCall(api, 'doomOn', location, 1)
    info(api, `[tablet]：在「${location.name}」放置 1 个毁灭标记。`)
    return true
  }
  if (effect.mode === 'nearestSerpentMove') {
    const serpent = nearestReadySerpent(state, inv.location)
    if (!serpent) return false
    safeCall(api, 'moveEnemy', serpent, inv.location)
    info(api, `[elder_thing]：最近的蛇敌人向 ${inv.name} 移动。`)
    return true
  }
  return false
}

export function tokenMeanings(state) {
  const hard = tokenTier(state) === 'hard'
  return hard ? TOKEN_MEANINGS.hard : TOKEN_MEANINGS.standard
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export function relicVictoryCount(state) {
  const controlled = relicAssetsInPlay(state).filter(asset => asset.controllerSeat != null).length
  return controlled + (Number(flagValue(state, 'relicsResigned')) || 0)
}

export function resolution(state, key, events = null, api = {}) {
  void events
  void api
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const anyDefeated = (state.investigators || []).some(inv => inv.defeated)
  const recordKey = finalKey === 'noResolution' ? (anyDefeated ? 'resolution2' : 'resolution1') : finalKey
  setFlag(state, 'relicsResolution', recordKey)
  const relics = relicVictoryCount(state)
  const monterey = findMonterey(state)
  const journal = monterey ? hasSupply(state, monterey, 'journal') : false
  const effects = [
    { record: { relicsOfThePastResolution: recordKey } },
    { record: { relicsOfThePastRelics: relics } },
    {
      text: recordKey === 'resolution1'
        ? `结局 1：调查队带着 ${relics} 件古代遗物逃出神庙。`
        : '结局 2：神庙坍塌，古代之物重归黑暗。',
    },
    ...(journal ? [{ text: '探险日志：蒙特雷的笔记为这次探险提供了额外的经验。' }] : []),
  ]
  return {
    award: true,
    seatBonus: seat => relics + (journal && monterey && monterey.seat === seat ? 1 : 0),
    effects,
  }
}

// ---------------------------------------------------------------------------
// 导入 / 摘要
// ---------------------------------------------------------------------------
export function introduction(state) {
  void state
  return { paragraphs: String(SCENARIO_TEXT.intro || '').split(/\n{2,}/).filter(Boolean) }
}

export function scenarioSummary(state) {
  return {
    exploration: (state.explorationDeck || []).length,
    relics: relicVictoryCount(state),
    supplies: flagValue(state, 'supplies') || {},
    resolution: flagValue(state, 'relicsResolution') || null,
  }
}

// ---------------------------------------------------------------------------
// 古代遗物（从探索牌库抽到/显现）
// ---------------------------------------------------------------------------
export function drawStoryAsset(state, inv, code, api = {}) {
  if (!RELIC_CODES.includes(code)) {
    const other = spawnStoryAssetSafe(state, api, code, inv.location)
    if (other && other.controllerSeat == null) other.controllerSeat = inv.seat
    return true
  }
  const asset = spawnStoryAssetSafe(state, api, code, null)
  if (asset) {
    asset.controllerSeat = inv.seat
    asset.location = null
    asset.removedFromGame = false
  }
  const card = ALL_CARDS[code] || {}
  info(api, `${inv.name} 获得古代遗物「${card.nameZh || card.name || code}」，并结算其显现效果。`)
  const here = locationOf(state, inv.location)
  const doomOrElse = (elseLabel) => safeCall(api, 'choice', {
    kind: 'effect', source: code, seat: inv.seat,
    prompt: `${card.nameZh || card.name}：在你的地点放置 1 个毁灭标记，或${elseLabel}？`,
    options: [{ id: 'doom', label: '在所在地点放置 1 个毁灭标记' }, { id: 'other', label: elseLabel }],
  }) !== 'other'
  switch (code) {
    case '90073':
      if (doomOrElse('受到 2 点伤害')) safeCall(api, 'doomOn', here, 1)
      else safeCall(api, 'damage', inv.seat, 2)
      break
    case '90074':
      if (doomOrElse('让最近的敌人攻击你')) safeCall(api, 'doomOn', here, 1)
      else {
        const nearest = (state.enemies || []).filter(enemy => !enemy.defeated)
          .sort((left, right) => (left.location === inv.location ? -1 : 0) - (right.location === inv.location ? -1 : 0))[0]
        if (nearest) safeCall(api, 'attack', nearest, inv)
      }
      break
    case '90075':
      if (inv.poisoned) safeCall(api, 'damage', inv.seat, 1)
      else safeCall(api, 'poison', inv.seat)
      break
    case '90076':
      if (doomOrElse('受到 2 点恐惧')) safeCall(api, 'doomOn', here, 1)
      else safeCall(api, 'horror', inv.seat, 2)
      break
    default:
      break
  }
  return true
}

// 复仇往昔（90077）：每位控制古代遗物的调查员二选一（受伤/恐惧，或把该支援洗回探索牌库），
// 结算后把复仇往昔自身洗回探索牌库。
export function resolveEncounter(state, inv, card, api = {}) {
  const code = codeOf(card)
  if (code !== VENGEANT_PAST_CODE) return false
  const controlled = relicAssetsInPlay(state).filter(asset => asset.controllerSeat != null)
  const shuffled = []
  for (const asset of controlled) {
    const owner = state.investigators[asset.controllerSeat]
    if (!owner) continue
    const assetName = ALL_CARDS[codeOf(asset)]?.nameZh || codeOf(asset)
    const answer = safeCall(api, 'choice', {
      kind: 'effect', source: VENGEANT_PAST_CODE, seat: inv.seat,
      prompt: `复仇往昔：${assetName}——选择一项。`,
      options: [
        { id: 'damage', label: `让 ${owner.name} 受到 1 点伤害` },
        { id: 'horror', label: `让 ${owner.name} 受到 1 点恐惧` },
        { id: 'shuffle', label: '把该古代遗物洗回探索牌库' },
      ],
    })
    if (answer === 'shuffle') {
      asset.removedFromGame = true
      asset.controllerSeat = null
      shuffled.push(codeOf(asset))
    } else if (answer === 'horror') safeCall(api, 'horror', owner.seat, 1)
    else safeCall(api, 'damage', owner.seat, 1)
  }
  if (shuffled.length) shuffleIntoExploration(state, shuffled, api)
  // 复仇往昔自身洗回探索牌库（不进入遭遇弃牌堆）。
  shuffleIntoExploration(state, [VENGEANT_PAST_CODE], api)
  info(api, '复仇往昔结算完毕：本卡洗回探索牌库。')
  return true
}

export { ENCOUNTER_DECK, TOKEN_MEANINGS, SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT }

export const behavior = {
  id: CHAPTER_ID,
  startLocation,
  setupLocations,
  afterDeckSetup,
  canExplore,
  afterExplore,
  drawStoryAsset,
  resolveEncounter,
  checkObjectives,
  actReveal,
  agendaAdvancing,
  agendaReveal,
  allResigned,
  investigatorEliminated,
  enemyStatModifier,
  resolveChaosToken,
  applyTokenEffect,
  tokenMeanings,
  resolution,
  introduction,
  scenarioSummary,
}

void innerChamberThreshold
void SET_ASIDE_CODES
void SUPPLY_NAMES
void LOCATION_TABLE
void EXPLORATION_TREACHERY_CODES
void EXPLORATION_ENEMY_CODES
