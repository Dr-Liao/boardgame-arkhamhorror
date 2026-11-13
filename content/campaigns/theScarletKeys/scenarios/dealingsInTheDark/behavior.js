// 暗中交易 · 引擎钩子（章节流程 + 日食计数 + 密室/阴影 + 密钥与结局）。
//
// 约定：本循环的 location / act / agenda / scenario 不建单卡条目（见 P7 交接口径），
// 这些卡面的规则由 `definition.js#LOCATION_RULES` 与本章 behavior 直接承载；
// enemy / treachery / story / asset / key 的逐卡规则在
// `src/cards/encounter-entries/theScarletKeys/dealingsInTheDark/<code>.js`。
//
// 规则事实源与近似逐条见文件末尾 scenarioApproximations；引擎缺口见 scenarioGaps。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { enemyRuleFor, entryFlags } from '../../../../../src/cards/card-rules.js'
import {
  BAZAAR_LOCATION_CODES, CODES, INITIAL_LOCATIONS, KEY_ID, LOCATION_IDS, LOCATION_RULES,
  SET_ASIDE_ENEMY_CODES, SET_ASIDE_LOCATION_CODES, START_LOCATION,
} from './definition.js'
import { bazaarDiagramFor, isSideAdjacent } from './layout.js'
import {
  cluesUnveiled, cultCluesTotal, cultistEnemies, dealingsChaosAfterTest, dealingsChaosToken,
  investigatorCluesTotal, isCultist, isFinalStage, nearestCultist,
} from './chaos.js'

const CHAPTER_ID = 'dealingsInTheDark'

const codeOf = card => card?.originalCode || card?.code || card
const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
const flagsOf = state => (state.scenarioFlags ||= {})
const recordsOf = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const leadSeat = state => Number(state.campaign?.leadSeat ?? 0)
const numInvestigators = state => Number(state.numInvestigators) || (state.investigators || []).length || 1
const ruleAt = (state, locationId) => LOCATION_RULES[locationId] || null

function record(state, api, key, value = true) {
  if (typeof api?.setCampaignRecord === 'function') return api.setCampaignRecord(key, value)
  recordsOf(state)[key] = value
  return value
}
function recordValue(state, api, key) {
  if (typeof api?.campaignRecord === 'function') return api.campaignRecord(key)
  return recordsOf(state)[key] ?? null
}

/** 选择：优先 api.choose；没有选择面（单候选/测试桩）时退回第一项。 */
function choose(api, spec) {
  if (!spec.options.length) return null
  if (spec.options.length === 1) return spec.options[0].id
  if (typeof api?.choose !== 'function') return spec.options[0].id
  let answer
  try {
    answer = api.choose(spec)
  } catch (error) {
    // 内容层直接调用（单测/旧路径）不在引擎规则事务中：退回第一项，避免把「没有选择面」当崩溃。
    if (/规则事务/.test(String(error?.message || ''))) return spec.options[0].id
    throw error
  }
  return spec.options.some(option => String(option.id) === String(answer)) ? answer : spec.options[0].id
}

// ---- 时间（战役记录 `time`；P8 世界地图时间轴接入后与 tsk.map.time 取较大值） ----
export function timePassed(state, api = null) {
  const mapTime = Number(api?.tsk?.map?.time?.() ?? api?.mechanics?.tsk?.map?.time?.() ?? 0)
  const recorded = Number(recordValue(state, api, 'time') ?? 0)
  return Math.max(mapTime, recorded)
}
function markTime(state, api, amount) {
  const total = timePassed(state, api) + Number(amount || 0)
  record(state, api, 'time', total)
  api?.info?.(`⏳ 记录 ${amount} 点时间（累计 ${total}）。`)
  return total
}

// ---- 隐匿迷你卡（Concealed X） ----
// 迷你卡的 kind 必须匹配 tsk-concealed 的标识规则（字母开头）：用 `enemy<卡号>` 表达「这是哪个敌人」，
// 诱饵使用同一 kind（真身/诱饵靠 decoy 区分，未揭露时不投影 kind）。
const MINI_KIND_PREFIX = 'enemy'
const miniKindOf = code => `${MINI_KIND_PREFIX}${code}`
const codeOfMiniKind = kind => (typeof kind === 'string' && kind.startsWith(MINI_KIND_PREFIX)
  ? kind.slice(MINI_KIND_PREFIX.length) : null)

function concealedApi(api) {
  return api?.mechanics?.tsk?.concealed || api?.tsk?.concealed || null
}
function miniCardsOf(api) {
  return concealedApi(api)?.miniCards?.() || []
}
function enemyInShadows(api, enemy) {
  const kind = miniKindOf(codeOf(enemy))
  return miniCardsOf(api).some(card => !card.decoy && card.kind === kind)
}

/** 敌人的隐匿关键词：1 张真身迷你卡 + 每名调查员 1 张诱饵，放在敌人所在地点与连接地点。 */
function concealEnemy(state, api, enemy, { decoys = null } = {}) {
  const concealed = concealedApi(api)
  if (!concealed || !enemy?.location) return []
  const kind = miniKindOf(codeOf(enemy))
  const cards = [{ kind, code: codeOf(enemy), decoy: false }]
  const decoyCount = decoys == null ? numInvestigators(state) : Math.max(0, Number(decoys))
  for (let index = 0; index < decoyCount; index += 1) cards.push({ kind, decoy: true })
  const here = locationOf(state, enemy.location)
  const slots = [enemy.location, ...(here?.connections || []).filter(id => locationOf(state, id))]
  const placements = new Map()
  cards.forEach((card, index) => {
    const locationId = slots[index % slots.length]
    const entry = placements.get(locationId) || { locationId, count: 0 }
    entry.count += 1
    placements.set(locationId, entry)
  })
  const created = concealed.distribute({ cards, placements: [...placements.values()] })
  api?.info?.(`🕯️ 「${enemy.name}」的隐匿迷你卡与 ${decoyCount} 张诱饵已混洗分配到 ${placements.size} 处地点。`)
  return created
}

/** 敌人进入阴影：迷你卡留在原地，敌人移出游戏（放一边区），直到被揭露。 */
function sendEnemyToShadows(state, api, enemy, options = {}) {
  if (!enemy || !(state.enemies || []).includes(enemy)) return false
  const locationId = enemy.location
  if (!locationId) return false
  concealEnemy(state, api, enemy, options)
  // 密钥跟着敌人进入阴影：战役密钥不能指向已离场敌人（读档校验会拒），
  // 用剧本标记记住「钥匙在该阴影敌人身上」，揭露入场时还原。
  const bearer = keyBearer(state, api)
  if (bearer.type === 'enemy' && bearer.enemyId === enemy.id) {
    flagsOf(state).keyAwayWithEnemy = enemy.id
    bindKey(state, api, { type: 'none' })
    api?.info?.(`🔑 扭曲反棱镜随「${enemy.name}」进入阴影（不进入任何调查员或在场敌人手中）。`)
  }
  api?.setEnemyAside?.(enemy)
  api?.info?.(`🌑 「${enemy.name}」返回阴影（放一边），其迷你卡留在「${locationOf(state, locationId)?.name || locationId}」。`)
  return true
}

/**
 * 揭露某地点的一张迷你卡：真身 → 把对应敌人从阴影放回该地点；诱饵 → 结算地点规则
 * （09580 拥挤商铺：把本地点 1 个线索移到最近的异教徒）。
 */
function exposeAt(state, api, seat, locationId) {
  const concealed = concealedApi(api)
  if (!concealed) return { exposed: false }
  const candidates = concealed.at(locationId) || []
  if (!candidates.length) {
    api?.info?.('该地点没有隐匿迷你卡。')
    return { exposed: false }
  }
  const options = candidates.map((card, index) => ({ id: card.id, label: `隐匿迷你卡 #${index + 1}` }))
  const id = choose(api, {
    kind: 'card', source: 'dealingsExpose', seat,
    prompt: '选择要揭露的隐匿迷你卡（正面向下，不显示身份）。', options,
  })
  const chosen = candidates.find(card => card.id === id) || candidates[0]
  const result = concealed.expose(chosen.id, { seat })
  api?.info?.(`🔎 ${state.investigators[seat]?.name || '调查员'} 揭露了「${locationOf(state, locationId)?.name || locationId}」的一张迷你卡。`)
  if (result.decoy) {
    const rule = ruleAt(state, locationId)
    if (rule?.decoyExposedClueToCultist) {
      const cultist = cultistEnemies(state).find(enemy => enemy.location === locationId) || null
      const location = locationOf(state, locationId)
      if (cultist && location && (location.clues || 0) > 0) {
        api?.moveClueToEnemy?.(cultist, { from: 'location' })
        api?.info?.(`🩸 「拥挤商铺」：揭露诱饵后把 1 个线索移到「${cultist.name}」。`)
      } else {
        api?.info?.('「拥挤商铺」：本地点没有持有线索的[[异教徒]]敌人，线索不移走。')
      }
    }
    return { ...result, exposed: true, locationId }
  }
  const asideEnemy = (state.setAsideEnemies || []).find(enemy => codeOf(enemy) === codeOfMiniKind(result.kind))
  if (asideEnemy) {
    api?.restoreEnemyFromAside?.(asideEnemy.id, locationId)
    api?.info?.(`👁 「${asideEnemy.name}」从阴影现身于「${locationOf(state, locationId)?.name || locationId}」。`)
    if (flagsOf(state).keyAwayWithEnemy === asideEnemy.id) {
      delete flagsOf(state).keyAwayWithEnemy
      bindKey(state, api, { type: 'enemy', enemyId: asideEnemy.id }, { steal: true })
      api?.info?.(`🔑 扭曲反棱镜随「${asideEnemy.name}」回到场上（动荡面）。`)
    }
  } else {
    const code = codeOfMiniKind(result.kind)
    if (code && api?.spawn) api.spawn(code, locationId)
  }
  return { ...result, exposed: true, locationId }
}

// ---- 绯红密钥（扭曲反棱镜） ----
function keyApi(api) {
  return api?.tsk?.keys || api?.mechanics?.tsk?.keys || null
}
function keyRecord(state, api) {
  const keys = keyApi(api)
  if (!keys) return null
  try {
    return (keys.all() || []).find(entry => entry.id === KEY_ID) || null
  } catch {
    return null
  }
}
export function keyBearer(state, api = null) {
  const entry = keyRecord(state, api)
  if (entry) return entry.bearer
  const recorded = flagsOf(state).twistedAntiprismBearer || null
  return recorded && typeof recorded === 'object' ? recorded : { type: 'none' }
}
function keyFaceCode(state, api) {
  const entry = keyRecord(state, api)
  if (entry) return entry.stable ? CODES.keyStable : CODES.keyUnstable
  return flagsOf(state).twistedAntiprismFace === CODES.keyUnstable ? CODES.keyUnstable : CODES.keyStable
}
function bindKey(state, api, bearer, { steal = false } = {}) {
  const keys = keyApi(api)
  if (keys) {
    try {
      if (steal) keys.steal(KEY_ID, bearer)
      else keys.bind(KEY_ID, bearer)
    } catch {
      // 密钥实体未初始化（战役流程尚未登记本章密钥）：回落到剧本标记。
    }
  }
  flagsOf(state).twistedAntiprismBearer = { ...bearer }
  return { ...bearer }
}
function initializeKey(state, api) {
  const keys = keyApi(api)
  if (!keys || keyRecord(state, api)) return null
  try {
    keys.initialize([{ id: KEY_ID, stableFace: CODES.keyStable, unstableFace: CODES.keyUnstable }])
    flagsOf(state).twistedAntiprismFace = CODES.keyStable
    return keyRecord(state, api)
  } catch {
    // 战役级容器已经初始化过（P8 世界地图流程一次性登记 10 把密钥）：改用剧本标记。
    return null
  }
}
function keyHolderSeat(state, api) {
  const bearer = keyBearer(state, api)
  return bearer.type === 'investigator' ? bearer.seat : null
}

/** 艾婕底下的牌（scenarioFlags.eceBeneath = [{ code, seat }]）。 */
function eceBeneath(state) {
  const list = flagsOf(state).eceBeneath
  return Array.isArray(list) ? list : []
}

/** 任意钥匙变换后：艾婕·萨辛底下每张牌的所有者抽取该牌（条目 09584 的 flags.afterKeyShift）。 */
function resolveEceBeneath(state, api) {
  const ece = (state.storyAssets || []).find(asset => codeOf(asset) === CODES.eceSahin)
  if (!ece) return 0
  const list = eceBeneath(state)
  if (!list.length) return 0
  flagsOf(state).eceBeneath = []
  for (const item of list) {
    api?.moveCard?.({ code: item.code, from: 'setAside', to: 'hand', ownerSeat: item.seat }, { seat: item.seat })
    api?.info?.(`🂠 钥匙变换：${state.investigators[item.seat]?.name || '调查员'} 取回压在艾婕·萨辛底下的「${api?.cardName?.(item.code) || item.code}」。`)
  }
  return list.length
}

/** 变换扭曲反棱镜。by：'investigator' | 'enemy'（敌人变换动荡面时不翻面）。 */
export function shiftTwistedAntiprism(state, api, { by = 'investigator', seat = null, enemyId = null } = {}) {
  const face = keyFaceCode(state, api)
  // 面规则由单卡条目声明（09590a/b 的 flags.shiftRule）；条目未注册时按卡号回退。
  const rule = entryFlags(face)?.shiftRule
    || (face === CODES.keyStable ? 'twistedAntiprismStable' : 'twistedAntiprismUnstable')
  const shifterSeat = seat == null ? (keyHolderSeat(state, api) ?? leadSeat(state)) : seat
  if (rule === 'twistedAntiprismStable') {
    const inv = state.investigators[shifterSeat]
    if (inv && typeof api?.lookAt === 'function') {
      api.lookAt(shifterSeat, { zone: 'deck', count: 3, choose: 1, arrange: false, returnStrategy: 'shuffle', source: CODES.keyStable })
    }
    api?.info?.('🔑 扭曲反棱镜（稳定面）：查看牌库顶 3 张，抽 1 张，其余洗回。')
  } else {
    const nearest = nearestInvestigator(state, enemyId)
    if (nearest) placeUnstableDoom(state, api, nearest)
  }
  const shouldFlip = face === CODES.keyStable || by === 'investigator'
  const keys = keyApi(api)
  if (shouldFlip) {
    if (keys) {
      try { keys.shift(KEY_ID, { force: true }) } catch { /* 未初始化时只翻剧本标记 */ }
    }
    flagsOf(state).twistedAntiprismFace = face === CODES.keyStable ? CODES.keyUnstable : CODES.keyStable
    api?.info?.(`🔄 扭曲反棱镜翻至${face === CODES.keyStable ? '动荡' : '稳定'}面。`)
  } else {
    api?.info?.('🔄 敌人变换了动荡面的扭曲反棱镜：不翻面（卡面只要求调查员变换时翻回稳定面）。')
  }
  flagsOf(state).lastKeyShift = { round: state.round, by, seat: shifterSeat, enemyId: enemyId || null }
  resolveEceBeneath(state, api)
  return { from: face, flipped: shouldFlip, by }
}

function nearestInvestigator(state, enemyId = null) {
  const alive = activeInvestigators(state)
  if (!alive.length) return null
  const enemy = enemyId ? (state.enemies || []).find(item => item.id === enemyId) : null
  if (!enemy?.location) return alive[0]
  const distance = id => {
    if (!id) return Number.POSITIVE_INFINITY
    const queue = [[enemy.location, 0]]
    const seen = new Set([enemy.location])
    while (queue.length) {
      const [current, steps] = queue.shift()
      if (current === id) return steps
      for (const next of locationOf(state, current)?.connections || []) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push([next, steps + 1])
      }
    }
    return Number.POSITIVE_INFINITY
  }
  return alive.reduce((best, inv) => (distance(inv.location) < distance(best.location) ? inv : best), alive[0])
}

function placeUnstableDoom(state, api, inv) {
  const agenda = state.agendas?.[state.agendaIndex]
  const options = [{ id: 'agenda', label: `当前密谋${agenda ? `「${agenda.name}」` : ''}` }]
  for (const asset of inv.assets || []) options.push({ id: `asset:${asset.id}`, label: `支援「${api?.cardName?.(asset.code) || asset.code}」` })
  const here = locationOf(state, inv.location)
  for (const attachment of here?.attachments || []) {
    if (attachment.ownerSeat != null) continue
    options.push({ id: `encounter:${attachment.id}`, label: `遭遇卡「${api?.cardName?.(attachment.code) || attachment.code}」` })
  }
  const answer = choose(api, {
    kind: 'story', source: CODES.keyUnstable, seat: inv.seat,
    prompt: '扭曲反棱镜（动荡面）：把 1 个毁灭标记放在哪里？', options,
  })
  if (String(answer).startsWith('asset:')) {
    const asset = (inv.assets || []).find(item => item.id === String(answer).slice(6))
    if (asset) api?.doomOn?.(asset, 1)
  } else if (String(answer).startsWith('encounter:')) {
    const attachment = (here?.attachments || []).find(item => item.id === String(answer).slice(10))
    if (attachment) api?.doomOn?.(attachment, 1)
  } else {
    api?.addDoom?.(1)
  }
}

// ---- 教派线索 ----
function trimCultistClues(state, api) {
  let moved = 0
  const seat = leadSeat(state)
  for (const enemy of cultistEnemies(state)) {
    const clues = Number(enemy.clues) || 0
    if (clues <= 3) continue
    const excess = clues - 3
    const taken = api?.takeEnemyClues?.(enemy, seat, excess, { victoryWhenEmpty: false }) || 0
    if (!taken) continue
    api?.loseClues?.(seat, taken)
    api?.setScenarioFlag?.('cluesUnveiled', cluesUnveiled(state) + taken)
    moved += taken
  }
  if (moved) api?.info?.(`📜 ${moved} 个超出上限的教派线索移到「彰显的线索」上。`)
  return moved
}

/** 按玩家顺序让每位调查员抽取一张异教徒敌人（Setup「cultists」与密谋 1 背面共用）。 */
function drawCultistFor(state, api, seat) {
  const inv = state.investigators[seat]
  if (!inv) return null
  if (typeof api?.discardUntilEnemyTrait !== 'function') return null
  const code = api.discardUntilEnemyTrait('Cultist')
  if (!code) {
    api?.info?.('遭遇牌库里没有[[异教徒]]敌人。')
    return null
  }
  const enemy = api.spawn?.(code, inv.location)
  if (!enemy) return null
  concealEnemy(state, api, enemy)
  api.info?.(`🩸 ${inv.name} 抽取了[[异教徒]]敌人「${enemy.name}」，并结算其隐匿关键词。`)
  return enemy
}

/** 从遭遇牌库/弃牌堆找一张[[异教徒]]敌人并抽取（密谋 1 背面的选项）。 */
function searchCultistAndDraw(state, api, seat) {
  const inv = state.investigators[seat]
  if (!inv) return false
  const enemies = state.scenario?.enemies || {}
  const isCultistCode = code => (enemies[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'cultist')
  const deck = (state.encounterDeck || []).filter(code => isCultistCode(code))
  const discard = (state.encounterDiscard || []).filter(code => isCultistCode(code))
  const code = deck[deck.length - 1] || discard[discard.length - 1] || null
  if (!code) return false
  api?.takeEncounterCard?.(code)
  const enemy = api?.spawn?.(code, inv.location)
  if (!enemy) return false
  concealEnemy(state, api, enemy)
  api.info?.(`🩸 ${inv.name} 从遭遇牌库找出[[异教徒]]敌人「${enemy.name}」并抽取。`)
  return true
}

// ---- 场景 1 → 场景 2 布置 ----
function setAsideActOneLocations(state, api) {
  const snapshot = []
  const minis = []
  const concealed = concealedApi(api)
  for (const id of INITIAL_LOCATIONS) {
    const location = locationOf(state, id)
    if (!location) continue
    snapshot.push({ id, clues: Number(location.clues) || 0, doom: Number(location.doom) || 0, revealed: location.revealed === true })
    for (const card of miniCardsOf(api).filter(entry => entry.locationId === id)) {
      minis.push({ kind: card.kind, decoy: card.decoy === true })
      concealed?.expose?.(card.id)
    }
    api?.remove?.(id)
  }
  flagsOf(state).actOneLocations = snapshot
  flagsOf(state).actOneMiniCards = minis
  return snapshot
}

function shuffled(api, list) {
  const out = [...list]
  for (let index = out.length - 1; index > 0; index -= 1) {
    const random = typeof api?.random === 'function' ? api.random() : 0.5
    const target = Math.floor(random * (index + 1))
    ;[out[index], out[target]] = [out[target], out[index]]
  }
  return out
}

function bazaarIdByCode(state, code) {
  return Object.values(state.scenario?.locations || {}).find(location => codeOf(location) === code)?.id || null
}

/** 场景 2 布置（Act 1b）：四地点放一边、七张巴扎抽 6 摆图形、共边连接、调查员进入口、迷你卡重分配。 */
export function setupGrandBazaar(state, api) {
  const flags = flagsOf(state)
  setAsideActOneLocations(state, api)
  const pool = shuffled(api, BAZAAR_LOCATION_CODES.map(code => bazaarIdByCode(state, code)).filter(Boolean))
  const removed = pool.shift() || null
  if (removed) {
    flags.bazaarRemoved = removed
    api?.info?.(`🚫 一张大巴扎地点被随机移出游戏（不查看）。`)
  }
  const token = api?.revealToken ? api.revealToken(leadSeat(state)) : 'default'
  const diagram = bazaarDiagramFor(token)
  const placed = pool.map((id, index) => ({ id, ...(diagram.positions[index] || diagram.positions[0]) }))
  for (const entry of placed) {
    api?.place?.(entry.id)
    const location = locationOf(state, entry.id)
    if (location) Object.assign(location, { x: entry.x, y: entry.y, bazaarSlot: `${entry.x},${entry.y}` })
  }
  for (const left of placed) {
    for (const right of placed) {
      if (left.id >= right.id) continue
      if (isSideAdjacent(left, right)) api?.connectLocations?.(left.id, right.id)
    }
  }
  const entrance = placed[0]?.id || START_LOCATION
  const eastGateEntry = placed.find(entry => entry.x === diagram.eastGate.x && entry.y === diagram.eastGate.y) || null
  const eastGate = eastGateEntry?.id || placed[placed.length - 1]?.id || entrance
  flags.bazaarDiagram = diagram.id
  flags.bazaarToken = token
  flags.bazaarEntrance = entrance
  flags.bazaarEastGate = eastGate
  flags.bazaarLocations = placed.map(entry => entry.id)
  for (const inv of activeInvestigators(state)) {
    if (inv.location !== entrance) api?.moveInvestigator?.(inv.seat, entrance)
  }
  const minis = [...(flags.actOneMiniCards || [])]
  if (minis.length && placed.length) {
    const concealed = concealedApi(api)
    const base = Math.floor(minis.length / placed.length)
    const extra = minis.length % placed.length
    const placements = placed.map((entry, index) => ({ locationId: entry.id, count: base + (index < extra ? 1 : 0) }))
      .filter(entry => entry.count > 0)
    try {
      concealed?.distribute?.({ cards: minis, placements })
    } catch (error) {
      api?.info?.(`迷你卡重新分配失败：${error.message}`)
    }
    flags.actOneMiniCards = []
  }
  api?.info?.(`🕌 大巴扎按图形「${diagram.id}」摆放 6 个地点；入口 = 「${locationOf(state, entrance)?.name || entrance}」，东门 = 「${locationOf(state, eastGate)?.name || eastGate}」。`)
  return { entrance, eastGate, diagram, placed, removed }
}

/** 把场景 1 的地点按快照放回场上（Act 2b + 圣索菲亚接到入口左侧 + 加拉塔码头入场）。 */
export function restoreActOneLocations(state, api) {
  const snapshot = flagsOf(state).actOneLocations || []
  for (const item of snapshot) {
    api?.place?.(item.id)
    const location = locationOf(state, item.id)
    if (!location) continue
    if (item.revealed && !location.revealed) api?.reveal?.(item.id)
    const current = Number(location.clues) || 0
    if (item.clues > current) api?.addCluesToLocation?.(item.id, item.clues - current)
    else if (item.clues < current) api?.removeLocationClues?.(item.id, current - item.clues)
    if (item.doom) location.doom = item.doom
  }
  const entrance = flagsOf(state).bazaarEntrance
  if (entrance && locationOf(state, entrance)) {
    api?.connectLocations?.(LOCATION_IDS.hagiaSophia, entrance)
    const hagia = locationOf(state, LOCATION_IDS.hagiaSophia)
    if (hagia) hagia.leftOf = entrance
  }
  if (locationOf(state, LOCATION_IDS.galataDocks) == null) api?.place?.(LOCATION_IDS.galataDocks)
  flagsOf(state).actOneLocationsRestored = true
  api?.info?.('🏛️ 场景 1 的四个地点回到场上；圣索菲亚与入口彼此连接，加拉塔码头入场。')
}

// ---- 故事卡：彰显 → 解封 ----
function storyInPlay(state, code) {
  return (state.storyAssets || []).find(asset => codeOf(asset) === code) || null
}
function flipUnveiling(state, api) {
  const unveiling = storyInPlay(state, CODES.storyTheUnveiling)
  flagsOf(state).cluesUnveiled = 0
  if (unveiling) api?.removeStoryAsset?.(unveiling.id)
  api?.storyAsset?.(CODES.storyTheUnsealing, null)
  api?.info?.('📜 「彰显」翻至「解封」面，其上的线索全部移除。')
}

/** The Unsealing 在场时：每个非弱点敌人获得猎手/猎物，持钥敌人改为巡逻加拉塔码头。 */
export function applyUnsealingKeywords(state, api) {
  if (!storyInPlay(state, CODES.storyTheUnsealing)) return 0
  const docks = LOCATION_IDS.galataDocks
  const holder = keyBearer(state, api)
  let changed = 0
  for (const enemy of state.enemies || []) {
    if (!enemy || enemy.defeated || enemy.removedFromGame) continue
    if (holder.type === 'enemy' && holder.enemyId === enemy.id) {
      if (!enemy.patrol || enemy.patrol.locationId !== docks) {
        enemy.patrol = { kind: 'named', locationId: docks }
        enemy.hunter = false
        changed += 1
      }
      continue
    }
    if (enemy.hunter !== true) { enemy.hunter = true; changed += 1 }
    if (holder.type === 'investigator' && enemy.preySeat !== holder.seat) enemy.preySeat = holder.seat
  }
  return changed
}

// ---- 幕背面（Act 1b / Act 2b） ----
function actOneBack(state, api) {
  // 1) 结算不在阴影中的非弱点[[异教徒]]敌人的隐匿关键词（密谋 1a 授予）。
  for (const enemy of cultistEnemies(state)) {
    if (!enemyInShadows(api, enemy)) concealEnemy(state, api, enemy)
  }
  // 2) 把放一边的幽影预示者与犹格斯星密使洗入遭遇牌库。
  const shuffledIn = []
  for (const code of SET_ASIDE_ENEMY_CODES) if (api?.takeFromSetAside?.(code)) shuffledIn.push(code)
  if (shuffledIn.length) api?.shuffleIntoEncounterDeck?.(shuffledIn)
  api?.shuffleDiscard?.()
  api?.info?.('📜 幕 1 背面：「幽影预示者」与「犹格斯星的密使」洗入遭遇牌库；遭遇弃牌堆洗回。')
  // 3) 进入场景 2 布置。
  return setupGrandBazaar(state, api)
}

function actTwoBack(state, api) {
  const flags = flagsOf(state)
  const winner = flags.talismanWinner || 'investigators'
  const docks = LOCATION_IDS.galataDocks
  // 1) 揭示每张隐匿迷你卡：敌人的迷你卡 → 敌人从阴影回到该地点（密钥归属要在敌人回场后判定）。
  const concealed = concealedApi(api)
  for (const card of [...miniCardsOf(api)]) {
    let result = null
    try { result = concealed?.expose?.(card.id) || null } catch { result = null }
    if (!result || result.decoy) continue
    const asideEnemy = (state.setAsideEnemies || []).find(enemy => codeOf(enemy) === codeOfMiniKind(result.kind))
    if (asideEnemy) api?.restoreEnemyFromAside?.(asideEnemy.id, card.locationId)
  }
  flags.miniCardsRevealed = true
  // 2) 密钥归属：教派先达成 → 线索最多的异教徒；否则东门的调查员。
  api?.takeFromSetAside?.(CODES.keyStable)
  if (winner === 'cult') {
    const cultist = [...cultistEnemies(state)].sort((left, right) => (right.clues || 0) - (left.clues || 0))[0] || null
    if (cultist) {
      bindKey(state, api, { type: 'enemy', enemyId: cultist.id }, { steal: true })
      flags.twistedAntiprismFace = CODES.keyUnstable
      api?.info?.(`🔑 教派先找到护身符：扭曲反棱镜交给线索最多的「${cultist.name}」（动荡面）。`)
    } else {
      record(state, api, 'twistedAntiprismBearer', 'redGlovedMan')
      flags.twistedAntiprismBearer = { type: 'none', holder: 'redGlovedMan' }
    }
  } else {
    const eastGate = flags.bazaarEastGate
    const eligible = activeInvestigators(state).filter(inv => inv.location === eastGate)
    const seat = eligible[0]?.seat ?? leadSeat(state)
    bindKey(state, api, { type: 'investigator', seat })
    flags.twistedAntiprismFace = CODES.keyStable
    record(state, api, 'twistedAntiprismBearer', `investigator:${seat}`)
    api?.info?.(`🔑 调查员先找到护身符：扭曲反棱镜交给「${state.investigators[seat]?.name || '调查员'}」。`)
  }
  // 3) 地点回场 + 加拉塔码头。
  restoreActOneLocations(state, api)
  // 4) 教派先达成：线索多于调查员，密钥敌人向加拉塔码头移动（每多 1[每人] 移动一次）。
  if (winner === 'cult') {
    const difference = cultCluesTotal(state) - investigatorCluesTotal(state)
    const moves = Math.max(0, Math.floor(difference / numInvestigators(state)))
    const bearer = keyBearer(state, api)
    const enemy = bearer.type === 'enemy' ? (state.enemies || []).find(item => item.id === bearer.enemyId) : null
    for (let index = 0; index < moves && enemy; index += 1) api?.moveEnemyToward?.(enemy, docks, {})
    if (moves) api?.info?.(`🚶 密钥敌人朝加拉塔码头移动 ${moves} 次。`)
  }
  // 5) 每位调查员与每个异教徒失去所有线索。
  for (const inv of activeInvestigators(state)) if (inv.clues) api?.loseClues?.(inv.seat, inv.clues)
  for (const enemy of cultistEnemies(state)) api?.clearCluesOnEnemy?.(enemy)
  // 6) 彰显翻面 → 解封；幕/密谋直接推进到「追逐」。
  flipUnveiling(state, api)
  api?.clearDoom?.()
  api?.advanceAgendaTo?.(1)
  flags.actTwoAdvanced = true
  api?.info?.('🌒 幕 2 背面：扭曲反棱镜入场；幕与密谋直接推进到「追逐」（它同时是当前幕与当前密谋）。')
  return true
}

// ---- 密谋背面（1a 黑暗使徒 / 2a 追逐） ----
function agendaAgentsBack(state, api) {
  const flags = flagsOf(state)
  const resolveOne = seat => {
    const inv = state.investigators[seat]
    if (!inv || inv.defeated || inv.resigned) return
    const hasCultist = [...(state.encounterDeck || []), ...(state.encounterDiscard || [])]
      .some(code => (state.scenario?.enemies?.[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'cultist'))
    const options = [{ id: 'clue', label: '将 1 个线索（从供应堆）放到「彰显的线索」上' }]
    if (hasCultist) options.push({ id: 'cultist', label: '查找遭遇牌库/弃牌堆，找出一个[[异教徒]]敌人并抽取（获得隐匿 1）' })
    const answer = choose(api, {
      kind: 'story', source: CODES.agendaAgentsOfTheDark, seat,
      prompt: '黑暗使徒：选择一项。', options,
    })
    if (answer === 'cultist' && searchCultistAndDraw(state, api, seat)) return
    api?.setScenarioFlag?.('cluesUnveiled', cluesUnveiled(state) + 1)
    flags.cluesUnveiled = cluesUnveiled(state)
    api?.info?.(`📜 ${inv.name} 把 1 个线索放到「彰显的线索」上（${cluesUnveiled(state)}）。`)
  }
  const investigators = activeInvestigators(state)
  for (const inv of investigators) resolveOne(inv.seat)
  const eclipses = Math.max(0, Number(flags.eclipse) || 0)
  for (let index = 0; index < eclipses; index += 1) {
    const seat = Number(choose(api, {
      kind: 'investigator', source: CODES.agendaAgentsOfTheDark, seat: leadSeat(state),
      prompt: `日食 ${index + 1}：选择一位调查员额外结算一次「黑暗使徒」背面。`,
      options: investigators.map(inv => ({ id: String(inv.seat), label: inv.name })),
    }))
    resolveOne(Number.isInteger(seat) ? seat : leadSeat(state))
  }
  flags.eclipse = eclipses + 1
  api?.info?.(`🌘 黑暗使徒翻回正面，并增加 1 个日食（当前 ${flags.eclipse} 个）。`)
  api?.revertAgenda?.()
}

function agendaChaseBack(state, api) {
  // 每个敌人移动并攻击（如同敌军阶段，不横置）。
  for (const enemy of [...(state.enemies || [])]) {
    if (!(state.enemies || []).includes(enemy)) continue
    api?.resolveEnemyPhaseOf?.(enemy)
  }
  // 场上敌人少于调查员时，按玩家顺序弃遭遇牌库顶直到弃出异教徒并抽取。
  const investigators = activeInvestigators(state)
  for (const inv of investigators) {
    if ((state.enemies || []).length >= investigators.length) break
    drawCultistFor(state, api, inv.seat)
  }
  api?.info?.('🏃 追逐：每个敌人移动并攻击；若有敌人不足，抽取[[异教徒]]敌人补足。')
  api?.revertAgenda?.()
}

// ---- 场景目标 ----
function checkManuscript(state, api) {
  const act = state.acts?.[state.actIndex]
  const per = Number(act?.clueThresholdPerInvestigator ?? 4)
  const needed = per * numInvestigators(state)
  const cult = cultCluesTotal(state)
  const investigator = investigatorCluesTotal(state)
  if (cult < needed && investigator < needed) return false
  flagsOf(state).manuscriptWinner = cult >= needed ? 'cult' : 'investigators'
  api?.info?.(cult >= needed
    ? `📖 教派先达成线索阈值（${cult}/${needed}）：推进幕 1。`
    : `📖 调查员先达成线索阈值（${investigator}/${needed}）：推进幕 1。`)
  api?.advanceAct?.()
  return true
}

function checkTalisman(state, api) {
  const act = state.acts?.[state.actIndex]
  const per = Number(act?.clueThresholdPerInvestigator ?? 8)
  const needed = per * numInvestigators(state)
  const eastGate = flagsOf(state).bazaarEastGate
  const atGate = activeInvestigators(state).filter(inv => inv.location === eastGate)
    .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
  const cult = cultCluesTotal(state)
  if (cult < needed && atGate < needed) return false
  flagsOf(state).talismanWinner = cult >= needed ? 'cult' : 'investigators'
  api?.info?.(cult >= needed
    ? `🔑 教派先达成线索阈值（${cult}/${needed}）：推进幕 2。`
    : `🔑 调查员在东门达成线索阈值（${atGate}/${needed}）：推进幕 2。`)
  api?.advanceAct?.()
  return true
}

export function checkTheChase(state, api) {
  const bearer = keyBearer(state, api)
  const docks = LOCATION_IDS.galataDocks
  if (bearer.type === 'enemy') {
    const enemy = (state.enemies || []).find(item => item.id === bearer.enemyId)
    if (enemy?.location === docks) {
      api?.info?.('🚢 持有扭曲反棱镜的敌人在加拉塔码头：进入结局 6。')
      api?.finish?.('resolution6', state)
      return true
    }
  }
  if (bearer.type === 'investigator') {
    const inv = state.investigators[bearer.seat]
    if (inv && (inv.defeated || inv.resigned)) {
      api?.info?.(`💀 持有扭曲反棱镜的 ${inv.name} 已被击败：进入结局 6。`)
      api?.finish?.('resolution6', state)
      return true
    }
    // 2026-11-13 P1-14（09570 正面目标一）：「持钥调查员在加拉塔码头」→ 可以从城里带走它 → 结局 1。
    // 结局链 R1→R2/R3→R4/R5 由 `resolution` 按「与艾婕合作/欺骗/拒绝」的记录分流。
    if (inv && inv.location === docks) {
      api?.info?.(`🚢 持有扭曲反棱镜的 ${inv.name} 在加拉塔码头：带着它离开伊斯坦布尔 → 进入结局 1。`)
      api?.finish?.('resolution1', state)
      return true
    }
  }
  return false
}

// ---- 地点行动 ----
function groupUsedThisRound(state, key) {
  return Number(flagsOf(state).groupLimits?.[key]) === state.round
}
function markGroupUsed(state, key) {
  flagsOf(state).groupLimits ||= {}
  flagsOf(state).groupLimits[key] = state.round
}

function sceneActions(state, inv) {
  const location = locationOf(state, inv.location)
  if (!location || !location.revealed) return []
  const rule = ruleAt(state, location.id)
  if (!rule) return []
  const moves = []
  if (rule.studyAction) {
    moves.push({
      action: 'scenarioAction', actionKind: 'activate', rule: 'dealingsStudyHagiaSophia',
      label: rule.label, locationId: location.id,
    })
  }
  if (rule.studyClueAction) {
    const used = Boolean(flagsOf(state).istanbulStudySuccess)
    moves.push({
      action: 'scenarioAction', actionKind: 'activate', rule: 'dealingsStudyIstanbulUniversity',
      label: rule.label, locationId: location.id,
      ...(used ? { reason: '本场游戏已经成功过一次（每场游戏仅限一次成功）' } : {}),
    })
  }
  if (rule.investigateCharmRelicPlay) {
    moves.push({
      action: 'scenarioAction', actionKind: 'investigate', rule: 'dealingsJewelersRoadInvestigate',
      label: rule.label, locationId: location.id,
    })
  }
  return moves
}

function sceneFastActions(state, inv) {
  const location = locationOf(state, inv.location)
  if (!location || !location.revealed) return []
  const rule = ruleAt(state, location.id)
  if (!rule) return []
  const moves = []
  if (rule.fastParley === 'exposeAnywhere') {
    const hasMini = (state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []).length > 0
    if (hasMini && !groupUsedThisRound(state, 'galataExpose') && (inv.resources || 0) >= (Number(rule.resourceCost) || 0)) {
      moves.push({
        action: 'scenarioAction', actionKind: 'parley', fast: true, actions: 0,
        resourceCost: rule.resourceCost, rule: 'dealingsGalataExpose', label: rule.label, locationId: location.id,
      })
    }
  }
  if (rule.fastParleyTakeClue) {
    const cultist = cultistEnemies(state).find(enemy => enemy.location === location.id && (enemy.clues || 0) > 0)
    if (cultist && !groupUsedThisRound(state, 'marbleFountainClue')) {
      moves.push({
        action: 'scenarioAction', actionKind: 'parley', fast: true, actions: 0,
        enemyId: cultist.id, rule: 'dealingsMarbleFountainClue', label: rule.label, locationId: location.id,
      })
    }
  }
  return moves
}

function performSceneAction(state, inv, move, api) {
  const rule = move.rule
  const location = locationOf(state, move.locationId || inv.location)
  if (!location) return false
  if (rule === 'dealingsStudyHagiaSophia') {
    const per = Number(ruleAt(state, location.id)?.studyCluesPerInvestigator) || 1
    const amount = per * numInvestigators(state)
    api?.addCluesToLocation?.(location.id, amount)
    location.studyTokens = (Number(location.studyTokens) || 0) + 1
    api?.info?.(`📚 圣索菲亚：放置 ${amount} 个线索与 1 个研究标记（当前 ${location.studyTokens} 个，隐藏值 +${3 * location.studyTokens}）。`)
    return true
  }
  if (rule === 'dealingsStudyIstanbulUniversity') {
    const action = ruleAt(state, location.id)?.studyClueAction
    const skill = String(choose(api, {
      kind: 'story', source: CODES.istanbulUniversity, seat: inv.seat,
      prompt: '选择检定技能。', options: action.skills.map(name => ({ id: name, label: name === 'intellect' ? '智力' : '意志' })),
    }) || action.skills[0])
    api?.test?.(inv.seat, skill, action.difficulty, result => {
      if (!result.success) return
      const unveiled = cluesUnveiled(state)
      if (unveiled <= 0) {
        api?.info?.('「彰显的线索」上没有线索。')
        return
      }
      api?.setScenarioFlag?.('cluesUnveiled', unveiled - 1)
      flagsOf(state).istanbulStudySuccess = true
      api?.gainClues?.(inv.seat, 1)
      api?.info?.(`🎓 伊斯坦布尔大学：${inv.name} 取得 1 个「彰显的线索」（剩余 ${cluesUnveiled(state)}）。`)
    }, 0, { label: '伊斯坦布尔大学研究', code: CODES.istanbulUniversity })
    return true
  }
  if (rule === 'dealingsJewelersRoadInvestigate') {
    const shroud = Number(location.shroud) || 0
    api?.test?.(inv.seat, 'intellect', shroud, result => {
      if (!result.success) return
      const successBy = Math.max(0, Number(result.value) - shroud)
      const candidates = (inv.hand || []).filter(code => {
        const traits = ALL_CARDS[code]?.traits || []
        if (!traits.some(trait => ['Charm', 'Relic'].includes(trait))) return false
        return (ALL_CARDS[code]?.cost ?? 0) <= successBy
      })
      if (!candidates.length) {
        api?.info?.('珠宝匠之路：没有可用成功点数免费打出的[[守护]]/[[遗物]]支援。')
        return
      }
      const code = String(choose(api, {
        kind: 'card', source: CODES.bazaarJewelersRoad, seat: inv.seat,
        prompt: `成功 ${successBy} 点：可以免费打出其中一张[[守护]]/[[遗物]]支援（不发现线索）。`,
        options: candidates.map(value => ({ id: value, label: ALL_CARDS[value]?.nameZh || ALL_CARDS[value]?.name || value })),
      }))
      if (!candidates.includes(code)) return
      api?.playCardFromHandFree?.(inv.seat, code) || api?.info?.(`珠宝匠之路：按成功点数免费打出「${ALL_CARDS[code]?.nameZh || code}」。`)
    }, 0, { label: '珠宝之路投资', code: CODES.bazaarJewelersRoad })
    return true
  }
  if (rule === 'dealingsGalataExpose') {
    const cost = Number(ruleAt(state, location.id)?.resourceCost) || 0
    if ((inv.resources || 0) < cost) {
      api?.info?.(`加拉塔：资源不足（需要 ${cost}）。`)
      return true
    }
    inv.resources -= cost
    markGroupUsed(state, 'galataExpose')
    const candidates = [...new Set(miniCardsOf(api).map(card => card.locationId))]
      .filter(id => locationOf(state, id))
    if (!candidates.length) {
      api?.info?.('加拉塔：场上没有可揭露的隐匿迷你卡。')
      return true
    }
    const locationId = String(choose(api, {
      kind: 'location', source: CODES.galata, seat: inv.seat,
      prompt: '选择要揭露迷你卡的地点。',
      options: candidates.map(id => ({ id, label: locationOf(state, id)?.name || id })),
    }) || candidates[0])
    exposeAt(state, api, inv.seat, candidates.includes(locationId) ? locationId : candidates[0])
    return true
  }
  if (rule === 'dealingsMarbleFountainClue') {
    const enemy = (state.enemies || []).find(item => item.id === move.enemyId)
    if (!enemy) return true
    const taken = api?.takeEnemyClues?.(enemy, inv.seat, 1) || 0
    api?.info?.(`🤝 大理石喷泉：${inv.name} 取得「${enemy.name}」的 ${taken} 个线索。`)
    markGroupUsed(state, 'marbleFountainClue')
    sendEnemyToShadows(state, api, enemy)
    return true
  }
  return false
}

function paySceneActionCost(state, inv, move, api) {
  // 费用在 performSceneAction 内结算（快速行动直接走 performAction，不经过本钩子）；
  // 这里只记录脚本行动已支付，避免同一次行动重复扣资源。
  void state
  void inv
  void move
  void api
}

// ---- 地点被动/强制 ----
function rooftopReaction(state, inv, location, api) {
  const rule = ruleAt(state, location.id)
  if (!rule?.moveReactionTest) return false
  const test = rule.moveReactionTest
  api?.info?.(`🪜 「${location.name}」：${inv.name} 可以选择检定敏捷(${test.difficulty})，成功后再移动一次。`)
  api?.test?.(inv.seat, test.skill, test.difficulty, result => {
    if (!result.success) return
    const destinations = (location.connections || []).filter(id => locationOf(state, id))
    if (!destinations.length) return
    const destination = String(choose(api, {
      kind: 'move', source: CODES.bazaarRooftopAccess, seat: inv.seat,
      prompt: '屋顶通道：再次移动。', options: destinations.map(id => ({ id, label: locationOf(state, id)?.name || id })),
    }) || destinations[0])
    api?.moveInvestigator?.(inv.seat, destinations.includes(destination) ? destination : destinations[0])
  }, 0, { label: '屋顶通道（再次移动）', code: CODES.bazaarRooftopAccess })
  return true
}

function reResolveKeywordAtRooftop(state, enemy, api) {
  const location = locationOf(state, enemy?.location)
  if (!location) return false
  if (!ruleAt(state, location.id)?.reResolveEnemyKeyword) return false
  const marker = flagsOf(state).rooftopRepeats || {}
  const round = String(state.round)
  const list = Array.isArray(marker[round]) ? marker[round] : []
  if (list.includes(enemy.id)) return false
  flagsOf(state).rooftopRepeats = { [round]: [...list, enemy.id] }
  if (enemy.patrol) api?.moveEnemyToward?.(enemy, (enemy.patrol.kind === 'named' ? enemy.patrol.locationId : null), {})
  else if (enemy.hunter) api?.resolveHunterMove?.(enemy, { source: CODES.bazaarRooftopAccess })
  api?.info?.(`🪜 「${location.name}」：敌人「${enemy.name}」通过猎手/巡逻进入后再次结算该关键词。`)
  return true
}

// ---- 导出 ----
export const scenarioApproximations = Object.freeze([
  '时间记录写进战役记录 `time`（number）；本章读取 `time` 与 P8 世界地图 `campaign.tsk.map.time` 的较大值，'
    + '两者的合并由战役流程在 P8 接线（本章不直写地图状态）。',
  '[cultist] 的「你可以放 1 毁灭把它改为 -1/-3」需要「标记取值前」的选择窗口，引擎没有该窗口：'
    + '本章固定按 -5/-7 结算，并把可选改值挂在 `cultistDoomSwap` 上供面板提示。',
  '「彰显的线索」数量记在 `scenarioFlags.cluesUnveiled`（引擎没有剧情卡线索计数器原语）；'
    + '教派线索总数 = 场上异教徒线索 + 该记录。',
  '从遭遇牌库抽出的[[异教徒]]敌人在抽牌者所在地点生成（参考实现按卡的 Spawn 指示；本章定义表不解析 Spawn 文本）。',
  '场景 2 的图形用 `api.revealToken` 从当前混乱袋揭示一个标记来选择；六张大巴扎的展示坐标写在 layout.js 的'
    + ' BAZAAR_DIAGRAMS（布置是随机的，不写进 manifest.layout）。',
  '场景 1 地点放一边时用 `scenarioFlags.actOneLocations` 保存揭示/线索/毁灭快照；地点上的附属卡会被'
    + '`removeLocation` 的既有清理弃入遭遇弃牌堆（参考实现要求「地点上的卡不弃置」）。',
  '「追逐」同时充当最终幕：幕牌库走完后不再有幕指针，R1/R6 目标由本文件 checkTheChase + 幕 2 背面结算。',
  '艾婕·萨辛按剧情支援入场（引擎没有剧情支援的控制者转移原语）：她的 [free] 能力由同地点调查员使用'
    + '（原为「控制者」）；「压在她底下」的牌记在 `scenarioFlags.eceBeneath` 并移入放一边区。',
  '密钥：若战役已初始化其它密钥（P8 世界地图流程），本章不再初始化扭曲反棱镜，改用剧本标记记录持有者；'
    + '敌人变换动荡面时不翻面（原语 shiftKey 恒翻面），只结算效果并记录每轮一次。',
  '大巴扎「暗处小巷」的「隐匿迷你卡攻防难度 +2」与「公共浴场」的「武器文本空白」在引擎里没有读点：'
    + '本章在 LOCATION_RULES 声明并由 describe/日志提示，读点缺口见 primitive-requests/。',
  '「午夜假面」只收 2 张错误指示 + 3 张追猎鬼影（按卡表份数），不收该组的地点/幕/议程。',
  '密谋 1 的日食用 `scenarioFlags.eclipse` 计数；每次推进按日食数量额外重复背面效果。',
  '「屋顶通道」的「敌人通过猎手/巡逻移动到本地点后再次结算」读点拿不到移动原因（引擎的 enemyMoved 钩子'
    + '不传 cause）：本章对任意进入该地点的敌人移动都按一次/轮再结算，并记录 `rooftopRepeats` 防循环。',
  '「加拉塔码头」的额外费用（合计 3 个相同技能图标）近似为「弃 1 张随机手牌」：引擎没有按图标组合支付的'
    + '选择面板（api.cardIcons 只在能力面可读）。',
  '「教派达成线索阈值」在参考实现是故事卡的 ScenarioModifier；本章直接在 checkObjectives 比较阈值。',
])

export const scenarioGaps = Object.freeze([
  'concealed 迷你卡的攻击/躲避难度没有引擎读点（09577 暗处小巷）。',
  '地点级「武器文本空白」没有引擎读点（09578 公共浴场）。',
  '「混乱标记取值前选择」窗口缺失（09566 [异教徒]）。',
  '剧情卡线索计数器与「压在剧情支援下」的写入口缺失（09571 / 09584）。',
  '敌人「在阴影中」没有独立状态字段（本章用「未揭露的非诱饵迷你卡」表达，与共用条目 09721 同一口径）。',
  'enemyMoved 钩子不携带移动原因，巡逻/猎手与效果移动无法区分（09582 屋顶通道）。',
])

export const implementedEncounterCodes = Object.freeze(['09584', '09585', '09586a', '09586b', '09586c',
  '09587', '09588', '09589', '09571', '09571b', '09590a', '09590b'])

export const behavior = {
  id: CHAPTER_ID,
  name: '暗中交易',
  scenarioApproximations,
  scenarioGaps,

  // ---- 入口三选一（参考 PreScenarioSetup DoStep 2/3/4） ----
  preScenarioSetup(state, events, api) {
    const flags = flagsOf(state)
    if (flags.introResolved) return
    flags.introResolved = true
    const seat = leadSeat(state)
    const answer = choose(api, {
      kind: 'story', source: `${CODES.scenario}-intro`, seat,
      prompt: '艾婕·萨辛提出由基金会保管护身符。你们如何回应？',
      options: [
        { id: 'giveToEce', label: '「好吧。我们会找到它，交给你保管。」（与艾婕合作）' },
        { id: 'giveToEceLying', label: '「好吧。」（你在撒谎：欺骗艾婕）' },
        { id: 'takeForOurselves', label: '「我们会找到它，但由我们保管。」（拒绝艾婕）' },
      ],
    })
    if (answer === 'giveToEceLying') {
      record(state, api, 'theCellIsDecievingEce', true)
      api?.info?.('🤝 记录「特别小组欺骗艾婕」；艾婕·萨辛会以剧情支援形式加入。')
    } else if (answer === 'takeForOurselves') {
      record(state, api, 'theCellRefusedEcesOffer', true)
      api?.info?.('🚫 记录「特别小组拒绝了艾婕的提议」；艾婕·萨辛移出游戏。')
    } else {
      record(state, api, 'theCellIsWorkingWithEce', true)
      api?.info?.('🤝 记录「特别小组与艾婕合作」；艾婕·萨辛会以剧情支援形式加入。')
    }
  },

  // ---- 布置：起始四地点 + 放一边 ----
  setupLocations(state, events, helper = {}) {
    const zones = (state.scenarioZones ||= {})
    const flags = flagsOf(state)
    const api = helper.api || null
    zones.setAside = [...SET_ASIDE_LOCATION_CODES, ...SET_ASIDE_ENEMY_CODES, CODES.keyStable]
    flags.eclipse = 0
    flags.cluesUnveiled = 0
    flags.actOneMiniCards = []
    if (!api) return [...INITIAL_LOCATIONS]
    // 时间线索：按已流逝时间在「彰显」上放线索（0 / ceil(人数/2) / 人数 / 人数×2）。
    const time = timePassed(state, api)
    const count = numInvestigators(state)
    const unveiled = time <= 10 ? 0 : time <= 17 ? Math.ceil(count / 2) : time <= 24 ? count : count * 2
    flags.cluesUnveiled = unveiled
    api.storyAsset?.(CODES.storyTheUnveiling, null)
    api.info?.(unveiled
      ? `📜 已流逝 ${time} 点时间：「彰显」上放置 ${unveiled} 个线索（彰显的线索）。`
      : `📜 已流逝 ${time} 点时间：不作改动。`)
    return [...INITIAL_LOCATIONS]
  },

  // ---- 布置后：艾婕 / 密钥 / 教派敌人抽牌 ----
  afterDeckSetup(state, events, helper = {}) {
    const api = helper.api || null
    if (!api) return
    const flags = flagsOf(state)
    const working = recordValue(state, api, 'theCellIsWorkingWithEce') === true
    const deceiving = recordValue(state, api, 'theCellIsDecievingEce') === true
    if (working || deceiving) {
      const ece = api.storyAsset?.(CODES.eceSahin, START_LOCATION)
      if (ece) {
        flags.eceControllerSeat = leadSeat(state)
        api.info?.(`🕵️ 艾婕·萨辛进入「${locationOf(state, START_LOCATION)?.name || START_LOCATION}」（控制者：${state.investigators[leadSeat(state)]?.name || '队长'}）。`)
      }
    } else {
      api.info?.('🚫 特别小组拒绝了艾婕的提议：艾婕·萨辛移出游戏。')
    }
    initializeKey(state, api)
    for (const inv of activeInvestigators(state)) {
      flags.cultistSetupDone ||= {}
      if (flags.cultistSetupDone[inv.seat]) continue
      drawCultistFor(state, api, inv.seat)
      flags.cultistSetupDone[inv.seat] = true
    }
    api.shuffleDiscard?.()
  },

  // ---- 幕/密谋背面（没有单卡条目：按当前卡号分派） ----
  actReveal(state, act, api) {
    const code = codeOf(act)
    if (code === CODES.actSearchForTheManuscript) { actOneBack(state, api); return true }
    if (code === CODES.actSearchForTheTalisman) { actTwoBack(state, api); return true }
    return true
  },

  agendaReveal(state, agenda, api) {
    const code = codeOf(agenda)
    if (code === CODES.agendaAgentsOfTheDark) { agendaAgentsBack(state, api); return true }
    if (code === CODES.agendaTheChase) { agendaChaseBack(state, api); return true }
    return true
  },

  // ---- 每次行动后的目标检查 ----
  checkObjectives(state, api) {
    if (state?.status !== 'playing') return
    trimCultistClues(state, api)
    const act = state.acts?.[state.actIndex]
    if (act?.chapterFlow === 'manuscript' && checkManuscript(state, api)) return
    if (act?.chapterFlow === 'talisman' && checkTalisman(state, api)) return
    const agenda = state.agendas?.[state.agendaIndex]
    if (agenda?.chapterFlow === 'theChase') checkTheChase(state, api)
  },

  // ---- 混乱标记：动态数值 ----
  resolveChaosToken(state, inv, token, api) {
    const fx = dealingsChaosToken(state, inv, token)
    if (fx?.cultistDoomSwap) {
      api?.info?.(`💀 [异教徒]：可用 1 个毁灭把修正改为 ${fx.cultistDoomSwap.changedTo}（本章近似：不提供改值选择）。`)
    }
    return fx
  },

  // ---- 检定后：符号后果 + 方尖碑强制 ----
  afterTest(state, inv, result, api, extra = {}) {
    for (const effect of dealingsChaosAfterTest(state, inv, result)) {
      if (effect.type === 'clueToLocation') {
        const left = api?.loseClues?.(inv.seat, effect.amount) ?? 0
        if (left > 0 && inv.location) api?.addCluesToLocation?.(inv.location, left)
        api?.info?.(`🪨 [石板]：${inv.name} 把 ${left} 个线索放到「${locationOf(state, inv.location)?.name || inv.location}」。`)
      } else if (effect.type === 'doomOnNearestCultist') {
        const cultist = nearestCultist(state, inv.location)
        if (cultist) {
          api?.doomOn?.(cultist, 1)
          api?.info?.(`🌑 [旧日支配者]：在「${cultist.name}」上放 1 个毁灭。`)
        }
      }
    }
    const location = locationOf(state, inv.location)
    const rule = ruleAt(state, location?.id)
    if (rule?.investigateFailClueToCultist && extra?.test?.actionKind === 'investigate' && result?.success !== true
      && (inv.clues || 0) > 0) {
      const cultist = nearestCultist(state, inv.location)
      if (cultist) {
        api?.moveClueToEnemy?.(cultist, { from: 'investigator', seat: inv.seat })
        api?.info?.(`🪨 方尖碑：调查失败，${inv.name} 的 1 个线索移到最近的「${cultist.name}」。`)
      }
    }
  },

  // ---- 故事 09571b：毁灭改为移动+攻击 ----
  doomPlaced(state, payload, api) {
    if (!payload?.card || payload.agenda) return
    if (!storyInPlay(state, CODES.storyTheUnsealing)) return
    const card = payload.card
    if (!(state.enemies || []).includes(card)) return
    const amount = Math.max(0, Number(payload.amount) || 0)
    if (!amount) return
    card.doom = Math.max(0, (Number(card.doom) || 0) - amount)
    api?.info?.(`🌑 「解封」：${card.name} 上将要放置的 ${amount} 个毁灭改为该敌人移动并攻击（不横置）。`)
    api?.resolveEnemyPhaseOf?.(card)
  },

  enemySpawned(state, enemy, api) {
    if (!storyInPlay(state, CODES.storyTheUnsealing)) return
    if (entryFlags(CODES.storyTheUnsealing)?.grantsHunterPrey !== true) return
    applyUnsealingKeywords(state, api)
    api?.info?.(`🩸 「解封」：新出现的「${enemy.name}」获得猎手/猎物（或巡逻加拉塔码头）。`)
  },

  // 密谋 1a「黑暗使徒」的强制：躲避[[异教徒]]后把它返回阴影并结算隐匿关键词，控制它的 1 个线索。
  // 读点 = 引擎的 afterEvade 钩子（combat.js#afterEvade，每种躲避只结算一次）。
  afterEvade(state, inv, enemy, _result, api) {
    const agenda = state.agendas?.[state.agendaIndex]
    if (agenda?.chapterFlow !== 'agentsOfTheDark') return
    if (!enemy || !(state.enemies || []).includes(enemy)) return
    if (!isCultist(enemy)) return
    if (!api?.setEnemyAside) return
    const taken = api?.takeEnemyClues?.(enemy, inv.seat, 1, { victoryWhenEmpty: false }) || 0
    sendEnemyToShadows(state, api, enemy)
    api?.info?.(taken
      ? `🩸 ${inv.name} 躲避了「${enemy.name}」：它返回阴影，${inv.name} 控制它的 ${taken} 个线索。`
      : `🩸 ${inv.name} 躲避了「${enemy.name}」：它返回阴影（身上没有线索）。`)
  },

  // 持钥敌人被击败：09571b 的反应会先让击败者夺回密钥；若没人夺回，密钥回到「无人持有」
  // （战役密钥不能指向已离场敌人，读档校验会拒）。
  enemyDefeated(state, enemy, api) {
    const bearer = keyBearer(state, api)
    if (bearer.type !== 'enemy' || bearer.enemyId !== enemy.id) return
    bindKey(state, api, { type: 'none' })
    flagsOf(state).twistedAntiprismBearer = { type: 'none', holder: 'defeatedEnemy' }
    api?.info?.(`🔑 「${enemy.name}」被击败且无人夺回扭曲反棱镜：密钥暂时无人持有。`)
  },

  // ---- 地点：隐藏值 / 进入限制 / 离开检定 / 屋顶反应 ----
  locationShroudModifier(state, location) {
    const perStudy = Number(ruleAt(state, location?.id)?.shroudPerStudy) || 0
    if (!perStudy) return 0
    return perStudy * (Number(location.studyTokens) || 0)
  },

  moveError(state, inv, destination) {
    const rule = ruleAt(state, destination?.id)
    if (!rule?.entryOnlyFrom) return null
    const from = locationOf(state, inv.location)
    if (from && codeOf(from) === CODES.galata) return null
    return `「${destination.name}」只能从「${locationOf(state, rule.entryOnlyFrom)?.name || rule.entryOnlyFrom}」进入。`
  },

  movementError(state, inv, destination) {
    const rule = ruleAt(state, destination?.id)
    if (!rule?.entryOnlyFrom) return null
    const from = locationOf(state, inv.location)
    if (from && codeOf(from) === CODES.galata) return null
    return `「${destination.name}」只能从「${locationOf(state, rule.entryOnlyFrom)?.name || rule.entryOnlyFrom}」进入。`
  },

  beforeMove(state, inv, destination, api) {
    const rule = ruleAt(state, destination?.id)
    if (!rule?.entryDiscardCards) return true
    const from = locationOf(state, inv.location)
    if (!from || codeOf(from) !== CODES.galata) return true
    if (!(inv.hand || []).length) {
      api?.info?.(`「${destination.name}」：手牌为空，无法支付额外费用。`)
      return false
    }
    api?.discardRandom?.(inv.seat, rule.entryDiscardCards)
    api?.info?.(`🚢 进入「${destination.name}」的额外费用：弃 1 张手牌（近似：卡面要求合计 3 个相同技能图标）。`)
    return true
  },

  locationEntered(state, inv, location, api) {
    if (!location) return
    rooftopReaction(state, inv, location, api)
  },

  enemyMoved(state, enemy, _previous, api) {
    reResolveKeywordAtRooftop(state, enemy, api)
  },

  // 邪恶野心家（09586a/b/c）：敌军阶段结束时若仍处于重整状态，在其上放 1 个毁灭。
  enemyPhaseEnd(state, api) {
    for (const enemy of state.enemies || []) {
      const rule = enemyRuleFor(codeOf(enemy))
      const amount = Number(rule?.enemyPhaseEndDoomIfReady) || 0
      if (!amount || enemy.exhausted || enemy.defeated) continue
      api?.doomOn?.(enemy, amount)
      api?.info?.(`🌑 「${enemy.name}」在敌军阶段结束时仍处于重整状态：放置 ${amount} 个毁灭。`)
    }
  },

  locationLeaveTest(state, inv, previous) {
    const rule = ruleAt(state, previous?.id)
    if (!rule?.leaveTest) return null
    return { ...rule.leaveTest }
  },

  locationLeaveFailed(state, inv, previous, api) {
    const rule = ruleAt(state, previous?.id)
    if (!rule?.leaveFailChoice) return
    const answer = choose(api, {
      kind: 'story', source: `${CODES.bazaarBusyWalkway}-leave`, seat: inv.seat,
      prompt: `「${previous.name}」：检定失败，选择失去 1 个行动或取消本次移动。`,
      options: [
        { id: 'loseAction', label: '失去 1 个行动' },
        { id: 'cancelMove', label: '取消本次移动（留在原地）' },
      ],
    })
    if (answer === 'loseAction' && (inv.actionsLeft || 0) > 0) api?.loseActions?.(inv.seat, 1)
    api?.info?.(answer === 'loseAction'
      ? `🚧 「${previous.name}」：${inv.name} 失去 1 个行动。`
      : `🚧 「${previous.name}」：${inv.name} 的移动被取消。`)
  },

  // ---- 地点行动 ----
  actions(state, inv) {
    return sceneActions(state, inv)
  },

  fastActions(state, inv) {
    return sceneFastActions(state, inv)
  },

  performAction(state, inv, move, api) {
    if (!move) return false
    return performSceneAction(state, inv, move, api)
  },

  payScenarioActionCost(state, inv, move, api) {
    if (move?.action !== 'scenarioAction') return
    paySceneActionCost(state, inv, move, api)
  },

  // ---- 章节事件（条目经 api.scenario.resolveScenarioEvent 调用） ----
  events: {
    dealingsExpose(state, payload, api) {
      const seat = Number.isInteger(payload?.seat) ? payload.seat : leadSeat(state)
      const locationId = payload?.locationId || state.investigators[seat]?.location
      return exposeAt(state, api, seat, locationId)
    },
    dealingsSendCultistToShadows(state, payload, api) {
      const enemy = (state.enemies || []).find(item => item.id === payload?.enemyId)
      return enemy ? sendEnemyToShadows(state, api, enemy) : false
    },
    dealingsConcealEnemy(state, payload, api) {
      const enemy = (state.enemies || []).find(item => item.id === payload?.enemyId)
      return enemy ? concealEnemy(state, api, enemy) : false
    },
    dealingsShiftKey(state, payload, api) {
      return shiftTwistedAntiprism(state, api, payload || {})
    },
    dealingsSetupGrandBazaar(state, _payload, api) {
      return setupGrandBazaar(state, api)
    },
    // 最近的[[异教徒]]敌人（09585 / 09587 / 09588 共用这一句，只在本章实现一次）。
    dealingsNearestCultist(state, payload) {
      const cultist = nearestCultist(state, payload?.from || null)
      return cultist ? { enemyId: cultist.id, name: cultist.name, clues: Number(cultist.clues) || 0 } : null
    },
    dealingsDoomOnNearestCultist(state, payload, api) {
      const cultist = nearestCultist(state, payload?.from || null)
      if (!cultist) return null
      api?.doomOn?.(cultist, Math.max(1, Number(payload?.amount) || 1))
      return { enemyId: cultist.id, name: cultist.name }
    },
    // 教派线索总数（09589 与场景目标共用同一口径）。
    dealingsCultClues(state) {
      return cultCluesTotal(state)
    },
    dealingsKeyBearer(state, _payload, api) {
      return keyBearer(state, api)
    },
    dealingsKeyStolenByEnemy(state, payload, api) {
      const enemy = (state.enemies || []).find(item => item.id === payload?.enemyId)
      if (!enemy) return null
      bindKey(state, api, { type: 'enemy', enemyId: enemy.id }, { steal: true })
      api?.info?.(`🔑 「${enemy.name}」攻击了持钥者：扭曲反棱镜被该敌人夺走（动荡面），随后该敌人变换它。`)
      shiftTwistedAntiprism(state, api, { by: 'enemy', enemyId: enemy.id })
      return { enemyId: enemy.id }
    },
    dealingsTakeKeyByInvestigator(state, payload, api) {
      const seat = Number.isInteger(payload?.seat) ? payload.seat : leadSeat(state)
      const inv = state.investigators[seat]
      if (!inv) return null
      // 从敌人手里夺回：走 steal 让密钥回到调查员持有时的稳定面。
      bindKey(state, api, { type: 'investigator', seat }, { steal: true })
      flagsOf(state).twistedAntiprismFace = CODES.keyStable
      record(state, api, 'twistedAntiprismBearer', `investigator:${seat}`)
      api?.info?.(`🔑 ${inv.name} 夺回扭曲反棱镜（稳定面）。`)
      return { seat }
    },
  },

  // ---- 面板/说明 ----
  describe(state) {
    const lines = []
    const eclipse = Number(flagsOf(state).eclipse) || 0
    if (eclipse) lines.push(`🌘 密谋 1 上有 ${eclipse} 个日食：下次推进时额外结算 ${eclipse} 次背面。`)
    const unveiled = cluesUnveiled(state)
    if (unveiled) lines.push(`📜 彰显的线索：${unveiled} 个（教派线索总数 ${cultCluesTotal(state)}）。`)
    for (const location of state.locations || []) {
      const rule = ruleAt(state, location.id)
      if (!rule) continue
      if (rule.concealedFightEvadeBonus) {
        lines.push(`🕯️ 「${location.name}」：本地点隐匿迷你卡的攻击/躲避难度 +${rule.concealedFightEvadeBonus}。`)
      }
      if (rule.blankAssetsWithTrait) {
        lines.push(`🛁 「${location.name}」：你控制的[[${rule.blankAssetsWithTrait}]]支援文本框视为空白。`)
      }
    }
    const bearer = keyBearer(state)
    if (bearer.type === 'investigator') lines.push(`🔑 扭曲反棱镜：${state.investigators[bearer.seat]?.name || '调查员'} 持有（${keyFaceCode(state)}）。`)
    if (bearer.type === 'enemy') lines.push(`🔑 扭曲反棱镜：敌人 ${bearer.enemyId} 持有（${keyFaceCode(state)}）。`)
    return lines
  },

  // ---- 结局链 ----
  resolution(state, key, events, api = {}) {
    const records = recordsOf(state)
    const working = records.theCellIsWorkingWithEce === true
    const refused = records.theCellRefusedEcesOffer === true
    const normalized = String(key || '')
    const finish = target => behavior.resolution(state, target, events, api)
    const award = () => ({ award: true, bonus: 0 })

    if (normalized === 'noResolution' || normalized === 'r0') {
      if (isFinalStage(state)) {
        api.info?.('🌑 未达成任何结局（场景 3）：跳到结局 6。')
        return finish('resolution6')
      }
      record(state, api, 'twistedAntiprismBearer', 'redGlovedMan')
      flagsOf(state).twistedAntiprismBearer = { type: 'none', holder: 'redGlovedMan' }
      api.info?.('🌑 未达成任何结局：戴红手套的男子拥有扭曲反棱镜。')
      markTime(state, api, 1)
      return award()
    }
    if (normalized === 'resolution1' || normalized === 'r1') {
      api.info?.(refused
        ? '📖 结局 1：特别小组拒绝了艾婕的提议 → 跳到结局 2。'
        : '📖 结局 1：特别小组与艾婕合作/欺骗艾婕 → 跳到结局 3。')
      return finish(refused ? 'resolution2' : 'resolution3')
    }
    if (normalized === 'resolution2' || normalized === 'r2') {
      const seat = chooseKeyBearer(state, api)
      record(state, api, 'twistedAntiprismBearer', `investigator:${seat}`)
      bindKey(state, api, { type: 'investigator', seat })
      api.info?.(`📖 结局 2：${state.investigators[seat]?.name || '调查员'} 保管扭曲反棱镜。`)
      markTime(state, api, 2)
      return award()
    }
    if (normalized === 'resolution3' || normalized === 'r3') {
      api.info?.(working ? '📖 结局 3：特别小组与艾婕合作 → 结局 4。' : '📖 结局 3：特别小组欺骗艾婕 → 结局 5。')
      return finish(working ? 'resolution4' : 'resolution5')
    }
    if (normalized === 'resolution4' || normalized === 'r4') {
      record(state, api, 'eceTrustsTheCell', true)
      record(state, api, 'twistedAntiprismBearer', 'eceSahin')
      flagsOf(state).twistedAntiprismBearer = { type: 'none', holder: 'eceSahin' }
      api.info?.('📖 结局 4：记录「艾婕信任特别小组」；艾婕·萨辛保管扭曲反棱镜。')
      markTime(state, api, 3)
      return award()
    }
    if (normalized === 'resolution5' || normalized === 'r5') {
      record(state, api, 'eceDoesNotTrustTheCell', true)
      const seat = chooseKeyBearer(state, api)
      record(state, api, 'twistedAntiprismBearer', `investigator:${seat}`)
      bindKey(state, api, { type: 'investigator', seat })
      api.info?.(`📖 结局 5：记录「艾婕不信任特别小组」；${state.investigators[seat]?.name || '调查员'} 保管扭曲反棱镜。`)
      markTime(state, api, 3)
      return award()
    }
    if (normalized === 'resolution6' || normalized === 'r6') {
      record(state, api, 'twistedAntiprismBearer', 'redGlovedMan')
      record(state, api, 'youHaventSeenTheLastOfTheRedGlovedMan', true)
      flagsOf(state).twistedAntiprismBearer = { type: 'none', holder: 'redGlovedMan' }
      api.info?.('📖 结局 6：戴红手套的男子拥有扭曲反棱镜。')
      markTime(state, api, 2)
      return award()
    }
    api.info?.(`📖 未知结局 ${normalized}：按无结局发放经验。`)
    return award()
  },
}

function chooseKeyBearer(state, api) {
  const alive = activeInvestigators(state)
  if (!alive.length) return leadSeat(state)
  const answer = choose(api, {
    kind: 'investigator', source: `${CODES.scenario}-keyBearer`, seat: leadSeat(state),
    prompt: '选择一位调查员保管扭曲反棱镜。',
    options: alive.map(inv => ({ id: String(inv.seat), label: inv.name })),
  })
  const seat = Number(answer)
  return Number.isInteger(seat) && state.investigators[seat] ? seat : alive[0].seat
}
