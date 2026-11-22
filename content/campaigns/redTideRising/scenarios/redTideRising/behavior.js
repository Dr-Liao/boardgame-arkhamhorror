// 红潮涌起（Red Tide Rising · 90041）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/RedTideRising.hs + frontend/src/locales/en/standalone/redTideRising.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   startLocation / setupLocations / setupEnemies / afterDeckSetup → 7 地点、Leads deck 首张、
//     嫌疑犯/藏身处、怪物放一边、Angry Mob、双面神秘相片。
//   actions / performAction → 神秘相片（正面谈判/翻面/花线索入胜利区；背面调查/翻面/花线索入胜利区）。
//   agendaWouldAdvance → 议程 1「将要推进时改为移除毁灭并洗入一只放一边怪物」。
//   checkObjectives / actReveal / agendaReveal / allResigned → 幕/议程推进与结局。
//   afterTest → [tablet] 成功看迹象顶牌可混洗；[elder_thing] 失败把遭遇顶牌洗入迹象。
//   resolveChaosToken / applyTokenEffect / tokenMeanings → 90041 提示卡的四类标记。
//   resolution → 声明式结局效果（记录 + 温蒂/其他调查员经验）。
//
// 本章状态只写 state.scenarioFlags / state.scenarioZones / state.campaign.records（纯 JSON）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT_CODE, AGENDA1_CODE, AGENDA2_CODE, AGENDA_CODES, ANGRY_MOB_CODE, CHAPTER_ID,
  ENCOUNTER_DECK, HIDEOUT_CODES, HIDEOUT_LOCATION_IDS, KEY_INVESTIGATOR, LEADS_CARDS, LEADS_DECK_ID,
  LOCATIONS, LOCATION_CODES, LOCATION_TABLE, MONSTER_CODES, PHOTO_BACK, PHOTO_FRONT,
  RESOLUTION_KEYS, SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT, SCENARIO_TEXT, START_LOCATION,
  SUSPECT_CODES, SUSPECT_HOME_LOCATIONS, TOKEN_MEANINGS, WENDY_TITLE, tokenTier,
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
export const isWendy = inv => codeOf(inv) === KEY_INVESTIGATOR
  || String(inv?.nameEn || inv?.name || '').includes(WENDY_TITLE)
export const findWendy = state => (state.investigators || []).find(inv => inv && isWendy(inv)) || null
const currentActCode = state => codeOf(state.acts?.[state.actIndex]) || ''
const currentAgendaCode = state => codeOf(state.agendas?.[state.agendaIndex]) || ''
const cluesOn = (state, id) => Number(locationOf(state, id)?.clues) || 0
const groupCluesAt = (state, locationId) => activeInvestigators(state)
  .filter(inv => inv.location === locationId)
  .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
const isHideoutId = id => HIDEOUT_LOCATION_IDS.includes(id)
const isSuspectCode = code => SUSPECT_CODES.includes(code)
const hideoutCodeForLocation = state => code => {
  const id = Object.keys(LOCATION_CODES).find(key => LOCATION_CODES[key] === code)
  return id
}

function localShuffle(list, rng) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Number(rng()) * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// 本地敌人实例：不依赖 ALL_ENEMIES（内容注册前测试也能布置）。
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
    prey: definition.prey || null,
    elite: Boolean(definition.elite),
    exhausted: options.exhausted === true,
    engagedSeat: options.engagedSeat ?? null,
    damageTaken: 0,
    doom: 0,
    clues: options.clues || 0,
    attachments: [],
    victory: Number(definition.victory) || 0,
    ...(options.preysSeat != null ? { preySeat: options.preysSeat } : {}),
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

// ---------------------------------------------------------------------------
// Leads deck（引擎通用 scenarioDecks，id='leads'）
// ---------------------------------------------------------------------------
export function leadsDeckApi(api) {
  return api?.scenarioDecks || api?.mechanics?.scenarioDecks || null
}

export function leadsSize(state, api = null) {
  const decks = leadsDeckApi(api)
  if (decks && typeof decks.size === 'function') {
    try { return decks.size(LEADS_DECK_ID) } catch { /* 尚未初始化 */ }
  }
  return Number(flagValue(state, 'leadsRemaining') ?? 0)
}

function setAsideCodes(state) {
  const zones = (state.scenarioZones ||= {})
  zones.setAside ||= []
  return zones
}

function firstLeadCard(state) {
  return state.enemies?.find(enemy => isSuspectCode(codeOf(enemy))) ? null : null
}

function suspectEnemy(state) {
  return (state.enemies || []).find(enemy => isSuspectCode(codeOf(enemy)) && !enemy.defeated) || null
}

function placeSuspect(state, code, api = null) {
  const locationId = SUSPECT_HOME_LOCATIONS[code] || START_LOCATION
  const enemy = spawnScenarioEnemy(state, code, locationId, { clues: investigatorCount(state) })
  info(api, `「${enemy?.name || code}」出现在「${locationOf(state, locationId)?.name || locationId}」。`)
  return enemy
}

function placeHideout(state, code, api = null) {
  const id = hideoutCodeForLocation(state)(code)
  if (!id) return null
  const placed = safeCall(api, 'placeLocation', id)
  const here = locationOf(state, id)
  if (here) here.revealed = true
  info(api, `藏身处「${here?.name || code}」浮出水面。`)
  return placed ? here : here
}

// 抽到一张迹象：地点 → 入场；敌人 → 生成。返回 {kind, code, id}。
export function resolveLead(state, code, api = null) {
  if (!code) return null
  const pendingMonster = MONSTER_CODES.includes(code)
  if (pendingMonster) {
    const enemy = spawnScenarioEnemy(state, code, START_LOCATION)
    info(api, `怪物「${enemy?.name || code}」从迹象牌堆中现身。`)
    return { kind: 'monster', code }
  }
  if (HIDEOUT_CODES.includes(code)) {
    const location = placeHideout(state, code, api)
    return { kind: 'location', code, id: location?.id || null }
  }
  if (isSuspectCode(code)) {
    const enemy = placeSuspect(state, code, api)
    return { kind: 'suspect', code, id: enemy?.location || null }
  }
  return { kind: 'unknown', code }
}

export function drawLead(state, api = null, options = {}) {
  const decks = leadsDeckApi(api)
  let code = null
  if (decks && typeof decks.take === 'function') {
    try {
      code = decks.take(LEADS_DECK_ID, 1)[0] || null
    } catch { code = null }
  }
  if (code == null) {
    const list = flagValue(state, 'leadsPending')
    if (Array.isArray(list) && list.length) {
      code = list.pop()
      setFlag(state, 'leadsPending', list)
    }
  }
  if (code == null) return null
  return { ...resolveLead(state, code, api), code }
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function startLocation(state) {
  const flags = flagsFor(state)
  if (!flags.firstLead) {
    const order = localShuffle(LEADS_CARDS, () => Math.random())
    setFlag(state, 'firstLead', order[0])
    setFlag(state, 'leadsPending', order.slice(1))
  }
  const first = flagValue(state, 'firstLead')
  if (HIDEOUT_CODES.includes(first)) return hideoutCodeForLocation(state)(first)
  return SUSPECT_HOME_LOCATIONS[first] || START_LOCATION
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const flags = flagsFor(state)
  setAsideCodes(state)
  const fixed = LOCATION_TABLE.map(([id]) => id).filter(id => !isHideoutId(id))
  const first = flagValue(state, 'firstLead')
  const extra = HIDEOUT_CODES.includes(first) ? [hideoutCodeForLocation(state)(first)] : []
  for (const id of extra) {
    const location = state.locations?.find(item => item.id === id)
    if (location) location.revealed = false
  }
  setFlag(state, 'redTideFirstLead', first)
  info(api, `红潮涌起：放置 ${fixed.length} 处印斯茅斯地点；迹象牌堆首张为「${ALL_CARDS[first]?.nameZh || first}」。`)
  return [...fixed, ...extra]
}

export function setupEnemies(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const first = flagValue(state, 'firstLead')
  const zones = setAsideCodes(state)
  zones.setAside = [
    ANGRY_MOB_CODE,
    ...MONSTER_CODES,
    ...HIDEOUT_CODES,
    PHOTO_FRONT, PHOTO_BACK,
  ]
  if (isSuspectCode(first)) {
    placeSuspect(state, first, api)
  }
  info(api, `放一边：愤怒暴民、${MONSTER_CODES.length} 只怪物、6 处藏身处与神秘相片。`)
  return true
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const flags = flagsFor(state)
  const count = investigatorCount(state)
  const hard = ['hard', 'expert'].includes(String(state.difficulty || 'standard'))
  const adjusted = count + (hard ? (state.difficulty === 'expert' ? 2 : 1) : 0)

  // 1) 迹象牌堆：首张已抽出，其余 11 张（+ 调整值 ≥ 4 时多 1 只怪物）洗混。
  const pending = [...(flagValue(state, 'leadsPending') || [])]
  if (adjusted >= 4 && MONSTER_CODES.length) {
    const zones = setAsideCodes(state)
    const monster = MONSTER_CODES.find(code => zones.setAside.includes(code))
    if (monster) {
      pending.push(monster)
      zones.setAside = zones.setAside.filter(code => code !== monster)
    }
  }
  const decks = leadsDeckApi(api)
  if (decks && typeof decks.initialize === 'function') {
    try {
      decks.initialize(LEADS_DECK_ID, pending, { shuffle: true })
      setFlag(state, 'redTideLeadsReady', true)
    } catch { setFlag(state, 'leadsPending', localShuffle(pending, randomOf(api))) }
  } else {
    setFlag(state, 'leadsPending', localShuffle(pending, randomOf(api)))
  }
  setFlag(state, 'leadsRemaining', pending.length)

  // 2) 起始地点揭示：首张抽到敌人的话，该敌人所在地点与印斯茅斯广场。
  const wendy = findWendy(state)
  const start = wendy?.location || START_LOCATION
  for (const id of [start, START_LOCATION]) {
    const location = locationOf(state, id)
    if (location) location.revealed = true
  }

  // 3) 议程 1 的调整值：标准难度 2/3 人各放 1/2 毁灭（1P 标准 = 0）。
  const doom = adjusted === 2 ? 1 : adjusted === 3 ? 2 : adjusted === 5 ? 1 : adjusted === 6 ? 2 : 0
  if (doom > 0) safeCall(api, 'addDoom', doom)

  // 4) 神秘相片：放在温蒂控制下，默认正面（嫌疑犯面）；玩家可在指南/牌桌翻面。
  const photo = spawnStoryAssetSafe(state, api, PHOTO_FRONT, null)
  if (photo) {
    photo.controllerSeat = wendy?.seat ?? 0
    photo.photoSide = PHOTO_FRONT
    photo.exhausted = false
  }
  setFlag(state, 'photoSide', PHOTO_FRONT)
  setFlag(state, 'photoExhaustedRound', null)

  // 5) 其他调查员从印斯茅斯广场开始。
  for (const inv of activeInvestigators(state)) {
    if (wendy && inv.seat === wendy.seat) continue
    inv.location = START_LOCATION
  }
  info(api, `迹象牌堆剩余 ${pending.length} 张；神秘相片在 ${wendy?.name || '温蒂'} 控制下。`)
  return { placed: LOCATION_TABLE.length, leads: pending.length }
}

// ---------------------------------------------------------------------------
// 神秘相片（行动）
// ---------------------------------------------------------------------------
const SUSPECT_PARLEY = Object.freeze({
  '07076': { skill: 'agility', difficulty: 2, failDamage: 1 },
  '07077': { skill: 'agility', difficulty: 3 },
  '07078': { skill: 'agility', difficulty: 3 },
  '07079': { skill: 'willpower', difficulty: 2, failHorror: 1 },
  '07080': { skill: 'willpower', difficulty: 3 },
  '07081': { skill: 'agility', difficulty: 3 },
})

function photoOf(state) {
  return (state.storyAssets || []).find(asset => codeOf(asset) === PHOTO_FRONT || codeOf(asset) === PHOTO_BACK) || null
}

function photoReady(state) {
  const photo = photoOf(state)
  if (!photo || photo.removedFromGame) return false
  return flagValue(state, 'photoExhaustedRound') !== state.round
}

function exhaustPhoto(state) {
  const photo = photoOf(state)
  if (photo) photo.exhausted = true
  setFlag(state, 'photoExhaustedRound', state.round)
}

function currentPhotoSide(state) {
  return codeOf(photoOf(state)) || flagValue(state, 'photoSide') || PHOTO_FRONT
}

function suspectAt(state, locationId) {
  return (state.enemies || []).find(enemy => isSuspectCode(codeOf(enemy)) && enemy.location === locationId && !enemy.defeated) || null
}

function hideoutLocationAt(state, locationId) {
  const location = locationOf(state, locationId)
  if (!location || !isHideoutId(locationId)) return null
  return location
}

function cluelessSuspectAt(state, locationId) {
  return (state.enemies || []).find(enemy => isSuspectCode(codeOf(enemy)) && enemy.location === locationId
    && !enemy.defeated && (Number(enemy.clues) || 0) === 0) || null
}

function cluelessHideoutAt(state, locationId) {
  const location = hideoutLocationAt(state, locationId)
  return location && (Number(location.clues) || 0) === 0 ? location : null
}

export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const wendy = findWendy(state)
  if (!wendy || inv.seat !== wendy.seat) return []
  const photo = photoOf(state)
  if (!photo) return []
  const here = inv.location
  const moves = []
  const ready = photoReady(state)
  const side = currentPhotoSide(state)
  const count = investigatorCount(state)
  const agendaTwo = currentAgendaCode(state) === AGENDA2_CODE

  if (ready && side === PHOTO_FRONT) {
    const suspect = suspectAt(state, here)
    moves.push({
      action: 'scenarioAction', rule: 'redTidePhotoParley', locationId: here, actions: 0, photoAction: 'parley',
      label: suspect
        ? `神秘相片：与「${suspect.name}」谈判（横置相片）`
        : '神秘相片：翻到背面（横置相片）',
    })
    const clueless = cluelessSuspectAt(state, here)
    if (clueless) {
      const cost = (agendaTwo ? 2 : 1) * count
      moves.push({
        action: 'scenarioAction', rule: 'redTidePhotoVictorySuspect', locationId: here, actions: 0, photoAction: 'suspectVictory',
        label: `神秘相片：共同花费 ${cost} 线索，把「${clueless.name}」加入胜利区`,
      })
    }
  }
  if (ready && side === PHOTO_BACK) {
    const hideout = hideoutLocationAt(state, here)
    moves.push({
      action: 'scenarioAction', rule: 'redTidePhotoInvestigate', locationId: here, actions: 0, photoAction: 'investigate',
      label: hideout ? `神秘相片：在「${hideout.name}」调查（横置相片）` : '神秘相片：翻到正面（横置相片）',
    })
    const clueless = hideout && cluelessHideoutAt(state, here)
    if (clueless) {
      const cost = Math.max(1, Number(clueless.cluesPerInvestigator) || Number(clueless.clues) || 1) * count
      moves.push({
        action: 'scenarioAction', rule: 'redTidePhotoVictoryHideout', locationId: here, actions: 0, photoAction: 'hideoutVictory',
        label: `神秘相片：共同花费 ${cost} 线索，把「${clueless.name}」加入胜利区`,
      })
    }
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  const photo = photoOf(state)
  if (!photo) return false
  const here = inv.location
  if (!photoReady(state)) {
    info(api, '神秘相片本回合已经横置过了。')
    return false
  }
  switch (move.rule) {
    case 'redTidePhotoParley': {
      const suspect = suspectAt(state, here)
      exhaustPhoto(state)
      if (!suspect) {
        // 翻面。
        photo.code = currentPhotoSide(state) === PHOTO_FRONT ? PHOTO_BACK : PHOTO_FRONT
        photo.originalCode = photo.code
        setFlag(state, 'photoSide', photo.code)
        info(api, `神秘相片翻到${photo.code === PHOTO_FRONT ? '正面（嫌疑犯）' : '背面（藏身处）'}。`)
        return true
      }
      const parley = SUSPECT_PARLEY[codeOf(suspect)] || { skill: 'agility', difficulty: 2 }
      info(api, `${inv.name} 用神秘相片与「${suspect.name}」谈判。`)
      safeCall(api, 'test', inv.seat, parley.skill, parley.difficulty, {
        source: { type: 'scenario', action: 'parley', code: PHOTO_FRONT, name: photo.name, ability: true },
        target: { kind: 'enemy', id: suspect.id }, actionKind: 'parley',
        resolve: result => {
          if (result?.success) safeCall(api, 'takeEnemyClues', suspect, inv.seat, 1, { victoryWhenEmpty: true })
          else {
            if (parley.failDamage) safeCall(api, 'damage', inv.seat, parley.failDamage)
            if (parley.failHorror) safeCall(api, 'horror', inv.seat, parley.failHorror)
          }
        },
      })
      return true
    }
    case 'redTidePhotoVictorySuspect': {
      const suspect = cluelessSuspectAt(state, here)
      if (!suspect) return false
      const cost = (currentAgendaCode(state) === AGENDA2_CODE ? 2 : 1) * investigatorCount(state)
      const paid = safeCall(api, 'payGroupClues', cost, { atLocation: here })
      if (!paid) {
        info(api, `线索不足：需要共同花费 ${cost} 个线索。`)
        return false
      }
      safeCall(api, 'addEnemyToVictory', suspect)
      info(api, `「${suspect.name}」被加入胜利区（神秘相片）。`)
      return true
    }
    case 'redTidePhotoInvestigate': {
      const hideout = hideoutLocationAt(state, here)
      exhaustPhoto(state)
      if (!hideout) {
        photo.code = currentPhotoSide(state) === PHOTO_FRONT ? PHOTO_BACK : PHOTO_FRONT
        photo.originalCode = photo.code
        setFlag(state, 'photoSide', photo.code)
        info(api, `神秘相片翻到${photo.code === PHOTO_FRONT ? '正面（嫌疑犯）' : '背面（藏身处）'}。`)
        return true
      }
      const difficulty = Math.max(0, Number(hideout.shroud) || 0)
      info(api, `${inv.name} 用神秘相片在「${hideout.name}」调查。`)
      safeCall(api, 'test', inv.seat, 'intellect', difficulty, {
        source: { type: 'scenario', action: 'investigate', code: PHOTO_BACK, name: photo.name, ability: true },
        target: { kind: 'location', id: hideout.id }, actionKind: 'investigate',
        resolve: result => {
          if (result?.success) safeCall(api, 'discoverClue', inv.seat, 1, hideout.id)
        },
      })
      return true
    }
    case 'redTidePhotoVictoryHideout': {
      const hideout = cluelessHideoutAt(state, here)
      if (!hideout) return false
      const cost = Math.max(1, Number(hideout.cluesPerInvestigator) || 1) * investigatorCount(state)
      const paid = safeCall(api, 'payGroupClues', cost, { atLocation: here })
      if (!paid) {
        info(api, `线索不足：需要共同花费 ${cost} 个线索。`)
        return false
      }
      // 把地点上的敌人/调查员移到连接地点，然后把地点加入胜利区。
      const destination = (hideout.connections || []).find(id => locationOf(state, id))
      for (const other of activeInvestigators(state)) {
        if (other.location === hideout.id && destination) safeCall(api, 'moveInvestigator', other.seat, destination)
      }
      for (const enemy of [...(state.enemies || [])]) {
        if (enemy.location === hideout.id && destination) safeCall(api, 'moveEnemy', enemy, destination)
      }
      safeCall(api, 'awardLocationVictory', hideout.id)
      info(api, `「${hideout.name}」被加入胜利区（神秘相片）。`)
      return true
    }
    default:
      return false
  }
}

// ---------------------------------------------------------------------------
// 议程 1：将要推进时改为「移除毁灭 + 洗入一只放一边怪物」
// ---------------------------------------------------------------------------
export function agendaWouldAdvance(state, api = {}) {
  if (currentAgendaCode(state) !== AGENDA1_CODE) return false
  const zones = setAsideCodes(state)
  const monsters = zones.setAside.filter(code => MONSTER_CODES.includes(code))
  if (!monsters.length) {
    info(api, '没有放一边的怪物了：议程 1 正常推进。')
    return false
  }
  const rng = randomOf(api)
  const monster = monsters[Math.floor(rng() * monsters.length)]
  // 只移除一张实例（Hunting Nightgaunt 在放一边区有两张）。
  const at = zones.setAside.indexOf(monster)
  if (at >= 0) zones.setAside.splice(at, 1)
  safeCall(api, 'clearDoom')
  const decks = leadsDeckApi(api)
  if (decks && typeof decks.put === 'function') {
    try { decks.put(LEADS_DECK_ID, [monster], { shuffle: true }) } catch { /* fallthrough */ }
  } else {
    const pending = flagValue(state, 'leadsPending') || []
    setFlag(state, 'leadsPending', localShuffle([...pending, monster], rng))
  }
  setFlag(state, 'leadsRemaining', leadsSize(state, api) + 1)
  info(api, `议程 1 因毁灭阈值将要推进：移除场上所有毁灭，并把一只[[怪物]]洗入迹象牌堆（还剩 ${zones.setAside.filter(code => MONSTER_CODES.includes(code)).length} 只）。`)
  return true
}

// ---------------------------------------------------------------------------
// 幕/议程推进与结局
// ---------------------------------------------------------------------------
export function checkObjectives(state, api = {}) {
  if (codeOf(state.acts?.[state.actIndex]) !== ACT_CODE) return false
  if (leadsSize(state, api) > 0) return false
  info(api, '迹象牌堆已空：寻找父亲有了结果。')
  safeCall(api, 'advanceAct')
  return true
}

export function actReveal(state, act, api = {}) {
  if (codeOf(act) !== ACT_CODE) return false
  setFlag(state, 'redTideResolution', 'resolution1')
  info(api, '幕 1 背面：进入结局 1。')
  safeCall(api, 'finish', 'resolution1')
  return true
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === AGENDA1_CODE) {
    const mob = spawnScenarioEnemy(state, ANGRY_MOB_CODE, START_LOCATION, { exhausted: true })
    const count = investigatorCount(state)
    for (const enemy of state.enemies || []) {
      if (isSuspectCode(codeOf(enemy)) && !enemy.defeated) enemy.clues = (enemy.clues || 0) + count
    }
    for (const location of state.locations || []) {
      if (HIDEOUT_LOCATION_IDS.includes(location.id)) location.clues = (location.clues || 0) + count
    }
    info(api, `议程 1 背面：愤怒暴民出现在印斯茅斯广场；所有[[嫌犯]]与[[窝点]]各放置 ${count} 个线索。${mob ? '' : ''}`)
    return true
  }
  if (code === AGENDA2_CODE) {
    setFlag(state, 'redTideResolution', 'resolution2')
    info(api, '议程 2 背面：红潮吞没了印斯茅斯，进入结局 2。')
    safeCall(api, 'finish', 'resolution2')
    return true
  }
  return false
}

export function allResigned(state, api = {}) {
  setFlag(state, 'redTideResolution', 'resolution2')
  info(api, '调查员全部撤退：进入结局 2。')
  safeCall(api, 'finish', 'resolution2')
  return true
}

export function investigatorEliminated(state, inv, clues, api = {}) {
  if (!isWendy(inv)) return false
  const alive = activeInvestigators(state).some(other => other.seat !== inv.seat)
  if (alive) return false
  setFlag(state, 'redTideResolution', 'resolution2')
  safeCall(api, 'finish', 'resolution2')
  return true
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolvedVictoryCards(state) {
  const cards = []
  for (const item of state.victoryDisplay || []) {
    const card = ALL_CARDS[codeOf(item)] || null
    if (card && (hasTrait(item, 'Suspect') || hasTrait(item, 'Hideout')
      || (card.traits || []).some(trait => ['Suspect', 'Hideout'].includes(trait)))) cards.push(item)
  }
  return cards
}

export function resolveChaosToken(state, inv, token, api = {}) {
  void inv
  void api
  const hard = tokenTier(state) === 'hard'
  const leads = leadsSize(state, null)
  const victoryCards = resolvedVictoryCards(state)
  const n = victoryCards.length
  switch (String(token)) {
    case 'skull':
      return { delta: -(hard ? n : Math.ceil(n / 2)), onDraw: [], onFail: [] }
    case 'cultist': {
      const test = state.skillTest
      const action = String(test?.actionKind || '')
      const target = test?.source || {}
      const followingLead = action === 'parley' || action === 'investigate'
      return { delta: -(hard ? (followingLead ? 5 : 3) : (followingLead ? 4 : 2)), onDraw: [], onFail: [] }
    }
    case 'tablet':
      return { delta: hard ? -4 : -3, onDraw: [], onFail: [] }
    case 'elderthing':
      return { delta: hard ? -2 : -1, onDraw: [], onFail: [] }
    default:
      return null
  }
  void leads
}

// 提示卡特殊效果：成功检定的 [tablet] / 失败检定的 [elder_thing]。
export function afterTest(state, inv, result, api = {}, extras = {}) {
  const resolved = extras?.resolvedTokens || result?.drawn || []
  const leadsEmpty = leadsSize(state, api) <= 0
  if (result?.success && resolved.includes('tablet') && !leadsEmpty) {
    const decks = leadsDeckApi(api)
    const top = decks && typeof decks.cards === 'function'
      ? [...decks.cards(LEADS_DECK_ID)].at(-1)
      : (flagValue(state, 'leadsPending') || []).at(-1)
    if (top) {
      safeCall(api, 'info', `[tablet]：查看迹象牌堆顶的「${ALL_CARDS[top]?.nameZh || top}」。`)
      const answer = safeCall(api, 'choice', {
        kind: 'effect', source: REFERENCE, seat: inv.seat, canSkip: true,
        prompt: '[tablet]：是否混洗迹象牌堆？',
        options: [{ id: 'skip', label: '不混洗' }, { id: 'shuffle', label: '混洗迹象牌堆' }],
      })
      if (answer === 'shuffle' && decks && typeof decks.put === 'function') {
        try { decks.put(LEADS_DECK_ID, [], { shuffle: true }) } catch { /* noop */ }
      }
    }
    return true
  }
  if (!result?.success && resolved.includes('elderthing') && state.encounterDeck?.length) {
    const code = state.encounterDeck.pop()
    const decks = leadsDeckApi(api)
    if (decks && typeof decks.put === 'function') {
      try { decks.put(LEADS_DECK_ID, [code], { shuffle: true }) } catch { /* noop */ }
    } else {
      setFlag(state, 'leadsPending', [...(flagValue(state, 'leadsPending') || []), code])
    }
    safeCall(api, 'info', `[elder_thing]：将遭遇牌库顶的「${ALL_CARDS[code]?.nameZh || code}」洗入迹象牌堆。`)
    return true
  }
  return false
}

export function applyTokenEffect() {
  return false
}

const REFERENCE = '90041'

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export function xpForSeat(state, seat) {
  const wendy = findWendy(state)
  const total = Number(state.victoryDisplay?.length) || 0
  const threshold = wendy && wendy.seat === seat ? 3 : 5
  return Math.max(0, total - threshold)
}

export function resolution(state, key, events = null, api = {}) {
  void events
  void api
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const wendy = findWendy(state)
  const anyDefeated = (state.investigators || []).some(inv => inv.defeated)
  const recordKey = finalKey === 'noResolution' ? (anyDefeated ? 'resolution2' : 'resolution1') : finalKey
  setFlag(state, 'redTideResolution', recordKey)
  const victoryCards = resolvedVictoryCards(state)
  const titles = victoryCards.map(card => ALL_CARDS[codeOf(card)]?.nameZh || codeOf(card))
  const effects = [
    { record: { redTideRisingResolution: recordKey } },
    { record: { redTideRisingVictoryCards: victoryCards.length } },
    {
      text: recordKey === 'resolution1'
        ? '结局 1：你没能找回父亲，但那个戴棕色圆顶礼帽的男人给了你一个不能回家的理由。'
        : '结局 2：你等追兵转过街角，悄悄回到公交站，搭上下一班回阿卡姆的车。父亲还活着——你仍然相信。',
    },
    ...(titles.length ? [{ text: `加入胜利区的卡牌：${titles.join('、')}。` }] : []),
  ]
  return {
    award: true,
    seatBonus: seat => xpForSeat(state, seat),
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
  const flags = flagsFor(state)
  return {
    leads: leadsSize(state),
    victoryCards: resolvedVictoryCards(state).length,
    photoSide: currentPhotoSide(state),
    monstersSetAside: setAsideCodes(state).setAside.filter(code => MONSTER_CODES.includes(code)).length,
    resolution: flags.redTideResolution || null,
  }
}

export function tokenMeanings(state) {
  const hard = tokenTier(state) === 'hard'
  const table = hard ? TOKEN_MEANINGS.hard : TOKEN_MEANINGS.standard
  const victory = resolvedVictoryCards(state).length
  return Object.fromEntries(Object.entries(table).map(([token, meaning]) => [
    token,
    {
      ...meaning,
      text: token === 'skull'
        ? meaning.text.replace('X', String(hard ? victory : Math.ceil(victory / 2)))
        : meaning.text,
    },
  ]))
}

export { ENCOUNTER_DECK, TOKEN_MEANINGS, SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT }

export const behavior = {
  id: CHAPTER_ID,
  startLocation,
  setupLocations,
  setupEnemies,
  afterDeckSetup,
  actions,
  performAction,
  agendaWouldAdvance,
  checkObjectives,
  actReveal,
  agendaReveal,
  allResigned,
  investigatorEliminated,
  resolveChaosToken,
  afterTest,
  applyTokenEffect,
  tokenMeanings,
  resolution,
  introduction,
  scenarioSummary,
}

void firstLeadCard
void suspectEnemy
void cluesOn
void groupCluesAt
