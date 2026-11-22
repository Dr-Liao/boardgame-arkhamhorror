// 安魂镇息（Laid to Rest · 90054）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/LaidToRest.hs + frontend/src/locales/en/standalone/laidToRest.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   startLocation / setupLocations / setupEnemies / afterDeckSetup → 布置地点、双遭遇牌库、
//     灵魂牌库、异端者、饥饿之魂暗置与让·德弗罗。
//   actions / performAction → 幕的移动敌人/翻地点、议程的谈判驱魂、让的谈判。
//   enemyDefeated / actReveal / agendaReveal / allResigned / resolution → 结局与记录。
//   resolveChaosToken / applyTokenEffect → 90054 提示卡四类标记（按难度分支）。
//   encounterDeckFor → [[幽灵]]地点改用幽灵遭遇牌库。
//   locationFlipped → 饥饿之魂显形 + 闹鬼文本。
//
// 近似（risks 同 status.json）：灵魂牌库/彼端的完整「附属 4 张翻面」由 core-inv 的 90052
// 条目承担；本 behavior 维护 state.scenarioZones.spiritDeck / beyondAttached 的**记账**，
// 供驱魂、计数与测试读点；「未了之事进胜利区」用 `banishedUnfinishedBusiness` 记账。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { extraDeckPiles, setExtraDeckPiles } from '../../../../../src/engine/alt-decks.js'
import {
  ACT_CODE, AGENDA_CODE, BEYOND_CODE, FIXED_LOCATION_IDS, HAUNTED_BY_LOCATION,
  HERETIC_ENEMY_CODES, JEAN_POSSESSED_CODE, JEAN_SEEKING_CODE, KEY_INVESTIGATOR,
  LOCATION_PAIRS, RAVENOUS_CODE, RESOLUTION_KEYS, SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT,
  SCENARIO_TEXT, SPECTRAL_DECK_CODES, SPIRIT_ALLY_CODES, START_LOCATION, TOKEN_MEANINGS,
  UNFINISHED_BUSINESS_CODES, VENGEFUL_SHADE_CODE, tokenTier,
} from './definition.js'

const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const codeOf = value => String(value?.originalCode || value?.code || '')
const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())
const flagsFor = state => (state.scenarioFlags ||= {})
const flag = (state, key) => flagsFor(state)[key]
const setFlag = (state, key, value = true) => { flagsFor(state)[key] = value; return value }
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const isSpectralLocation = location => Boolean(location) && (hasTrait(location, 'Spectral')
  || String(location.originalCode || location.code || '').endsWith('b'))
const isJim = inv => codeOf(inv) === KEY_INVESTIGATOR || /Jim Culver|吉姆·卡尔弗/.test(String(inv?.nameEn || inv?.name || ''))
const findJim = state => (state.investigators || []).find(inv => inv && isJim(inv)) || null
const findJean = state => (state.enemies || []).find(enemy => [JEAN_SEEKING_CODE, JEAN_POSSESSED_CODE].includes(codeOf(enemy))) || null
const info = (api, message) => api?.info?.(message)
const safe = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const zones = state => (state.scenarioZones ||= {})
const groupCluesAt = (state, id) => activeInvestigators(state)
  .filter(inv => inv.location === id).reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1

function shuffleWith(api, list) {
  if (typeof api?.shuffle === 'function') return api.shuffle([...list])
  const rng = typeof api?.random === 'function' ? api.random : () => Math.random()
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Number(rng()) * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function spiritDeck(state) {
  const list = zones(state).spiritDeck
  if (Array.isArray(list)) return list
  return (zones(state).spiritDeck = [])
}

export function banishedUnfinishedBusiness(state) {
  const explicit = new Set(flag(state, 'banishedUnfinishedBusiness') || [])
  const fromVictory = (state.victoryDisplay || []).map(card => codeOf(card))
    .filter(code => UNFINISHED_BUSINESS_CODES.includes(code))
  return new Set([...explicit, ...fromVictory]).size
}

export function attachedToBeyond(state) {
  return [...(zones(state).beyondAttached || [])]
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function startLocation() {
  return START_LOCATION
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const rng = typeof api?.random === 'function' ? api.random : () => Math.random()
  const pickOne = list => list[Math.floor(Number(rng()) * list.length) % list.length]
  const picks = [
    'hangmansBrook',
    'hauntedFields',
    'abandonedChapel',
    pickOne(LOCATION_PAIRS.theGallows),
    pickOne(LOCATION_PAIRS.hereticsGraves),
    pickOne(LOCATION_PAIRS.chapelCrypt),
    'chapelAttic176',
  ]
  setFlag(state, 'laidToRestLocations', picks)
  info(api, `安魂镇息：放置 ${picks.length} 处地点（每组双面地点随机选 1 张），全员从绞刑者河开始。`)
  return picks
}

export function setupEnemies(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const spawn = typeof helper?.spawnEnemy === 'function'
    ? (code, location) => helper.spawnEnemy(code, location)
    : null
  if (spawn) spawn(JEAN_SEEKING_CODE, START_LOCATION)
  // 引擎的 spawnEnemy 需要 scenario.enemies 定义；未提供时由 afterDeckSetup 兜底生成。
  return true
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  void helper
  // 1) 幽灵遭遇牌库（第二牌堆）。
  setExtraDeckPiles(state, 'spectral', {
    deck: shuffleWith(api, SPECTRAL_DECK_CODES),
    discard: [],
  })
  // 1.5) 每个地点至少 1[per_investigator] 个线索。
  const perPlayerClues = investigatorCount(state)
  for (const location of state.locations || []) {
    const target = Math.max(Number(location.maxClues) || 0, Number(location.cluesPerInvestigator) || 1) * perPlayerClues
    location.maxClues = Math.max(Number(location.maxClues) || 0, target)
    location.clues = Math.max(Number(location.clues) || 0, target)
  }
  // 2) 异端者：随机 2 张移出游戏，其余 4 张敌人面朝上洗入灵魂牌库。
  const order = shuffleWith(api, [...HERETIC_ENEMY_CODES])
  const removedHeretics = order.slice(4)
  const keptHeretics = order.slice(0, 4)
  setFlag(state, 'removedHeretics', removedHeretics)
  setFlag(state, 'hereticsInDeck', keptHeretics)
  // 3) 灵魂牌库：9 张盟友 + 4 张异端者（近似：固定候选 + 随机异端者）。
  zones(state).spiritDeck = shuffleWith(api, [...SPIRIT_ALLY_CODES, ...keptHeretics])
  setFlag(state, 'laidToRestSpiritDeckSize', zones(state).spiritDeck.length)
  // 4) 彼端：确保在吉姆的场上（若 core-inv 的 90052 已按玩家牌组入场则跳过）。
  const jim = findJim(state)
  if (jim) {
    const hasBeyond = (jim.assets || []).some(asset => codeOf(asset) === BEYOND_CODE)
    if (!hasBeyond && typeof api?.giveAsset === 'function') safe(api, 'giveAsset', jim.seat, BEYOND_CODE)
    setFlag(state, 'beyondSeat', jim.seat)
  }
  // 5) 饥饿之魂暗置在 4 个地点下方（由 locationFlipped 显形）。
  const picks = flag(state, 'laidToRestLocations') || []
  const ravenousLocations = [
    picks.find(id => id.startsWith('theGallows')),
    picks.find(id => id.startsWith('hereticsGraves')),
    'chapelAttic176',
    picks.find(id => id.startsWith('chapelCrypt')),
  ].filter(Boolean)
  setFlag(state, 'ravenousUnder', Object.fromEntries(ravenousLocations.map(id => [id, RAVENOUS_CODE])))
  // 6) 让·德弗罗（若 setupEnemies 未能生成则在此兜底）。
  if (!findJean(state)) spawnScenarioEnemy(state, JEAN_SEEKING_CODE, START_LOCATION)
  setFlag(state, 'laidToRestPrepared', true)
  info(api, `安魂镇息：幽灵遭遇牌库 ${SPECTRAL_DECK_CODES.length} 张；灵魂牌库 ${zones(state).spiritDeck.length} 张；`
    + `饥饿之魂暗置在 ${ravenousLocations.length} 个地点下方；让·德弗罗在绞刑者河。`)
  return { spectral: SPECTRAL_DECK_CODES.length, spiritDeck: zones(state).spiritDeck.length }
}

// 本地敌人实例（内容注册前测试也能布置；引擎 spawnEnemy 缺失时兜底）。
export function spawnScenarioEnemy(state, code, locationId, options = {}) {
  const definition = (state.scenario?.enemies || {})[code]
  if (!definition) return null
  const existing = (state.enemies || []).find(enemy => codeOf(enemy) === code)
  if (existing) return existing
  state.enemies ||= []
  const count = investigatorCount(state)
  const health = definition.healthPerInvestigator
    ? (Number(definition.health) || 1) * count + (definition.healthPerPlayerBonus || 0) * count
    : (Number(definition.health) || 1) + (definition.healthPerPlayerBonus || 0) * count
  const enemy = {
    id: `e${++state.instanceSeq.e}`, code, originalCode: code,
    name: definition.name, nameEn: definition.nameEn,
    location: locationId,
    fight: definition.fight ?? null, evade: definition.evade ?? null,
    health, damage: definition.damage || 0, horror: definition.horror || 0,
    traits: [...(definition.traits || [])],
    hunter: Boolean(definition.hunter), aloof: Boolean(definition.aloof),
    retaliate: Boolean(definition.retaliate),
    elite: Boolean(definition.elite), exhausted: options.exhausted === true,
    engagedSeat: options.engagedSeat ?? null, damageTaken: 0, doom: 0, clues: 0,
    victory: Number(definition.victory) || 0,
  }
  state.enemies.push(enemy)
  if (enemy.engagedSeat != null) state.investigators[enemy.engagedSeat]?.engaged?.push(enemy.id)
  return enemy
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here) return []
  const moves = []
  const jean = findJean(state)
  const perPlayer = investigatorCount(state)
  if (jean && jean.location === here.id) {
    moves.push({
      action: 'scenarioAction', rule: 'laidToRestJeanParley', locationId: here.id, actions: 1,
      enemyId: jean.id,
      label: jean.code === JEAN_POSSESSED_CODE
        ? '与「让·德弗罗（附身）」谈判：意志检定（难度 3 + 胜利区未了之事数量）'
        : '与「让·德弗罗」谈判：抽取暗置的牌并带走一个异端者',
    })
  }
  const deck = spiritDeck(state)
  if (deck.length) {
    moves.push({
      action: 'scenarioAction', rule: 'laidToRestBanishSpirit', locationId: here.id, actions: 1,
      label: `[action] 团队共同花费 ${2 * perPlayer} 个线索：谈判，驱除一个灵魂（弃灵魂牌库顶的牌）`,
      reason: groupCluesAt(state, here.id) >= 2 * perPlayer ? null : `本地点需要 ${2 * perPlayer} 个线索`,
    })
  }
  const enemiesHere = (state.enemies || []).filter(enemy => enemy.location === here.id)
  if (enemiesHere.length) {
    moves.push({
      action: 'scenarioAction', rule: 'laidToRestMoveEnemy', locationId: here.id, actions: 0,
      label: '[free] 横置吉姆的小号，或团队共同花费 1[per_investigator] 个线索：将一个敌人向吉姆移动一次',
    })
  }
  const alreadyFlipped = (flag(state, 'flippedThisRound') || {})[here.id] === state.round
  moves.push({
    action: 'scenarioAction', rule: 'laidToRestFlipLocation', locationId: here.id, actions: 0,
    label: '[free] 团队共同花费 1[per_investigator] 个线索：将你的所在地点翻面（每地点每轮一次）',
    reason: alreadyFlipped ? '本地点本轮已翻面' : groupCluesAt(state, here.id) >= perPlayer ? null : `需要 ${perPlayer} 个线索`,
  })
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  switch (move.rule) {
    case 'laidToRestJeanParley': return jeanParley(state, inv, api)
    case 'laidToRestBanishSpirit': return banishSpirit(state, inv, api)
    case 'laidToRestMoveEnemy': return moveEnemyTowardJim(state, inv, api)
    case 'laidToRestFlipLocation': return flipHere(state, inv, api)
    default: return false
  }
}

function payGroupClues(state, locationId, amount) {
  let remaining = amount
  for (const inv of activeInvestigators(state).filter(item => item.location === locationId)) {
    if (remaining <= 0) break
    const pay = Math.min(Number(inv.clues) || 0, remaining)
    inv.clues -= pay
    remaining -= pay
  }
  state.clues = activeInvestigators(state).reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
  return remaining === 0
}

function jeanParley(state, inv, api) {
  const jean = findJean(state)
  if (!jean || jean.location !== inv.location) return false
  if (jean.code === JEAN_POSSESSED_CODE) {
    const difficulty = 3 + banishedUnfinishedBusiness(state)
    info(api, `${inv.name} 与附身的让·德弗罗谈判（意志检定，难度 ${difficulty}）。`)
    if (typeof api.test !== 'function') return true
    api.test(inv.seat, 'willpower', difficulty, result => {
      if (!result?.success) return
      jean.damageTaken = 0
      jean.code = JEAN_SEEKING_CODE
      jean.originalCode = JEAN_SEEKING_CODE
      info(api, `让·德弗罗被治愈并翻回 Seeking Closure 面（不再交战）。`)
    })
    return true
  }
  // Seeking Closure：抽取同名地点下方暗置的牌 + 从彼端带走一个异端者（近似：直接驱除一张未了之事）。
  const deck = spiritDeck(state)
  const index = deck.findIndex(code => HERETIC_ENEMY_CODES.includes(code))
  if (index >= 0) {
    const enemyCode = deck.splice(index, 1)[0]
    const storyCode = UNFINISHED_BUSINESS_CODES[HERETIC_ENEMY_CODES.indexOf(enemyCode)]
    banishUnfinishedBusiness(state, storyCode)
    if (typeof api.drawCards === 'function') api.drawCards(inv.seat, 1)
    info(api, `${inv.name} 从彼端带走了一个异端者：未了之事被驱除（胜利区 ${banishedUnfinishedBusiness(state)} 张）。`)
  } else {
    info(api, '灵魂牌库里没有仍附在彼端上的异端者。')
  }
  const here = locationOf(state, inv.location)
  const hidden = (zones(state).beneath || {})[here?.id]
  if (hidden) {
    delete zones(state).beneath[here.id]
    info(api, `${inv.name} 抽出了「${here.name}」下方暗置的牌。`)
  }
  maybeAdvanceAct(state, api)
  return true
}

function banishUnfinishedBusiness(state, storyCode) {
  const list = new Set(flag(state, 'banishedUnfinishedBusiness') || [])
  if (storyCode) list.add(storyCode)
  setFlag(state, 'banishedUnfinishedBusiness', [...list])
  zones(state).banished ||= []
  if (storyCode && !zones(state).banished.includes(storyCode)) zones(state).banished.push(storyCode)
}

function banishSpirit(state, inv, api) {
  const perPlayer = investigatorCount(state)
  if (!payGroupClues(state, inv.location, 2 * perPlayer)) return false
  const deck = spiritDeck(state)
  const code = deck.pop()
  if (!code) return false
  if (HERETIC_ENEMY_CODES.includes(code)) {
    const storyCode = UNFINISHED_BUSINESS_CODES[HERETIC_ENEMY_CODES.indexOf(code)]
    banishUnfinishedBusiness(state, storyCode)
    info(api, `${inv.name} 驱除了一个异端者（未了之事进胜利区：${banishedUnfinishedBusiness(state)}/4）。`)
  } else if (UNFINISHED_BUSINESS_CODES.includes(code)) {
    banishUnfinishedBusiness(state, code)
    info(api, `${inv.name} 驱除了一个灵魂。`)
  } else {
    zones(state).spiritDeckBottom ||= []
    zones(state).spiritDeckBottom.push(code)
    info(api, `${inv.name} 弃掉了灵魂牌库顶的「${(ALL_CARDS[code] || {}).nameZh || code}」（放回灵魂牌库底）。`)
  }
  maybeAdvanceAct(state, api)
  return true
}

function maybeAdvanceAct(state, api) {
  if (banishedUnfinishedBusiness(state) >= 4) {
    info(api, '胜利区已有 4 张「未了之事」：推进场景。')
    safe(api, 'advanceAct')
  }
}

function moveEnemyTowardJim(state, inv, api) {
  const jim = findJim(state) || inv
  const perPlayer = investigatorCount(state)
  const enemies = (state.enemies || []).filter(enemy => enemy.location === inv.location)
  if (!enemies.length) return false
  const enemy = enemies[0]
  // 近似：直接移动到吉姆所在地点（真实规则为「向吉姆移动一次」的最短路径一步）。
  const target = locationOf(state, jim.location)
  if (!target) return false
  enemy.location = jim.location
  enemy.engagedSeat = null
  if (Number(jim.clues) >= perPlayer) jim.clues -= perPlayer
  info(api, `「${enemy.name}」被移动向吉姆·卡尔弗的所在地点「${target.name}」。`)
  return true
}

function flipHere(state, inv, api) {
  const here = locationOf(state, inv.location)
  if (!here) return false
  const perPlayer = investigatorCount(state)
  const flipped = flag(state, 'flippedThisRound') || {}
  if (flipped[here.id] === state.round) return false
  if (!payGroupClues(state, here.id, perPlayer)) return false
  flipped[here.id] = state.round
  setFlag(state, 'flippedThisRound', flipped)
  safe(api, 'flipLocation', here.id, inv.seat)
  info(api, `${inv.name} 将「${here.name}」翻面。`)
  return true
}

// ---------------------------------------------------------------------------
// 地点翻面：闹鬼 + 饥饿之魂显形
// ---------------------------------------------------------------------------
export function locationFlipped(state, location, api = {}, seat = null) {
  void seat
  if (!location) return false
  // 引擎的 flipScenarioLocation 只派发钩子；打印面数据由章节在这里应用（与 flipLocationFace 同形）。
  const card = ALL_CARDS[location.code] || ALL_CARDS[location.originalCode]
  const backCode = card?.linkedCardCode
  const isFront = Boolean(backCode)
  const faceCode = isFront ? backCode : String(location.originalCode || location.code).replace(/b$/, '')
  const face = ALL_CARDS[faceCode]
  if (face) {
    location.code = faceCode
    location.originalCode = faceCode
    location.artCode = faceCode
    location.name = face.nameZh || face.name || faceCode
    location.traits = [...(face.traits || [])]
    if (Number.isFinite(face.shroud)) location.shroud = face.shroud
    if (Number.isFinite(face.clues) && isFront) {
      location.clues = face.clues
      location.maxClues = Math.max(Number(location.maxClues) || 0, face.clues)
    }
  }
  const haunted = HAUNTED_BY_LOCATION[location.hauntedGroup]
  if (haunted && isSpectralLocation(location)) location.haunted = structuredClone(haunted)
  else delete location.haunted
  // 暗置的饥饿之魂在翻到幽灵面时显形（近似：直接在原地生成）。
  const hidden = flag(state, 'ravenousUnder') || {}
  if (hidden[location.id] && isSpectralLocation(location)) {
    delete hidden[location.id]
    setFlag(state, 'ravenousUnder', hidden)
    spawnScenarioEnemy(state, RAVENOUS_CODE, location.id)
    info(api, `「${location.name}」翻到幽灵面：暗置的饥饿之魂显形。`)
  }
  return true
}

// ---------------------------------------------------------------------------
// 遭遇牌库选择
// ---------------------------------------------------------------------------
export function encounterDeckFor(state, inv) {
  if (!state.extraEncounterDecks?.spectral) return null
  const here = locationOf(state, inv?.location)
  if (!isSpectralLocation(here)) return null
  setFlag(state, 'lastEncounterDeck', 'spectral')
  return 'spectral'
}

// ---------------------------------------------------------------------------
// 敌人 / 幕 / 议程 / 结局
// ---------------------------------------------------------------------------
export function enemyDefeated(state, enemy, api = {}) {
  if (codeOf(enemy) !== RAVENOUS_CODE) return false
  info(api, '饥饿之魂被击败（基础胜利点照常结算）。')
  return false
}

export function checkObjectives(state, api = {}) {
  if (banishedUnfinishedBusiness(state) >= 4) {
    info(api, '目标达成：胜利区有 4 张「未了之事」，推进场景。')
    safe(api, 'advanceAct')
    return true
  }
  return false
}

export function actReveal(state, act, api = {}) {
  if (codeOf(act) !== ACT_CODE) return false
  setFlag(state, 'laidToRestResolution', 'resolution1')
  info(api, '幕 1 背面：为了结未了之事，你们成功安抚了死者的亡灵。（结局 1）')
  safe(api, 'finish', 'resolution1')
  return true
}

export function agendaReveal(state, agenda, api = {}) {
  if (codeOf(agenda) !== AGENDA_CODE) return false
  const horror = (flag(state, 'agendaHorror') || 0) + 1
  setFlag(state, 'agendaHorror', horror)
  if (horror >= 4) {
    setFlag(state, 'laidToRestResolution', 'resolution2')
    for (const inv of activeInvestigators(state)) {
      if (typeof api?.horror === 'function') api.horror(inv.seat, 1)
    }
    info(api, '冒险参考卡上已有 4 点恐惧：全体未离场的调查员被击败（结局 2）。')
    safe(api, 'finish', 'resolution2')
    return true
  }
  // 否则：补充线索、把除让所在地点外每个地点翻回非幽灵面，然后翻回议程。
  const perPlayer = investigatorCount(state)
  for (const location of state.locations || []) {
    if (location.revealed !== false) location.clues = Math.max(Number(location.clues) || 0, perPlayer)
  }
  const jean = findJean(state)
  for (const location of state.locations || []) {
    if (jean && jean.location === location.id) continue
    if (isSpectralLocation(location)) safe(api, 'flipLocation', location.id)
  }
  state.agendaDoom = 0
  info(api, `迷雾聚集：冒险参考卡上放置 1 点恐惧（${horror}/4）。补充线索并翻回地点，议程翻回。`)
  return true
}

export function allResigned(state, api = {}) {
  setFlag(state, 'laidToRestResolution', 'resolution2')
  safe(api, 'finish', 'resolution2')
  return true
}

export function resolution(state, key, events = null, api = {}) {
  void events
  void api
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const recordKey = finalKey === 'resolution1' ? 'resolution1' : 'resolution2'
  setFlag(state, 'laidToRestResolvedTo', recordKey)
  const enemies = (state.victoryDisplay || []).filter(card => (state.scenario?.enemies || {})[codeOf(card)])
  const locations = (state.victoryDisplay || []).filter(card => codeOf(card).startsWith('0516')
    || codeOf(card).startsWith('0517'))
  const enemyVictory = enemies.reduce((sum, card) => sum + (Number(card.victory) || 0), 0)
  const locationVictory = locations.reduce((sum, card) => sum + (Number(card.victory) || 0), 0)
  return {
    award: true,
    seatBonus: seat => {
      const inv = state.investigators?.[seat]
      return isJim(inv) ? Math.max(0, enemyVictory - locationVictory) : 0
    },
    effects: [
      { record: { laidToRestResolution: recordKey } },
      { record: { laidToRestUnfinishedBusinessBanished: banishedUnfinishedBusiness(state) } },
      { record: { laidToRestSpiritDeckRemaining: spiritDeck(state).length } },
      { text: recordKey === 'resolution1'
        ? '调查队安抚了死者的亡灵，让终于得以安息。'
        : '调查队未能了结所有未了之事，让·德弗罗与死者一同留在了绞刑者山丘。' },
    ],
  }
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
function spectralLocationCount(state) {
  return (state.locations || []).filter(location => isSpectralLocation(location)).length
}

function geistAtLocation(state, inv) {
  return (state.enemies || []).some(enemy => enemy.location === inv.location && hasTrait(enemy, 'Geist'))
}

export function resolveChaosToken(state, inv, token, api = {}) {
  void api
  const hard = tokenTier(state) === 'hard'
  switch (String(token)) {
    case 'skull': {
      const n = banishedUnfinishedBusiness(state)
      return { delta: -(n + (hard ? 2 : 1)), onDraw: [], onFail: [] }
    }
    case 'cultist': {
      const n = attachedToBeyond(state).length
      return { delta: -(hard ? n * 2 : n), onDraw: [], onFail: [] }
    }
    case 'tablet': {
      const n = spectralLocationCount(state)
      return { delta: -(hard ? n * 2 : n), onDraw: [], onFail: [] }
    }
    case 'elderthing': {
      if (!hard && geistAtLocation(state, inv)) return { delta: -2, drawAnother: true, onDraw: [], onFail: [] }
      return { delta: hard ? -3 : -2, onDraw: [], onFail: [] }
    }
    default:
      return null
  }
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  if (!effect || effect.type !== 'scenarioToken') return false
  switch (effect.mode) {
    case 'discardTop': {
      const count = Number(effect.count) || 2
      if (typeof api.discardTop === 'function') api.discardTop(inv.seat, count)
      else {
        const deck = inv.deck || []
        const discarded = []
        for (let i = 0; i < count && deck.length; i += 1) discarded.push(deck.pop())
        inv.discard.push(...discarded)
      }
      info(api, `${inv.name} 弃掉牌库顶 ${count} 张牌。`)
      return true
    }
    default:
      return false
  }
}

export function tokenMeanings() {
  return TOKEN_MEANINGS
}

// ---------------------------------------------------------------------------
// 只读投影 / 导入正文
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  const jim = findJim(state)
  const jean = findJean(state)
  return {
    locations: (flag(state, 'laidToRestLocations') || []).slice(),
    jimSeat: jim?.seat ?? null,
    jeanLocation: jean?.location ?? null,
    jeanSide: jean?.code || null,
    banishedUnfinishedBusiness: banishedUnfinishedBusiness(state),
    spiritDeckRemaining: spiritDeck(state).length,
    spectralDeckRemaining: state.extraEncounterDecks?.spectral?.deck?.length ?? 0,
    agendaHorror: flag(state, 'agendaHorror') || 0,
    ravenousUnder: { ...(flag(state, 'ravenousUnder') || {}) },
    beyondAttached: attachedToBeyond(state),
  }
}

export function introduction() {
  const paragraphs = SCENARIO_TEXT.intro.split(/\n{2,}/).map(line => line.trim()).filter(Boolean)
  return {
    version: 3,
    title: SCENARIO_TEXT.heading,
    sections: [{ title: SCENARIO_TEXT.heading, paragraphs }],
    paragraphs,
    code: ACT_CODE,
  }
}

export function modifyDeck(state, deck) {
  // 本关的两套遭遇牌库由 setup 自行拆分；基础牌库保持原样。
  void state
  return deck
}

export const behavior = {
  id: 'laidToRest',
  locationsStartRevealed: true,
  startLocation,
  setupLocations,
  setupEnemies,
  afterDeckSetup,
  actions,
  performAction,
  enemyDefeated,
  checkObjectives,
  actReveal,
  agendaReveal,
  allResigned,
  resolution,
  resolveChaosToken,
  applyTokenEffect,
  tokenMeanings,
  encounterDeckFor,
  locationFlipped,
  modifyDeck,
  introduction,
  scenarioSummary,
  // 具名助手（测试/验收）
  findJim,
  findJean,
  banishedUnfinishedBusiness,
  attachedToBeyond,
  spiritDeck,
  spawnScenarioEnemy,
  SCENARIO_ACT_TEXT,
  SCENARIO_AGENDA_TEXT,
  TOKEN_MEANINGS,
  VENGEFUL_SHADE_CODE,
}

export {
  ACT_CODE, AGENDA_CODE, JEAN_SEEKING_CODE, JEAN_POSSESSED_CODE, RAVENOUS_CODE, BEYOND_CODE,
  RESOLUTION_KEYS, START_LOCATION, KEY_INVESTIGATOR, findJim, findJean, spiritDeck,
}
