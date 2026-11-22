// 读书至死（Read or Die · 90004）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/ReadOrDie.hs + frontend/src/locales/en/standalone/readOrDie.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   startLocation / setupLocations / afterDeckSetup → 布置 8 个地点、书卷暗置、故事资产与死书之灵。
//   actions / performAction → 幕 1 的 [fast] 取回书卷、与死书之灵谈判（advanceAct）。
//   enemyDefeated → 死书之灵「将被击败时」改为治愈/横置/移回奥恩图书馆。
//   actReveal → 幕 1 推进即结局 1；agendaReveal → 议程推进即结局 2；allResigned → 结局 2。
//   resolveChaosToken / applyTokenEffect → 90004 提示卡的四类标记。
//   resolution → 声明式结局效果（记录 + 黛西按「书卷数或胜利点，取高」拿经验）。
//   introduction → 章节导入正文。
//
// 本章状态只写 state.scenarioFlags / 地点 beneath / state.campaign.records（纯 JSON）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT_CODE, AGENDA_CODE, ARMITAGE_CODE, CHAPTER_ID, DAISY_TITLE, ENCOUNTER_DECK, JAZZ_CODE,
  JAZZ_LOCATION, KEY_INVESTIGATOR, LOCATIONS, LOCATION_COORDINATES, NAMER_CODE,
  OTHER_START_LOCATION, RESOLUTION_KEYS, SCENARIO_AGENDA_TEXT, SCENARIO_ACT_TEXT, SCENARIO_TEXT,
  START_LOCATION, START_LOCATION_IDS, TOKEN_MEANINGS, tokenTier,
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
const isDaisy = inv => codeOf(inv) === KEY_INVESTIGATOR
  || String(inv?.nameEn || inv?.name || '').includes(DAISY_TITLE)
const findDaisy = state => (state.investigators || []).find(inv => inv && isDaisy(inv)) || null
const findNamer = state => (state.enemies || []).find(enemy => codeOf(enemy) === NAMER_CODE && !enemy.defeated) || null
const tomeCode = code => {
  const card = ALL_CARDS[code]
  return Boolean(card && card.type === 'asset' && (card.traits || []).includes('Tome'))
}
const tomesInPlay = inv => (inv?.assets || []).filter(asset => tomeCode(asset.code || asset.originalCode))
const groupCluesAt = (state, locationId) => activeInvestigators(state)
  .filter(inv => inv.location === locationId)
  .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
const locationBeneath = (state, locationId) => locationOf(state, locationId)?.beneath || []

function splitParagraphs(text) {
  return String(text || '').split(/\n{2,}/).map(line => line.trim()).filter(Boolean)
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
  const existing = state.enemies.find(enemy => codeOf(enemy) === code)
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
    clues: 0,
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

// 地点距离（BFS；不可达返回 Infinity）。
export function distancesFrom(state, fromId) {
  const distance = new Map([[fromId, 0]])
  const queue = [fromId]
  while (queue.length) {
    const current = queue.shift()
    const location = locationOf(state, current)
    if (!location) continue
    for (const next of location.connections || []) {
      if (distance.has(next)) continue
      distance.set(next, distance.get(current) + 1)
      queue.push(next)
    }
  }
  return distance
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
  state.scenarioZones ||= {}
  state.scenarioZones.setAside ||= []
  setFlag(state, 'readOrDiePrepared', true)
  info(api, `读书至死：放置 ${START_LOCATION_IDS.length} 处米斯卡塔尼克大学地点；黛西·沃克在奥恩图书馆。`)
  return [...START_LOCATION_IDS]
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  const rng = typeof api?.random === 'function' ? api.random : () => Math.random()
  const shuffle = list => (typeof helper?.shuffle === 'function' ? helper.shuffle([...list], rng) : localShuffle(list, rng))
  const daisy = findDaisy(state)
  // 1) 其他调查员移到大学广场（黛西留在奥恩图书馆）。
  for (const inv of activeInvestigators(state)) {
    if (daisy && inv.seat === daisy.seat) continue
    inv.location = OTHER_START_LOCATION
  }
  const quad = locationOf(state, OTHER_START_LOCATION)
  if (quad && !quad.revealed) {
    if (typeof api.reveal === 'function') api.reveal(OTHER_START_LOCATION)
    else {
      quad.revealed = true
      quad.clues = Number(quad.maxClues ?? quad.cluesPerInvestigator ?? 0) * investigatorCount(state)
    }
  }
  // 2) 黛西牌组中的非弱点[[书卷]]资产移出并放到一边。
  const tomes = []
  if (daisy) {
    const isTome = code => tomeCode(code)
    const removedFromDeck = (daisy.deck || []).filter(isTome)
    daisy.deck = (daisy.deck || []).filter(code => !isTome(code))
    const removedFromHand = (daisy.hand || []).filter(isTome)
    daisy.hand = (daisy.hand || []).filter(code => !isTome(code))
    tomes.push(...removedFromDeck, ...removedFromHand)
    if (removedFromHand.length && typeof api.drawCards === 'function') api.drawCards(daisy.seat, removedFromHand.length)
    setFlag(state, 'readOrDieTomeCount', tomes.length)
  }
  state.scenarioZones ||= {}
  state.scenarioZones.setAside = [...tomes]
  // 3) 书卷洗混后从「离奥恩图书馆最远」的地点开始暗置；剩余压在奥恩图书馆下方。
  const shuffled = shuffle([...tomes])
  const distance = distancesFrom(state, START_LOCATION)
  const buckets = new Map()
  for (const id of START_LOCATION_IDS) {
    if (id === OTHER_START_LOCATION) continue
    const value = distance.has(id) ? distance.get(id) : 0
    if (!buckets.has(value)) buckets.set(value, [])
    buckets.get(value).push(id)
  }
  const ordered = [...buckets.keys()].sort((a, b) => b - a)
    .flatMap(value => shuffle([...buckets.get(value)]))
  const orne = locationOf(state, START_LOCATION)
  if (orne) orne.beneath ||= []
  let index = 0
  for (const id of ordered) {
    if (index >= shuffled.length) break
    const location = locationOf(state, id)
    if (!location) continue
    location.beneath ||= []
    location.beneath.push(shuffled[index++])
  }
  if (orne) orne.beneath.push(...shuffled.slice(index))
  info(api, `读书至死：${tomes.length} 张书卷已暗置于各地点下方（剩余 ${orne?.beneath?.length || 0} 张在奥恩图书馆下方）。`)
  // 4) "Jazz" Mulligan 放在科学大楼。
  spawnStoryAssetSafe(state, api, JAZZ_CODE, JAZZ_LOCATION)
  // 5) 死书之灵放在奥恩图书馆（未交战、横置）。
  spawnScenarioEnemy(state, NAMER_CODE, START_LOCATION, { exhausted: true, preysSeat: daisy?.seat ?? null })
  // 6) 亨利·阿米蒂奇博士由黛西控制（若在牌组/手中则先取出）。
  if (daisy) {
    for (const zone of ['deck', 'hand']) {
      const pile = daisy[zone] || []
      const at = pile.indexOf(ARMITAGE_CODE)
      if (at >= 0) pile.splice(at, 1)
    }
    if (!(daisy.assets || []).some(asset => codeOf(asset) === ARMITAGE_CODE)) {
      safeCall(api, 'giveAsset', daisy.seat, ARMITAGE_CODE)
    }
    setFlag(state, 'readOrDieArmitageSeat', daisy.seat)
  }
  setFlag(state, 'readOrDiePrepared', true)
  return { tomes: tomes.length, ordered }
}

/** 单测/直调入口：不经过引擎事务时使用（真实开局走 setup 钩子）。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  for (const id of START_LOCATION_IDS) {
    const definition = (state.scenario?.locations || LOCATIONS)[id]
    const instance = { ...structuredClone(definition), clues: 0, revealed: false, connections: [...definition.connections] }
    state.locations.push(instance)
  }
  state.investigators ||= []
  for (const inv of state.investigators) inv.location = START_LOCATION
  afterDeckSetup(state, null, { api, shuffle: list => list })
  return { placed: START_LOCATION_IDS.length }
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here) return []
  const moves = []
  const daisy = findDaisy(state)
  const namer = findNamer(state)
  if (namer && namer.location === here.id) {
    const tomes = daisy ? tomesInPlay(daisy).length : 0
    const parleyable = isDaisy(inv) ? null
      : `只有黛西·沃克能与「死书之灵」谈判`
    const enough = isDaisy(inv) && tomes >= 4
    const base = SCENARIO_ACT_TEXT[ACT_CODE]
    moves.push({
      action: 'scenarioAction', rule: 'readOrDieParley', locationId: here.id, actions: 1,
      enemyId: namer.id,
      label: `与「死书之灵」谈判（难度 ${Math.max(1, 18 - 2 * tomes)}；每张[[书卷]]使难度 -2）`,
      reason: parleyable || (!enough ? '你需要控制至少 4 张非弱点[[书卷]]资产' : null),
      used: enough ? undefined : undefined,
      text: base,
    })
  }
  if (isDaisy(inv) && locationBeneath(state, here.id).length) {
    const required = 1 * investigatorCount(state)
    const available = groupCluesAt(state, here.id)
    moves.push({
      action: 'scenarioAction', rule: 'readOrDieRecallTome', locationId: here.id, actions: 0,
      label: `[fast] 团队花费 ${required} 个线索：把本地点下方 1 张暗置的玩家卡洗回你的牌组`,
      reason: available >= required ? null : `本地点需要共 ${required} 个线索（现有 ${available}）`,
    })
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  if (move.rule === 'readOrDieParley') return parleyAction(state, inv, api)
  if (move.rule === 'readOrDieRecallTome') return recallTomeAction(state, inv, api)
  return false
}

function parleyAction(state, inv, api) {
  if (!isDaisy(inv)) return false
  const daisy = findDaisy(state) || inv
  const tomes = tomesInPlay(daisy).length
  if (tomes < 4) return false
  const difficulty = Math.max(1, 18 - 2 * tomes)
  const namer = findNamer(state)
  if (!namer || namer.location !== inv.location) return false
  info(api, `${inv.name} 与「死书之灵」谈判：意志检定，难度 ${difficulty}（书卷 ${tomes} 张）。`)
  if (typeof api.test !== 'function') return true
  api.test(inv.seat, 'willpower', difficulty, result => {
    if (!result?.success) return
    setFlag(state, 'readOrDieParleySucceeded', true)
    info(api, `${inv.name} 成功放逐了「死书之灵」！`)
    safeCall(api, 'advanceAct')
  })
  return true
}

function recallTomeAction(state, inv, api) {
  if (!isDaisy(inv)) return false
  const here = locationOf(state, inv.location)
  if (!here || !here.beneath?.length) return false
  const required = 1 * investigatorCount(state)
  const available = groupCluesAt(state, here.id)
  if (available < required) return false
  // 团队共同支付：优先由执行者支付，不足时由同地点调查员补足。
  let remaining = required
  for (const payer of activeInvestigators(state).filter(item => item.location === here.id)) {
    if (remaining <= 0) break
    const pay = Math.min(Number(payer.clues) || 0, remaining)
    payer.clues -= pay
    remaining -= pay
  }
  if (remaining > 0) return false
  const card = here.beneath.pop()
  inv.deck.push(card)
  inv.deck = typeof api.shuffle === 'function' ? api.shuffle([...inv.deck]) : inv.deck
  info(api, `${inv.name} 把「${(ALL_CARDS[card] || {}).nameZh || (ALL_CARDS[card] || {}).name || card}」从「${here.name}」下方洗回牌组。`)
  return true
}

// ---------------------------------------------------------------------------
// 死书之灵：被击败时改为治愈/横置/移回奥恩图书馆
// ---------------------------------------------------------------------------
export function enemyDefeated(state, enemy, api = {}) {
  if (codeOf(enemy) !== NAMER_CODE) return false
  enemy.damageTaken = 0
  enemy.exhausted = true
  enemy.engagedSeat = null
  enemy.location = START_LOCATION
  for (const inv of state.investigators || []) inv.engaged = (inv.engaged || []).filter(id => id !== enemy.id)
  info(api, '「死书之灵」没有被击败：它被完全治愈、横置，并移回奥恩图书馆。')
  return true
}

// ---------------------------------------------------------------------------
// 幕 / 议程 / 结局
// ---------------------------------------------------------------------------
export function actReveal(state, act, api = {}) {
  if (codeOf(act) !== ACT_CODE) return false
  setFlag(state, 'readOrDieResolution', 'resolution1')
  info(api, '幕 1 背面：死书之灵被放逐，进入结局 1。')
  safeCall(api, 'finish', 'resolution1')
  return true
}

export function agendaReveal(state, agenda, api = {}) {
  if (codeOf(agenda) !== AGENDA_CODE) return false
  setFlag(state, 'readOrDieResolution', 'resolution2')
  info(api, '议程 1 背面：调查队未能及时放逐死书之灵，进入结局 2。')
  safeCall(api, 'finish', 'resolution2')
  return true
}

export function allResigned(state, api = {}) {
  setFlag(state, 'readOrDieResolution', 'resolution2')
  safeCall(api, 'finish', 'resolution2')
  return true
}

export function resolution(state, key, events = null, api = {}) {
  void events
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const recordKey = finalKey === 'resolution1' ? 'resolution1' : 'resolution2'
  const daisy = state.investigators?.find(inv => isDaisy(inv)) || null
  setFlag(state, 'readOrDieResolvedTo', recordKey)
  const effects = [
    { record: { readOrDieResolution: recordKey } },
    {
      text: recordKey === 'resolution1'
        ? '调查队放逐了死书之灵，黛西·沃克保住了《死灵之书》。'
        : '调查队未能放逐死书之灵，黛西·沃克只能带着《死灵之书》离开。',
    },
    { record: { readOrDieTomesInPlay: daisy ? tomesInPlay(daisy).length : 0 } },
  ]
  setFlag(state, 'readOrDieTomeCountAtEnd', daisy ? tomesInPlay(daisy).length : 0)
  void api
  return {
    award: true,
    seatBonus: seat => {
      if (!daisy || daisy.seat !== seat) return 0
      // 黛西：经验取「胜利点」或「游戏结束时场上书卷数」较高者；引擎已把胜利点计入基础值。
      const tomes = tomesInPlay(daisy).length
      return Math.max(0, tomes - (Number(state.victory) || 0))
    },
    effects,
  }
}

// ---------------------------------------------------------------------------
// 混乱标记（90004 正面 = 简单/普通，背面 = 困难/专家）
// ---------------------------------------------------------------------------
function namerSkillTest(state, effect) {
  const test = effect?.test || null
  if (!test) return true
  const kind = String(test.actionKind || '')
  if (!['fight', 'evade', 'attack', 'evasion'].includes(kind)) return false
  return Boolean(findNamer(state))
}

export function resolveChaosToken(state, inv, token, api = {}) {
  void api
  const hard = tokenTier(state) === 'hard'
  const daisy = findDaisy(state)
  const tomes = daisy ? tomesInPlay(daisy).length : 0
  switch (String(token)) {
    case 'skull':
      return { delta: -(hard ? tomes + 1 : tomes), onDraw: [], onFail: [] }
    case 'cultist':
      return {
        delta: 0, drawAnother: true, onDraw: [],
        onFail: [{ type: 'scenarioToken', token: 'cultist', mode: 'discardTop', count: hard ? 3 : 2 }],
      }
    case 'tablet':
      return {
        delta: hard ? -3 : -2, onDraw: [],
        onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'namerAttack' }],
      }
    case 'elderthing':
      return {
        delta: hard ? -5 : -3, onDraw: [],
        onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'daisyHorror' }],
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
        const discarded = []
        for (let i = 0; i < count && inv.deck.length; i += 1) discarded.push(inv.deck.pop())
        inv.discard.push(...discarded)
      }
      info(api, `${inv.name} 因 [cultist] 失败，弃掉牌库顶 ${count} 张牌。`)
      return true
    }
    case 'namerAttack': {
      const namer = findNamer(state)
      if (!namer) return false
      if (!namerSkillTest(state, effect)) return false
      // 近似：失败时必定攻击；「成功不足 2/3 点也攻击」需要 afterTest 的成功差值读点，记入 dossier。
      if (typeof api.attack === 'function') api.attack(namer, inv)
      info(api, `「死书之灵」攻击了 ${inv.name}。`)
      return true
    }
    case 'daisyHorror': {
      const daisy = findDaisy(state)
      if (!daisy) return false
      if (typeof api.horror === 'function') api.horror(daisy.seat, 1)
      else daisy.horror = (Number(daisy.horror) || 0) + 1
      info(api, '黛西·沃克因 [elder_thing] 失败受到 1 点恐惧。')
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
  const daisy = findDaisy(state)
  const namer = findNamer(state)
  return {
    act: codeOf((state.acts || [])[state.actIndex ?? 0]),
    agenda: codeOf((state.agendas || [])[state.agendaIndex ?? 0]),
    daisySeat: daisy?.seat ?? null,
    tomesInPlay: daisy ? tomesInPlay(daisy).length : 0,
    namerLocation: namer?.location || null,
    setAside: [...(state.scenarioZones?.setAside || [])],
  }
}

export function introduction() {
  const paragraphs = splitParagraphs(SCENARIO_TEXT.intro)
  return {
    version: 3,
    title: SCENARIO_TEXT.heading,
    sections: [{ title: SCENARIO_TEXT.heading, paragraphs }],
    paragraphs,
    code: ACT_CODE,
  }
}

export const behavior = {
  id: CHAPTER_ID,
  startLocation,
  setupLocations,
  afterDeckSetup,
  setupScenario,
  actions,
  performAction,
  enemyDefeated,
  actReveal,
  agendaReveal,
  allResigned,
  resolution,
  resolveChaosToken,
  applyTokenEffect,
  tokenMeanings,
  introduction,
  scenarioSummary,
  // 具名助手（测试/验收）
  findDaisy,
  findNamer,
  tomesInPlay,
  tomeCode,
  groupCluesAt,
  locationBeneath,
  distancesFrom,
  spawnScenarioEnemy,
  spawnStoryAssetSafe,
  SCENARIO_ACT_TEXT,
  SCENARIO_AGENDA_TEXT,
  TOKEN_MEANINGS,
  LOCATION_COORDINATES,
  ENCOUNTER_DECK,
}

export { ACT_CODE, AGENDA_CODE, NAMER_CODE, RESOLUTION_KEYS, START_LOCATION, OTHER_START_LOCATION, findDaisy, findNamer, tomesInPlay }
