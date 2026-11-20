// 山谷的命运（fateOfTheVale · 10651）· 引擎钩子（章节流程）。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/FateOfTheVale.hs +
//       Scenarios/TheFeastOfHemlockVale/FateOfTheVale/{Helpers,CosmicEmissary}.hs +
//       Act|Agenda|Location|Enemy|Treachery|Story/Cards/TheFeastOfHemlockVale/FateOfTheVale/*.hs +
//       frontend/src/locales/en/theFeastOfHemlockVale/fateOfTheVale.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup → 章节准备（幕/议程牌库、放一边、镜巢洗牌、破碎自我换卡、开场分支）
//   setupLocations / locationPlaced / setupEnemies / afterDeckSetup → 镜巢环、宇宙密使阵形、深渊牌库
//   actions / performAction → 查找深渊、v.II 居民谈判、v.III 引线与火势、v.IV 撤退、幕推进
//   turnEnded / afterTest / roundEnded → 镜巢回合末强制效果、本轮成功记录
//   locationEntered → 进入深渊时深渊有牌即阵亡
//   enemyDefeated / enemyAttackResolved / enemyDamageAllowed / enemyCannotAttack / enemyStatModifier
//   actReveal / agendaReveal / checkObjectives → 幕/议程背面、幕间四选项与幕 3a 四个版本
//   resolveChaosToken / applyTokenEffect / testAutoFail → 10651 混乱标记与破碎密使的标记反应
//   resolution → 结局 1–5 / 无结局与剧本日志写入
//
// 近似（approximation，逐条在函数注释里标明）：
//   1. 遭遇牌库不被「深渊牌库」取代：引擎没有「遭遇牌库替换」钩子，因此神话阶段仍从
//      state.encounterDeck 抽取；深渊牌库（state.scenarioFlags.mechanics.scenarioDecks.abyss）
//      承载调查员牌库顶 5 张 + 各调查员「真正的」调查员卡，供本章的「揭示深渊」类效果使用。
//   2. 深渊抽牌按「底部=数组头部」的既有 scenarioDecks 约定（deck 尾部是顶）。
//   3. 神话阶段「从深渊底翻到有遭遇卡背的卡」的改写没有引擎窗口；本章提供
//      drawEncounterFromAbyss（行为 / events / 测试可调），交给主进程接窗口后再替换神话抽牌。
//   4. 四个镜巢的卡面不同，洗牌是隐藏信息：nestAssignment 用 api.randomValue 打乱位置→卡号，
//      setupLocations 之前把 state.scenario.locations 的 code 换掉；无随机源时保持印刷顺序。
//   5. The Vale 地点印刷连线不在卡表里，用「印刷顺序围成一环」的近似；洞穴地点同理。
//   6. Relationship Level ≥4 的居民「选择控制」与居民卡叠在「战役记录」里的关系等级读数
//      走 api.residents / campaign.records 的既有字段；缺记录时按未达 4 级处理。
import {
  applyInvestigatorForm, hasInvestigatorForm, restoreInvestigatorForm,
} from '../../../../../src/engine/investigator-form.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  isHardSide, againstCosmicEmissary,
  EMISSARY_CODES, EMISSARY_COLOUR_CODES, EMISSARY_SHATTERED_CODES,
  fateChaosToken, fateChaosTokenValue, hasTrait, isEmissary, isEmissaryCode,
} from './chaos.js'
import {
  ACT1_CODE, ACT2_CODE, ACT3_CODE_BY_CHOICE, ACT3_RULES, ACT3_VARIANT_CODES, ACT_CODES,
  AGENDA_CODES, AGENDAS, ALL_ACT_CODES, ABYSS_LOCATION_CODE, ABYSS_LOCATION_ID, ACT_STAGES,
  BOARDING_HOUSE_ID, CAVE_LOCATION_CODES, CAVE_LOCATION_IDS, DR_MARQUEZ_CODE,
  EMISSARY_FORMATION, ENCOUNTER_DECK, FIRE_CODE, FRENZIED_REVELER_CODE,
  LOCATIONS, LOCATION_CONNECTIONS, MIRROR_NEST_CODE_BY_POSITION, MIRROR_NEST_CODES,
  MIRROR_NEST_POSITIONS, OLD_MEMORY_CODE, PRISMATIC_SHARD_CODE, RESIDENT_ASSET_CODES,
  RESIDENT_ENEMY_BY_ASSET, RESIDENT_ENEMY_CODES, residentAssetOf, SET_ASIDE_CARDS,
  SET_ASIDE_LOCATION_IDS, SHATTERED_SELF_CODE, START_LOCATION, STORY_CARD_CODE,
  THE_ATWOOD_HOUSE_ID, THE_COMMONS_ID, THE_CROSSROADS_ID, VALE_LOCATION_IDS,
} from './definition.js'
import { isCaveLocation, mirrorNestInPlay, placeAbyssLocation, placeNightLocation, syncConnections } from './locations.js'
import { clearEscapeRoad, escapeLocationAction, performEscapeLocationAction } from './escape.js'
export { mirrorNestInPlay, placeAbyssLocation, syncConnections } from './locations.js'

const CHAPTER_ID = 'fateOfTheVale'
const ABYSS_DECK_ID = 'abyss'
const NO_RESOLUTION = 'noResolution'
const RESOLUTION_KEYS = ['resolution1', 'resolution2', 'resolution3', 'resolution4', 'resolution5']

const activeInvestigators = state => (state.investigators || [])
  .filter(inv => inv && !inv.defeated && !inv.resigned)
const investigatorCount = state => Number(state.numInvestigators) || (state.investigators || []).length || 1
const info = (api, text) => api?.info?.(text)
const safeCall = (api, name, ...args) => (typeof api?.[name] === 'function' ? api[name](...args) : null)
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
const flag = (state, key, fallback = false) => flagsFor(state)[key] ?? fallback
const clearFlag = (state, key) => { delete flagsFor(state)[key] }
const zonesFor = state => (state.scenarioZones ||= {})
const codeOf = value => String(value?.originalCode || value?.code || '')
const random = (api, state) => {
  if (typeof api?.randomValue === 'function') return Number(api.randomValue())
  if (typeof state?.randomValue === 'function') return Number(state.randomValue())
  return null
}
const shuffleWith = (list, api, state) => {
  const cards = [...list]
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const value = random(api, state)
    const roll = Number.isFinite(value) ? value : ((index * 7 + 3) % (index + 1)) / (index + 1)
    const target = Math.floor(roll * (index + 1))
    ;[cards[index], cards[target]] = [cards[target], cards[index]]
  }
  return cards
}

// 单卡条目的规则数据（flags）是唯一事实源：behavior 只按条目声明分派。
// 条目可能尚未被主进程重建索引（并行 worker），因此 registeredEntry 查不到时返回 null。
const entryOf = code => {
  if (!code) return null
  try {
    return registeredEntry(String(code)) || null
  } catch {
    return null
  }
}

const entryFlags = code => entryOf(code)?.flags || {}

// ---------------------------------------------------------------------------
// 镜巢与连接
// ---------------------------------------------------------------------------

/** 四个镜巢的「位置 → 卡号」映射（洗牌是隐藏信息）。 */
export function nestAssignment(state, api = {}) {
  const flags = flagsFor(state)
  if (flags.fateNestCodes) return flags.fateNestCodes
  const shuffled = shuffleWith(MIRROR_NEST_CODES, api, state)
  const assignment = Object.fromEntries(MIRROR_NEST_POSITIONS.map((position, index) => [position, shuffled[index]]))
  flags.fateNestCodes = assignment
  return assignment
}

export const nestCodeAt = (state, positionId) => nestAssignment(state)[positionId]
  || MIRROR_NEST_CODE_BY_POSITION[positionId]

/** 把洗牌结果写回地点定义（引擎按 id 读 state.scenario.locations 入场）。 */
export function applyNestCodes(state) {
  const assignment = nestAssignment(state)
  for (const position of MIRROR_NEST_POSITIONS) {
    const def = state.scenario?.locations?.[position]
    if (!def) continue
    const code = assignment[position]
    def.code = code
    def.originalCode = code
    const printed = ALL_CARDS[code]
    if (printed) {
      def.name = printed.nameZh || printed.name
      def.nameEn = printed.name
      def.text = printed.textZh || printed.text
      def.textEn = printed.text
    }
  }
  return assignment
}

// ---------------------------------------------------------------------------
// 破碎自我（Shattered Self）
// ---------------------------------------------------------------------------

/** 记录每位调查员「真正的」调查员卡，并把卡面换成破碎自我（10661）。 */
export function shatterSelves(state, api = {}) {
  const flags = flagsFor(state)
  const trueSelves = { ...(flags.fateTrueSelves || {}) }
  const seats = []
  for (const inv of state.investigators || []) {
    if (!inv) continue
    const original = inv.formOriginal?.code || inv.code || state.campaign?.investigators?.[inv.seat]?.code
      || (hasInvestigatorForm(inv) ? null : inv.code)
    if (original && !trueSelves[inv.seat]) trueSelves[inv.seat] = String(original)
    if (hasInvestigatorForm(inv)) { seats.push(inv.seat); continue }
    applyInvestigatorForm(state, inv, {
      code: SHATTERED_SELF_CODE, form: shatteredFlags().form || 'shattered',
    })
    seats.push(inv.seat)
  }
  flags.fateTrueSelves = trueSelves
  flags.fateShatteredSelves = seats
  // 「将其余破碎自我卡牌移出游戏」：4 张里只用与调查员数相同的张数。
  flags.fateShatteredSelfRemoved = Math.max(0, 4 - seats.length)
  info(api, `破碎自我：${seats.length} 位调查员换上破碎自我卡（其余 ${flags.fateShatteredSelfRemoved} 张移出游戏）。`)
  return { seats, trueSelves }
}

export const trueSelfCodeOf = (state, seat) => flagsFor(state).fateTrueSelves?.[seat] || null
export const isShattered = (state, inv) => Boolean(inv && hasInvestigatorForm(inv) && inv.form === 'shattered')

/** 「真正的调查员卡」从深渊回到调查员：治愈全部伤害/恐惧、恢复身份、旧时记忆入场。 */
export function returnToTrueSelf(state, seat, api = {}) {
  const inv = state.investigators?.[seat]
  if (!inv) return null
  const trueCode = String(resolveTrueSelfCode(state, seat) || '')
  if (trueCode && trueCode !== inv.code) {
    const restored = restoreInvestigatorForm(inv)
    if (!restored && ALL_CARDS[trueCode]) {
      const def = ALL_CARDS[trueCode]
      inv.code = trueCode
      inv.name = def.nameZh || def.name
      inv.nameEn = def.name
      inv.klass = def.klass
      inv.willpower = def.willpower
      inv.intellect = def.intellect
      inv.combat = def.combat
      inv.agility = def.agility
      inv.maxHealth = def.health ?? inv.maxHealth
      inv.maxSanity = def.sanity ?? inv.maxSanity
    }
  }
  safeCall(api, 'heal', seat, 'all')
  inv.damage = 0
  inv.horror = 0
  const oldMemoryCode = entryFlags(SHATTERED_SELF_CODE).oldMemoryCode || OLD_MEMORY_CODE
  const memoryEntry = entryFlags(oldMemoryCode)
  const oldMemory = addStoryAsset(state, oldMemoryCode,
    { controllerSeat: seat, inPlayArea: seat, ...(memoryEntry.oldMemory ? { oldMemory: true } : {}) }, api)
  const memoryCost = Number(memoryEntry.groupClueCost?.perInvestigator) || 0
  if (memoryCost) info(api, `旧时记忆入场（触发需共同支付 ${memoryCost}/人 线索）。`)
  setFlag(state, `fateTrueSelfReturned:${seat}`, true)
  info(api, `${inv.name} 取回「真正的」调查员卡；旧时记忆（10661b）入场。`)
  return { investigator: inv, oldMemory, trueCode }
}

function resolveTrueSelfCode(state, seat) {
  const recorded = flagsFor(state).fateTrueSelves?.[seat]
  if (recorded) return recorded
  const record = state.campaign?.investigators?.[seat]
  return record?.code || null
}

// ---------------------------------------------------------------------------
// 深渊（The Abyss）
// ---------------------------------------------------------------------------

/** 深渊牌库（引擎 scenarioDecks 形状：deck 尾部是牌库顶）。 */
export function abyssPile(state) {
  const mechanics = (state.scenarioFlags ||= {}).mechanics || null
  return mechanics?.scenarioDecks?.[ABYSS_DECK_ID] || null
}

function ensureAbyssPile(state) {
  const flags = flagsFor(state)
  const mechanics = flags.mechanics ||= { version: 1 }
  mechanics.scenarioDecks ||= {}
  mechanics.scenarioDecks[ABYSS_DECK_ID] ||= { deck: [], discard: [], removed: [] }
  return mechanics.scenarioDecks[ABYSS_DECK_ID]
}

/** 底牌 = 数组头部（引擎既有约定）。 */
export function abyssCards(state) {
  const pile = abyssPile(state)
  return pile ? [...pile.deck] : []
}

export const abyssSize = state => abyssCards(state).length

/** 当前议程是否要求在深渊里代替遭遇牌库抽牌（条目 flags.abyssMythosReplacement）。 */
export function abyssMythosActive(state) {
  const agenda = (state.agendas || [])[state.agendaIndex || 0]
  return entryFlags(codeOf(agenda)).abyssMythosReplacement === true
}

/** 「凝视宇宙密使超过 15 秒 → 疯狂」的打印口径（条目 flags.cosmicEmissaryGaze）。 */
export function gazeRule(state) {
  const agenda = (state.agendas || [])[state.agendaIndex || 0]
  return {
    active: entryFlags(codeOf(agenda)).cosmicEmissaryGaze === true,
    seconds: 15,
    penalty: 'drivenInsane',
  }
}

export const ABYSS_CARD_KINDS = Object.freeze(['encounter', 'location', 'resident', 'investigator', 'player', 'story'])

/** 深渊里的卡按「抽到时怎么结算」分类（The Abyss 故事卡正面印刷文本）。 */
export function classifyAbyssCard(code) {
  const id = String(code || '')
  if (!id) return 'player'
  if (id === STORY_CARD_CODE) return 'story'
  const card = ALL_CARDS[id]
  if (!card) return 'player'
  if (RESIDENT_ENEMY_CODES.includes(id) || RESIDENT_ASSET_CODES.includes(id) || residentAssetOf(id)) return 'resident'
  if (card.type === 'investigator') return 'investigator'
  if (card.type === 'location') return 'location'
  if (card.type === 'enemy' || card.type === 'treachery') return 'encounter'
  if (card.type === 'scenario' || card.type === 'agenda' || card.type === 'act') return 'story'
  return 'player'
}

/** 初始化深渊：牌库整体洗牌（底部/顶部都是未知）。 */
export function initializeAbyss(state, cards, api = {}) {
  if (typeof api.scenarioDecks?.initialize === 'function') {
    try {
      api.scenarioDecks.initialize(ABYSS_DECK_ID, cards)
      return abyssCards(state)
    } catch {
      // 已初始化（读档重放）时退回本地牌库，保持同一形状。
    }
  }
  const pile = ensureAbyssPile(state)
  pile.deck = shuffleWith(cards, api, state)
  pile.discard = []
  pile.removed = []
  return [...pile.deck]
}

/** 把牌放到深渊顶（引擎：deck 尾部是顶）。 */
export function putOnAbyss(state, codes, api = {}) {
  const list = (Array.isArray(codes) ? codes : [codes]).filter(Boolean).map(String)
  if (!list.length) return 0
  if (typeof api.scenarioDecks?.put === 'function') {
    try {
      api.scenarioDecks.put(ABYSS_DECK_ID, list, { top: true })
      return list.length
    } catch { /* 退回本地牌库 */ }
  }
  const pile = ensureAbyssPile(state)
  pile.deck.push(...list)
  return list.length
}

export function discardToAbyss(state, codes) {
  const list = (Array.isArray(codes) ? codes : [codes]).filter(Boolean).map(String)
  if (entryFlags(STORY_CARD_CODE).discardToTop === true) return putOnAbyss(state, list)
  const pile = ensureAbyssPile(state)
  pile.discard.push(...list)
  return list.length
}

/** 从深渊底揭示 n 张（不移动牌；调用方决定抽取/放回）。 */
export function revealBottomOfAbyss(state, count) {
  const cards = abyssCards(state)
  const n = Math.max(0, Math.min(Number(count) || 0, cards.length))
  const fromBottom = entryFlags(STORY_CARD_CODE).drawFromBottom !== false
  return fromBottom ? cards.slice(0, n) : cards.slice(-n).reverse()
}

/** 把揭示后未抽取的牌放到深渊顶（引擎：push 到数组尾部）。 */
export function returnRevealedToAbyssTop(state, codes, api = {}) {
  const list = (Array.isArray(codes) ? codes : []).map(String)
  if (!list.length) return 0
  removeFromAbyss(state, list)
  return putOnAbyss(state, list, api)
}

export function removeFromAbyss(state, codes) {
  const list = new Set((Array.isArray(codes) ? codes : [codes]).map(String))
  const pile = abyssPile(state)
  if (!pile) return 0
  const kept = pile.deck.filter(code => !list.has(code))
  const removed = pile.deck.length - kept.length
  pile.deck = kept
  return removed
}

/**
 * 从深渊底翻牌直到出现「有遭遇卡背的卡」，抽走它；其余揭示牌放回深渊顶。
 * 返回抽到的卡号（没有遭遇卡时返回 null）。
 */
export function drawEncounterFromAbyss(state, seat, api = {}) {
  if (!abyssMythosActive(state)) {
    info(api, '当前议程没有「在深渊里抽遭遇卡」的强制效果。')
    return null
  }
  if (typeof api.scenarioDecks?.drawBottomMatching === 'function') {
    try {
      const code = api.scenarioDecks.drawBottomMatching(ABYSS_DECK_ID, seat,
        candidate => classifyAbyssCard(candidate) === 'encounter')
      if (code) {
        info(api, `从深渊底抽到遭遇卡 ${code}。`)
        return code
      }
      return null
    } catch { /* 退回本地实现 */ }
  }
  const cards = abyssCards(state)
  const index = cards.findIndex(code => classifyAbyssCard(code) === 'encounter')
  if (index < 0) {
    if (cards.length) info(api, '深渊里没有遭遇卡背的卡。')
    return null
  }
  const [code] = cards.splice(index, 1)
  const revealed = cards.splice(0, index)
  const pile = ensureAbyssPile(state)
  pile.deck = [...revealed, ...cards]
  if (typeof api.drawCard === 'function') api.drawCard(seat, code, { scenarioDeckId: ABYSS_DECK_ID })
  else info(api, `从深渊底抽取遭遇卡 ${code}（交给引擎遭遇管线）。`)
  return code
}

/** 从深渊底抽一张（任意类型）并按其类型结算。 */
export function drawFromAbyss(state, seat, api = {}) {
  const cards = abyssCards(state)
  if (!cards.length) { info(api, '深渊里没有牌。'); return null }
  const code = cards[0]
  const kind = classifyAbyssCard(code)
  if (kind === 'encounter') return { code: drawEncounterFromAbyss(state, seat, api) }
  removeFromAbyss(state, [code])
  resolveAbyssCard(state, seat, code, kind, api)
  return { code, kind }
}

/** The Abyss 卡面的抽牌结算：地点 / 居民 / 真正的调查员 / 玩家卡。 */
export function resolveAbyssCard(state, seat, code, kind = classifyAbyssCard(code), api = {}) {
  const inv = state.investigators?.[seat]
  const rule = entryFlags(STORY_CARD_CODE).revealRules?.[kind] || null
  if (rule) info(api, `深渊揭示 ${code}：按「${rule}」结算。`)
  switch (kind) {
    case 'location':
      return placeAbyssLocation(state, code, seat, api)
    case 'resident':
      return resolveResidentFromAbyss(state, seat, code, api)
    case 'investigator': {
      const owner = state.investigators.find(candidate => resolveTrueSelfCode(state, candidate.seat) === String(code))
      return owner ? returnToTrueSelf(state, owner.seat, api) : null
    }
    case 'story':
      return addStoryAsset(state, code, { controllerSeat: null }, api)
    case 'encounter':
      safeCall(api, 'drawEncounter', seat, { code })
      return code
    default: {
      // 玩家卡：加入所有者手牌（深渊里的玩家卡来自各调查员牌库顶）。
      if (typeof api.addToHand === 'function') api.addToHand(seat, [code])
      else if (inv) (inv.hand ||= []).push(code)
      info(api, `${inv?.name || '调查员'} 从深渊抽到玩家卡 ${code}，加入手牌。`)
      return code
    }
  }
}

/** 居民卡：翻到敌人面，在你所在地点生成并攻击你（不交战），然后弃掉该敌人。 */
export function resolveResidentFromAbyss(state, seat, code, api = {}) {
  const inv = state.investigators?.[seat]
  const enemyCode = RESIDENT_ENEMY_CODES.includes(String(code)) ? String(code) : RESIDENT_ENEMY_BY_ASSET[String(code)]
  if (!enemyCode) return null
  const locationId = inv?.location || START_LOCATION
  const enemy = spawnFateEnemy(state, enemyCode, locationId, api, { engagedSeat: null })
  if (enemy) {
    if (typeof api.attack === 'function') api.attack(enemy, inv)
    else info(api, `「${enemy.name}」显现并攻击 ${inv?.name || '调查员'}（不交战）。`)
    if (typeof api.discardEnemy === 'function') api.discardEnemy(enemy)
    else state.enemies = (state.enemies || []).filter(item => item !== enemy)
  }
  return enemy
}

/** 剧情卡入场（深渊故事卡 / 旧时记忆 / 马奎兹）。 */
export function addStoryAsset(state, code, extra = {}, api = {}) {
  state.storyAssets ||= []
  const existing = state.storyAssets.find(asset => codeOf(asset) === String(code))
  if (existing) return existing
  if (typeof api.storyAsset === 'function') {
    const spawned = api.storyAsset(code, extra)
    if (spawned) return spawned
  }
  const card = ALL_CARDS[code] || {}
  const asset = {
    id: `fate-${code}-${state.storyAssets.length + 1}`,
    code: String(code), originalCode: String(code),
    name: card.nameZh || card.name || String(code),
    location: null, controllerSeat: null, exhausted: false, tokens: 0,
    ...extra,
  }
  state.storyAssets.push(asset)
  return asset
}

export const abyssStoryInPlay = state => (state.storyAssets || [])
  .find(asset => entryFlags(codeOf(asset)).abyssStory === true || codeOf(asset) === STORY_CARD_CODE) || null
export const abyssLocationInPlay = state => (state.locations || [])
  .find(location => location.id === ABYSS_LOCATION_ID) || null

/** 翻「深渊」故事卡到地点面：入场并连到每个镜巢。 */
export function flipAbyssToLocation(state, api = {}) {
  const existing = abyssLocationInPlay(state)
  if (existing) {
    syncConnections(state)
    return existing
  }
  const before = new Set((state.locations || []).map(location => location.id))
  if (typeof api.placeLocation === 'function') api.placeLocation(ABYSS_LOCATION_ID)
  if (before.size === (state.locations || []).length) {
    const def = state.scenario?.locations?.[ABYSS_LOCATION_ID] || LOCATIONS[ABYSS_LOCATION_ID]
    const clues = investigatorCount(state) * 2
    state.locations ||= []
    state.locations.push({ ...structuredClone(def), id: ABYSS_LOCATION_ID, code: ABYSS_LOCATION_CODE,
      originalCode: ABYSS_LOCATION_CODE, revealed: true, clues, maxClues: clues, connections: [] })
  } else {
    const placed = abyssLocationInPlay(state)
    if (placed) { placed.revealed = true; placed.code = ABYSS_LOCATION_CODE; placed.originalCode = ABYSS_LOCATION_CODE }
  }
  syncConnections(state)
  removeFromSetAside(state, STORY_CARD_CODE)
  setFlag(state, 'fateAbyssIsLocation', true)
  info(api, '「深渊」故事卡翻到地点面：深渊与每个镜巢相连。')
  return abyssLocationInPlay(state)
}

// ---------------------------------------------------------------------------
// 宇宙密使（Cosmic Emissary）
// ---------------------------------------------------------------------------

export const emissaryInPlay = state => (state.enemies || [])
  .filter(enemy => entryFlags(codeOf(enemy)).cosmicEmissary === true || isEmissary(enemy))
export const emissaryAt = (state, locationId) => emissaryInPlay(state)
  .find(enemy => enemy.location === locationId) || null
export const shatteredEmissaryAt = (state, locationId) => emissaryInPlay(state)
  .find(enemy => EMISSARY_SHATTERED_CODES.includes(codeOf(enemy)) && enemy.location === locationId) || null

/** 每个密使紧邻的镜巢（阵形内视为位于该镜巢）。 */
export function emissaryPosition(state, enemy) {
  const code = codeOf(enemy)
  const entry = EMISSARY_FORMATION.find(item => item.front === code || item.back === code)
  if (!entry) return null
  return entry.position
}

/** 密使翻到破碎面（打破阵形）：深渊密使放到深渊，其余留在原本相邻的镜巢。 */
export function flipEmissariesToShattered(state, { abyssId = ABYSS_LOCATION_ID } = {}, api = {}) {
  const flips = []
  for (const entry of EMISSARY_FORMATION) {
    const current = (state.enemies || []).find(enemy => codeOf(enemy) === entry.front)
    if (!current) continue
    const destination = entry.label === 'cosmicEmissaryAbyss' ? abyssId : current.location
    state.enemies = (state.enemies || []).filter(enemy => enemy !== current)
    const backCode = entryFlags(entry.front).backFaceCode || entry.back
    const shattered = spawnFateEnemy(state, backCode, destination, api, { ignoreSpawn: true })
    if (shattered) flips.push({ from: entry.front, to: entry.back, location: destination })
  }
  setFlag(state, 'fateFormationBroken', true)
  if (flips.length) info(api, `宇宙密使打破阵形：${flips.length} 个密使翻到破碎面。`)
  return flips
}

/** 「将攻击/躲避成功：本敌人在本轮敌军阶段不攻击」（正面 [[星之彩]] 的强制效果）。 */
export function wardEmissary(state, enemy) {
  if (!enemy) return false
  flagsFor(state).fateWardedEmissaries ||= {}
  flagsFor(state).fateWardedEmissaries[String(enemy.id)] = Number(state.round) || 1
  return true
}

export const isWardedEmissary = (state, enemy) => Number(flagsFor(state).fateWardedEmissaries?.[String(enemy?.id)])
  === (Number(state.round) || 1)

// ---------------------------------------------------------------------------
// 敌人
// ---------------------------------------------------------------------------

function nextFateSerial(state) {
  const flags = flagsFor(state)
  flags.fateEnemySeq = (Number(flags.fateEnemySeq) || 0) + 1
  return flags.fateEnemySeq
}

const enemyDefinition = (state, code) => state.scenario?.enemies?.[code] || ALL_CARDS[code] || {}

function enemyHealthFor(state, def) {
  return def.healthPerInvestigator ? Number(def.health) * investigatorCount(state) : (def.health ?? 1)
}

const keywordOf = (def, key) => Boolean(def[key]) || new RegExp(`\\b${key}\\.`, 'i').test(String(def.textEn || def.text || ''))

/** 生成剧本敌人：优先引擎 api.spawn；直调路径本地建实例。 */
export function spawnFateEnemy(state, code, locationId, api = {}, options = {}) {
  const existing = options.unique ? (state.enemies || []).find(enemy => codeOf(enemy) === String(code)) : null
  if (existing) return existing
  if (typeof api.spawn === 'function' && !options.ignoreSpawn) {
    const spawned = api.spawn(code, locationId, options)
    if (spawned) return spawned
  }
  const def = enemyDefinition(state, code)
  const enemy = {
    id: `fate-${code}-${nextFateSerial(state)}`, code, originalCode: code,
    name: def.nameZh || def.name || code, location: locationId,
    fight: def.fight ?? 0, evade: def.evade ?? 0, health: enemyHealthFor(state, def),
    damage: def.damage || 0, horror: def.horror || 0, traits: [...(def.traits || [])],
    exhausted: options.exhausted === true, engagedSeat: options.engagedSeat ?? null,
    damageTaken: 0, doom: 0, clues: 0, attachments: [],
    victory: Number(def.victory) || 0,
    ...(def.elite || hasTrait(def, 'Elite') ? { elite: true } : {}),
    ...(keywordOf(def, 'hunter') ? { hunter: true } : {}),
    ...(keywordOf(def, 'aloof') ? { aloof: true } : {}),
    ...(keywordOf(def, 'massive') ? { massive: true } : {}),
    ...(keywordOf(def, 'retaliate') ? { retaliate: true } : {}),
    ...(keywordOf(def, 'alert') ? { alert: true } : {}),
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  info(api, `「${enemy.name}」在「${(state.locations || []).find(loc => loc.id === locationId)?.name || locationId}」生成。`)
  return enemy
}

/** 破阵后的密使站在「自己作为地点」的格位：这里只做读点，不改引擎字段。 */
export const emissaryIsSelfLocation = (state, enemy) => isEmissaryCode(codeOf(enemy))

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------

function removeFromSetAside(state, code) {
  const list = zonesFor(state).setAside
  if (!Array.isArray(list)) return false
  const index = list.indexOf(String(code))
  if (index < 0) return false
  list.splice(index, 1)
  return true
}

function pickActs(state, codes) {
  const source = state.scenario?.acts || []
  return codes.map(code => source.find(act => codeOf(act) === code) || ACT_STAGES[codeToStage(code)])
    .filter(Boolean).map(act => structuredClone(act))
}

function codeToStage(code) {
  return code === ACT1_CODE ? 1 : code === ACT2_CODE ? 2
    : code === '10657' ? 3 : code === '10658' ? 4 : code === '10659' ? 5 : 6
}

function pickAgendas(state) {
  const source = state.scenario?.agendas || AGENDAS
  return AGENDA_CODES
    .map(code => source.find(agenda => codeOf(agenda) === code))
    .filter(Boolean).map(agenda => structuredClone(agenda))
}

/** 章节准备：幕/议程牌库、放一边区、计数清零。 */
export function prepareScenario(state, api = {}) {
  flagsFor(state)
  zonesFor(state)
  const flags = flagsFor(state)
  if (!flags.fatePrepared) {
    state.acts = pickActs(state, ACT_CODES)
    state.agendas = pickAgendas(state)
    state.actIndex = 0
    state.agendaIndex = 0
    zonesFor(state).setAside = [...SET_ASIDE_CARDS]
    zonesFor(state).setAsideLocations = [...SET_ASIDE_LOCATION_IDS]
    flags.fateResolution = null
    flags.fateSuccesses = {}
    flags.fateKindling = {}
    flags.fateFireDrawn = []
    flags.fatePrepared = true
    info(api, '山谷的命运：幕牌库（1a/2a）与议程牌库（1a/2a/3a）已建立；幕 3a 四个版本与深渊牌库放一边。')
  }
  return {
    actCodes: [...ACT_CODES],
    agendaCodes: [...AGENDA_CODES],
    setAside: [...SET_ASIDE_CARDS],
    setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  }
}

/** 引擎真实入口：setup.js#preScenarioSetup。 */
export function preScenarioSetup(state, events, api = {}) {
  void events
  prepareScenario(state, api)
  nestAssignment(state, api)
  shatterSelves(state, api)
  setFlag(state, 'fateIntro', 'fateOfTheVale')
  setFlag(state, 'fateStandalone', false)
  info(api, '场景导入：「山谷的命运」。你站在镜巢之间，头顶是血红的月亮。')
  return false
}

/** 引擎真实入口：setup.js#setupLocations（返回要放入场的地点 id）。 */
export function setupLocations(state, events, helper = {}) {
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  if (!flag(state, 'fatePrepared')) prepareScenario(state, api)
  applyNestCodes(state)
  syncConnections(state)
  info(api, '四个镜巢洗牌后未揭示入场；调查员各选一个镜巢作为起始地点。')
  return [...MIRROR_NEST_POSITIONS]
}

/** 引擎真实入口：locations.js#placeLocation。 */
export function locationPlaced(state, location) {
  if (!location) return
  syncConnections(state)
  if (location.id === ABYSS_LOCATION_ID) setFlag(state, 'fateAbyssIsLocation', true)
}

/** 引擎真实入口：setup.js#setupEnemies（宇宙密使阵形）。 */
export function setupEnemies(state, events, helper = {}) {
  const api = helper.api || { info: text => helper.info?.(state, events, text), spawn: null }
  const spawn = helper.spawnEnemy || (api.spawn ? (s, code, loc) => api.spawn(code, loc) : null)
  for (const entry of EMISSARY_FORMATION) {
    if (spawn) spawn(state, entry.front, entry.position, null, true)
    else spawnFateEnemy(state, entry.front, entry.position, api, { ignoreSpawn: true })
  }
  setFlag(state, 'fateFormation', 'colour')
  info(api, '四个宇宙密使以[[星之彩]]面朝上入场，紧邻各自的镜巢（阵形）。')
}

/** 分配起始镜巢：每位调查员一个不同的镜巢。 */
export function assignStartingNests(state, api = {}) {
  const nests = mirrorNestInPlay(state).map(location => location.id)
  if (!nests.length) return {}
  const assignment = {}
  for (const inv of state.investigators || []) {
    const id = nests[inv.seat % nests.length]
    assignment[inv.seat] = id
    if (!inv.location || !nests.includes(inv.location)) inv.location = id
  }
  setFlag(state, 'fateStartingNests', assignment)
  return assignment
}

/** 深渊牌库：各调查员牌库顶 5 张 + 各调查员「真正的」调查员卡。 */
export function seedAbyss(state, api = {}) {
  const trueSelves = Object.values(flagsFor(state).fateTrueSelves || {}).map(String)
  const playerCards = []
  for (const inv of state.investigators || []) {
    const top = (inv.deck || []).slice(0, 5)
    inv.deck = (inv.deck || []).slice(top.length)
    playerCards.push(...top.map(String))
  }
  const cards = [...playerCards, ...trueSelves.filter(code => ALL_CARDS[code])]
  initializeAbyss(state, cards, api)
  flagsFor(state).fateAbyssSeeded = { playerCards: playerCards.length, trueSelves: trueSelves.length,
    encounterCards: (state.encounterDeck || []).length }
  info(api, `深渊牌库：${playerCards.length} 张调查员牌库顶牌 + ${trueSelves.length} 张「真正的」调查员卡；`
    + `遭遇牌库 ${(state.encounterDeck || []).length} 张仍按神话阶段抽取（见 approximation 1）。`)
  return abyssCards(state)
}

/** 引擎真实入口：setup.js#afterDeckSetup。 */
export function afterDeckSetup(state, events, helper = {}) {
  const api = helper.api || { info: text => helper.info?.(state, events, text) }
  if (!flag(state, 'fateNestAssigned')) {
    setFlag(state, 'fateNestAssigned', true)
    assignStartingNests(state, api)
  }
  addStoryAsset(state, STORY_CARD_CODE, { global: true, abyssStory: true }, api)
  if (!abyssPile(state)) seedAbyss(state, api)
  syncConnections(state)
}

/** 直调/单测入口：布置 + 地点 + 密使 + 起始镜巢 + 深渊牌库。 */
export function setupScenario(state, api = {}) {
  prepareScenario(state, api)
  nestAssignment(state, api)
  applyNestCodes(state)
  shatterSelves(state, api)
  state.locations = []
  const placedIds = [...MIRROR_NEST_POSITIONS]
  for (const id of placedIds) {
    const def = state.scenario?.locations?.[id] || LOCATIONS[id]
    const clues = (def?.cluesPerInvestigator ?? 2) * investigatorCount(state)
    state.locations.push({ ...structuredClone(def), id, revealed: false, clues: 0, maxClues: clues,
      connections: [...(LOCATION_CONNECTIONS[id] || [])] })
  }
  syncConnections(state)
  for (const entry of EMISSARY_FORMATION) spawnFateEnemy(state, entry.front, entry.position, api, { ignoreSpawn: true })
  setFlag(state, 'fateFormation', 'colour')
  assignStartingNests(state, api)
  setFlag(state, 'fateNestAssigned', true)
  state.storyAssets ||= []
  addStoryAsset(state, STORY_CARD_CODE, { global: true, abyssStory: true }, api)
  seedAbyss(state, api)
  info(api, `山谷的命运：${placedIds.length} 个镜巢、${EMISSARY_FORMATION.length} 个宇宙密使入场；深渊牌库 ${abyssSize(state)} 张。`)
  return { placedIds, enemies: emissaryInPlay(state).length, abyss: abyssSize(state) }
}

// ---------------------------------------------------------------------------
// 幕间与幕 3a
// ---------------------------------------------------------------------------

/** act2 背面「命运的选择」四个选项及其可用条件（读战役记录）。 */
export function interludeOptions(state) {
  const records = recordsFor(state)
  const canEndThis = (Boolean(records.drMarquesHasAHunch && records.drMarquezHasAPlan)
    || Boolean(records.gideonFinishedTheTaleOfAnnabelleLee))
  const canSaveTheVale = Boolean(records.theHemlocksMadeATruce || records.thePetersFamilyWereReunited)
  const canBurnItAll = Boolean(records.theValeIsFullOfFireworks)
  return [
    { choice: 'letsEndThis', available: canEndThis },
    { choice: 'saveTheVale', available: canSaveTheVale },
    { choice: 'burnItAll', available: canBurnItAll },
    { choice: 'escape', available: true },
  ]
}

/** 幕 2 背面：每位调查员失去全部线索 → 幕间选择。 */
export function resolveInterlude(state, choice, api = {}) {
  const options = interludeOptions(state)
  const picked = options.find(item => item.choice === choice && item.available)
    || options.find(item => item.available)
  if (!picked) return null
  for (const inv of activeInvestigators(state)) inv.clues = 0
  setFlag(state, 'fateInterlude', picked.choice)
  ;(recordsFor(state)).fateInterlude = picked.choice
  const code = ACT3_CODE_BY_CHOICE[picked.choice]
  info(api, `幕间：命运的选择 → ${picked.choice}（幕 3a ${code}）。`)
  if (picked.choice === 'letsEndThis') fateOfTheValeStep1(state, api)
  else if (picked.choice === 'saveTheVale') fateOfTheValeStep2(state, api)
  else if (picked.choice === 'burnItAll') fateOfTheValeStep3(state, api)
  else fateOfTheValeStep4(state, api)
  return { choice: picked.choice, act: code }
}

function advanceToAct3(state, code, api) {
  const act = state.scenario?.acts?.find(item => codeOf(item) === code) || ACT_STAGES[codeToStage(code)]
  if (!act) return null
  state.acts = [...(state.acts || []).slice(0, 2), structuredClone(act)]
  state.actIndex = 2
  info(api, `幕 3a「${code}」入场；其余幕移出游戏。`)
  return act
}

/** Fate of the Vale 1（v.I）：马奎兹入场、深渊翻到地点面、密使翻到破碎面并放置。 */
export function fateOfTheValeStep1(state, api = {}) {
  addStoryAsset(state, DR_MARQUEZ_CODE, { controllerSeat: state.campaign?.leadSeat ?? 0,
    noAllySlot: true, campaignAsset: true }, api)
  flipAbyssToLocation(state, api)
  flipEmissariesToShattered(state, { abyssId: ABYSS_LOCATION_ID }, api)
  advanceToAct3(state, '10657', api)
  return { step: 1 }
}

/** Fate of the Vale 2（v.II）：山谷黑夜面入场、调查员到十字路口、放置居民、密使分布在村庄。 */
export function fateOfTheValeStep2(state, api = {}) {
  setupNightVale(state, api)
  placeResidentsBeneath(state, { onlyEmpty: false }, api)
  placeShatteredEmissariesInVillage(state, api)
  advanceToAct3(state, '10658', api)
  return { step: 2 }
}

/** Fate of the Vale 3（v.III）：直接跳到 5。 */
export function fateOfTheValeStep3(state, api = {}) {
  const result = fateOfTheValeStep5(state, api)
  advanceToAct3(state, '10659', api)
  return { step: 3, ...result }
}

/** Fate of the Vale 4（v.IV）：直接跳到 5。 */
export function fateOfTheValeStep4(state, api = {}) {
  const result = fateOfTheValeStep5(state, api)
  advanceToAct3(state, '10660', api)
  return { step: 4, ...result }
}

/** Fate of the Vale 5（v.III/v.IV 共用）：山谷黑夜面 + 居民 + 密使。 */
export function fateOfTheValeStep5(state, api = {}) {
  setupNightVale(state, api)
  placeResidentsBeneath(state, { onlyEmpty: true }, api)
  placeShatteredEmissariesInVillage(state, api)
  return { step: 5, vale: VALE_LOCATION_IDS.length, residents: (state.scenarioZones?.beneathResidents || []).length }
}

/** 「把每个放一边的 Hemlock Vale 地点以黑夜面放入场；移除镜巢与洞穴；移动调查员到十字路口」。 */
export function setupNightVale(state, api = {}) {
  state.enemies = (state.enemies || []).filter(enemy => !isEmissary(enemy))
  state.locations = (state.locations || []).filter(location =>
    !MIRROR_NEST_POSITIONS.includes(location.id) && !isCaveLocation(location))
  for (const id of VALE_LOCATION_IDS) placeNightLocation(state, id, investigatorCount(state))
  const crossroads = (state.locations || []).find(location => location.id === THE_CROSSROADS_ID)
  for (const inv of activeInvestigators(state)) {
    if (typeof api.moveInvestigator === 'function') api.moveInvestigator(inv.seat, THE_CROSSROADS_ID)
    else inv.location = THE_CROSSROADS_ID
  }
  syncConnections(state)
  setFlag(state, 'fateNightVale', true)
  info(api, `黑夜的山谷：${VALE_LOCATION_IDS.length} 个山谷地点入场，调查员聚集在「${crossroads?.name || '十字路口'}」。`)
  return VALE_LOCATION_IDS
}

/** 居民/狂乱的赴宴者放到地点底下（v.II 全部；v.III/IV 只放空地点）。 */
export function placeResidentsBeneath(state, { onlyEmpty = false } = {}, api = {}) {
  const locations = (state.locations || []).filter(location => location.id !== THE_CROSSROADS_ID)
  const targets = onlyEmpty ? locations.filter(location =>
    !activeInvestigators(state).some(inv => inv.location === location.id)) : locations
  if (!targets.length) { info(api, '没有可以放置居民的地点。'); return 0 }
  const cards = [...RESIDENT_ASSET_CODES, FRENZIED_REVELER_CODE, FRENZIED_REVELER_CODE]
  const placed = []
  cards.forEach((code, index) => {
    const location = targets[index % targets.length]
    location.beneath ||= []
    location.beneath.push(code)
    placed.push({ code, location: location.id })
  })
  zonesFor(state).beneathResidents = placed
  info(api, `${placed.length} 张居民/狂乱的赴宴者卡放到地点底下（敌人面朝上）。`)
  return placed.length
}

/** 破碎的密使分布到村庄：深渊密使在十字路口，其余打乱放到旅舍/集会厅/阿特伍德宅。 */
export function placeShatteredEmissariesInVillage(state, api = {}) {
  const homes = [BOARDING_HOUSE_ID, THE_COMMONS_ID, THE_ATWOOD_HOUSE_ID]
  const others = shuffleWith(EMISSARY_FORMATION.filter(item => item.label !== 'cosmicEmissaryAbyss'), api, state)
  spawnFateEnemy(state, '10662b', THE_CROSSROADS_ID, api, { ignoreSpawn: true })
  others.forEach((entry, index) => {
    spawnFateEnemy(state, entry.back, homes[index % homes.length], api, { ignoreSpawn: true })
  })
  setFlag(state, 'fateFormation', 'shattered')
  info(api, '破碎的宇宙密使在村庄各处生成（深渊密使在十字路口）。')
  return 1 + others.length
}

// ---------------------------------------------------------------------------
// 行动
// ---------------------------------------------------------------------------

const actCodeOf = state => codeOf((state.acts || [])[state.actIndex || 0])
const kindlingAt = (state, locationId) => Number(flagsFor(state).fateKindling?.[locationId]) || 0
const setKindlingAt = (state, locationId, value) => {
  const table = flagsFor(state).fateKindling ||= {}
  table[locationId] = Math.max(0, Number(value) || 0)
  return table[locationId]
}
const abyssSearchedThisAct = state => Number(flagsFor(state).fateAbyssSearchAct) === (Number(state.actIndex) || 0) + 1
const groupClues = state => activeInvestigators(state).reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)

/** 当前幕的目标是否达成（用于「推进幕」行动与自动推进）。 */
export function objectiveStatus(state) {
  const code = actCodeOf(state)
  const count = investigatorCount(state)
  if (code === ACT1_CODE) {
    const flags = flagsFor(state)
    const active = activeInvestigators(state)
    const allTrue = active.length > 0 && active.every(inv =>
      Boolean(flags[`fateTrueSelfReturned:${inv.seat}`] || flags.fateTrueSelfReturned?.[inv.seat]))
    return { satisfied: allTrue, rule: 'trueSelves', detail: '每位调查员都取回「真正的」调查员卡' }
  }
  if (code === ACT2_CODE) {
    const caves = (state.locations || []).filter(location =>
      location.revealed && isCaveLocation(location) && (Number(location.clues) || 0) === 0)
    return { satisfied: caves.length >= 3, rule: 'caves', detail: `已揭示且无线索的洞穴地点 ${caves.length}/3` }
  }
  if (code === '10657') {
    const allAtAbyss = activeInvestigators(state).length > 0
      && activeInvestigators(state).every(inv => inv.location === ABYSS_LOCATION_ID)
    const required = 2 * count
    return { satisfied: allAtAbyss && groupClues(state) >= required,
      rule: 'abyssClues', required, available: groupClues(state),
      detail: `全队在深渊且共同支付 ${required} 线索` }
  }
  if (code === '10658') {
    const residents = (state.enemies || []).some(enemy => RESIDENT_ENEMY_CODES.includes(codeOf(enemy)))
      || (state.locations || []).some(location => (location.beneath || []).some(code => RESIDENT_ASSET_CODES.includes(code)))
    const required = 3 * count
    return { satisfied: !residents && groupClues(state) >= required, rule: 'residents',
      required, available: groupClues(state), detail: '没有居民敌人（场上/地点底下）且共同支付 3/人 线索' }
  }
  if (code === '10659') {
    const fires = (state.locations || []).flatMap(location => location.attachments || [])
      .filter(item => codeOf(item) === FIRE_CODE).length
    return { satisfied: fires >= 5, rule: 'fire', fires, detail: `场上「着火了！」${fires}/5` }
  }
  if (code === '10660') {
    const undefeated = (state.investigators || []).filter(inv => inv && !inv.defeated)
    const allResigned = undefeated.length > 0 && undefeated.every(inv => inv.resigned)
    return { satisfied: allResigned, rule: 'resigned', detail: '所有未被击败的调查员都已撤退' }
  }
  return { satisfied: false, rule: null, detail: '当前幕没有可结算的目标' }
}

const actFlagsOf = state => entryFlags(actCodeOf(state))
const act3Flags = actFlagsOf
const resignSpec = state => {
  const flags = act3Flags(state)
  return {
    keys: flags.resignRememberedKeys || ACT3_RULES.v4ResignRememberedKeys,
    required: Number(flags.resignRequired ?? ACT3_RULES.v4ResignRememberedRequired) || 5,
  }
}
const rememberCount = state => resignSpec(state).keys
  .filter(key => Boolean(recordsFor(state)[key])).length

export function actions(state, inv) {
  const moves = []
  const code = actCodeOf(state)
  const flags = flagsFor(state)
  const here = inv?.location
  // 10669 镜巢：「共同花费 7/人 线索：查找深渊，找出一张卡牌并抽取（团队每个幕一次）」。
  const nest = (state.locations || []).find(location => location.id === here && MIRROR_NEST_POSITIONS.includes(location.id))
  if (nest && codeOf(nest) === '10669') {
    const required = 7 * investigatorCount(state)
    const used = abyssSearchedThisAct(state)
    moves.push({
      action: 'scenarioAction', rule: 'fateAbyssSearch',
      label: `查找深渊（共同花费 ${required} 线索）`,
      ...(used ? { reason: '本幕已经使用过查找深渊（团队每幕一次）', used: true }
        : groupClues(state) < required ? { reason: `需要 ${required} 个线索（当前 ${groupClues(state)}）` } : {}),
    })
  }
  const flagsForAct = act3Flags(state)
  if (code === '10658') {
    const parley = flagsForAct.parley || ACT3_RULES.v2Parley
    moves.push({ action: 'scenarioAction', rule: 'fateResidentParley',
      label: `谈判：弃 ${parley.discardFromHand || 1} 张手牌，检定(${parley.difficulty || 3})带走地点底下的居民` })
  }
  if (code === '10659') {
    moves.push({ action: 'scenarioAction', rule: 'fatePlaceKindling',
      label: '放置引线（花费 1/人 线索）' })
    const location = (state.locations || []).find(item => item.id === here)
    const kindling = kindlingAt(state, here)
    const shroud = Number(location?.shroud) || 0
    const burned = (flags.fateFireDrawn || []).includes(here)
    moves.push({
      action: 'scenarioAction', rule: 'fateDrawFire',
      label: '点燃引线：抽取 1 张放一边的「着火了！」',
      ...(burned ? { reason: '本地点已经点过火（团队每地点一次）', used: true }
        : !state.scenarioZones?.setAside?.includes(FIRE_CODE) ? { reason: '放一边区域没有剩余的「着火了！」' }
        : kindling < shroud ? { reason: `引线数量（${kindling}）少于隐藏值（${shroud}）` } : {}),
    })
  }
  if (code === '10660') {
    const escape = escapeLocationAction(state, inv)
    if (escape) moves.push(escape)
    const remembered = rememberCount(state)
    const resign = resignSpec(state)
    moves.push({
      action: 'scenarioAction', rule: 'fateResign',
      label: '撤退：逃出山谷',
      ...(remembered >= resign.required ? {}
        : { reason: `已知的「记得」条件只有 ${remembered}/${resign.required}` }),
    })
  }
  const status = objectiveStatus(state)
  if (status.satisfied && status.rule !== 'fire') {
    moves.push({ action: 'scenarioAction', rule: 'fateAdvanceAct', label: `推进幕：${status.detail}` })
  }
  return moves
}

export function performAction(state, inv, move, api = {}) {
  if (!move) return false
  switch (move.rule) {
    case 'fateAbyssSearch': {
      const required = 7 * investigatorCount(state)
      if (groupClues(state) < required) return false
      for (const other of activeInvestigators(state)) { other.clues = 0 }
      flagsFor(state).fateAbyssSearchAct = (Number(state.actIndex) || 0) + 1
      const result = drawFromAbyss(state, inv.seat, api)
      info(api, `查找深渊：揭示并结算 ${result?.code || '（空）'}。`)
      return Boolean(result)
    }
    case 'fateResidentParley': return residentParley(state, inv, api)
    case 'fateRevealFromAbyss': return revealFromAbyssReaction(state, inv, move, api)
    case 'fatePlaceKindling': return placeKindling(state, inv, api)
    case 'fateDrawFire': return drawFire(state, inv, api)
    case 'fateEscapeLocation': return actCodeOf(state) === '10660' && performEscapeLocationAction(state, inv, api)
    case 'fateResign': {
      if (actCodeOf(state) !== '10660' || rememberCount(state) < resignSpec(state).required) return false
      if (typeof api.resign === 'function') api.resign(inv.seat)
      else inv.resigned = true
      info(api, `${inv.name} 撤退：逃出了山谷。`)
      return true
    }
    case 'fateAdvanceAct': return advanceCurrentAct(state, api)
    default: return false
  }
}

/** 「弃 1 张手牌；谈判 [意志] 或 [智识](3)：成功则带走你地点底下的居民。」 */
export function residentParley(state, inv, api = {}) {
  if (!inv) return false
  const hand = inv.hand || []
  if (!hand.length) { info(api, '手牌为空，无法谈判。'); return false }
  const location = (state.locations || []).find(item => item.id === inv.location)
  const beneath = (location?.beneath || []).filter(code => RESIDENT_ASSET_CODES.includes(code) || code === FRENZIED_REVELER_CODE)
  if (!beneath.length) { info(api, '你所在地点底下没有居民卡。'); return false }
  const discarded = hand.pop()
  ;(inv.discard ||= []).push(discarded)
  const finish = result => {
    if (!result?.success) { info(api, `谈判失败（${result?.value ?? 0}/3）。`); return false }
    const [card] = beneath.splice(0, 1)
    location.beneath = beneath
    const enemyCode = RESIDENT_ENEMY_BY_ASSET[card] || card
    if (RESIDENT_ENEMY_CODES.includes(card)) {
      const enemy = spawnFateEnemy(state, card, location.id, api, { ignoreSpawn: true, exhausted: true })
      info(api, `谈判成功：「${enemy?.name || card}」横置入场。`)
    } else {
      takeResident(state, inv.seat, card, api)
    }
    return true
  }
  if (typeof api.test === 'function') {
    return api.test(inv.seat, 'willpower', 3, finish) ?? false
  }
  return finish({ success: true, difficulty: 3, value: 3 })
}

/** v.III：「花费 X/人 线索：在你的地点放 X 个资源作为引线」（近似：每次 1/人 线索 → 1 引线）。 */
export function placeKindling(state, inv, api = {}) {
  const kindling = act3Flags(state).kindling || ACT3_RULES.v3Kindling
  const required = kindling.cluesPerKindling === 'perInvestigator' ? investigatorCount(state) : 1
  if (groupClues(state) < required) { info(api, '线索不足，无法放置引线。'); return false }
  for (const other of activeInvestigators(state)) { other.clues = Math.max(0, (other.clues || 0) - required) }
  const total = setKindlingAt(state, inv.location, kindlingAt(state, inv.location) + 1)
  info(api, `在「${inv.location}」放置 1 个引线（当前 ${total}）。`)
  return true
}

/** v.III：「引线 ≥ 隐藏值：移除全部引线，抽取 1 张放一边的『着火了！』（团队每地点一次）」。 */
export function drawFire(state, inv, api = {}) {
  const location = (state.locations || []).find(item => item.id === inv?.location)
  if (!location) return false
  const kindling = kindlingAt(state, location.id)
  const shroud = Number(location.shroud) || 0
  if (kindling < shroud) return false
  if ((flagsFor(state).fateFireDrawn || []).includes(location.id)) return false
  const fireCode = act3Flags(state).fireTreacheryCode || FIRE_CODE
  if (!removeFromSetAside(state, fireCode)) return false
  setKindlingAt(state, location.id, 0)
  ;(flagsFor(state).fateFireDrawn ||= []).push(location.id)
  api.drawEncounter?.(inv.seat, { code: fireCode })
  info(api, `「${location.name || location.id}」被点燃：抽取「着火了！」（${fireCode}）。`)
  return true
}

/** 拿取居民（剧情资产）：优先 api.addAsset，其次调查员支援区。 */
export function takeResident(state, seat, code, api = {}) {
  const inv = state.investigators?.[seat]
  if (!inv) return null
  removeFromSetAside(state, code)
  if (typeof api.addAsset === 'function') {
    const asset = api.addAsset(seat, code)
    if (asset) return asset
  }
  const card = ALL_CARDS[code] || {}
  const asset = {
    id: `fate-resident-${code}-${seat}`, code: String(code), originalCode: String(code),
    name: card.nameZh || card.name || String(code), exhausted: false, damage: 0, horror: 0,
    controllerSeat: seat, storyAsset: true, ally: true,
  }
  ;(inv.assets ||= []).push(asset)
  info(api, `${inv.name} 取得居民「${asset.name}」。`)
  return asset
}

// ---------------------------------------------------------------------------
// 回合 / 轮末
// ---------------------------------------------------------------------------

const successKey = actionKind => {
  const kind = String(actionKind || '')
  if (['fight', 'fightEnemy'].includes(kind)) return 'fight'
  if (['evade', 'evadeEnemy'].includes(kind)) return 'evade'
  if (['investigate'].includes(kind)) return 'investigate'
  return null
}

/** 记录本轮成功（镜巢的回合末强制效果要读它）。 */
export function afterTest(state, inv, result, api = {}, context = {}) {
  if (!inv || !result?.success) return false
  const kind = successKey(context?.test?.actionKind ?? state.skillTest?.actionKind)
  if (kind) {
    const table = flagsFor(state).fateSuccesses ||= {}
    table[kind] ||= {}
    table[kind][inv.seat] = true
  }
  // 幕 1/2 的 [reaction]「在[[巢穴]]地点检定成功后按超过难度点数揭示深渊底部」：
  // 引擎没有卡面反应窗口的条目级读点，这里按条目 flags.lairReaction 自动结算。
  const reaction = actFlagsOf(state).lairReaction
  const location = (state.locations || []).find(item => item.id === inv.location)
  if (reaction && location && (location.traits || []).some(trait => String(trait).toLowerCase() === String(reaction.trait).toLowerCase())) {
    const successBy = Number(result.successBy ?? (result.value - result.difficulty))
    if (successBy > 0 && (state.currentSeat == null || state.currentSeat === inv.seat)) {
      revealFromAbyssReaction(state, inv, { successBy }, api)
    }
  }
  return true
}

/** 幕 1/2 的深渊反应：揭示底部 n 张，抽 1 张，其余放到深渊顶。 */
export function revealFromAbyssReaction(state, inv, move = {}, api = {}) {
  const count = Math.max(1, Number(move.successBy) || 1)
  const revealed = revealBottomOfAbyss(state, count)
  if (!revealed.length) { info(api, '深渊里没有牌可揭示。'); return false }
  const [first, ...rest] = revealed
  abyssPile(state).deck.splice(0, revealed.length)
  putOnAbyss(state, rest, api)
  const kind = classifyAbyssCard(first)
  resolveAbyssCard(state, inv.seat, first, kind, api)
  info(api, `${inv.name} 在巢穴检定成功：从深渊底部揭示 ${revealed.length} 张，抽走 ${first}，其余放到深渊顶。`)
  return true
}

const succeededThisRound = (state, kind, seat) => Boolean(flagsFor(state).fateSuccesses?.[kind]?.[seat])

/** 镜巢回合末强制效果（10666 攻击 / 10667 躲避 / 10668 调查 / 10669 随机弃牌）。 */
export function turnEnded(state, inv, api = {}) {
  if (!inv) return false
  const location = (state.locations || []).find(item => item.id === inv.location)
  if (!location || !MIRROR_NEST_POSITIONS.includes(location.id)) return false
  const code = codeOf(location)
  if (entryFlags(code).mirrorNest !== true) return false
  const ask = (options, prompt) => {
    if (typeof api.choose === 'function') return api.choose({ kind: 'choice', seat: inv.seat, prompt, options })
    return options.at(-1).id
  }
  const rule = entryFlags(code).turnEnd || {}
  if (!rule.require) {
    discardRandomFromHand(state, inv, 1, api)
    info(api, `${inv.name} 在镜巢结束回合：随机弃掉 1 张手牌。`)
    return true
  }
  const required = String(rule.require)
  if (succeededThisRound(state, required, inv.seat)) return false
  const options = []
  if ((Number(inv.clues) || 0) > 0) options.push({ id: 'clue', label: '放置 1 个线索在镜巢上' })
  if ((inv.hand || []).length) options.push({ id: 'discard', label: '随机弃掉 1 张手牌' })
  if (!options.length) return false
  const choice = ask(options, '镜巢：你必须把 1 个线索放在这里，或随机弃 1 张手牌。')
  if (choice === 'clue' || !options.some(item => item.id === 'discard')) {
    inv.clues = Math.max(0, (Number(inv.clues) || 0) - 1)
    location.clues = (Number(location.clues) || 0) + 1
    info(api, `${inv.name} 在镜巢结束回合：放置 1 个线索。`)
  } else {
    discardRandomFromHand(state, inv, 1, api)
    info(api, `${inv.name} 在镜巢结束回合：随机弃掉 1 张手牌。`)
  }
  return true
}

export function discardRandomFromHand(state, inv, count, api = {}) {
  const hand = inv?.hand || []
  if (!hand.length) return []
  if (typeof api.discardRandom === 'function') return api.discardRandom(inv.seat, count)
  const dropped = hand.splice(0, Math.min(count, hand.length))
  ;(inv.discard ||= []).push(...dropped)
  return dropped
}

/** 引擎真实入口：phases.js#roundEnded。 */
export function roundEnded(state, api = {}) {
  flagsFor(state).fateSuccesses = {}
  const status = objectiveStatus(state)
  if (status.satisfied && ['caves', 'fire', 'resigned'].includes(status.rule)) {
    info(api, `轮末结算：${status.detail} → 自动推进幕。`)
    advanceCurrentAct(state, api)
  }
  return false
}

function advanceCurrentAct(state, api = {}) {
  const act = (state.acts || [])[state.actIndex || 0]
  if (!act) return false
  if (typeof api.advanceAct === 'function') { api.advanceAct(); return true }
  actReveal(state, act, api)
  state.actIndex = actIndexAfterAdvance(state, act) ?? ((Number(state.actIndex) || 0) + 1)
  return true
}

/** 引擎真实入口：movement.js#locationEntered。 */
export function locationEntered(state, inv, location, api = {}) {
  if (!inv || location?.id !== ABYSS_LOCATION_ID) return false
  if (entryFlags(codeOf(location)).entryKillsIfCards !== true && codeOf(location) !== ABYSS_LOCATION_CODE) return false
  if (!abyssSize(state)) return false
  info(api, `${inv.name} 进入深渊：深渊里还有牌，调查员阵亡。`)
  if (typeof api.kill === 'function') api.kill(inv.seat)
  else inv.defeated = true
  return true
}

// ---------------------------------------------------------------------------
// 破碎自我（10661）的卡面读点
// ---------------------------------------------------------------------------

const shatteredFlags = () => entryOf(SHATTERED_SELF_CODE)?.flags || {}

/** 「你的手牌上限减少 3 张。」（引擎 api-misc.js#handSizePenalty） */
export function handSizePenalty(state, inv) {
  if (!isShattered(state, inv)) return 0
  if (shatteredFlags().shatteredSelf !== true) return 0
  return Number(shatteredFlags().handSizePenalty ?? 3) || 0
}

/** 「X 为你的手牌数（最多为 5）。」——破碎自我的四项技能都是 X。 */
export function statModifier(state, inv, skill) {
  if (!isShattered(state, inv)) return 0
  if (!['willpower', 'intellect', 'combat', 'agility'].includes(String(skill))) return 0
  const max = Number(shatteredFlags().handSizeValueMax ?? 5) || 5
  const hand = Math.min(max, (inv.hand || []).length)
  return hand - (Number(inv[skill]) || 0)
}

/** 破碎自我的旧印：+2（「你可以抽取 1 张卡牌」没有结局钩子，披露为近似）。 */
export function elderSign(state, inv) {
  if (!isShattered(state, inv)) return null
  return { delta: Number(shatteredFlags().elderSignDelta ?? 2) || 2 }
}

// ---------------------------------------------------------------------------
// 敌人钩子
// ---------------------------------------------------------------------------

/** 正面 [[星之彩]] 密使没有生命值：不能受到伤害。 */
export function enemyDamageAllowed(state, enemy) {
  void state
  if (entryFlags(codeOf(enemy)).cannotBeDamaged === true) return false
  if (EMISSARY_COLOUR_CODES.includes(codeOf(enemy))) return false
  return true
}

/** 本轮攻击/躲避成功过的密使在敌军阶段不攻击。 */
export function enemyCannotAttack(state, enemy) {
  return isWardedEmissary(state, enemy)
}

/** 水晶仿体：战斗/躲避时 X = 你手牌数（最多 5），否则 6。 */
export function enemyStatModifier(state, enemy, stat) {
  const flags = entryFlags(codeOf(enemy))
  if (flags.crystalMimic !== true) return 0
  if (!flags[`${stat}X`]) return 0
  if (!['fight', 'evade'].includes(String(stat))) return 0
  const printed = stat === 'fight' ? Number(enemy.fight) || 0 : Number(enemy.evade) || 0
  const frame = state.skillTest
  const active = frame && ['fight', 'fightEnemy', 'evade', 'evadeEnemy'].includes(String(frame.actionKind || ''))
  const base = Number(flags.defaultX ?? 6) || 6
  if (!active) return base - printed
  const seat = Number.isInteger(frame.seat) ? frame.seat : state.currentSeat
  const hand = (state.investigators?.[seat]?.hand || []).length
  return Math.min(Number(flags.handSizeMax ?? 5) || 5, hand) - printed
}

/** 水晶仿体攻击后：随机弃 1 张手牌。 */
export function enemyAttackResolved(state, enemy, inv, api = {}) {
  const count = Number(entryFlags(codeOf(enemy)).attackDiscard) || 0
  if (!count) return false
  discardRandomFromHand(state, inv, count, api)
  info(api, `水晶仿体攻击后：${inv?.name || '调查员'} 随机弃掉 1 张手牌。`)
  return true
}

/** 破碎的深渊密使被击败：每位调查员检定[意志](100)，失败者被吞噬（阵亡）。 */
export function enemyDefeated(state, enemy, api = {}) {
  const spec = entryFlags(codeOf(enemy)).defeatTest
  if (!spec) return false
  const difficulty = Number(spec.difficulty) || 100
  for (const inv of activeInvestigators(state)) {
    const resolve = result => {
      if (result?.success) return
      if (typeof api.kill === 'function') api.kill(inv.seat)
      else inv.defeated = true
      info(api, `${inv.name} 在「${enemy.name}」被击败时检定失败：被吞噬（阵亡）。`)
    }
    if (typeof api.test === 'function') api.test(inv.seat, spec.skill || 'willpower', difficulty, resolve)
    else resolve({ success: false, difficulty, value: 0 })
  }
  return false
}

/** 战斗/躲避成功对密使：不造成伤害/不横置，改为本轮不攻击。 */
export function enemyAttackedSuccessfully(state, inv, enemy, api = {}) {
  void inv
  if (entryFlags(codeOf(enemy)).wardOnFightEvade !== true
    && !EMISSARY_COLOUR_CODES.includes(codeOf(enemy))) return false
  wardEmissary(state, enemy)
  info(api, `「${enemy.name}」本轮敌军阶段不攻击（未受到伤害/未横置）。`)
  return true
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------

function actIndexAfterAdvance(state, previous) {
  if (codeOf(previous) === ACT2_CODE && ACT3_VARIANT_CODES.includes(actCodeOf(state))) return state.actIndex
}

/** 引擎真实入口：reveal.js#actReveal（结算幕背面）。 */
export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === ACT1_CODE) return act1Back(state, api)
  if (code === ACT2_CODE) return act2Back(state, api)
  if (code === '10657') return resolutionOf('resolution1', state, api, { allowChoice: true })
  if (['10658', '10659', '10660'].includes(code)) {
    return resolutionOf(entryFlags(code).back || 'resolution3', state, api)
  }
  return false
}

/** 幕 1 背面「Ex Nihilo」：补线索、划掉蕾切尔嬷嬷、把被划掉的居民与洞穴洗入深渊、可选控制居民。 */
function act1Back(state, api = {}) {
  for (const location of state.locations || []) {
    if (!location.revealed) continue
    const reveal = Number(location.cluesPerInvestigator) * investigatorCount(state)
    const value = Number.isFinite(Number(location.maxClues)) && Number(location.maxClues) > 0
      ? Number(location.maxClues) : reveal
    if (value > (Number(location.clues) || 0)) location.clues = value
  }
  recordsFor(state).motherRachelCrossedOut = true
  setFlag(state, 'fateCrossedOutResidents', [...new Set(['10693', ...(recordsFor(state).crossedOutResidents || [])])])
  const crossed = (flagsFor(state).fateCrossedOutResidents || [])
    .flatMap(asset => [asset, RESIDENT_ENEMY_BY_ASSET[asset]].filter(Boolean))
  const caves = [...CAVE_LOCATION_CODES]
  putOnAbyss(state, [...crossed, ...caves], api)
  zonesFor(state).setAside = (zonesFor(state).setAside || []).filter(code => !crossed.includes(code))
  // 「每位调查员可以控制 1 名关系等级 ≥4 的居民」：关系等级从战役记录读。
  let taken = 0
  for (const inv of activeInvestigators(state)) {
    const candidate = RESIDENT_ASSET_CODES.find(code => residentRelationship(state, code) >= 4
      && (zonesFor(state).setAside || []).includes(code))
    if (!candidate) continue
    takeResident(state, inv.seat, candidate, api)
    taken += 1
  }
  setFlag(state, 'fateAct1Back', true)
  info(api, `幕 1 背面：地点补满线索；蕾切尔嬷嬷被划掉；${crossed.length} 张居民/敌人面与 ${caves.length} 个洞穴洗入深渊；${taken} 位调查员取得居民。`)
  return true
}

function residentRelationship(state, code) {
  const record = recordsFor(state).residentRelationships || {}
  return Number(record[code] || record[residentAssetOf(code) || code] || 0) || 0
}

/** 幕 2 背面「命运的选择」：全员失去线索 → 幕间四选项。 */
function act2Back(state, api = {}) {
  if (!entryFlags(ACT2_CODE).interlude) return false
  for (const inv of activeInvestigators(state)) inv.clues = 0
  const options = interludeOptions(state)
  const offered = options.filter(item => item.available).map(item => item.choice)
  setFlag(state, 'fateInterludeOptions', offered)
  const choice = typeof api.choose === 'function'
    ? api.choose({ kind: 'story', seat: state.campaign?.leadSeat ?? 0, source: 'fateInterlude',
      prompt: '命运的选择：你们要怎么做？',
      options: offered.map(id => ({ id, label: id })) })
    : offered[offered.length - 1]
  const picked = offered.includes(choice) ? choice : offered[offered.length - 1]
  setFlag(state, 'fateInterludeChoice', picked)
  resolveInterlude(state, picked, api)
  return true
}

function resolutionOf(key, state, api, { allowChoice = false } = {}) {
  if (allowChoice) {
    const back = entryFlags('10657').back || {}
    const shardCode = back.requiresPrismaticShard || PRISMATIC_SHARD_CODE
    const shard = (state.investigators || []).some(inv => (inv.assets || []).some(asset => codeOf(asset) === shardCode))
      || (state.storyAssets || []).some(asset => codeOf(asset) === shardCode)
    const choices = back.choices || ['resolution1', 'resolution2']
    const labels = { resolution1: '让马奎兹博士执行她的计划', resolution2: '自己动手' }
    const options = choices.map(id => ({ id, label: labels[id] || id }))
      .filter(option => option.id !== 'resolution2' || shard)
    const picked = typeof api.choose === 'function'
      ? api.choose({ kind: 'story', seat: state.campaign?.leadSeat ?? 0, source: 'fateAct3V1',
        prompt: '幕 3a v.I 背面：由谁阻止深渊？', options })
      : 'resolution1'
    const finalKey = options.some(item => item.id === picked) ? picked : 'resolution1'
    info(api, `幕 3a v.I 背面 → ${finalKey}。`)
    if (typeof api.finish === 'function') api.finish(finalKey)
    else setFlag(state, 'fatePendingResolution', finalKey)
    return true
  }
  info(api, `幕 3a 背面 → ${key}。`)
  if (typeof api.finish === 'function') api.finish(key)
  else setFlag(state, 'fatePendingResolution', key)
  return true
}

/** 引擎真实入口：phases.js#agendaReveal（结算议程背面）。 */
export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === AGENDA_CODES[0]) return agenda1Back(state, api)
  if (code === AGENDA_CODES[1]) return agenda2Back(state, api)
  if (code === AGENDA_CODES[2]) {
    for (const inv of activeInvestigators(state)) {
      if (typeof api.kill === 'function') api.kill(inv.seat)
      else inv.defeated = true
    }
    info(api, '议程 3 背面：所有调查员被星之彩吞噬（阵亡）。')
    if (typeof api.finish === 'function') api.finish(NO_RESOLUTION)
    else setFlag(state, 'fatePendingResolution', NO_RESOLUTION)
    return true
  }
  return false
}

function agendaSkillTest(state, api, { skills, label, kind, difficulty = 4 }) {
  let failed = 0
  for (const inv of activeInvestigators(state)) {
    const resolve = result => {
      const by = Math.max(0, (Number(result?.difficulty) || difficulty) - (Number(result?.value) || 0))
      if (result?.success || !by) return
      for (let index = 0; index < by; index += 1) {
        if (kind === 'deck') {
          const top = (inv.deck || []).shift()
          if (top) putOnAbyss(state, [top])
        } else if (kind === 'damage') {
          if (typeof api.damage === 'function') api.damage(inv.seat, 1)
          else inv.damage = (Number(inv.damage) || 0) + 1
        } else {
          if (typeof api.horror === 'function') api.horror(inv.seat, 1)
          else inv.horror = (Number(inv.horror) || 0) + 1
        }
      }
      failed += by
    }
    if (typeof api.test === 'function') api.test(inv.seat, skills, difficulty, resolve)
    else resolve({ success: true, difficulty, value: difficulty })
  }
  info(api, `${label}：${failed} 点失败已结算。`)
}

/** 议程 1 背面「Dissolving Mind」：意志/智识(4)，每失败 1 点 → 1 恐惧或把牌库顶洗入深渊。 */
function agenda1Back(state, api = {}) {
  const spec = entryFlags(AGENDA_CODES[0]).backTest || {}
  agendaSkillTest(state, api, {
    skills: (spec.skills || ['willpower', 'intellect'])[0],
    label: `议程 1 背面（${(spec.skills || ['willpower']).join('/')} ${spec.difficulty || 4}）`,
    kind: String(spec.penalty || '').startsWith('damage') ? 'damage' : 'horror',
    difficulty: Number(spec.difficulty) || 4,
  })
  return true
}

/** 议程 2 背面「Dissolving Self」：战斗/敏捷(4)，每失败 1 点 → 1 伤害或把牌库顶洗入深渊。 */
function agenda2Back(state, api = {}) {
  const spec = entryFlags(AGENDA_CODES[1]).backTest || {}
  agendaSkillTest(state, api, {
    skills: (spec.skills || ['combat', 'agility'])[0],
    label: `议程 2 背面（${(spec.skills || ['combat']).join('/')} ${spec.difficulty || 4}）`,
    kind: String(spec.penalty || '').startsWith('horror') ? 'horror' : 'damage',
    difficulty: Number(spec.difficulty) || 4,
  })
  return true
}

/** 引擎真实入口：act-agenda.js#checkObjectives（幕 1 的「真正的调查员卡」等被动目标）。 */
export function checkObjectives(state, api = {}) {
  const status = objectiveStatus(state)
  if (!status.satisfied) return false
  if (['trueSelves'].includes(status.rule)) {
    info(api, `幕目标达成：${status.detail}。`)
    advanceCurrentAct(state, api)
    return true
  }
  if (['resigned'].includes(status.rule)) {
    info(api, `幕目标达成：${status.detail}。`)
    advanceCurrentAct(state, api)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------

export function resolveChaosToken(state, inv, token) {
  return fateChaosToken(state, inv, token)
}

export function chaosTokenValue(state, tokenFace, inv) {
  return fateChaosTokenValue(state, tokenFace, inv)
}

/** 破碎密使的「在该地点揭示指定标记」反应：要么本次检定自动失败，要么该敌人攻击你。 */
function shatteredEmissaryReaction(state, inv, token, api) {
  const enemy = shatteredEmissaryAt(state, inv?.location)
  if (!enemy) return false
  const reaction = entryFlags(codeOf(enemy)).tokenReaction
  if (!reaction || String(reaction.token) !== String(token)) return false
  const options = [{ id: 'autoFail', label: '本次检定自动失败' }, { id: 'attack', label: `「${enemy.name}」攻击你` }]
  const choice = typeof api.choose === 'function'
    ? api.choose({ kind: 'choice', seat: inv.seat, source: codeOf(enemy), prompt: '选择一项。', options })
    : 'attack'
  if (choice === 'autoFail') {
    setFlag(state, 'fateAutoFail', { seat: inv.seat, round: Number(state.round) || 1 })
    info(api, `${inv.name} 选择让本次检定自动失败。`)
    return true
  }
  if (typeof api.attack === 'function') api.attack(enemy, inv)
  info(api, `「${enemy.name}」攻击 ${inv.name}。`)
  return true
}

/** 引擎真实入口：skill-effects.js#applyTokenFx → 场景标记追加效果。 */
export function applyTokenEffect(state, inv, effect, api = {}) {
  if (!inv || !effect) return false
  const mode = effect.mode || ''
  switch (String(effect.token || '')) {
    case 'cultist': {
      // 破碎密使（10664b）的「揭示 [cultist] → 自动失败或它攻击你」先结算，再弃牌。
      shatteredEmissaryReaction(state, inv, 'cultist', api)
      discardRandomFromHand(state, inv, 1, api)
      info(api, `${inv.name} 因 [cultist] 随机弃掉 1 张手牌。`)
      return true
    }
    case 'tablet': {
      shatteredEmissaryReaction(state, inv, 'tablet', api)
      const doomOnSelf = mode === 'hard' ? -3 : 0
      const choice = typeof api.choose === 'function'
        ? api.choose({ kind: 'choice', seat: inv.seat, source: '10651',
          prompt: '是否将 1 个毁灭放在你的调查员卡上？',
          options: [{ id: 'doom', label: `放置 1 个毁灭（本次修正改为 ${doomOnSelf}）` },
            { id: 'skip', label: '不放置' }] })
        : 'skip'
      if (choice !== 'doom') return false
      if (typeof api.placeDoomOnInvestigator === 'function') api.placeDoomOnInvestigator(inv.seat, 1)
      else inv.doom = (Number(inv.doom) || 0) + 1
      info(api, `${inv.name} 在调查员卡上放置 1 个毁灭（[tablet] 修正视为 ${doomOnSelf}）。`)
      return true
    }
    case 'elderthing':
      return shatteredEmissaryReaction(state, inv, 'elderthing', api)
    default:
      return false
  }
}

/** 碎裂/升华/狂喜的标记反应之外，破碎密使的 token 也要在 cultist/tablet 上触发。 */
export function afterTokenReveal(state, inv, token, api = {}) {
  return shatteredEmissaryReaction(state, inv, token, api)
}

/** 引擎真实入口：tests.js 的自动失败判定。 */
export function testAutoFail(state, inv, context = {}) {
  const drawn = (context.drawn || []).map(String)
  const autoFail = flagsFor(state).fateAutoFail
  if (autoFail && autoFail.seat === inv?.seat && autoFail.round === (Number(state.round) || 1)) {
    clearFlag(state, 'fateAutoFail')
    return true
  }
  if (isHardSide(state) && drawn.includes('elderthing') && againstCosmicEmissary(state)) return true
  return false
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------

const RESOLUTION_CONFIG = Object.freeze({
  resolution1: { record: 'drMarquezSacrificedHerselfForTheVale', trauma: [1, 1], bonus: 5, crossOut: 'uncontrolled', xp: 'cosmicEmissary' },
  resolution2: { record: 'theInvestigatorsSacrificedThemselvesForTheVale', trauma: [0, 0], bonus: 0, crossOut: null, killed: true },
  resolution3: { record: 'theValeWasSaved', trauma: [2, 2], bonus: 3, crossOut: 'victory', xp: 'savedTheVale' },
  resolution4: { record: 'theValeBurned', trauma: [2, 2], bonus: 3, crossOut: 'uncontrolled', xp: 'eradicatedTheColour' },
  resolution5: { record: 'theInvestigatorsBarelySurvivedTheFeastOfHemlockVale', trauma: [3, 3], bonus: 2, crossOut: 'uncontrolled', xp: 'survivedTheFeast' },
})

/** 结局：写剧本日志、创伤、经验，返回 { award, bonus }。 */
export function resolution(state, key, events = [], api = {}) {
  void events
  const finalKey = RESOLUTION_KEYS.includes(String(key)) ? String(key) : NO_RESOLUTION
  const records = recordsFor(state)
  records.fateOfTheValeResolution = finalKey
  setFlag(state, 'fateResolution', finalKey)
  let bonus = 0
  if (finalKey === NO_RESOLUTION) {
    records.theInvestigatorsBecameTheTrueFeastOfHemlockVale = true
    for (const inv of state.investigators || []) {
      if (typeof api.kill === 'function') api.kill(inv.seat)
      else inv.defeated = true
    }
    state.campaign ||= {}
    state.campaign.lost = true
    info(api, '无结局：调查员成为铁杉谷真正的盛宴（全员阵亡，战役失败）。')
    return { award: true, bonus: 0 }
  }
  const config = RESOLUTION_CONFIG[finalKey]
  if (!config) return { award: false, bonus: 0 }
  records[config.record] = true
  if (config.killed) {
    for (const inv of state.investigators || []) {
      if (typeof api.kill === 'function') api.kill(inv.seat)
      else inv.defeated = true
    }
    records.theInvestigatorsWereDevoured = true
  }
  if (config.crossOut === 'uncontrolled') records.crossedOutResidents = crossOutUncontrolledResidents(state)
  if (config.crossOut === 'victory') records.crossedOutResidents = crossOutResidentsInVictory(state)
  const [physical, mental] = config.trauma
  if (physical || mental) {
    for (const inv of state.investigators || []) {
      if (physical) safeCall(api, 'addTrauma', inv.seat, 'physical', physical)
      if (mental) safeCall(api, 'addTrauma', inv.seat, 'mental', mental)
    }
  }
  if (finalKey === 'resolution1') {
    // 「如果罗莎·马奎兹在调查员牌组中，将其移出牌组。」
    records.drMarquezRemovedFromDecks = true
  }
  bonus = config.bonus
  records.fateOfTheValeXpBonus = bonus
  records.xp = (Number(records.xp) || 0) + bonus
  info(api, `结局 ${finalKey}：奖励经验 ${bonus}；${physical}/${mental} 点创伤。`)
  return { award: true, bonus }
}

function crossOutUncontrolledResidents(state) {
  const controlled = new Set()
  for (const inv of state.investigators || []) {
    for (const asset of inv.assets || []) {
      const code = codeOf(asset)
      if (RESIDENT_ASSET_CODES.includes(code)) controlled.add(code)
    }
  }
  const crossed = RESIDENT_ASSET_CODES.filter(code => !controlled.has(code))
  recordsFor(state).crossedOutResidents = crossed
  return crossed
}

function crossOutResidentsInVictory(state) {
  const victory = new Set((state.victoryDisplay || []).map(entry => codeOf(entry)))
  const crossed = RESIDENT_ASSET_CODES.filter(code => victory.has(code))
  recordsFor(state).crossedOutResidents = crossed
  return crossed
}

export function scenarioResolution(state, resolutionKey = 'resolution1', api = {}) {
  resolution(state, resolutionKey, [], api)
  const records = recordsFor(state)
  return {
    resolution: records.fateOfTheValeResolution,
    crossedOut: records.crossedOutResidents || [],
    bonus: records.fateOfTheValeXpBonus || 0,
    trueSelves: flagsFor(state).fateTrueSelves || {},
  }
}

// ---------------------------------------------------------------------------
// 诡计（10672 升华 / 10673 碎裂 / 10674 狂喜）
// ---------------------------------------------------------------------------

/** 「最近的宇宙密使」。 */
export function nearestEmissaryTo(state, inv) {
  const emissaries = emissaryInPlay(state)
  if (!emissaries.length) return null
  const here = inv?.location
  return emissaries.find(enemy => enemy.location === here) || emissaries[0]
}

/** 「把一个非剧情支援放到深渊顶」。 */
export function placeAssetOnAbyss(state, seat, assetId, api = {}) {
  const inv = state.investigators?.[seat]
  if (!inv) return null
  const assets = inv.assets || []
  const index = assetId ? assets.findIndex(asset => asset.id === assetId) : 0
  if (index < 0 || !assets.length) return null
  const [asset] = assets.splice(index, 1)
  putOnAbyss(state, [codeOf(asset)], api)
  info(api, `${inv.name} 将支援「${asset.name || codeOf(asset)}」放到深渊顶。`)
  return asset
}

const highestPrintedCostAsset = inv => (inv?.assets || []).slice()
  .sort((left, right) => (Number(ALL_CARDS[codeOf(right)]?.cost) || 0) - (Number(ALL_CARDS[codeOf(left)]?.cost) || 0))[0] || null

function takeHorror(state, inv, amount, api) {
  if (!inv) return
  if (typeof api.horror === 'function') api.horror(inv.seat, amount)
  else inv.horror = (Number(inv.horror) || 0) + amount
  info(api, `${inv.name} 承受 ${amount} 点恐惧。`)
}

function takeDamage(state, inv, amount, api) {
  if (!inv) return
  if (typeof api.damage === 'function') api.damage(inv.seat, amount)
  else inv.damage = (Number(inv.damage) || 0) + amount
  info(api, `${inv.name} 承受 ${amount} 点伤害。`)
}

const ask = (api, request, fallback) => (typeof api.choose === 'function' ? api.choose(request) : fallback)

const runTest = (api, seat, skill, difficulty, finish) => {
  if (typeof api.test === 'function') {
    api.test(seat, skill, difficulty, finish)
    return true
  }
  finish({ success: false, difficulty, value: 0 })
  return true
}

/** 10674 狂喜：检定[智识](4)。要么承受 2 点恐惧，要么放一个非剧情支援到深渊顶；失败则两者都做。 */
export function euphoriaEvent(state, payload = {}, api = {}) {
  const inv = state.investigators?.[payload.seat ?? 0]
  if (!inv) return false
  const spec = entryFlags('10674').test || {}
  return runTest(api, inv.seat, spec.skill || 'intellect', Number(spec.difficulty) || 4, result => {
    const asset = (inv.assets || []).find(item => codeOf(item))
    const options = [{ id: 'horror', label: '承受 2 点恐惧' }]
    if (asset) options.push({ id: 'asset', label: '把一个非剧情支援放到深渊顶' })
    const choice = ask(api, { kind: 'choice', seat: inv.seat, source: '10674',
      prompt: '选择一项。', options }, 'horror')
    if (result?.success) {
      if (choice === 'asset') placeAssetOnAbyss(state, inv.seat, asset?.id, api)
      else takeHorror(state, inv, 2, api)
    } else {
      takeHorror(state, inv, 2, api)
      if (asset) placeAssetOnAbyss(state, inv.seat, asset.id, api)
    }
    return true
  })
}

/** 10673 碎裂：检定[敏捷](4)。失败时二选一：印刷费用最高的支援放到深渊顶；或最近的密使攻击你。 */
export function fragmentationEvent(state, payload = {}, api = {}) {
  const inv = state.investigators?.[payload.seat ?? 0]
  if (!inv) return false
  const spec = entryFlags('10673').test || {}
  return runTest(api, inv.seat, spec.skill || 'agility', Number(spec.difficulty) || 4, result => {
    if (result?.success) return true
    const asset = highestPrintedCostAsset(inv)
    const emissary = nearestEmissaryTo(state, inv)
    const options = []
    if (asset) options.push({ id: 'asset', label: '把印刷费用最高的支援放到深渊顶' })
    if (emissary) options.push({ id: 'attack', label: '最近的密使攻击你' })
    if (!options.length) return true
    const choice = ask(api, { kind: 'choice', seat: inv.seat, source: '10673',
      prompt: '选择一项。', options }, options[0].id)
    if (choice === 'attack' && emissary) {
      if (typeof api.attack === 'function') api.attack(emissary, inv)
      info(api, `「${emissary.name}」攻击 ${inv.name}。`)
    } else placeAssetOnAbyss(state, inv.seat, asset?.id, api)
    return true
  })
}

/** 10672 升华：检定[意志](4)。失败时二选一：按失败点数把手牌放到深渊顶；或最近的密使攻击你。 */
export function sublimationEvent(state, payload = {}, api = {}) {
  const inv = state.investigators?.[payload.seat ?? 0]
  if (!inv) return false
  const spec = entryFlags('10672').test || {}
  return runTest(api, inv.seat, spec.skill || 'willpower', Number(spec.difficulty) || 4, result => {
    if (result?.success) return true
    const failedBy = Math.max(1, (Number(result?.difficulty) || 4) - (Number(result?.value) || 0))
    const emissary = nearestEmissaryTo(state, inv)
    const options = []
    if ((inv.hand || []).length) options.push({ id: 'hand', label: `把 ${failedBy} 张手牌放到深渊顶` })
    if (emissary) options.push({ id: 'attack', label: '最近的密使攻击你' })
    if (!options.length) return true
    const choice = ask(api, { kind: 'choice', seat: inv.seat, source: '10672',
      prompt: '选择一项。', options }, options[0].id)
    if (choice === 'attack' && emissary) {
      if (typeof api.attack === 'function') api.attack(emissary, inv)
      info(api, `「${emissary.name}」攻击 ${inv.name}。`)
    } else {
      const cards = (inv.hand || []).splice(0, Math.min(failedBy, (inv.hand || []).length))
      putOnAbyss(state, cards, api)
      info(api, `${inv.name} 把 ${cards.length} 张手牌放到深渊顶。`)
    }
    return true
  })
}

// ---------------------------------------------------------------------------
// 事件桥（线索：条目/引擎通过 api.resolveScenarioEvent 调用）
// ---------------------------------------------------------------------------

export const events = Object.freeze({
  fateOfTheValeDrawFromAbyss: (state, payload = {}, api = {}) => drawFromAbyss(state, payload.seat ?? 0, api),
  fateOfTheValeEncounterFromAbyss: (state, payload = {}, api = {}) => drawEncounterFromAbyss(state, payload.seat ?? 0, api),
  fateOfTheValeReturnToTrueSelf: (state, payload = {}, api = {}) => returnToTrueSelf(state, payload.seat ?? 0, api),
  fateOfTheValeInterlude: (state, payload = {}, api = {}) => resolveInterlude(state, payload.choice, api),
  fateOfTheValeAbyssLocation: (state, payload = {}, api = {}) => flipAbyssToLocation(state, api),
  fateOfTheValeShatter: (state, payload = {}, api = {}) => shatterSelves(state, api),
  fateOfTheValeEuphoria: (state, payload = {}, api = {}) => euphoriaEvent(state, payload, api),
  fateOfTheValeFragmentation: (state, payload = {}, api = {}) => fragmentationEvent(state, payload, api),
  fateOfTheValeSublimation: (state, payload = {}, api = {}) => sublimationEvent(state, payload, api),
})

// ---------------------------------------------------------------------------
// 装配
// ---------------------------------------------------------------------------

export const behavior = {
  id: CHAPTER_ID,
  locationsStartRevealed: false,
  roundEndActIndex: -1,
  startLocation: () => START_LOCATION,
  preScenarioSetup,
  prepareScenario,
  setupLocations,
  locationPlaced,
  setupEnemies,
  afterDeckSetup,
  setupScenario,
  assignStartingNests,
  seedAbyss,
  actions,
  performAction,
  turnEnded,
  afterTest,
  afterEvade(state, inv, enemy, result, api) {
    if (actCodeOf(state) === '10660') return clearEscapeRoad(state, inv, enemy, result, api)
  },
  roundEnded,
  locationEntered,
  handSizePenalty,
  statModifier,
  elderSign,
  enemyDamageAllowed,
  canOpportunityAttack(_state, enemy) {
    return !EMISSARY_COLOUR_CODES.includes(codeOf(enemy))
  },
  enemyCannotAttack,
  enemyStatModifier,
  enemyAttackResolved,
  enemyDefeated,
  enemyAttackedSuccessfully,
  actReveal,
  actIndexAfterAdvance,
  agendaReveal,
  checkObjectives,
  allResigned: checkObjectives,
  resolveChaosToken,
  chaosTokenValue,
  applyTokenEffect,
  afterTokenReveal,
  testAutoFail,
  resolution,
  scenarioResolution,
  events,
  objectiveStatus,
  interludeOptions,
  resolveInterlude,
  shatterSelves,
  returnToTrueSelf,
  nestAssignment,
  nestCodeAt,
  syncConnections,
  flipAbyssToLocation,
  abyssCards,
  abyssSize,
  drawFromAbyss,
  drawEncounterFromAbyss,
  revealBottomOfAbyss,
  putOnAbyss,
  removeFromAbyss,
  classifyAbyssCard,
  initializeAbyss,
  flipEmissariesToShattered,
  wardEmissary,
  isWardedEmissary,
  emissaryInPlay,
  emissaryAt,
  shatteredEmissaryAt,
  emissaryPosition,
  spawnFateEnemy,
  abyssStoryInPlay,
  abyssLocationInPlay,
  abyssMythosActive,
  gazeRule,
  revealFromAbyssReaction,
  applyNestCodes,
  isShattered,
  trueSelfCodeOf,
  takeResident,
  residentParley,
  placeKindling,
  drawFire,
  nearestEmissaryTo,
  placeAssetOnAbyss,
  euphoriaEvent,
  fragmentationEvent,
  sublimationEvent,
  setupNightVale,
  placeResidentsBeneath,
  placeShatteredEmissariesInVillage,
  fateOfTheValeStep1,
  fateOfTheValeStep2,
  fateOfTheValeStep3,
  fateOfTheValeStep4,
  fateOfTheValeStep5,
}

export function implementedEntryFlags(code) {
  return entryOf(code)?.flags || null
}

export {
  ABYSS_DECK_ID, ACT_CODES, ACT3_VARIANT_CODES, ALL_ACT_CODES, AGENDA_CODES, ENCOUNTER_DECK,
  EMISSARY_CODES, EMISSARY_FORMATION, MIRROR_NEST_POSITIONS, RESIDENT_ASSET_CODES,
  RESIDENT_ENEMY_CODES, SET_ASIDE_CARDS, VALE_LOCATION_IDS, CAVE_LOCATION_IDS,
}
