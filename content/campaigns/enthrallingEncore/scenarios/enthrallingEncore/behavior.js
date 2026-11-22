// 惑人返场（Enthralling Encore · 90094）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/EnthrallingEncore.hs + frontend locales en/standalone/enthrallingEncore.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   startLocation / setupLocations / setupEnemies / afterDeckSetup → 布置剧院四地点、道具牌库、小节、独奏者。
//   locationRevealed → 前厅/后台揭示时放 2 张私密地点入场。
//   actions / performAction → 幕的道具谈判、议程的独奏者谈判。
//   checkObjectives / actReveal / agendaReveal / allResigned / resolution → 结局与记录。
//   resolveChaosToken / applyTokenEffect → 90094 提示卡四类标记（按难度分支）。
//
// 近似（risks 同 status.json）：
//   · 前厅/后台走廊门口（Lobby/Backstage Doorway）在卡池没有实体卡，用谢幕的六个「私密地点」
//     按 2+2+2 近似（前厅揭示放前厅组 2 张、后台揭示放后台组 2 张）。
//   · 小节用 state.scenarioZones.measures 纯数值记账（布局/观测经 scenarioSummary 暴露）。
//   · 签名卡交换（Resolution 1/2）没有通用战役卡组改写原语，记为记录 + 说明，不实际改牌。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  ACT_CODE, AGENDA_CODE, CHAPTER_ID, KEY_INVESTIGATOR, LOCATIONS, PRIVATE_LOCATIONS,
  PRIVATE_LOCATION_IDS, PROPS_DECK_CODES, RESOLUTION_KEYS, SCENARIO_ACT_TEXT, SCENARIO_AGENDA_TEXT,
  SCENARIO_TEXT, SOLOIST_CODE, START_LOCATION, TOKEN_MEANINGS, tokenTier,
} from './definition.js'

const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const codeOf = value => String(value?.originalCode || value?.code || '')
const flagsFor = state => (state.scenarioFlags ||= {})
const flag = (state, key) => flagsFor(state)[key]
const setFlag = (state, key, value = true) => { flagsFor(state)[key] = value; return value }
const zones = state => (state.scenarioZones ||= {})
const info = (api, message) => api?.info?.(message)
const safe = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const isPrivateLocation = id => PRIVATE_LOCATION_IDS.includes(id)
const findSoloist = state => (state.enemies || []).find(enemy => codeOf(enemy) === SOLOIST_CODE) || null
const groupCluesAt = (state, id) => activeInvestigators(state)
  .filter(inv => inv.location === id).reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
const CLASS_SYMBOLS = ['guardian', 'seeker', 'rogue', 'mystic', 'survivor']

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

export const measures = state => Number(zones(state).measures) || 0
export const propsDeck = state => (Array.isArray(zones(state).propsDeck) ? zones(state).propsDeck : (zones(state).propsDeck = []))

export function classesAmongControlledCards(state, inv) {
  const classes = new Set()
  const seen = (card) => {
    const def = ALL_CARDS[card?.code || card] || ALL_CARDS[card]
    const symbols = def?.classSymbols || def?.classes || [def?.klass].filter(Boolean)
    for (const symbol of symbols || []) if (CLASS_SYMBOLS.includes(String(symbol).toLowerCase())) classes.add(String(symbol).toLowerCase())
  }
  for (const asset of inv.assets || []) seen(asset.code)
  for (const code of [...(inv.hand || []), ...(inv.deck || []), ...(inv.discard || [])]) seen(code)
  return classes.size
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

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
export function startLocation() {
  return START_LOCATION
}

export function setupLocations(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  setFlag(state, 'encorePrepared', true)
  info(api, '惑人返场：放置剧院、前厅、楼座与后台；全员从剧院开始；六个私密地点放在一边。')
  return ['theatre', 'lobby', 'balcony', 'backstage']
}

export function setupEnemies(state, events = null, helper = {}) {
  void events
  const spawn = typeof helper?.spawnEnemy === 'function' ? (code, location) => helper.spawnEnemy(code, location) : null
  if (spawn) spawn(SOLOIST_CODE, 'backstage')
  else spawnSoloist(state)
  return true
}

function spawnSoloist(state) {
  const definition = (state.scenario?.enemies || {})[SOLOIST_CODE]
  if (!definition) return null
  state.enemies ||= []
  const existing = findSoloist(state)
  if (existing) return existing
  const count = investigatorCount(state)
  const enemy = {
    id: `e${++state.instanceSeq.e}`, code: SOLOIST_CODE, originalCode: SOLOIST_CODE,
    name: definition.name, nameEn: definition.nameEn, location: 'backstage',
    fight: definition.fight ?? 4, evade: definition.evade ?? 5,
    health: (Number(definition.health) || 6) * count,
    damage: definition.damage || 2, horror: definition.horror || 2,
    traits: [...(definition.traits || [])],
    alert: true, aloof: true, elusive: true, hunter: true,
    elite: true, exhausted: false, engagedSeat: null, damageTaken: 0, doom: 0, clues: 0, victory: 2,
  }
  state.enemies.push(enemy)
  return enemy
}

export function afterDeckSetup(state, events = null, helper = {}) {
  void events
  const api = helper?.api || {}
  zones(state).propsDeck = shuffleWith(api, PROPS_DECK_CODES)
  zones(state).measures = 0
  zones(state).encorePrivatePlaced = []
  if (!findSoloist(state)) spawnSoloist(state)
  setFlag(state, 'encorePrepared', true)
  info(api, `惑人返场：道具牌库 ${zones(state).propsDeck.length} 张；小节 0；邪恶独奏者在后台。`)
  return { props: zones(state).propsDeck.length }
}

// ---------------------------------------------------------------------------
// 地点揭示：前厅/后台 → 放 2 张私密地点
// ---------------------------------------------------------------------------
export function locationRevealed(state, location, api = {}, seat = null) {
  void seat
  if (!location) return false
  const group = PRIVATE_LOCATIONS[location.id]
  if (!group) return false
  const placed = zones(state).encorePrivatePlaced || (zones(state).encorePrivatePlaced = [])
  const candidates = group.filter(id => !placed.includes(id)
    && !(state.locations || []).some(item => item.id === id))
  if (!candidates.length) return false
  const chosen = shuffleWith(api, candidates).slice(0, 2)
  for (const id of chosen) {
    placed.push(id)
    if (typeof api.placeLocation === 'function') api.placeLocation(id)
    else if (!(state.locations || []).some(item => item.id === id)) {
      const definition = (state.scenario?.locations || LOCATIONS)[id]
      if (definition) state.locations.push({ ...structuredClone(definition), id, clues: 0, revealed: false })
    }
  }
  info(api, `「${location.name}」揭示：将 ${chosen.map(id => (state.scenario?.locations || LOCATIONS)[id]?.name || id).join('、')} 放入场。`)
  return true
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here) return []
  const moves = []
  const perPlayer = investigatorCount(state)
  const deck = propsDeck(state)
  if (isPrivateLocation(here.id) && deck.length) {
    moves.push({
      action: 'scenarioAction', rule: 'encorePropsParley', locationId: here.id, actions: 0,
      label: `[fast] 团队共同花费 ${perPlayer} 个线索：谈判，揭示道具牌库顶 3 张并让一位调查员抽 1 张`,
      reason: groupCluesAt(state, here.id) >= perPlayer ? null : `本地点需要 ${perPlayer} 个线索`,
    })
  }
  const soloist = findSoloist(state)
  if (soloist && soloist.location === here.id) {
    const playable = (inv.hand || []).filter(code => ALL_CARDS[code]?.type === 'event'
      || ALL_CARDS[code]?.type === 'asset' || ALL_CARDS[code]?.type === 'skill')
    moves.push({
      action: 'scenarioAction', rule: 'encoreSoloistParley', locationId: here.id, actions: 0,
      enemyId: soloist.id,
      label: '[fast] 弃掉每个职介各 1 张手牌：谈判，自动躲避邪恶独奏者并使其文字框留白至本轮结束',
      reason: classesInHand(state, inv) >= 5 ? null : '手牌中没有覆盖 5 个职介的卡牌',
    })
    void playable
  }
  return moves
}

function classesInHand(state, inv) {
  void state
  const classes = new Set()
  for (const code of inv.hand || []) {
    const def = ALL_CARDS[code]
    const symbols = def?.classSymbols || def?.classes || [def?.klass].filter(Boolean)
    for (const symbol of symbols || []) {
      const value = String(symbol).toLowerCase()
      if (CLASS_SYMBOLS.includes(value)) classes.add(value)
    }
    if (def?.faction) {
      const value = String(def.faction).toLowerCase()
      if (CLASS_SYMBOLS.includes(value)) classes.add(value)
    }
  }
  return classes.size
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  if (move.rule === 'encorePropsParley') return propsParley(state, inv, api)
  if (move.rule === 'encoreSoloistParley') return soloistParley(state, inv, api)
  return false
}

function propsParley(state, inv, api) {
  if (!isPrivateLocation(inv.location)) return false
  if (!payGroupClues(state, inv.location, investigatorCount(state))) return false
  const deck = propsDeck(state)
  const revealed = deck.splice(Math.max(0, deck.length - 3))
  if (!revealed.length) return false
  const investigators = activeInvestigators(state)
  const chosenSeat = investigators.length === 1 ? investigators[0].seat : Number(api.choose({
    kind: 'investigator', source: 'encorePropsParley', seat: inv.seat,
    prompt: '选择一位调查员抽取 1 张揭示的道具。',
    options: investigators.map(item => ({ id: String(item.seat), label: item.name })),
  }))
  const target = state.investigators[chosenSeat] || inv
  const pick = revealed.length === 1 ? revealed[0] : revealed[Math.floor(Number(typeof api.random === 'function' ? api.random() : Math.random()) * revealed.length) % revealed.length]
  const rest = revealed.filter(code => code !== pick)
  deck.unshift(...shuffleWith(api, rest))
  if (typeof api.putInHand === 'function') api.putInHand(target.seat, pick)
  else target.hand.push(pick)
  info(api, `${target.name} 从道具牌库抽到「${ALL_CARDS[pick]?.nameZh || ALL_CARDS[pick]?.name || pick}」，其余洗回牌库底。`)
  return true
}

function soloistParley(state, inv, api) {
  const soloist = findSoloist(state)
  if (!soloist || soloist.location !== inv.location) return false
  // 近似：手牌中每个职介弃 1 张（重复职介取前 5 个不同职介）；不足 5 个职介时拒绝。
  const byClass = new Map()
  for (const code of inv.hand || []) {
    const def = ALL_CARDS[code]
    const symbols = def?.classSymbols || def?.classes || [def?.klass].filter(Boolean) || []
    for (const symbol of symbols) {
      const cls = String(symbol).toLowerCase()
      if (!CLASS_SYMBOLS.includes(cls) || byClass.has(cls)) continue
      byClass.set(cls, code)
      break
    }
  }
  if (byClass.size < 5) {
    info(api, '手牌没有覆盖全部 5 个职介，无法谈判。')
    return false
  }
  for (const code of byClass.values()) {
    const index = inv.hand.indexOf(code)
    if (index >= 0) inv.hand.splice(index, 1)
    inv.discard.push(code)
  }
  soloist.exhausted = true
  soloist.engagedSeat = null
  for (const other of state.investigators || []) other.engaged = (other.engaged || []).filter(id => id !== soloist.id)
  setFlag(state, 'soloistBlankRound', state.round)
  info(api, `${inv.name} 用五个职介的卡牌完成了交易：邪恶独奏者被自动躲避，其文字框本轮留白。`)
  return true
}

// ---------------------------------------------------------------------------
// 幕 / 议程 / 结局
// ---------------------------------------------------------------------------
export function enemyDefeated(state, enemy, api = {}) {
  void state
  void api
  void enemy
  return false
}

export function checkObjectives(state, api = {}) {
  const inVictory = (state.victoryDisplay || []).some(card => codeOf(card) === SOLOIST_CODE)
  if (inVictory) {
    info(api, '邪恶独奏者位于胜利区：推进场景。')
    safe(api, 'advanceAct')
    return true
  }
  return false
}

export function actReveal(state, act, api = {}) {
  if (codeOf(act) !== ACT_CODE) return false
  setFlag(state, 'enthrallingEncoreResolution', 'resolution1')
  info(api, '幕 1 背面：独奏者被击败，剧院的诅咒似乎终于平息。（结局 1）')
  safe(api, 'finish', 'resolution1')
  return true
}

export function agendaReveal(state, agenda, api = {}) {
  if (codeOf(agenda) !== AGENDA_CODE) return false
  const current = measures(state) + 1
  zones(state).measures = current
  setFlag(state, 'encoreMeasures', current)
  info(api, `在剧本参考卡上放置 1 个资源作为小节（当前 ${current} 个小节）。`)
  if (current >= 5) {
    setFlag(state, 'enthrallingEncoreResolution', 'resolution2')
    for (const inv of activeInvestigators(state)) {
      if (typeof api?.horror === 'function') api.horror(inv.seat, 1)
      inv.defeated = true
    }
    info(api, '已有至少 5 个小节：每位调查员被击败并承受 1 点精神创伤。（结局 2）')
    safe(api, 'finish', 'resolution2')
    return true
  }
  const perPlayer = investigatorCount(state)
  const failed = []
  for (const inv of activeInvestigators(state)) {
    if (typeof api.test !== 'function') continue
    api.test(inv.seat, 'willpower', 3, result => {
      if (result?.success) return
      failed.push(inv.seat)
      if (typeof api.horror === 'function') api.horror(inv.seat, 1)
      // 近似：把 1 张非永久、非弱点支援洗入道具牌库（优先弃牌堆/场上资产）。
      const pool = [...(inv.discard || []), ...(inv.assets || []).map(asset => codeOf(asset))]
        .filter(code => ALL_CARDS[code] && ALL_CARDS[code].type === 'asset'
          && ALL_CARDS[code].subtype !== 'weakness' && !ALL_CARDS[code].permanent)
      const code = pool[0]
      if (code) {
        const at = (inv.discard || []).indexOf(code)
        if (at >= 0) inv.discard.splice(at, 1)
        propsDeck(state).push(code)
      }
    })
  }
  const soloist = findSoloist(state)
  if (soloist && failed.length >= activeInvestigators(state).length) {
    soloist.damageTaken = Math.max(0, (soloist.damageTaken || 0) - perPlayer)
    info(api, '所有调查员检定失败：从邪恶独奏者身上移除 1[per_investigator] 点伤害。')
  }
  for (const location of state.locations || []) {
    if (location.revealed === false) continue
    const target = Number(location.maxClues ?? location.cluesPerInvestigator ?? 0) * perPlayer
    location.clues = Math.max(Number(location.clues) || 0, target)
  }
  state.encounterDeck = [...(state.encounterDeck || []), ...(state.encounterDiscard || [])]
  state.encounterDiscard = []
  state.agendaDoom = 0
  info(api, '冥冥中的挽歌：补充线索、把遭遇弃牌堆洗回遭遇牌库，并将本密谋重置为 1a。')
  return true
}

export function allResigned(state, api = {}) {
  setFlag(state, 'enthrallingEncoreResolution', 'resolution2')
  safe(api, 'finish', 'resolution2')
  return true
}

export function resolution(state, key, events = null, api = {}) {
  void events
  void api
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : 'noResolution'
  const recordKey = finalKey === 'resolution1' ? 'resolution1' : 'resolution2'
  setFlag(state, 'enthrallingEncoreResolvedTo', recordKey)
  return {
    award: true,
    effects: [
      { record: { enthrallingEncoreResolution: recordKey } },
      { record: { enthrallingEncoreMeasures: measures(state) } },
      { record: { enthrallingEncoreSignatureSwap: recordKey === 'resolution1' ? 'optional' : 'forced' } },
      { text: recordKey === 'resolution1'
        ? '独奏者被击败，调查员可以把签名卡升级为进阶版，或把进阶版弱点降级为原本版本。'
        : '独奏者带走了调查员的理智，调查员必须把弱点升级为进阶版，或把进阶版签名卡降级为原本版本。' },
    ],
  }
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
function soloistAtLocation(state, inv) {
  const soloist = findSoloist(state)
  return Boolean(soloist && soloist.location === inv.location)
}

export function resolveChaosToken(state, inv, token, api = {}) {
  void api
  const hard = tokenTier(state) === 'hard'
  switch (String(token)) {
    case 'skull':
      return { delta: 0 - (measures(state) + (hard ? 1 : 0)), onDraw: [], onFail: [] }
    case 'cultist':
      return {
        delta: hard ? -3 : -2, onDraw: [], onFail: [{ type: 'scenarioToken', mode: 'cultist' }],
      }
    case 'tablet': {
      const multiclass = classesAmongControlledCards(state, inv) >= 3
      return {
        delta: hard ? (multiclass ? -6 : -4) : (multiclass ? -5 : -3),
        onDraw: [], onFail: [],
      }
    }
    case 'elderthing': {
      if (hard && soloistAtLocation(state, inv)) return { delta: -3, autoFail: true, onDraw: [], onFail: [] }
      return { delta: hard ? -3 : -2, drawAnother: !hard && soloistAtLocation(state, inv), onDraw: [], onFail: [] }
    }
    default:
      return null
  }
}

export function applyTokenEffect(state, inv, effect = {}, api = {}) {
  if (!effect || effect.type !== 'scenarioToken') return false
  const hard = tokenTier(state) === 'hard'
  if (effect.mode === 'cultist') {
    const clues = Number(inv.clues) || 0
    if (hard) {
      if (clues > 0) {
        inv.clues -= 1
        state.clues = activeInvestigators(state).reduce((sum, item) => sum + (Number(item.clues) || 0), 0)
      }
      if (typeof api.damage === 'function') api.damage(inv.seat, 1)
      info(api, `${inv.name} 因 [cultist] 失败：花费 1 个线索并受到 1 点伤害。`)
      return true
    }
    const choice = clues > 0 ? api.choose({
      kind: 'option', source: 'encoreCultist', seat: inv.seat, prompt: '[cultist]：花费 1 个线索或受到 1 点伤害。',
      options: [{ id: 'clue', label: '花费 1 个线索' }, { id: 'damage', label: '受到 1 点伤害' }],
    }) : 'damage'
    if (choice === 'clue' && Number(inv.clues) > 0) {
      inv.clues -= 1
      state.clues = activeInvestigators(state).reduce((sum, item) => sum + (Number(item.clues) || 0), 0)
      info(api, `${inv.name} 花费 1 个线索代替伤害。`)
    } else if (typeof api.damage === 'function') {
      api.damage(inv.seat, 1)
      info(api, `${inv.name} 因 [cultist] 失败受到 1 点伤害。`)
    }
    return true
  }
  return false
}

export function tokenMeanings() {
  return TOKEN_MEANINGS
}

// ---------------------------------------------------------------------------
// 只读投影 / 导入正文
// ---------------------------------------------------------------------------
export function scenarioSummary(state) {
  const soloist = findSoloist(state)
  return {
    soloistLocation: soloist?.location ?? null,
    soloistExhausted: Boolean(soloist?.exhausted),
    soloistBlankRound: flag(state, 'soloistBlankRound') || null,
    measures: measures(state),
    propsDeckRemaining: propsDeck(state).length,
    privateLocations: [...(zones(state).encorePrivatePlaced || [])],
    classesAmongControlled: activeInvestigators(state).map(inv => ({
      seat: inv.seat, classes: classesAmongControlledCards(state, inv),
    })),
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

export const behavior = {
  id: 'enthrallingEncore',
  startLocation,
  setupLocations,
  setupEnemies,
  afterDeckSetup,
  locationRevealed,
  actions,
  performAction,
  checkObjectives,
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
  findSoloist,
  measures,
  propsDeck,
  classesAmongControlledCards,
  classesInHand,
  spawnSoloist,
  SCENARIO_ACT_TEXT,
  SCENARIO_AGENDA_TEXT,
  TOKEN_MEANINGS,
  PRIVATE_LOCATIONS,
}

export { ACT_CODE, AGENDA_CODE, SOLOIST_CODE, RESOLUTION_KEYS, START_LOCATION, KEY_INVESTIGATOR, findSoloist }
