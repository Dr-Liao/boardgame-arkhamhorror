// 吞噬万物 · ELSE! 变体（The Blob That Ate Everything Else）· 引擎钩子。
//
// 复用普通流程的 behavior（同一套幕/议程/地点网格/混乱袋/结局/Part 1 剧情机制），只覆盖：
//   · prepareScenario：elseMode = true（14 张隔离区随机移除 5 张；89005+ 的剧情与敌人入场池）；
//   · afterDeckSetup：主街与所有粘稠街道互相连接（89006 的移动规则）；
//   · actions / performAction：屠宰场（诱饵）、装甲车移动、旧墓山/主街备注；
//   · locationShroudModifier：废弃风车的调查 -4 帷幕（89008 的近似全局口径）；
//   · resolveEncounterCard：85044 现实酸液改走 89005 图表（近似抽样结算）；
//   · enemyDefeated 的复制异变体已在普通 behavior 内按 elseMode 分支实现。
import * as nb from '../theBlobThatAteEverything/behavior.js'
import {
  CHAPTER_ID, LOCATIONS, STORY_RULES, ELSE_QUARANTINE_IDS, ELSE_SET_ASIDE_CODES,
} from './definition.js'

const clone = value => structuredClone(value)
const codeOf = value => String(value?.originalCode || value?.code || '')
const info = (api, message) => api?.info?.(message)
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const randomOf = api => (typeof api?.random === 'function' ? api.random : () => 0.5)
const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const blobData = state => (state.scenarioFlags ||= {}).blob || {}

function internal(name) {
  return nb[name]
}

export function prepareScenario(state, api = {}) {
  const data = blobData(state)
  if (data.setup) {
    data.elseMode = true
    if (!state.scenario.elseQuarantineIds) state.scenario.elseQuarantineIds = [...ELSE_QUARANTINE_IDS]
    return data.setup
  }
  const report = nb.prepareScenario(state, api, { elseMode: true, extraQuarantine: [...ELSE_QUARANTINE_IDS] })
  data.elseMode = true
  return report
}

export function preScenarioSetup(state, events, helperOrApi = {}) {
  void events
  const api = helperOrApi?.api || helperOrApi || {}
  return prepareScenario(state, api)
}

export function startLocation() {
  return nb.startLocation()
}

export function setupLocations(state, events, helper = {}) {
  return nb.setupLocations(state, events, helper)
}

export function locationPlaced(state, location, api = {}, seat = null) {
  return nb.locationPlaced(state, location, api, seat)
}

export function afterDeckSetup(state, events = null, helper = {}) {
  const result = nb.afterDeckSetup(state, events, helper)
  const data = blobData(state)
  data.elseMode = true
  const api = helper?.api || {}
  // 89006 主街：移动时与每张粘稠街道互相连接（此处直接写连接表，等同移动规则声明）。
  const mainStreet = locationOf(state, 'mainStreet')
  if (mainStreet) {
    const slimy = (state.locations || []).filter(location => /^slimyStreets/.test(location.id))
    for (const streets of slimy) {
      mainStreet.connections = [...new Set([...(mainStreet.connections || []), streets.id])]
      streets.connections = [...new Set([...(streets.connections || []), 'mainStreet'])]
    }
    if (slimy.length) info(api, '🛣️ 主街与所有粘稠街道互相连接。')
  }
  // ELSE! 的剧情/奖励卡全部放一边（89005 现实酸液图表、Mi-Go Incursion II）。
  state.scenarioZones ||= {}
  state.scenarioZones.setAside ||= []
  for (const code of ELSE_SET_ASIDE_CODES) {
    if (!state.scenarioZones.setAside.includes(code)) state.scenarioZones.setAside.push(code)
  }
  return result
}

export function setupScenario(state, api = {}) {
  state.scenario.elseQuarantineIds ||= [...ELSE_QUARANTINE_IDS]
  const result = nb.setupScenario(state, api)
  afterDeckSetup(state, null, { api })
  return result
}

// ---------------------------------------------------------------------------
// 行动（ELSE 增量）
// ---------------------------------------------------------------------------
export function actions(state, inv) {
  const moves = nb.actions(state, inv)
  if (!inv || inv.defeated || inv.resigned) return moves
  const data = blobData(state)
  const here = inv.location
  if (here === 'abbatoir') {
    moves.push({
      action: 'scenarioAction', rule: 'blobElseAbbatoir', label: '检定敏捷(3)：诱使此地的生物，把每名[[软泥]]敌人向屠宰场移动两次，'
        + '本回合这些敌人的 Blob X 值 +2（每局仅限一次成功）', locationId: here, actions: 1,
      reason: null,
    })
  }
  const story = data.story
  const car = (state.storyAssets || []).find(asset => codeOf(asset) === '89012')
  if (story && !story.resolved && story.code === '89011' && car && car.location === here) {
    moves.push({
      action: 'scenarioAction', rule: 'blobElseMoveCar',
      label: '团队行动：把装甲车移动到一处连接地点（每人 1[per_investigator] 行动，本实现按 1 行动近似）',
      locationId: here, actions: 1, reason: null,
    })
  }
  if (here === 'oldBurialHill') {
    moves.push({
      action: 'scenarioAction', rule: 'blobElseOldBurialNote', label: '旧墓山：此地的[[异质]]敌人在本回合被击败时改为发现线索（被动）',
      locationId: here, actions: 1, reason: '被动规则（见 behavior.enemySpawned/enemyDefeated），无需行动',
      disabled: true,
    })
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv) return false
  if (move.rule === 'blobElseAbbatoir') {
    safeCall(api, 'test', inv.seat, 'agility', 3, result => {
      if (!result?.success) return
      const oozes = (state.enemies || []).filter(enemy => !enemy.defeated && (enemy.traits || [])
        ?.map(trait => String(trait).toLowerCase()).includes('ooze'))
      for (const enemy of oozes) {
        safeCall(api, 'moveEnemyToward', enemy, 'abbatoir')
        safeCall(api, 'moveEnemyToward', enemy, 'abbatoir')
      }
      patchElse(state, { abbatoirRound: state.round })
      info(api, `🩸 屠宰场：${oozes.length} 名[[软泥]]敌人被诱向屠宰场，本回合 Blob X +2。`)
    })
    return true
  }
  if (move.rule === 'blobElseMoveCar') {
    const car = (state.storyAssets || []).find(asset => codeOf(asset) === '89012')
    const here = locationOf(state, inv.location)
    if (!car || !here) return false
    const destinations = (here.connections || []).filter(id => locationOf(state, id))
    if (!destinations.length) return false
    const id = destinations.length === 1 ? destinations[0] : safeCall(api, 'choice', {
      kind: 'choice', source: 'blobElse', seat: inv.seat, prompt: '把装甲车移动到：',
      options: destinations.map(locationId => ({ id: locationId, label: locationOf(state, locationId).name })),
    }) || destinations[0]
    car.location = id
    patchElse(state, { carLocation: id })
    info(api, `🚚 装甲车移动到「${locationOf(state, id).name}」。`)
    if (id === 'fungusMound') {
      nb.events.blobSpawnStory || null
      const story = blobData(state).story
      if (story && !story.resolved) nb.behavior.enemyPhaseStart(state, api)
    }
    return true
  }
  return nb.performAction(state, inv, move, api)
}

function patchElse(state, patch) {
  const data = blobData(state)
  Object.assign(data, patch)
  return data
}

// ---------------------------------------------------------------------------
// 地点 / 敌人 / 遭遇
// ---------------------------------------------------------------------------
export function locationShroudModifier(state, location) {
  if (!location) return 0
  if (location.id === 'abandonedWindmill') return -4
  return 0
}

export function enemyDefeated(state, enemy, api = {}) {
  const data = blobData(state)
  if (data.abbatoirRound === state.round && enemy && (enemy.traits || [])
    .map(trait => String(trait).toLowerCase()).includes('ooze')) {
    // Blob X +2 只在「被击败时对 Subject 的伤害」上生效；普通 behavior 会按 BLOB_X 结算，
    // 这里把额外 2 点补上（近似：仅本回合、仅软泥）。
    const subject = nb.subjectOf(state)
    if (subject) nrDamage(state, api, 2)
    void subject
  }
  return nb.enemyDefeated(state, enemy, api)
}

function nrDamage(state, api, amount) {
  // 复用普通 behavior 的 Subject 伤害路径（通过击败敌人后即可；此处直接调用内部 API）。
  const subject = nb.subjectOf(state)
  if (!subject) return 0
  if (typeof api?.damageEnemy === 'function') api.damageEnemy(subject.id, amount, null, '屠宰场的 Blob X +2')
  return amount
}

// 现实酸液（ELSE）：85044 抽到时改查 89005 图表。按「能吞噬的事物」近似抽样结算。
const REALITY_ASPECTS = Object.freeze([
  { id: 'nearestEnemy', text: '…离你最近的非精英敌人。', apply: (state, inv, api) => {
    const enemy = (state.enemies || []).find(item => !item.defeated && item.location === inv?.location && !item.elite)
    if (!enemy) return false
    safeCall(api, 'devourEnemy', enemy)
    if (typeof api?.removeEnemyFromPlay === 'function') api.removeEnemyFromPlay(enemy)
    else state.enemies = state.enemies.filter(item => item !== enemy)
    info(api, `🕳️ 现实酸液吞噬了「${enemy.name || enemy.code}」。`)
    return true
  } },
  { id: 'treachery', text: '…你所在地点的一张诡计。', apply: (state, inv, api) => {
    const threat = (inv?.threat || [])[0]
    if (!threat) return false
    inv.threat = inv.threat.filter(item => item !== threat)
    info(api, '🕳️ 现实酸液吞噬了威胁区的一张诡计。')
    return true
  } },
  { id: 'heal', text: '…你的 1 点恐惧与 1 点伤害。', apply: (state, inv, api) => {
    safeCall(api, 'horror', inv?.seat, 1)
    safeCall(api, 'damage', inv?.seat, 1)
    return true
  } },
  { id: 'greatestFlaw', text: '…你最大的缺陷（随机 1 张弱点）。', apply: (state, inv, api) => {
    safeCall(api, 'addBasicWeakness', inv?.seat)
    return true
  } },
  { id: 'topDeck', text: '…每位调查员牌库顶的 1 张牌。', apply: (state, inv, api) => {
    for (const owner of activeInvestigators(state)) {
      const card = (owner.deck || []).pop()
      if (card) { owner.discard.push(card); info(api, `🕳️ ${owner.name} 牌库顶的卡被吞噬。`) }
    }
    return true
  } },
  { id: 'handCard', text: '…你手牌中随机 1 张。', apply: (state, inv, api) => {
    if (!inv?.hand?.length) return false
    const index = Math.floor(randomOf(api) * inv.hand.length)
    const [card] = inv.hand.splice(index, 1)
    info(api, `🕳️ 现实酸液吞噬了手牌中的「${card}」。`)
    return true
  } },
  { id: 'resources', text: '…你的所有资源。', apply: (state, inv, api) => {
    safeCall(api, 'loseResources', inv?.seat, Number(inv?.resources) || 0)
    return true
  } },
  { id: 'discardTop', text: '…每位调查员弃牌堆顶的 1 张牌。', apply: (state, inv, api) => {
    for (const owner of activeInvestigators(state)) owner.discard.pop()
    return true
  } },
  { id: 'light', text: '…光。到本轮结束，调查员只能关掉或遮住身边光源。', apply: () => true },
  { id: 'language', text: '…语言的概念。直到调查阶段结束，你们只能胡言乱语。', apply: () => true },
  { id: 'noSoul', text: '…你的灵魂。在剧本日志中记录「你没有灵魂」。', apply: (state, inv, api) => {
    safeCall(api, 'setCampaignRecord', 'youHaveNoSoul', true)
    info(api, '📓 剧本日志记录「你没有灵魂」。')
    return true
  } },
])

export function resolveEncounterCard(state, inv, code, api = {}) {
  if (code !== '85044') return false
  const data = blobData(state)
  if (!data.elseMode) return false
  const shrine = locationOf(state, 'researchSite')
  void shrine
  const aspect = REALITY_ASPECTS[Math.floor(randomOf(api) * REALITY_ASPECTS.length)]
  const applied = aspect.apply(state, inv, api)
  info(api, `🧪 现实酸液（ELSE! 89005 图表）：${aspect.text}${applied ? '' : '（无法吞噬，重抽一次）'}`)
  if (!applied) {
    const retry = REALITY_ASPECTS[Math.floor(randomOf(api) * REALITY_ASPECTS.length)]
    retry.apply(state, inv, api)
    info(api, `🧪 重抽：${retry.text}`)
  }
  void STORY_RULES
  return true
}

export function checkStoryTriggers(state, api) {
  return nb.checkObjectives(state, api)
}

export function implementedEntryFlags(code) {
  return nb.implementedEntryFlags(code)
}

export function scenarioSummary(state) {
  return { ...nb.scenarioSummary(state), elseMode: true }
}

export const events = {
  ...nb.events,
  blobElseRealityAcid(state, payload = {}, api = {}) {
    return resolveEncounterCard(state, payload.inv || nilInv(), '85044', api)
  },
}

function nilInv() {
  return { seat: 0, hand: [], threat: [] }
}

export const behavior = {
  ...nb.behavior,
  id: CHAPTER_ID,
  elseMode: true,
  preScenarioSetup,
  prepareScenario,
  setupLocations,
  locationPlaced,
  afterDeckSetup,
  setupScenario,
  actions,
  performAction,
  locationShroudModifier,
  resolveEncounterCard,
  enemyDefeated,
  scenarioSummary,
  events,
}

export { clone }
