// 死亡酷暑（deadHeat · 09520）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheScarletKeys/DeadHeat.hs +
//       Scenarios/TheScarletKeys/DeadHeat/Helpers.hs（slayCivilian / becomeAbandonedAbility）+
//       Enemy|Location|Treachery|Story/Cards/TheScarletKeys/DeadHeat/*.hs +
//       Campaigns/TheScarletKeys/Key/Cards/TheLastBlossom.hs +
//       frontend/src/locales/{en,zh}/theScarletKeys/scenarios/deadHeat.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup → 时间分支（25+ 跳过本关）
//   setupLocations / locationPlaced / afterDeckSetup → 5 地点入场、平民资源、时间预杀害、15+ 预置阿玛兰斯
//   actions / performAction → 拯救平民、火车站快速移动、德吉玛广场翻牌库顶、鞣革厂生成苏生死者、奴仆快速躲避
//   locationShroudModifier / enemyStatModifier / moveError / beforeMove / turnEnded
//   enemySpawned / enemyMoved / enemyAttackStarted / enemyAttackResolved / enemyDefeated
//   encounterGainsSurge / roundEnded → 奴仆涌动、饥荒
//   events + 诡计条目 encounterResolve → 饥荒 / 围困！
//   actReveal / agendaReveal / checkObjectives → 幕/议程背面与推进
//   resolveChaosToken / applyTokenEffect → 09520 混乱标记
//   resolution → 结局 1–5 / 无结局与剧本日志记录
import { shiftWithReaction } from '../../concealed.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import {
  initializeScarletKeys, scarletKey, scarletKeys, bindKey, stealKey, shiftKey,
} from '../../../../../src/engine/tsk-scarlet-keys.js'
import { KEY_CARDS } from '../../shared.js'
import {
  civiliansSlain, deadHeatChaosToken, deadHeatChaosTokenValue, isHardSide, perPlayerCiviliansSlain,
} from './chaos.js'
import {
  ABANDONED_BY_NORMAL, ACT_CODES, AGENDA_CODES, ACTS, AGENDAS, AMARANTH_BACK_CODE,
  AMARANTH_FRONT_CODE, AFTERMATH_CODE, CARD_DATA, CIVILIAN_TRACK, CORNERED_CODE, FAMINE_CODE,
  JEMAA_EL_FNAA_ABANDONED_CODE, KEY_SPEC, KHALID_CODE, LOCATIONS, NORMAL_BY_ABANDONED, RAZIN_CODE, RISEN_SPAWN_SITE, RITUAL_SITE_ID,
  SAVE_THE_CIVILIANS_CODE, SET_ASIDE_CARDS, SITE_IDS, START_LOCATION, ABANDONED_LOCATION_IDS,
} from './definition.js'

const CHAPTER_ID = 'deadHeat'
const NO_RESOLUTION = 'noResolution'
const RESOLUTION_KEYS = ['resolution1', 'resolution2', 'resolution3', 'resolution4', 'resolution5']

const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state.numInvestigators) || (state.investigators || []).length || 1
const info = (api, text) => api?.info?.(text)
const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const flagsFor = state => (state.scenarioFlags ||= {})
const setFlag = (state, key, value = true) => {
  flagsFor(state)[key] = value
  return value
}
const clearFlag = (state, key) => { delete flagsFor(state)[key] }
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)

// 单卡条目的规则数据（flags）是唯一事实源：behavior 只按条目声明分派。
const entryOf = code => (code ? registeredEntry(String(code)) : null)
const flagsOf = code => entryOf(code)?.flags || {}
const flagIs = (code, key) => flagsOf(code)[key] === true
const isAmaranthCode = code => flagIs(code, 'amaranth')
const isRazinCode = code => flagIs(code, 'razin')
const isKhalidCode = code => flagIs(code, 'khalid')
const isThrallCode = code => flagIs(code, 'thrall')
const isAncientRaiderCode = code => flagIs(code, 'ancientRaider')
const isFamineCode = code => flagIs(code, 'famine')
const isCorneredCode = code => flagIs(code, 'cornered')
const isSaveTheCiviliansCode = code => flagIs(code, 'saveTheCivilians')
const isAftermathCode = code => flagIs(code, 'aftermath')
const isAmaranthFace = (code, face) => flagIs(code, 'amaranth') && flagsOf(code).amaranthFace === face

// ---------------------------------------------------------------------------
// 时间与热浪
// ---------------------------------------------------------------------------

export function timeOf(state) {
  const override = Number(state?.scenarioFlags?.deadHeatTime)
  if (Number.isFinite(override)) return override
  return Math.max(0, Number(state?.campaign?.records?.time) || 0)
}

export function introBranchForTime(time) {
  if (time > 24) return 'moreThan24'
  if (time >= 15) return 'between15And24'
  return 'lessThan15'
}

/** 参考 Setup：<15 用幕 1/2/3；15–24 移除幕 1、从幕 2a 开始并在议程 1 上放 N 个毁灭。 */
export function actDeckForTime(state, time = timeOf(state)) {
  void state
  return time >= 15 ? [ACT_CODES[1], ACT_CODES[2]] : [ACT_CODES[0], ACT_CODES[1], ACT_CODES[2]]
}

// ---------------------------------------------------------------------------
// 平民：地点上的资源即平民；杀害/获救计数记在剧本标记上
// ---------------------------------------------------------------------------

const baseCiviliansPerLocation = state => investigatorCount(state) + 1

export function civiliansAt(state, locationId) {
  const location = (state.locations || []).find(item => item.id === locationId)
  return Math.max(0, Number(location?.resources) || 0)
}

function inPlayLocation(state, siteId) {
  return (state.locations || []).find(location => location.id === siteId
    || location.id === ABANDONED_BY_NORMAL[siteId]) || null
}

/** 地点当前属于哪个「地点语义 id」（普通/废弃版本都映射回普通 id）。 */
export function siteOf(state, locationId) {
  if (SITE_IDS.includes(locationId)) return inPlayLocation(state, locationId) ? locationId : null
  const normal = NORMAL_BY_ABANDONED[locationId]
  if (!normal) return null
  return inPlayLocation(state, normal) ? normal : null
}

export function civiliansSlainCount(state) {
  return civiliansSlain(state)
}

export function slayCivilian(state, locationId, api = {}) {
  const location = (state.locations || []).find(item => item.id === locationId)
  if (!location || (Number(location.resources) || 0) <= 0) return false
  location.resources = Math.max(0, Number(location.resources) - 1)
  const flags = flagsFor(state)
  flags[CIVILIAN_TRACK.slainFlag] = (Number(flags[CIVILIAN_TRACK.slainFlag]) || 0) + 1
  info(api, `一名平民在「${location.name}」被杀害（累计 ${flags[CIVILIAN_TRACK.slainFlag]}）。`)
  afterCivilianLoss(state, locationId, api)
  return true
}

function afterCivilianLoss(state, locationId, api) {
  maybeAdvanceRitualAct(state, api)
  checkAbandonedLocations(state, api)
}

export function slayAllCivilians(state, api = {}) {
  let slain = 0
  for (const location of [...(state.locations || [])]) {
    const count = Math.max(0, Number(location.resources) || 0)
    if (!count) continue
    location.resources = 0
    slain += count
  }
  if (slain) {
    const flags = flagsFor(state)
    flags[CIVILIAN_TRACK.slainFlag] = (Number(flags[CIVILIAN_TRACK.slainFlag]) || 0) + slain
    info(api, `场上剩余的 ${slain} 名平民全部被杀害（累计 ${flags[CIVILIAN_TRACK.slainFlag]}）。`)
    checkAbandonedLocations(state, api)
  }
  return slain
}

export function rescueCivilian(state, seat, api = {}) {
  const inv = state.investigators?.[seat]
  if (!inv || inv.defeated || inv.resigned) return false
  const story = (state.storyAssets || []).find(asset => isSaveTheCiviliansCode(asset.originalCode || asset.code))
  if (!story) return false
  const location = (state.locations || []).find(item => item.id === inv.location)
  if (!location || (Number(location.resources) || 0) <= 0) return false
  location.resources = Number(location.resources) - 1
  const flags = flagsFor(state)
  flags[CIVILIAN_TRACK.rescuedFlag] = (Number(flags[CIVILIAN_TRACK.rescuedFlag]) || 0) + 1
  info(api, `${inv.name} 从「${location.name}」救出 1 名平民（已救 ${flags[CIVILIAN_TRACK.rescuedFlag]}）。`)
  if ((location.originalCode || location.code) === '09530') healAfterRescue(state, inv, api)
  afterCivilianLoss(state, location.id, api)
  return true
}

function healAfterRescue(state, inv, api) {
  void state
  if ((inv.damage || 0) <= 0 && (inv.horror || 0) <= 0) return
  const choice = typeof api?.choose === 'function'
    ? api.choose({
      kind: 'heal', source: '09530', seat: inv.seat,
      prompt: '巴希尔宫花园：救出平民后，治愈 1 点伤害或 1 点恐惧。',
      options: [
        ...(inv.damage > 0 ? [{ id: 'damage', label: '治愈 1 点伤害' }] : []),
        ...(inv.horror > 0 ? [{ id: 'horror', label: '治愈 1 点恐惧' }] : []),
      ],
    })
    : (inv.damage > 0 ? 'damage' : 'horror')
  if (choice === 'damage' && inv.damage > 0) inv.damage -= 1
  else if (choice === 'horror' && inv.horror > 0) inv.horror -= 1
  info(api, `巴希尔宫花园：${inv.name} 治愈了 1 点${choice === 'horror' ? '恐惧' : '伤害'}。`)
}

/** 普通地点没有平民时，与放一边的废弃版本交换（规则卡「Replacing Locations」）。 */
export function checkAbandonedLocations(state, api = {}) {
  for (const siteId of SITE_IDS) {
    const location = (state.locations || []).find(item => item.id === siteId)
    if (!location || (Number(location.resources) || 0) > 0) continue
    swapToAbandoned(state, siteId, api)
  }
}

function dropSetAsideLocation(state, abandonedId) {
  const list = state.scenarioZones?.setAsideLocations
  if (Array.isArray(list)) state.scenarioZones.setAsideLocations = list.filter(id => id !== abandonedId)
}

function swapToAbandoned(state, siteId, api = {}) {
  const abandonedId = ABANDONED_BY_NORMAL[siteId]
  if (!abandonedId) return null
  if (typeof api.swapLocation === 'function') {
    const next = api.swapLocation(siteId, abandonedId, { reveal: 'keep' })
    if (next) {
      next.resources = 0
      dropSetAsideLocation(state, abandonedId)
      syncConnections(state)
      info(api, `「${next.name}」已没有平民：与放一边的废弃版本交换。`)
      return next
    }
  }
  const index = (state.locations || []).findIndex(item => item.id === siteId)
  if (index < 0) return null
  const old = state.locations[index]
  const def = state.scenario?.locations?.[abandonedId] || LOCATIONS[abandonedId]
  const next = {
    ...structuredClone(def), id: abandonedId, revealed: old.revealed !== false,
    clues: Number(old.clues) || 0, doom: Number(old.doom) || 0, resources: 0,
    maxClues: Math.max(Number(def.maxClues) || 0, Number(old.clues) || 0),
    attachments: [...(old.attachments || [])],
  }
  state.locations[index] = next
  for (const enemy of state.enemies || []) if (enemy.location === siteId) enemy.location = abandonedId
  for (const asset of state.storyAssets || []) if (asset.location === siteId) asset.location = abandonedId
  for (const inv of state.investigators || []) if (inv.location === siteId) inv.location = abandonedId
  dropSetAsideLocation(state, abandonedId)
  syncConnections(state)
  info(api, `「${next.name}」已没有平民：与放一边的废弃版本交换。`)
  return next
}

/** 连接按「当前在场的相邻地点实例」重算（普通/废弃版本可能互换）。 */
export function syncConnections(state) {
  const currentOf = siteId => {
    const normal = (state.locations || []).find(item => item.id === siteId)
    if (normal) return normal.id
    const abandoned = (state.locations || []).find(item => item.id === ABANDONED_BY_NORMAL[siteId])
    return abandoned ? abandoned.id : null
  }
  for (const siteId of SITE_IDS) {
    const currentId = currentOf(siteId)
    if (!currentId) continue
    const location = state.locations.find(item => item.id === currentId)
    location.connections = [...new Set((LOCATIONS[siteId]?.connections || [])
      .map(currentOf).filter(Boolean))]
  }
}

// ---------------------------------------------------------------------------
// 绯红密钥（末绽之花 09544：稳定面 09544a / 动荡面 09544b）
// ---------------------------------------------------------------------------

export function ensureScarletKeys(state, api = {}) {
  try {
    if (scarletKeys(state).length > 0) return true
    initializeScarletKeys(state, KEY_CARDS.map(key => ({
      id: key.id, stableFace: key.stableCode, unstableFace: key.unstableCode,
    })))
    info(api, '初始化绯红密钥（末绽之花在放一边区域）。')
    return true
  } catch (error) {
    if (/已经初始化/.test(String(error?.message || ''))) return true
    setFlag(state, 'deadHeatKeyUnavailable', true)
    return false
  }
}

export function lastBlossom(state) {
  try { return scarletKey(state, KEY_SPEC.id) } catch { return null }
}

function keyHolderLocation(state) {
  const record = lastBlossom(state)
  if (!record) return null
  if (record.bearer.type === 'investigator') return state.investigators?.[record.bearer.seat]?.location || null
  if (record.bearer.type === 'enemy') {
    return state.enemies?.find(enemy => enemy.id === record.bearer.enemyId)?.location || null
  }
  return null
}

export function bindLastBlossom(state, bearer, api = {}) {
  ensureScarletKeys(state, api)
  try {
    const result = bearer?.type === 'enemy' ? stealKey(state, KEY_SPEC.id, bearer) : bindKey(state, KEY_SPEC.id, bearer)
    const label = bearer?.type === 'investigator'
      ? (state.investigators?.[bearer.seat]?.name || `座位 ${bearer.seat}`)
      : bearer?.type === 'enemy'
        ? (state.enemies?.find(enemy => enemy.id === bearer.enemyId)?.name || bearer.enemyId)
        : '无人'
    info(api, `末绽之花现在由「${label}」持有（${lastBlossom(state)?.stable ? '稳定面' : '动荡面'}）。`)
    return result
  } catch (error) {
    setFlag(state, 'deadHeatKeyUnavailable', true)
    return null
  }
}

function healAllEnemiesOne(state, api) {
  let healed = 0
  for (const enemy of state.enemies || []) {
    if (!(Number(enemy.damageTaken) > 0)) continue
    enemy.damageTaken = Math.max(0, Number(enemy.damageTaken) - 1)
    safeCall(api, 'healEnemy', enemy, 1)
    healed += 1
  }
  return healed
}

function healInvestigatorsAt(state, locationId, api) {
  let healed = 0
  for (const inv of activeInvestigators(state)) {
    if (inv.location !== locationId) continue
    if (inv.damage > 0) { inv.damage -= 1; healed += 1; safeCall(api, 'healDamage', inv.seat, 1) }
    if (inv.horror > 0) { inv.horror -= 1; healed += 1; safeCall(api, 'healHorror', inv.seat, 1) }
  }
  return healed
}

/**
 * Shift 末绽之花：按当前面条目的 shiftEffect 结算，然后经密钥原语翻面。
 * 近似：动荡面的「若由调查员变换则翻回稳定面」按统一翻面处理（见 primitive-requests/09544b.json）。
 */
export function shiftLastBlossom(state, api = {}, { by = 'investigator' } = {}) {
  ensureScarletKeys(state, api)
  const record = lastBlossom(state)
  if (!record) return null
  const wasStable = record.stable === true
  const faceCode = wasStable ? KEY_SPEC.stableFace : KEY_SPEC.unstableFace
  const faceFlags = flagsOf(faceCode)
  const bearerType = record.bearer?.type || 'none'
  if (faceFlags.shiftEffect === 'healInvestigatorsAtBearerLocation') {
    if (bearerType === 'investigator') {
      const healed = healInvestigatorsAt(state, keyHolderLocation(state), api)
      info(api, `末绽之花（稳定面）：治愈了 ${healed} 点伤害/恐惧。`)
    } else {
      info(api, '末绽之花（稳定面）：持有者不是调查员，没有可治愈的调查员。')
    }
  } else if (faceFlags.shiftEffect === 'healAllEnemies') {
    const healed = healAllEnemiesOne(state, api)
    info(api, `末绽之花（动荡面）：场上 ${healed} 个敌人各治愈 1 点伤害。`)
  } else {
    info(api, `末绽之花：未登记的面效果「${faceFlags.shiftEffect || '无'}」。`)
  }
  try {
    const shifted = shiftWithReaction(state, api, KEY_SPEC.id, by === 'enemy' ? { force: true } : {})
    info(api, `末绽之花变换：${wasStable ? '稳定面 → 动荡面' : '动荡面 → 稳定面'}${by === 'enemy' ? '（敌人强制变换）' : ''}。`)
    razinReactsToKeyShift(state, api)
    return shifted
  } catch (error) {
    if (/本轮已经变换过/.test(String(error?.message || ''))) {
      info(api, '末绽之花本轮已经变换过。')
      return null
    }
    throw error
  }
}

/** 拉辛·法瑞：「任意密钥变换后」若横置则重整，否则立即攻击交战调查员。 */
export function razinReactsToKeyShift(state, api = {}) {
  const razin = (state.enemies || []).find(enemy => isRazinCode(enemy.originalCode || enemy.code))
  if (!razin) return false
  if (razin.exhausted) {
    razin.exhausted = false
    safeCall(api, 'readyEnemy', razin)
    info(api, '密钥变换后：拉辛·法瑞重整。')
    return true
  }
  const seat = razin.engagedSeat
  if (Number.isInteger(seat) && state.investigators?.[seat]) {
    if (typeof api?.attack === 'function') api.attack(razin, state.investigators[seat])
    info(api, `密钥变换后：拉辛·法瑞立即攻击 ${state.investigators[seat].name}。`)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 生成 / 翻面
// ---------------------------------------------------------------------------

function nextEnemySerial(state) {
  const flags = flagsFor(state)
  flags.deadHeatEnemySeq = (Number(flags.deadHeatEnemySeq) || 0) + 1
  return flags.deadHeatEnemySeq
}

function removeFromSetAside(state, code) {
  const list = state.scenarioZones?.setAside
  if (!Array.isArray(list)) return false
  const index = list.indexOf(String(code))
  if (index < 0) return false
  list.splice(index, 1)
  return true
}

const enemyDefinition = (state, code) => state.scenario?.enemies?.[code] || ALL_CARDS[code] || {}

function enemyHealthFor(state, def) {
  return def.healthPerInvestigator ? Number(def.health) * investigatorCount(state) : (def.health ?? 1)
}

/** 生成剧本敌人：优先引擎 api.spawn；直调路径本地建实例。 */
export function spawnDeadHeatEnemy(state, code, locationId, api = {}, options = {}) {
  const existing = options.unique
    ? (state.enemies || []).find(enemy => String(enemy.originalCode || enemy.code) === String(code))
    : null
  if (existing) return existing
  if (typeof api.spawn === 'function') {
    const spawned = api.spawn(code, locationId, options)
    if (spawned) return spawned
  }
  if (typeof api.spawnEngaged === 'function' && options.engagedSeat != null) {
    const spawned = api.spawnEngaged(code, locationId, options.engagedSeat)
    if (spawned) return spawned
  }
  const def = enemyDefinition(state, code)
  const enemy = {
    id: `deadheat-${code}-${nextEnemySerial(state)}`, code, originalCode: code,
    name: def.nameZh || def.name || code, location: locationId,
    fight: def.fight ?? 0, evade: def.evade ?? 0, health: enemyHealthFor(state, def),
    damage: def.damage || 0, horror: def.horror || 0, traits: [...(def.traits || [])],
    exhausted: options.exhausted === true, engagedSeat: options.engagedSeat ?? null,
    damageTaken: 0, doom: 0, clues: 0, attachments: [], victory: Number(def.victory) || 0,
    ...(def.elite ? { elite: true } : {}),
    ...(def.hunter ? { hunter: true } : {}),
    ...(def.retaliate ? { retaliate: true } : {}),
    ...(def.alert ? { alert: true } : {}),
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  info(api, `「${enemy.name}」在「${state.locations?.find(loc => loc.id === locationId)?.name || locationId}」生成。`)
  return enemy
}

export function amaranthInPlay(state) {
  return (state.enemies || []).find(enemy => isAmaranthCode(enemy.originalCode || enemy.code)) || null
}

export function spawnAmaranth(state, api = {}) {
  const existing = amaranthInPlay(state)
  if (existing) return existing
  removeFromSetAside(state, AMARANTH_FRONT_CODE)
  const enemy = spawnDeadHeatEnemy(state, AMARANTH_FRONT_CODE, RITUAL_SITE_ID, api, { unique: true })
  if (!enemy) return null
  bindLastBlossom(state, { type: 'enemy', enemyId: enemy.id }, api)
  info(api, '阿玛兰斯（腐败潜伏）在巴希尔宫花园生成，末绽之花附属在她身上。')
  return enemy
}

/** 翻到腐败显露面：保留伤害/附属/线索等全部标记。 */
export function flipAmaranth(state, api = {}) {
  const enemy = (state.enemies || []).find(item => isAmaranthFace(item.originalCode || item.code, 'lurkingCorruption'))
  if (!enemy) return null
  const def = enemyDefinition(state, AMARANTH_BACK_CODE)
  enemy.code = AMARANTH_BACK_CODE
  enemy.originalCode = AMARANTH_BACK_CODE
  enemy.health = enemyHealthFor(state, def)
  enemy.fight = def.fight ?? enemy.fight
  enemy.evade = def.evade ?? enemy.evade
  enemy.damage = def.damage ?? enemy.damage
  enemy.horror = def.horror ?? enemy.horror
  enemy.retaliate = true
  info(api, '阿玛兰斯翻到「腐败显露」面（保留其上所有标记与附属）。')
  return enemy
}

function randomLocationWithoutInvestigators(state, api, exclude = []) {
  const active = activeInvestigators(state)
  const candidates = (state.locations || []).filter(location =>
    !active.some(inv => inv.location === location.id) && !exclude.includes(location.id))
  if (!candidates.length) return null
  if (typeof api.randomLocationIds === 'function') {
    const picked = api.randomLocationIds(1)
    const id = Array.isArray(picked) ? picked[0] : picked
    if (id && candidates.some(location => location.id === id)) return id
  }
  return candidates[0].id
}

export function putSaveTheCiviliansInPlay(state, api = {}) {
  state.storyAssets ||= []
  const existing = state.storyAssets.find(asset => isSaveTheCiviliansCode(asset.originalCode || asset.code))
  if (existing) return existing
  if (typeof api.storyAsset === 'function') {
    const spawned = api.storyAsset(SAVE_THE_CIVILIANS_CODE, null)
    if (spawned) return spawned
  }
  const card = ALL_CARDS[SAVE_THE_CIVILIANS_CODE] || {}
  const asset = {
    id: 'deadheat-save-the-civilians', code: SAVE_THE_CIVILIANS_CODE, originalCode: SAVE_THE_CIVILIANS_CODE,
    name: card.nameZh || card.name || SAVE_THE_CIVILIANS_CODE, global: true, location: null,
    controllerSeat: null, exhausted: false, tokens: 0,
  }
  state.storyAssets.push(asset)
  info(api, '剧情卡「拯救平民」放置入场（放在议程牌库旁）。')
  return asset
}

export function aftermathInPlay(state) {
  return (state.storyAssets || []).find(asset => isAftermathCode(asset.originalCode || asset.code)) || null
}

/** 游戏结束时把「拯救平民」翻到「后果」面（保留上面的标记）。 */
export function flipSaveTheCivilians(state, api = {}) {
  const asset = (state.storyAssets || []).find(item => isSaveTheCiviliansCode(item.originalCode || item.code))
  if (!asset) return aftermathInPlay(state)
  if (typeof api.flipAsset === 'function') {
    try {
      api.flipAsset(asset, AFTERMATH_CODE)
      if (String(asset.originalCode || asset.code) === AFTERMATH_CODE) return asset
    } catch {
      // 剧情卡没有实体配对时退回本地口径。
    }
  }
  const card = ALL_CARDS[AFTERMATH_CODE] || {}
  asset.code = AFTERMATH_CODE
  asset.originalCode = AFTERMATH_CODE
  asset.name = card.nameZh || card.name || AFTERMATH_CODE
  info(api, '「拯救平民」翻到「后果」面：比较获救与被杀害的平民数量。')
  return asset
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------

export function prepareScenario(state, api = {}) {
  state.scenarioFlags ||= {}
  state.scenarioZones ||= {}
  const time = timeOf(state)
  const flags = flagsFor(state)
  flags.deadHeatTime = time
  flags.deadHeatIntro = introBranchForTime(time)
  flags.deadHeatSkip = time > 24
  flags[CIVILIAN_TRACK.rescuedFlag] = Number(flags[CIVILIAN_TRACK.rescuedFlag]) || 0
  flags[CIVILIAN_TRACK.slainFlag] = Number(flags[CIVILIAN_TRACK.slainFlag]) || 0
  ensureScarletKeys(state, api)

  const agendaSource = state.scenario?.agendas || AGENDAS
  state.agendas = [AGENDA_CODES[0], AGENDA_CODES[1]]
    .map(code => agendaSource.find(agenda => (agenda.originalCode || agenda.code) === code))
    .filter(Boolean).map(agenda => structuredClone(agenda))
  const actSource = state.scenario?.acts || ACTS
  state.acts = actDeckForTime(state, time)
    .map(code => actSource.find(act => (act.originalCode || act.code) === code))
    .filter(Boolean).map(act => structuredClone(act))
  state.agendaIndex = 0
  state.actIndex = 0
  if (time >= 15) {
    const doom = investigatorCount(state)
    state.doom = (Number(state.doom) || 0) + doom
    info(api, `时间 ${time}：移除幕 1，从幕 2a 开始；议程 1 上放置 ${doom} 个毁灭。`)
  }
  state.scenarioZones.setAside = [...SET_ASIDE_CARDS]
  state.scenarioZones.setAsideLocations = [...ABANDONED_LOCATION_IDS]
  flags.deadHeatPrepared = true
  return { time, actCodes: actDeckForTime(state, time), agendaCodes: [...AGENDA_CODES], skip: time > 24 }
}

function placeSite(state, siteId) {
  if ((state.locations || []).some(location => location.id === siteId)) {
    return state.locations.find(location => location.id === siteId)
  }
  const def = state.scenario?.locations?.[siteId] || LOCATIONS[siteId]
  if (!def) return null
  const clues = def.cluesFixed ?? (def.cluesPerInvestigator != null ? def.cluesPerInvestigator * investigatorCount(state) : 0)
  const location = {
    ...structuredClone(def), id: siteId, revealed: true,
    clues, maxClues: clues, doom: 0, resources: 0, damage: 0, horror: 0,
  }
  state.locations ||= []
  state.locations.push(location)
  syncConnections(state)
  return location
}

function placeAllSites(state, api, time) {
  const placed = []
  for (const siteId of SITE_IDS) {
    const location = placeSite(state, siteId)
    if (!location) continue
    location.resources = baseCiviliansPerLocation(state)
    placed.push(siteId)
  }
  syncConnections(state)
  info(api, `五处马拉喀什地点入场，每处 ${baseCiviliansPerLocation(state)} 名平民。`)
  if (time >= 11) applyPreSlainCivilians(state, api, time)
  return placed
}

/** 时间 11–17：1[per_investigator]；18–24：2[per_investigator]（尽可能均匀地分布）。 */
export function applyPreSlainCivilians(state, api = {}, time = timeOf(state)) {
  const perPlayer = time >= 18 ? 2 : time >= 11 ? 1 : 0
  const total = perPlayer * investigatorCount(state)
  if (!total) return 0
  const sites = SITE_IDS.filter(siteId => (state.locations || []).some(location => location.id === siteId))
  if (!sites.length) return 0
  let slain = 0
  for (let index = 0; index < total; index++) {
    if (slayCivilian(state, sites[index % sites.length], api)) slain += 1
  }
  info(api, `时间 ${time}：${slain} 名平民在冒险开始前已被杀害。`)
  return slain
}

function shuffleIntoEncounter(state, codes, api) {
  const list = codes.filter(Boolean)
  if (!list.length) return
  if (typeof api.shuffleIntoEncounterDeck === 'function') {
    api.shuffleIntoEncounterDeck(list)
    return
  }
  state.encounterDeck ||= []
  state.encounterDeck.push(...list)
}

export function applyTimeSetup(state, api = {}) {
  const flags = flagsFor(state)
  if (flags.deadHeatTimeSetupApplied) return false
  flags.deadHeatTimeSetupApplied = true
  const time = timeOf(state)
  if (time > 24) return false
  if (time >= 15) {
    spawnAmaranth(state, api)
    putSaveTheCiviliansInPlay(state, api)
    removeFromSetAside(state, KHALID_CODE)
    shuffleIntoEncounter(state, [KHALID_CODE], api)
    info(api, `时间 ${time}：阿玛兰斯与末绽之花已在场；哈立德洗入遭遇牌库。`)
  }
  return true
}

/** 引擎真实入口：setup.js#setupLocations。 */
export function setupLocations(state, events, helper = {}) {
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  const report = prepareScenario(state, api)
  if (report.skip) {
    info(api, '时间已超过 24：跳过本关，直接结算结局 5。')
    return [START_LOCATION]
  }
  return [...SITE_IDS]
}

/** 引擎真实入口：地点入场（补平民、同步连接）。 */
export function locationPlaced(state, location, api = {}) {
  const id = location?.id
  if (!SITE_IDS.includes(id)) return
  if ((Number(location.resources) || 0) === 0 && (Number(state.round) || 1) === 1
    && flagsFor(state).deadHeatPrepared) {
    location.resources = baseCiviliansPerLocation(state)
  }
  syncConnections(state)
  void api
}

/** 引擎真实入口：遭遇牌库建立之后（时间预杀害 / 15+ 的预置）。 */
export function afterDeckSetup(state, events, helper = {}) {
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  const flags = flagsFor(state)
  if (flags.deadHeatSkip) {
    if (typeof api.finish === 'function') api.finish('resolution5')
    else state.resolution = 'resolution5'
    return
  }
  if (!flags.deadHeatPreSlainApplied) {
    flags.deadHeatPreSlainApplied = true
    applyPreSlainCivilians(state, api, timeOf(state))
  }
  applyTimeSetup(state, api)
}

/** 直调/单测入口：准备 + 五地点入场 + 时间预杀害 + 15+ 预置。 */
export function setupScenario(state, api = {}) {
  const report = prepareScenario(state, api)
  state.locations = []
  const placedIds = report.skip ? [START_LOCATION] : placeAllSites(state, api, report.time)
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = START_LOCATION
  if (!state.encounterDeck?.length && !report.skip) {
    state.encounterDeck = [...(state.scenario?.encounterDeck || [])]
  }
  if (!report.skip) applyTimeSetup(state, api)
  syncConnections(state)
  info(api, `死亡酷暑（时间 ${report.time}）：${placedIds.length} 处地点入场，${civiliansSlain(state)} 名平民已被杀害。`)
  return { ...report, placedIds }
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------

function stationedHere(inv) {
  return inv?.location === 'marrakeshRailwayStation' || inv?.location === 'marrakeshRailwayStationAbandoned'
}

function storyAssetInPlay(state) {
  return (state.storyAssets || []).some(asset => isSaveTheCiviliansCode(asset.originalCode || asset.code))
}

function jemaaUsed(state) {
  return flagsFor(state).deadHeatJemaaUsed === true
}

function groupMoveUsed(state) {
  return Number(flagsFor(state).deadHeatStationMoveRound) === Number(state.round)
}

function thrallEvadedThisTurn(state, inv, enemyId) {
  const ledger = flagsFor(state).deadHeatThrallEvades || {}
  const round = ledger[state.round] || {}
  return (round[inv.seat] || []).includes(enemyId)
}

function markThrallEvaded(state, inv, enemyId) {
  const flags = flagsFor(state)
  flags.deadHeatThrallEvades ||= {}
  const round = flags.deadHeatThrallEvades[state.round] ||= {}
  const list = round[inv.seat] ||= []
  if (!list.includes(enemyId)) list.push(enemyId)
}

export function actions(state, inv) {
  if (!inv || state.status !== 'playing') return []
  const moves = []
  const location = (state.locations || []).find(item => item.id === inv.location)
  const site = location ? siteOf(state, location.id) : null

  if (storyAssetInPlay(state) && site) {
    const civilians = civiliansAt(state, location.id)
    if (civilians > 0 && (inv.clues || 0) >= 1) {
      moves.push({ action: 'scenarioAction', rule: 'deadHeatRescueCivilian', actions: 1,
        label: `花费 1 线索：从「${location.name}」救出 1 名平民（剩余 ${civilians}）` })
    } else if (civilians > 0) {
      moves.push({ action: 'scenarioAction', rule: 'deadHeatRescueCivilian', actions: 1,
        reason: '拯救平民需要 1 个线索' })
    }
  }

  if (inv.location === 'marrakeshRailwayStation' && location?.revealed) {
    if (groupMoveUsed(state)) {
      moves.push({ action: 'scenarioAction', rule: 'deadHeatStationMove', actions: 0,
        reason: '本回合团队已经使用过火车站的快速移动' })
    } else {
      for (const destination of location.connections || []) {
        const target = state.locations.find(item => item.id === destination)
        if (!target) continue
        moves.push({ action: 'scenarioAction', rule: 'deadHeatStationMove', destination, actions: 0,
          label: `快速移动：马拉喀什火车站 →「${target.name}」（团队每回合一次）` })
      }
    }
  }

  if (inv.location === 'jemaaElFnaaSquare' && location?.revealed && civiliansAt(state, inv.location) > 0) {
    moves.push(jemaaUsed(state)
      ? { action: 'scenarioAction', rule: 'deadHeatJemaaSearch', actions: 1, reason: '本场游戏已经使用过德吉玛广场的能力' }
      : { action: 'scenarioAction', rule: 'deadHeatJemaaSearch', actions: 1,
        label: '查看牌库顶 6 张：可打出其中 1 张支援（每场游戏一次）' })
  }

  if (inv.location === RISEN_SPAWN_SITE && location?.revealed) {
    const risen = (state.encounterDiscard || []).filter(code => {
      const def = ALL_CARDS[code]
      return def?.type === 'enemy' && (def.traits || []).some(trait => String(trait).toLowerCase() === 'risen')
    })
    if (risen.length) {
      for (const code of [...new Set(risen)]) {
        moves.push({ action: 'scenarioAction', rule: 'deadHeatTanneriesSpawn', code, actions: 0,
          label: `生成遭遇弃牌堆的[[苏生]]敌人「${ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code}」，按生命值在鞣革厂放线索` })
      }
    } else {
      moves.push({ action: 'scenarioAction', rule: 'deadHeatTanneriesSpawn', actions: 0,
        reason: '遭遇弃牌堆没有[[苏生]]敌人' })
    }
  }

  for (const enemy of state.enemies || []) {
    if (!isThrallCode(enemy.originalCode || enemy.code)) continue
    if (enemy.location !== inv.location || enemy.defeated) continue
    if (thrallEvadedThisTurn(state, inv, enemy.id)) continue
    moves.push({ action: 'scenarioAction', rule: `deadHeatThrallEvade:${enemy.id}`, actions: 0,
      label: '快速躲避「奴仆」（本次躲避它获得警戒；每回合一次）' })
  }
  return moves
}

function jemaaSearch(state, inv, api) {
  const deck = inv.deck || []
  const top = deck.slice(Math.max(0, deck.length - 6)).reverse()
  if (!top.length) return 0
  const assets = top.filter(code => ALL_CARDS[code]?.type === 'asset')
  if (!assets.length) {
    info(api, `${inv.name} 查看牌库顶 ${top.length} 张：其中没有支援。`)
    return 0
  }
  const choice = typeof api?.choose === 'function'
    ? api.choose({
      kind: 'card', source: '09527', seat: inv.seat, canSkip: true,
      prompt: '德吉玛广场：可以打出其中 1 张支援（支付其费用）。',
      options: [
        { id: 'skip', label: '不打出' },
        ...assets.map(code => ({ id: code, cardCode: code, label: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code })),
      ],
    })
    : 'skip'
  if (!choice || choice === 'skip' || !assets.includes(choice)) {
    info(api, '德吉玛广场：不打出其中的支援。')
    return 0
  }
  const cost = Number(ALL_CARDS[choice]?.cost) || 0
  if (cost > (inv.resources || 0)) {
    info(api, '德吉玛广场：资源不足，不能打出这张支援。')
    return 0
  }
  const index = inv.deck.lastIndexOf(choice)
  if (index >= 0) inv.deck.splice(index, 1)
  if (typeof api?.playAsset === 'function') api.playAsset(inv.seat, choice)
  else {
    inv.hand.push(choice)
    info(api, `德吉玛广场：把「${ALL_CARDS[choice]?.nameZh || choice}」加入手牌（直调路径）。`)
  }
  return 1
}

function tanneriesSpawn(state, inv, code, api) {
  const location = (state.locations || []).find(item => item.id === inv.location)
  if (!location) return false
  const index = (state.encounterDiscard || []).lastIndexOf(code)
  if (index < 0) return false
  state.encounterDiscard.splice(index, 1)
  const health = Number(ALL_CARDS[code]?.health) || 0
  const enemy = spawnDeadHeatEnemy(state, code, inv.location, api, { engagedSeat: inv.seat })
  if (!enemy) return false
  location.clues = (Number(location.clues) || 0) + health
  location.maxClues = Math.max(Number(location.maxClues) || 0, location.clues)
  info(api, `鞣革厂生成「${enemy.name}」：放置 ${health} 个线索。`)
  return true
}

function thrallEvade(state, inv, enemyId, api) {
  const enemy = (state.enemies || []).find(item => item.id === enemyId)
  if (!enemy || enemy.location !== inv.location) return false
  markThrallEvaded(state, inv, enemyId)
  if (typeof api?.test !== 'function') {
    if (typeof api?.evadeEnemy === 'function') return api.evadeEnemy(enemy)
    enemy.exhausted = true
    if (enemy.engagedSeat === inv.seat) enemy.engagedSeat = null
    return true
  }
  api.test(inv.seat, 'agility', Number(enemy.evade) || 0, result => {
    if (result.success) {
      if (typeof api.evadeEnemy === 'function') api.evadeEnemy(enemy)
      else { enemy.exhausted = true; enemy.engagedSeat = null }
      info(api, `${inv.name} 躲开了「奴仆」。`)
    } else {
      info(api, '躲避失败：「奴仆」获得警戒并攻击你。')
      if (typeof api.attack === 'function') api.attack(enemy, inv)
      else safeCall(api, 'damage', inv.seat, enemy.damage || 1)
    }
  }, 0, { label: '奴仆：快速躲避' })
  return true
}

export function performAction(state, inv, move, api = {}) {
  if (!move) return false
  if (move.rule === 'deadHeatRescueCivilian') {
    if (!storyAssetInPlay(state) || (inv.clues || 0) < 1) return false
    if (civiliansAt(state, inv.location) <= 0) return false
    if (typeof api.spendClues === 'function') api.spendClues(inv.seat, 1)
    else inv.clues = Math.max(0, (inv.clues || 0) - 1)
    return rescueCivilian(state, inv.seat, api)
  }
  if (move.rule === 'deadHeatStationMove') {
    if (!stationedHere(inv) || groupMoveUsed(state)) return false
    setFlag(state, 'deadHeatStationMoveRound', Number(state.round))
    if (typeof api.moveInvestigator === 'function') api.moveInvestigator(inv.seat, move.destination)
    else inv.location = move.destination
    info(api, `${inv.name} 借助马拉喀什火车站快速移动（团队本回合一次）。`)
    return true
  }
  if (move.rule === 'deadHeatJemaaSearch') {
    if (inv.location !== 'jemaaElFnaaSquare' || jemaaUsed(state)) return false
    setFlag(state, 'deadHeatJemaaUsed', true)
    jemaaSearch(state, inv, api)
    return true
  }
  if (move.rule === 'deadHeatTanneriesSpawn') {
    if (inv.location !== RISEN_SPAWN_SITE) return false
    return tanneriesSpawn(state, inv, move.code, api)
  }
  if (typeof move.rule === 'string' && move.rule.startsWith('deadHeatThrallEvade:')) {
    return thrallEvade(state, inv, move.rule.slice('deadHeatThrallEvade:'.length), api)
  }
  return false
}

// ---------------------------------------------------------------------------
// 地点 / 敌人常驻规则
// ---------------------------------------------------------------------------

export function locationShroudModifier(state, location) {
  if (!location) return 0
  if ((location.originalCode || location.code) === '09528') return civiliansAt(state, location.id)
  return 0
}

export function enemyStatModifier(state, enemy, stat) {
  void state
  if (!enemy || enemy.location !== 'tanneriesAbandoned') return 0
  if (!hasTrait(enemy, 'Risen')) return 0
  return stat === 'fight' || stat === 'evade' ? 1 : 0
}

export function moveError(state, inv, location, id) {
  void state
  void location
  if (inv?.location !== 'marrakeshRailwayStationAbandoned') return null
  if (id === 'marrakeshRailwayStationAbandoned') return null
  if ((inv.resources || 0) < 1) return '离开废弃的马拉喀什火车站需要支付 1 资源'
  return null
}

export function beforeMove(state, inv, destination, api = {}, options = {}) {
  void state
  if (inv?.location !== 'marrakeshRailwayStationAbandoned') return true
  if (destination?.id === 'marrakeshRailwayStationAbandoned') return true
  if (options?.reason === 'effect') return true
  if ((inv.resources || 0) < 1) return false
  inv.resources -= 1
  info(api, `${inv.name} 离开废弃的马拉喀什火车站，支付 1 资源。`)
  return true
}

export function enemySpawned(state, enemy, api = {}) {
  if (!enemy) return
  // 2026-11-13 P1-11：议程 2 正面（09522）让每个 [[复生者]]/[[食尸鬼]] 敌人获得猎手。
  // 引擎读点 turn.js#enemyHasHunter 先看实例的 enemy.hunter，再退回当前幕的 actRule。
  if (currentAgendaFrontCode(state) === AGENDA_CODES[1]
    && isRisenOrGhoulCode(String(enemy.originalCode || enemy.code || ''))) {
    enemy.hunter = true
  }
  if (isKhalidCode(enemy.originalCode || enemy.code)) khalidEnteredPlay(state, enemy, api)
  applySaadiansEntry(state, enemy, api)
}

export function enemyMoved(state, enemy, previous, api = {}) {
  if (!enemy || enemy.location === previous) return
  applySaadiansEntry(state, enemy, api)
}

function applySaadiansEntry(state, enemy, api) {
  if (!enemy || enemy.elite) return
  const locationId = enemy.location
  if (!locationId) return
  const cardCode = String((state.locations || []).find(location => location.id === locationId)?.originalCode
    || (state.locations || []).find(location => location.id === locationId)?.code || '')
  if (cardCode === '09528') {
    enemy.exhausted = true
    safeCall(api, 'exhaustEnemy', enemy)
    info(api, `萨阿德王陵：非[[精英]]敌人「${enemy.name}」入场后横置。`)
  } else if (cardCode === '09533') {
    const healed = Number(enemy.damageTaken) || 0
    if (healed > 0) {
      enemy.damageTaken = 0
      safeCall(api, 'healEnemy', enemy, healed)
      info(api, `萨阿德王陵（废弃）：「${enemy.name}」治愈全部 ${healed} 点伤害。`)
    }
  }
}

/** 哈立德入场：把其地点的其他非[[精英]]敌人与平民尽可能均匀地移到相邻地点。 */
export function khalidEnteredPlay(state, khalid, api = {}) {
  const here = (state.locations || []).find(location => location.id === khalid.location)
  if (!here) return 0
  const neighbors = (here.connections || []).filter(id => (state.locations || []).some(location => location.id === id))
  if (!neighbors.length) return 0
  const roll = index => neighbors[index % neighbors.length]
  let moved = 0
  for (const enemy of [...(state.enemies || [])]) {
    if (enemy === khalid || enemy.elite || enemy.location !== here.id) continue
    const destination = roll(moved)
    if (typeof api.moveEnemy === 'function') api.moveEnemy(enemy, destination)
    else enemy.location = destination
    moved += 1
  }
  let civilians = Math.max(0, Number(here.resources) || 0)
  if (civilians > 0) here.resources = 0
  let index = 0
  while (civilians > 0) {
    const target = (state.locations || []).find(location => location.id === roll(moved + index))
    if (target) target.resources = (Number(target.resources) || 0) + 1
    civilians -= 1
    index += 1
    moved += 1
  }
  info(api, `哈立德入场：把 ${moved} 个敌人/平民尽可能均匀地移到相邻地点。`)
  return moved
}

export function turnEnded(state, inv, api = {}) {
  void state
  if (inv?.location !== 'bahiaPalaceGardensAbandoned' || inv.defeated || inv.resigned) return false
  const choice = typeof api?.choose === 'function'
    ? api.choose({
      kind: 'harm', source: '09535', seat: inv.seat,
      prompt: '巴希尔宫花园（废弃）：承受 1 点伤害或 1 点恐惧。',
      options: [{ id: 'damage', label: '承受 1 点伤害' }, { id: 'horror', label: '承受 1 点恐惧' }],
    })
    : 'damage'
  if (choice === 'horror') {
    if (typeof api.horror === 'function') api.horror(inv.seat, 1)
    else inv.horror = (inv.horror || 0) + 1
  } else if (typeof api.damage === 'function') api.damage(inv.seat, 1)
  else inv.damage = (inv.damage || 0) + 1
  info(api, `巴希尔宫花园（废弃）：${inv.name} 回合结束时承受 1 点${choice === 'horror' ? '恐惧' : '伤害'}。`)
  return true
}

// ---------------------------------------------------------------------------
// 阿玛兰斯 / 古代劫掠者的攻击
// ---------------------------------------------------------------------------

function amaranthAttackSnapshot(state, inv) {
  setFlag(state, 'deadHeatAttackSnapshot', {
    seat: inv.seat,
    assets: (inv.assets || []).map(asset => ({ id: asset.id, damage: asset.damage || 0, horror: asset.horror || 0 })),
  })
}

function damagedAssetsSinceSnapshot(state, inv) {
  const snapshot = flagsFor(state).deadHeatAttackSnapshot
  if (!snapshot || snapshot.seat !== inv.seat) return []
  const damaged = []
  for (const entry of snapshot.assets) {
    const asset = (inv.assets || []).find(item => item.id === entry.id)
    if (!asset) { damaged.push({ id: entry.id, missing: true }); continue }
    if ((asset.damage || 0) > entry.damage || (asset.horror || 0) > entry.horror) damaged.push({ id: asset.id })
  }
  return damaged
}

function defeatAsset(inv, entry, api) {
  if (entry.missing) return false
  if (typeof api.discardAsset === 'function') {
    api.discardAsset(inv.seat, entry.id)
    if (!(inv.assets || []).some(asset => asset.id === entry.id)) return true
  }
  const asset = (inv.assets || []).find(item => item.id === entry.id)
  if (!asset) return false
  inv.assets.splice(inv.assets.indexOf(asset), 1)
  inv.discard.push(asset.code)
  info(api, `阿玛兰斯：击败支援「${ALL_CARDS[asset.code]?.nameZh || asset.code}」。`)
  return true
}

export function enemyAttackStarted(state, enemy, inv, api = {}) {
  const code = String(enemy?.originalCode || enemy?.code || '')
  if (!isAmaranthCode(code)) return
  amaranthAttackSnapshot(state, inv)
  if (isAmaranthFace(code, 'corruptionRevealed')) shiftLastBlossom(state, api, { by: 'enemy' })
}

export function enemyAttackResolved(state, enemy, inv, api = {}) {
  const code = String(enemy?.originalCode || enemy?.code || '')
  if (isAmaranthCode(code)) {
    const damaged = damagedAssetsSinceSnapshot(state, inv)
    clearFlag(state, 'deadHeatAttackSnapshot')
    for (const entry of damaged) defeatAsset(inv, entry, api)
    if (isAmaranthFace(code, 'lurkingCorruption') && damaged.length) {
      shiftLastBlossom(state, api, { by: 'enemy' })
    }
    if (damaged.length) info(api, `阿玛兰斯：本次攻击击败了 ${damaged.length} 个支援。`)
    return
  }
  if (isAncientRaiderCode(code)) {
    const location = (state.locations || []).find(item => item.id === inv.location)
    if (location && (Number(location.resources) || 0) > 0) slayCivilian(state, inv.location, api)
  }
}

// ---------------------------------------------------------------------------
// 遭遇卡（饥荒 / 围困！）与每轮第一张奴仆
// ---------------------------------------------------------------------------

export function encounterGainsSurge(state, code) {
  if (!isThrallCode(code)) return false
  const flags = flagsFor(state)
  if (Number(flags.deadHeatThrallSurgeRound) === Number(state.round)) return false
  flags.deadHeatThrallSurgeRound = Number(state.round)
  return true
}

function putFamineNextToAgenda(state, api) {
  state.agendaAside ||= []
  const existing = state.agendaAside.filter(card => (card.originalCode || card.code) === FAMINE_CODE).length
  let card = null
  if (typeof api.putNextToAgenda === 'function') card = api.putNextToAgenda(FAMINE_CODE)
  if (!card) {
    card = {
      id: `deadheat-famine-${existing + 1}`, code: FAMINE_CODE, originalCode: FAMINE_CODE,
      name: ALL_CARDS[FAMINE_CODE]?.nameZh || ALL_CARDS[FAMINE_CODE]?.name || FAMINE_CODE,
    }
    state.agendaAside.push(card)
  }
  for (const location of state.locations || []) {
    location.playCostIncrease = (Number(location.playCostIncrease) || 0) + 1
  }
  info(api, '饥荒放在议程牌库旁：打出每张卡牌的费用 +1（轮末弃掉）。')
  return card
}

function removeFamineCost(state, api) {
  const famines = (state.agendaAside || []).filter(card => (card.originalCode || card.code) === FAMINE_CODE)
  if (!famines.length) return 0
  for (const location of state.locations || []) {
    location.playCostIncrease = Math.max(0, (Number(location.playCostIncrease) || 0) - famines.length)
    if (!location.playCostIncrease) delete location.playCostIncrease
  }
  for (const card of famines) {
    const index = state.agendaAside.indexOf(card)
    if (index >= 0) state.agendaAside.splice(index, 1)
    state.encounterDiscard ||= []
    state.encounterDiscard.push(FAMINE_CODE)
  }
  info(api, `饥荒离开场上：卡牌费用恢复（${famines.length} 张）。`)
  return famines.length
}

export function roundEnded(state, api = {}) {
  removeFamineCost(state, api)
}

function resolveCornered(state, inv, api) {
  const seat = inv.seat
  if (typeof api.test !== 'function') {
    slayCivilian(state, inv.location, api)
    return true
  }
  api.test(seat, 'combat', 3, result => {
    if (result.success) {
      info(api, `${inv.name} 挣脱了围困。`)
      return
    }
    const failedBy = Math.max(0, (Number(result.difficulty) || 3) - (Number(result.value) || 0))
    const choice = typeof api.choose === 'function'
      ? api.choose({
        kind: 'treachery', source: CORNERED_CODE, seat,
        prompt: `围困！：失败 ${failedBy} 点。选择一项：`,
        options: [
          { id: 'slain', label: '你所在地点 1 名平民被杀害' },
          { id: 'damage', label: `承受 ${failedBy} 点伤害` },
        ],
      })
      : 'slain'
    if (choice === 'damage') {
      if (typeof api.damage === 'function') api.damage(seat, failedBy)
      else inv.damage = (inv.damage || 0) + failedBy
    } else {
      slayCivilian(state, inv.location, api)
    }
  }, 0, { label: '围困！' })
  return true
}

export function resolveEncounterCard(state, inv, code, api = {}) {
  if (isFamineCode(code)) return famineEvent(state, api)
  if (isCorneredCode(code)) { resolveCornered(state, inv, api); return false }
  return false
}

export function famineEvent(state, api = {}) {
  putFamineNextToAgenda(state, api)
  return true
}

export function corneredEvent(state, payload = {}, api = {}) {
  const inv = state.investigators?.[payload.seat]
  if (!inv) return false
  resolveCornered(state, inv, api)
  // 返回 false：诡计结算完成后由引擎放进遭遇弃牌堆。
  return false
}

export const events = Object.freeze({
  deadHeatFamine: famineEvent,
  deadHeatCornered: corneredEvent,
})

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------

function currentActCode(state) {
  const act = state.acts?.[state.actIndex ?? 0]
  return String(act?.originalCode || act?.code || '')
}

function ritualActActive(state) {
  return currentActCode(state) === ACT_CODES[1]
}

function maybeAdvanceRitualAct(state, api) {
  if (!ritualActActive(state)) return false
  const required = 4 * investigatorCount(state)
  if (civiliansSlain(state) < required) return false
  if (flagsFor(state).deadHeatAct2Reason) return false
  setFlag(state, 'deadHeatAct2Reason', 'civilians')
  info(api, `已有 ${civiliansSlain(state)} 名平民被杀害（不少于 ${required}）：推进幕 2。`)
  if (typeof api.advanceAct === 'function') api.advanceAct()
  return true
}

export function act2Reason(state) {
  return flagsFor(state).deadHeatAct2Reason || null
}

export function checkAct3Objective(state, api = {}) {
  if (currentActCode(state) !== ACT_CODES[2]) return false
  if (flagsFor(state).deadHeatAct3Advancing) return false
  if (amaranthInPlay(state)) return false
  if ((state.enemies || []).some(enemy => isRazinCode(enemy.originalCode || enemy.code))) return false
  setFlag(state, 'deadHeatAct3Advancing', true)
  info(api, '阿玛兰斯与拉辛·法瑞都不在场：推进幕 3。')
  if (typeof api.advanceAct === 'function') api.advanceAct()
  return true
}

export function checkObjectives(state, api = {}) {
  // 2026-11-13 P1-11：09524 正面「如果苋将被击败，改为推进」——`enemyCanBeDefeated` 只置待决标记，
  // 这里在引擎 checkAct 回调里真正推进（否则引擎先移除敌人，幕 2 背面翻面时找不到苋）。
  const flags = flagsFor(state)
  if (flags.deadHeatAmaranthWouldFall && !flags.deadHeatAct2Reason && currentActCode(state) === ACT_CODES[0]) {
    delete flags.deadHeatAmaranthWouldFall
    setFlag(state, 'deadHeatAct2Reason', 'defeat')
    info(api, '阿玛兰斯将被击败：改为推进幕 1（幕 2 背面翻面，保留她身上的标记）。')
    if (typeof api.advanceAct === 'function') api.advanceAct()
    return true
  }
  const ritual = maybeAdvanceRitualAct(state, api)
  const act3 = checkAct3Objective(state, api)
  return ritual || act3
}

// ---------------------------------------------------------------------------
// P1-11：议程 1/2 正面授予敌人关键词（09521「生成-随机地点」/ 09522 再加猎手）、
// 09532 废弃版杰马广场「在此打出的支援费用 +2」。
// ---------------------------------------------------------------------------
const isRisenOrGhoulCode = code => {
  const def = ALL_CARDS[code]
  return def?.type === 'enemy' && (def.traits || [])
    .some(trait => ['risen', 'ghoul'].includes(String(trait).toLowerCase()))
}

function currentAgendaFrontCode(state) {
  const agenda = (state.agendas || [])[state.agendaIndex] || null
  if (!agenda || agenda.face === 'back') return null
  const code = String(agenda.originalCode || agenda.code || '')
  return AGENDA_CODES.includes(code) ? code : null
}

/** 09521/09522 正面：每个 [[复生者]]/[[食尸鬼]] 敌人获得「生成-随机地点」。 */
export function spawnLocation(state, code, loc, engagedSeat, api = {}) {
  void engagedSeat
  if (!currentAgendaFrontCode(state)) return loc
  if (!isRisenOrGhoulCode(code)) return loc
  const ids = typeof api.randomLocationIds === 'function' ? api.randomLocationIds(1) : null
  const picked = Array.isArray(ids) ? ids[0] : ids
  return typeof picked === 'string' && (state.locations || []).some(location => location.id === picked) ? picked : loc
}

/** 09532 废弃版杰马广场：你在此地打出的每张支援费用 +2。 */
export function playCostIncrease(state, inv) {
  const location = (state.locations || []).find(item => item.id === inv?.location)
  if (!location) return 0
  const code = String(location.originalCode || location.code || '')
  return code === JEMAA_EL_FNAA_ABANDONED_CODE || location.id === 'jemaaElFnaaSquareAbandoned' ? 2 : 0
}

/** 09521/09522 正面：复生者/食尸鬼获得「生成-随机地点」；09522 还让它获得猎手。 */
/** 09524 正面：苋被击败改为推进幕 1（真正的推进在 checkObjectives 里执行）。 */
export function enemyCanBeDefeated(state, enemy) {
  const code = String(enemy?.originalCode || enemy?.code || '')
  if (!isAmaranthCode(code)) return true
  if (currentActCode(state) !== ACT_CODES[0]) return true
  const flags = flagsFor(state)
  if (flags.deadHeatAct2Reason) return true
  flags.deadHeatAmaranthWouldFall = true
  return false
}

function spawnAncientRaiders(state, api) {
  let count = 0
  for (const code of ['09540', '09540']) {
    if (!removeFromSetAside(state, code)) continue
    shuffleIntoEncounter(state, [code], api)
    count += 1
  }
  if (count) info(api, `${count} 张古代劫掠者洗入遭遇牌库。`)
  return count
}

function spawnRazin(state, api) {
  removeFromSetAside(state, RAZIN_CODE)
  const enemy = spawnDeadHeatEnemy(state, RAZIN_CODE, RITUAL_SITE_ID, api, { unique: true })
  if (enemy) info(api, '拉辛·法瑞在巴希尔宫花园生成。')
  return enemy
}

export function actReveal(state, act, api = {}) {
  const code = String(act?.originalCode || act?.code || '')
  if (code === ACT_CODES[0]) {
    spawnAmaranth(state, api)
    putSaveTheCiviliansInPlay(state, api)
    removeFromSetAside(state, KHALID_CODE)
    shuffleIntoEncounter(state, [KHALID_CODE], api)
    info(api, '幕 1 背面：阿玛兰斯现身，末绽之花附属在她身上；拯救平民入场；哈立德洗入遭遇牌库。')
    return true
  }
  if (code === ACT_CODES[1]) {
    if (act2Reason(state) === 'defeat') {
      const amaranth = flipAmaranth(state, api)
      if (amaranth) {
        const destination = randomLocationWithoutInvestigators(state, api, [amaranth.location])
        if (destination) {
          if (typeof api.moveEnemy === 'function') api.moveEnemy(amaranth, destination)
          else amaranth.location = destination
          info(api, `幕 2 背面：阿玛兰斯翻面并移动到没有调查员的「${
            state.locations.find(location => location.id === destination)?.name || destination}」。`)
        }
      }
    } else {
      spawnRazin(state, api)
    }
    spawnAncientRaiders(state, api)
    info(api, '幕 2 背面（生与死的仪式）：拉辛/阿玛兰斯的分支已结算，古代劫掠者洗入遭遇牌库。')
    return true
  }
  if (code === ACT_CODES[2]) {
    const knows = Boolean(recordsFor(state).theCellKnowsAmaranthsRealName)
    const key = knows ? 'resolution3' : 'resolution4'
    info(api, `幕 3 背面：剧本日志${knows ? '知道' : '不知道'}苋的真名 → 结局 ${key.slice(-1)}。`)
    if (typeof api.finish === 'function') api.finish(key)
    else state.resolution = key
    return true
  }
  return false
}

function spawnRisenFromDeck(state, count, api) {
  if (!count) return 0
  const isRisenOrGhoul = code => {
    const def = ALL_CARDS[code]
    return def?.type === 'enemy' && (def.traits || [])
      .some(trait => ['risen', 'ghoul'].includes(String(trait).toLowerCase()))
  }
  let spawned = 0
  for (let index = 0; index < count; index++) {
    const piles = [
      { list: state.encounterDeck || [] },
      { list: state.encounterDiscard || [] },
    ]
    let picked = null
    for (const pile of piles) {
      const at = pile.list.findLastIndex(isRisenOrGhoul)
      if (at >= 0) { picked = { ...pile, at }; break }
    }
    if (!picked) break
    const [code] = picked.list.splice(picked.at, 1)
    const location = randomLocationWithoutInvestigators(state, api, []) || START_LOCATION
    spawnDeadHeatEnemy(state, code, location, api)
    spawned += 1
  }
  if ((state.encounterDiscard || []).length) {
    state.encounterDeck = [...(state.encounterDeck || []), ...state.encounterDiscard]
    state.encounterDiscard = []
    if (typeof api.shuffle === 'function') state.encounterDeck = api.shuffle(state.encounterDeck)
  }
  return spawned
}

export function agendaReveal(state, agenda, api = {}) {
  const code = String(agenda?.originalCode || agenda?.code || '')
  if (code === AGENDA_CODES[0]) {
    const n = perPlayerCiviliansSlain(state)
    const spawned = spawnRisenFromDeck(state, n, api)
    info(api, `议程 1 背面：按 ${n} 名[per_investigator]被杀害的平民生成 ${spawned} 个[[苏生]]/[[食尸鬼]]敌人。`)
    for (const inv of activeInvestigators(state)) {
      const elites = (state.enemies || []).filter(enemy => enemy.elite && (Number(enemy.damageTaken) || 0) > 0)
      const options = [
        ...(elites.length ? [{ id: 'heal', label: '治愈场上每个[[精英]]敌人 2 点伤害' }] : []),
        ...(civiliansAt(state, inv.location) > 0 ? [{ id: 'slain', label: '你所在地点 1 名平民被杀害' }] : []),
      ]
      if (!options.length) continue
      const choice = typeof api.choose === 'function'
        ? api.choose({ kind: 'agenda', source: AGENDA_CODES[0], seat: inv.seat,
          prompt: '咬牙切齿：选择一项。', options })
        : options[0].id
      if (choice === 'slain') slayCivilian(state, inv.location, api)
      else {
        for (const enemy of elites) {
          enemy.damageTaken = Math.max(0, (Number(enemy.damageTaken) || 0) - 2)
          safeCall(api, 'healEnemy', enemy, 2)
        }
      }
    }
    return true
  }
  if (code === AGENDA_CODES[1]) {
    for (const inv of activeInvestigators(state)) safeCall(api, 'addTrauma', inv.seat, 'physical', 1)
    const razin = (state.enemies || []).some(enemy => isRazinCode(enemy.originalCode || enemy.code))
    const key = razin ? 'resolution1' : 'resolution2'
    info(api, `议程 2 背面：每位调查员承受 1 点肉体创伤；拉辛${razin ? '在' : '不在'}场 → 结局 ${key.slice(-1)}。`)
    if (typeof api.finish === 'function') api.finish(key)
    else state.resolution = key
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------

export function resolveChaosToken(state, inv, token) {
  return deadHeatChaosToken(state, inv, token)
}

export function chaosTokenValue(state, tokenFace, inv) {
  return deadHeatChaosTokenValue(state, tokenFace, inv)
}

function nonEliteEnemiesHere(state, inv) {
  return (state.enemies || []).filter(enemy => enemy.location === inv.location && !enemy.elite && !enemy.defeated)
}

function applyCultistToken(state, inv, api) {
  const candidates = nonEliteEnemiesHere(state, inv)
  if (!candidates.length) {
    info(api, '[cultist]：你所在地点没有非[[精英]]敌人。')
    return
  }
  let target = candidates[0]
  if (candidates.length > 1 && typeof api.choose === 'function') {
    const picked = api.choose({
      kind: 'enemy', source: '09520-token', seat: inv.seat,
      prompt: '[cultist]：选择你所在地点的一个非[[精英]]敌人重整并攻击你。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })
    target = candidates.find(enemy => enemy.id === picked) || target
  }
  target.exhausted = false
  safeCall(api, 'readyEnemy', target)
  if (typeof api.attack === 'function') api.attack(target, inv)
  else inv.damage = (inv.damage || 0) + (target.damage || 0)
  info(api, `[cultist]：「${target.name}」重整并攻击 ${inv.name}。`)
}

function applyTabletToken(state, inv, api, mode) {
  const damageOnce = () => {
    if (typeof api.damage === 'function') api.damage(inv.seat, 1)
    else inv.damage = (inv.damage || 0) + 1
  }
  if (mode === 'hard') {
    damageOnce()
    slayCivilian(state, inv.location, api)
    info(api, '[tablet]：承受 1 点伤害，且你所在地点 1 名平民被杀害。')
    return
  }
  const hasCivilian = civiliansAt(state, inv.location) > 0
  const choice = typeof api.choose === 'function'
    ? api.choose({
      kind: 'token', source: '09520-token', seat: inv.seat,
      prompt: '[tablet]：你可以承受 1 点伤害；若不承受，你所在地点 1 名平民被杀害。',
      options: [
        { id: 'damage', label: '承受 1 点伤害' },
        ...(hasCivilian ? [{ id: 'slain', label: '不承受伤害；1 名平民被杀害' }] : []),
      ],
    })
    : 'damage'
  if (choice === 'slain' && hasCivilian) slayCivilian(state, inv.location, api)
  else damageOnce()
  info(api, '[tablet]：结算承受伤害 / 平民被杀害。')
}

function applyElderThingToken(state, inv, api, mode) {
  const hand = inv.hand || []
  if (!hand.length) return
  if (mode === 'random') {
    const index = typeof api.random === 'function'
      ? Math.min(hand.length - 1, Math.floor(api.random() * hand.length))
      : 0
    const [code] = hand.splice(index, 1)
    ;(inv.discard ||= []).push(code)
    info(api, `[elder_thing]：${inv.name} 随机弃掉「${ALL_CARDS[code]?.nameZh || code}」。`)
    return
  }
  if (typeof api.discardOneFromHand === 'function') {
    api.discardOneFromHand(inv.seat, { source: '09520-token', prompt: '[elder_thing]：选择并弃掉 1 张手牌。' })
    return
  }
  const index = typeof api.choose === 'function'
    ? Number(api.choose({ kind: 'card', source: '09520-token', seat: inv.seat,
      prompt: '[elder_thing]：选择并弃掉 1 张手牌。',
      options: hand.map((code, position) => ({ id: String(position), cardCode: code, label: ALL_CARDS[code]?.nameZh || code })) }))
    : 0
  const safeIndex = Number.isInteger(index) && index >= 0 && index < hand.length ? index : 0
  const [code] = hand.splice(safeIndex, 1)
  ;(inv.discard ||= []).push(code)
  info(api, `[elder_thing]：${inv.name} 弃掉「${ALL_CARDS[code]?.nameZh || code}」。`)
}

export function applyTokenEffect(state, inv, effect, api = {}) {
  if (!inv || inv.defeated || inv.resigned || !effect) return false
  if (effect.token === 'cultist') { applyCultistToken(state, inv, api); return true }
  if (effect.token === 'tablet') { applyTabletToken(state, inv, api, effect.mode); return true }
  if (effect.token === 'elderthing') { applyElderThingToken(state, inv, api, effect.mode); return true }
  return false
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------

function chooseKeyBearer(state, api) {
  const candidates = activeInvestigators(state)
  if (!candidates.length) return null
  const seat = typeof api.choose === 'function'
    ? api.choose({
      kind: 'key', source: KEY_SPEC.id, seat: state.campaign?.leadSeat ?? candidates[0].seat,
      prompt: '选择一位调查员持有末绽之花。',
      options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
    })
    : candidates[0].seat
  const parsed = Number(seat)
  const chosen = candidates.find(inv => inv.seat === parsed) || candidates[0]
  bindLastBlossom(state, { type: 'investigator', seat: chosen.seat }, api)
  return chosen.seat
}

function aftermathOutcome(state) {
  const rescued = Math.max(0, Number(flagsFor(state)[CIVILIAN_TRACK.rescuedFlag]) || 0)
  const slain = civiliansSlain(state)
  let bonus = 0
  let trauma = 0
  if (rescued > slain) {
    bonus += 2
    if (rescued > slain * 2) bonus += 2
  } else if (slain > rescued) {
    trauma += 1
    if (slain > rescued * 2) trauma += 1
  }
  return { rescued, slain, bonus, trauma }
}

const RESOLUTION_RECORDS = Object.freeze({
  resolution1: { record: 'theLoversAreReunited', time: 1, bearer: 'amaranth' },
  resolution2: { record: 'youHaventSeenTheLastOfAmaranth', time: 1, bearer: 'amaranth' },
  resolution3: { record: 'amaranthHasLeftTheCoterie', time: 2, bearer: 'investigator' },
  resolution4: { record: 'youHaventSeenTheLastOfAmaranth', time: 1, bearer: 'investigator' },
  resolution5: { record: 'youHaventSeenTheLastOfAmaranth', time: 1, bearer: 'amaranth', trauma: 1, bonus: 3 },
})

function releaseKeyFromEnemy(state, api = {}) {
  const record = lastBlossom(state)
  if (!record || record.bearer.type !== 'enemy') return false
  return Boolean(bindLastBlossom(state, { type: 'none' }, api))
}

function applyResolutionRecords(state, key, api = {}) {
  const records = recordsFor(state)
  const outcome = aftermathOutcome(state)
  const config = RESOLUTION_RECORDS[key] || RESOLUTION_RECORDS.resolution5
  if (config.bearer === 'amaranth') {
    releaseKeyFromEnemy(state, api)
    records.theLastBlossomBearer = 'amaranth'
  } else {
    const seat = chooseKeyBearer(state, api)
    records.theLastBlossomBearer = Number.isInteger(seat) ? seat : 'amaranth'
  }
  if (config.record) records[config.record] = true
  const flags = flagsFor(state)
  flags[CIVILIAN_TRACK.slainFlag] = outcome.slain
  flags[CIVILIAN_TRACK.rescuedFlag] = outcome.rescued
  records.deadHeatCiviliansRescued = outcome.rescued
  records.deadHeatCiviliansSlain = outcome.slain
  records.time = (Number(records.time) || 0) + (Number(config.time) || 0)
  records.deadHeatResolution = key
  records.deadHeatTimes = (Number(records.deadHeatTimes) || 0) + 1
  const traumaTotal = (config.trauma || 0) + outcome.trauma
  if (traumaTotal > 0) {
    for (const inv of state.investigators || []) safeCall(api, 'addTrauma', inv.seat, 'mental', traumaTotal)
    info(api, `结局：每位调查员承受 ${traumaTotal} 点精神创伤（后果比较）。`)
  }
  const bonus = (Number(config.bonus) || 0) + outcome.bonus
  info(api, `死亡酷暑结算（${key}）：获救 ${outcome.rescued} / 被杀 ${outcome.slain}；时间 +${config.time}；奖励经验 ${bonus}。`)
  return { bonus, outcome }
}

export function resolution(state, key, events = [], api = {}) {
  void events
  let finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : NO_RESOLUTION
  if (finalKey === NO_RESOLUTION) {
    slayAllCivilians(state, api)
    if (currentActCode(state) === ACT_CODES[0]) {
      putSaveTheCiviliansInPlay(state, api)
      flipSaveTheCivilians(state, api)
    }
    const razin = (state.enemies || []).some(enemy => isRazinCode(enemy.originalCode || enemy.code))
    finalKey = razin ? 'resolution1' : 'resolution2'
  }
  if (!aftermathInPlay(state) && storyAssetInPlay(state)) flipSaveTheCivilians(state, api)
  const applied = applyResolutionRecords(state, finalKey, api)
  return { award: true, bonus: applied.bonus }
}

export function scenarioResolution(state, resolutionKey = 'resolution1', api = {}) {
  resolution(state, resolutionKey, [], api)
  const records = recordsFor(state)
  return {
    resolution: records.deadHeatResolution,
    rescued: records.deadHeatCiviliansRescued ?? 0,
    slain: records.deadHeatCiviliansSlain ?? 0,
    time: records.time,
    bearer: records.theLastBlossomBearer,
  }
}

export function skipToResolution5(state, api = {}) {
  setFlag(state, 'deadHeatSkip', true)
  info(api, '时间超过 24：直接结算结局 5。')
  if (typeof api.finish === 'function') api.finish('resolution5')
  else resolution(state, 'resolution5', [], api)
  return true
}

// ---------------------------------------------------------------------------
// 布置前置钩子 / 行为装配
// ---------------------------------------------------------------------------

export function preScenarioSetup(state, events, api = {}) {
  void events
  const time = timeOf(state)
  setFlag(state, 'deadHeatIntro', introBranchForTime(time))
  if (time > 24) {
    setFlag(state, 'deadHeatSkip', true)
    info(api, '时间已超过 24：跳过本关，结算时直接进入结局 5。')
    return true
  }
  info(api, `死亡酷暑：已流逝时间 ${time}（${introBranchForTime(time)}）。`)
  return false
}

export function setupEnemies(state, events, helper = {}) {
  void state
  void events
  void helper
}

export const behavior = {
  id: CHAPTER_ID,
  locationsStartRevealed: true,
  roundEndActIndex: 0,
  startLocation: () => START_LOCATION,
  preScenarioSetup,
  prepareScenario,
  setupScenario,
  setupLocations,
  setupEnemies,
  afterDeckSetup,
  locationPlaced,
  locationShroudModifier,
  enemyStatModifier,
  // 2026-11-13 P1-11：09521/09522 正面「生成-随机地点」/猎手；09532 该地点打支援 +2；
  // 09524 苋被击败→改为推进幕 1。
  spawnLocation,
  playCostIncrease,
  enemyCanBeDefeated,
  moveError,
  beforeMove,
  enemySpawned,
  enemyMoved,
  enemyAttackStarted,
  enemyAttackResolved,
  enemyDefeated: (state, enemy, api = {}) => {
    const code = String(enemy?.originalCode || enemy?.code || '')
    if (isAmaranthCode(code)) {
      if (ritualActActive(state) && !flagsFor(state).deadHeatAct2Reason) {
        // 「如果苋将被击败，改为推进幕 2」：不结算击败/胜利区，改由幕 2 背面翻面并移走她。
        setFlag(state, 'deadHeatAct2Reason', 'defeat')
        info(api, '阿玛兰斯将被击败：改为推进幕 2（生与死的仪式）。')
        if (typeof api.advanceAct === 'function') api.advanceAct()
        return true
      }
      releaseKeyFromEnemy(state, api)
    }
    checkAct3Objective(state, api)
    return false
  },
  checkObjectives,
  actions,
  performAction,
  encounterGainsSurge,
  resolveEncounterCard,
  events,
  applyTokenEffect,
  roundEnded,
  turnEnded,
  actReveal,
  agendaReveal,
  resolveChaosToken,
  chaosTokenValue,
  resolution,
  scenarioResolution,
  timeOf,
  introBranchForTime,
  actDeckForTime,
  civiliansAt,
  civiliansSlain: civiliansSlainCount,
  slayCivilian,
  rescueCivilian,
  checkAbandonedLocations,
  syncConnections,
  ensureScarletKeys,
  lastBlossom,
  bindLastBlossom,
  shiftLastBlossom,
  spawnAmaranth,
  flipAmaranth,
  amaranthInPlay,
  spawnDeadHeatEnemy,
  putSaveTheCiviliansInPlay,
  flipSaveTheCivilians,
  aftermathInPlay,
  applyTimeSetup,
  applyPreSlainCivilians,
  khalidEnteredPlay,
  checkAct3Objective,
  skipToResolution5,
}

export function implementedEntryFlags(code) {
  return entryOf(code)?.flags || {}
}

export { CARD_DATA }
