// 《万象无终 · 恶罪报应》行为层（数据驱动版）。
//
// 结构：`...encounterRules`（战役共享钩子）+ `id` + 本章钩子。逐卡规则不写「卡号分支」：
//   · 单卡条目 `flags`（entryFlags 读点）优先，索引未重建时回退 definition.CARD_RULES（同一份键）；
//   · 地点实例声明 hauntedGroup/shroudRule/statRule/investigateBonus/beneathRule/horrorAura/
//     defeatRule/resignAction，behavior 只按字段分派；幕议程 advanceRule、未了之事 forced/immediate 都来自数据表。
//
// 本章状态键（save 往返 / 测试断言用，全部纯 JSON）：
//   scenarioZones.setAside / removed；scenarioFlags: hereticPool, hereticsRemoved, hereticsSpawned, unfinishedBusiness, flippedThisRound,
//                  actOneWebs, hereticsUnleashedCount, lastEncounterDeck
//   地点实例：beneath（教堂阁楼底下）、spectralFace（幽灵面）
//   敌人实例：enemyRole/hereticFace/hereticStory/hereticJResolved/hereticBanishNext/roundFightEvadeBonus；
//   调查员实例：wosInvestigateBonus/wosBaseWillpower/wosRoundSkillPenalty/wosResignLockedRound
//
// 规则事实源：参考实现 `TheWagesOfSin.hs`、`Scenarios/TheCircleUndone/TheWagesOfSin/Helpers.hs`
// 与 Cards 目录下的逐卡文件；中文卡文是文案事实源。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { entryFlags } from '../../../../../src/cards/card-rules.js'
import {
  discardEncounterTop, encounterRules, hasTrait, here, isSpectralLocation, isSpellOrRelicSource,
  nearestEnemyWithTrait, original,
} from '../../encounter-rules.js'
import { mementoCount, recordMemento } from '../../../../../src/campaign/mementos.js'
import { extraDeckPiles, setExtraDeckPiles } from '../../../../../src/engine/alt-decks.js'
import { chaosAfterTest, resolveChaosToken as resolveChaos, unfinishedBusinessInVictory } from './chaos.js'
import {
  CARD_RULES, HAUNTED_BY_LOCATION, HERETIC_ENEMY_CODES, HERETIC_FACES,
  LOCATION_ID_BY_FRONT_CODE, LOCATION_VARIANTS, SPECTRAL_DECK_CODES, SPECTRAL_WATCHER,
  SPECTRAL_WEB, STANDARD_DECK_CODES, UNFINISHED_BUSINESS_CODES, UNFINISHED_BUSINESS_RULES,
  WATCHERS_GRASP,
} from './definition.js'

const alive = state => (state?.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const loc = (state, id) => (state.locations || []).find(location => location.id === id) || null
const byCode = (state, code) => (state.locations || []).find(location => original(location) === code) || null
const flagsFor = state => (state.scenarioFlags ||= {})
const zonesFor = state => (state.scenarioZones ||= {})
const actStep = state => Number(state.actIndex || 0) + 1
const agendaStep = state => Number(state.agendaIndex || 0) + 1
const recordsFor = state => (state.campaign.records ||= {})
const EMPTY_RULE = Object.freeze({})

// 单卡规则读点：条目 flags → definition.CARD_RULES（同一份规则键）。
function rulesOf(_state, code) {
  const key = String(code ?? '')
  const flags = entryFlags(key)
  const base = CARD_RULES[key]
  if (flags && Object.keys(flags).length) return { ...(base || {}), ...flags }
  return base || EMPTY_RULE
}

const enemyRoleOf = (state, enemy) => {
  if (!enemy) return null
  if (enemy.enemyRole) return enemy.enemyRole
  if (enemy.hereticFace) return 'heretic'
  return rulesOf(state, original(enemy))?.enemyRole || null
}
const isHereticEnemy = (state, enemy) => enemyRoleOf(state, enemy) === 'heretic'
const isStoryThreat = card => Boolean(UNFINISHED_BUSINESS_RULES[original(card)])
const threatRule = card => UNFINISHED_BUSINESS_RULES[original(card)] || null
const threatHasRule = (inv, resolveRule) => (inv?.threat || []).some(card =>
  rulesOf(null, original(card))?.resolveRule === resolveRule)

function takeFromSetAside(state, code) {
  const list = zonesFor(state).setAside
  if (!Array.isArray(list)) return false
  const index = list.indexOf(code)
  if (index < 0) return false
  list.splice(index, 1)
  return true
}

function shuffleWith(list, random) {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

// ---------------------------------------------------------------------------
// 地点分组（变体二选一）：按 definition 的 LOCATION_VARIANTS 数据，不比对卡号。
// ---------------------------------------------------------------------------
function placedByFrontCodes(state, codes) {
  return (state.locations || []).filter(location => codes.includes(original(location)))
}
function placedGroup(state, key) {
  return placedByFrontCodes(state, LOCATION_VARIANTS[key] || [])
}
function locationGroupOf(state, locationId) {
  const code = original(loc(state, locationId))
  for (const [group, codes] of Object.entries(LOCATION_VARIANTS)) {
    if (codes.includes(code)) return group
  }
  return null
}
function isAtAttic(state, locationId) {
  return locationGroupOf(state, locationId) === 'chapelAttic'
}
function hasAtticBelowRule(location) {
  return location?.beneathRule === 'atticBottom'
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
function setupLocations(state, events, helper = {}) {
  const random = () => (helper.randomValue ? helper.randomValue(state) : 0.5)
  const shuffle = list => (helper.shuffle ? helper.shuffle(list, random) : shuffleWith(list, random))
  const zones = zonesFor(state)
  zones.removed = []
  const flags = flagsFor(state)
  // 异端者：混洗 6 张，随机 4 张放一边，另外 2 张移出游戏。
  const hereticOrder = shuffle([...HERETIC_ENEMY_CODES])
  const hereticPool = hereticOrder.slice(0, 4)
  const hereticsRemoved = hereticOrder.slice(4)
  Object.assign(flags, {
    hereticPool,
    hereticsRemoved,
    hereticsSpawned: false,
    unfinishedBusiness: [],
    flippedThisRound: { round: 0, ids: [] },
    actOneWebs: [],
    hereticsUnleashedCount: 0,
  })
  // 放在一边：4 张异端者 + 4 张幽灵迷网 + 看守人组。
  zones.setAside = [
    ...hereticPool,
    SPECTRAL_WEB, SPECTRAL_WEB, SPECTRAL_WEB, SPECTRAL_WEB,
    SPECTRAL_WATCHER, WATCHERS_GRASP, WATCHERS_GRASP,
  ]
  // 11 对地点：每组随机选 1 张入场，另一张移出游戏（卡号→地点 id 用数据表）。
  const selected = ['hangmansBrook', 'hauntedFields', 'abandonedChapel']
  for (const ids of Object.values(LOCATION_VARIANTS)) {
    const order = shuffle([...ids])
    selected.push(LOCATION_ID_BY_FRONT_CODE[order[0]])
    zones.removed.push(order[1])
  }
  // 剪掉与未入场变体之间的连接（引擎按固定 id 建图，变体是二选一）。
  const selectedSet = new Set(selected)
  for (const id of selected) {
    const definition = state.scenario?.locations?.[id]
    if (!definition) continue
    definition.connections = (definition.connections || []).filter(connection => selectedSet.has(connection))
  }
  // 幽灵遭遇牌库（第二牌堆）：印刷张数需要保留（05107/05108 ×3 等），直接建 piles 而非
  // setExtraEncounterDeck（后者会去重）。
  setExtraDeckPiles(state, 'spectral', { deck: shuffle([...SPECTRAL_DECK_CODES]), discard: [] })
  return selected
}

// ---------------------------------------------------------------------------
// 幕 / 议程（advanceRule 数据分派）
// ---------------------------------------------------------------------------
// 议程 1b：所有地点翻到幽灵面；幽灵看守人放到绞刑者河；看守人组剩余卡 + 幽灵弃牌堆洗入幽灵遭遇牌库。
function advanceTheHangedMan(state, agenda, api) {
  for (const location of state.locations || []) {
    if (isSpectralLocation(location)) continue
    api.flipSpectral(location.id)
  }
  api.info?.('🌫️ 绞刑者山丘被鬼灵迷雾吞没：每个地点翻到了幽灵面。')
  takeFromSetAside(state, SPECTRAL_WATCHER)
  api.spawn(SPECTRAL_WATCHER, 'hangmansBrook')
  api.info?.('👻 幽灵看守人在绞刑者河现身。')
  const watcherCodes = []
  for (const code of [WATCHERS_GRASP, WATCHERS_GRASP]) {
    if (takeFromSetAside(state, code)) watcherCodes.push(code)
  }
  const piles = extraDeckPiles(state, 'spectral')
  const merged = [...piles.deck, ...piles.discard, ...watcherCodes]
  setExtraDeckPiles(state, 'spectral', { deck: api.shuffle ? api.shuffle(merged) : merged, discard: [] })
  api.info?.('🌀 看守人组剩余卡与幽灵弃牌堆一起洗入幽灵遭遇牌库。')
}

// 议程 2b → 结局 2。
function advanceDeathsApproach(state, agenda, api) {
  api.finish('r2')
}

// 幕 1b：4 处地点各生成 1 个放一边的异端者；加线索；Memento≥3 发幽灵迷网。
function advanceInPursuitOfTheDead(state, act, api) {
  const flags = flagsFor(state)
  const perInvestigator = Number(state.numInvestigators) || 1
  const hereticLocations = [
    placedGroup(state, 'theGallows')[0],
    placedGroup(state, 'hereticsGraves')[0],
    placedGroup(state, 'chapelAttic')[0],
    placedGroup(state, 'chapelCrypt')[0],
  ].filter(Boolean)
  const pool = [...(flags.hereticPool || [])]
  for (const location of hereticLocations) {
    const code = pool.shift()
    if (!code) break
    takeFromSetAside(state, code)
    api.spawn(code, location.id)
    api.info?.(`👁️ 异端者在「${location.name}」现身。`)
  }
  flags.hereticsSpawned = true
  const targetIds = new Set(hereticLocations.map(location => location.id))
  for (const location of state.locations || []) {
    const amount = (targetIds.has(location.id) ? 2 : 1) * perInvestigator
    location.maxClues = (location.maxClues || 0) + amount
    if (location.revealed !== false) location.clues = (location.clues || 0) + amount
    api.info?.(`🔍 「${location.name}」增加 ${amount} 个线索。`)
  }
  if (mementoCount(state) >= 3) {
    api.info?.('🎵 你听懂了女巫所唱歌曲中的悲伤歌词。')
    for (const inv of alive(state)) {
      if (!takeFromSetAside(state, SPECTRAL_WEB)) break
      api.giveAsset(inv.seat, SPECTRAL_WEB)
      flags.actOneWebs.push(inv.seat)
    }
  }
}

// 幕 2b：记录玉米皮娃娃 Memento；→ 结局 1。
function advanceInPursuitOfTheLiving(state, act, api) {
  recordMemento(state, 'cornHuskDoll')
  api.info?.('📓 遗留记忆：记录下玉米皮娃娃；随后进入结局 1。')
  api.finish('r1')
}

const ACT_ADVANCE = Object.freeze({
  inPursuitOfTheDead: advanceInPursuitOfTheDead,
  inPursuitOfTheLiving: advanceInPursuitOfTheLiving,
})
const AGENDA_ADVANCE = Object.freeze({
  theHangedManXII: advanceTheHangedMan,
  deathsApproach: advanceDeathsApproach,
})

// ---------------------------------------------------------------------------
// 地点规则（实例字段分派）
// ---------------------------------------------------------------------------
function renderLocationRule(location, api) {
  if (!location) return
  if (isSpectralLocation(location) && location.hauntedGroup) {
    const haunted = HAUNTED_BY_LOCATION[location.hauntedGroup]
    if (haunted) location.haunted = structuredClone(haunted)
  } else {
    delete location.haunted
  }
  api?.info?.(isSpectralLocation(location)
    ? `👻 「${location.name}」的闹鬼能力已就绪。`
    : `🏛️ 「${location.name}」回到非幽灵面。`)
}

const SHROUD_RULES = Object.freeze({
  perWitch: state => (state.enemies || []).filter(enemy => hasTrait(enemy, 'witch')).length,
  perGeist: state => (state.enemies || []).filter(enemy => hasTrait(enemy, 'geist')).length,
  noReadyEnemy: (state, location) => (state.enemies || [])
    .some(enemy => enemy.location === location.id && !enemy.exhausted) ? 0 : -3,
  noHexThreat: (state, location) => {
    const hereInvestigators = alive(state).filter(inv => inv.location === location.id)
    const hasHex = hereInvestigators.some(inv => (inv.threat || []).some(card => hasTrait(card, 'hex')))
    return hasHex ? 0 : -3
  },
})

function locationShroudModifier(state, location) {
  const rule = location?.shroudRule
  if (!rule) return 0
  return SHROUD_RULES[rule]?.(state, location) ?? 0
}

const INVESTIGATE_BONUS = Object.freeze({
  willpower: (state, inv) => Number(inv.willpower) || 0,
  handCount: (state, inv) => (inv.hand || []).length,
})

// ---------------------------------------------------------------------------
// 异端者：翻面 / 未了之事 / 放逐
// ---------------------------------------------------------------------------
function ensureHereticFaces(state, enemy) {
  if (!enemy) return false
  if (!enemy.hereticFace) {
    const face = HERETIC_FACES.find(candidate => candidate.enemy === original(enemy)
      || candidate.enemy === enemy.code)
    if (!face) return false
    enemy.enemyRole = 'heretic'
    enemy.hereticFace = face.enemy
    enemy.hereticStory = face.story
    enemy.faces = enemy.faces || [
      { code: face.enemy, side: 'enemy' },
      { code: face.story, side: 'unfinishedBusiness' },
    ]
    enemy.side = enemy.side || 'enemy'
  }
  return true
}

function unfinishedBusinessEntry(state, storyCode) {
  return (flagsFor(state).unfinishedBusiness || []).find(entry => entry.storyCode === storyCode) || null
}

// 把异端者翻到未了之事面（威胁区剧情卡）并登记快照（save-safe：快照是纯 JSON）。
function flipToUnfinishedBusiness(state, enemy, api, holderSeat = null) {
  ensureHereticFaces(state, enemy)
  const storyCode = enemy.hereticStory
  if (!storyCode) return false
  const holder = Number.isInteger(holderSeat) ? state.investigators[holderSeat]
    : (state.investigators[enemy.engagedSeat] || alive(state)[0])
  // flipEnemyFace 需要一个持有者：先把它放回交战列表，让引擎把剧情卡交给正确的调查员。
  if (holder && !holder.engaged?.includes(enemy.id)) {
    holder.engaged ||= []
    holder.engaged.push(enemy.id)
  }
  api.flipEnemy(enemy, storyCode)
  if (holder) holder.engaged = (holder.engaged || []).filter(id => id !== enemy.id)
  const entry = {
    storyCode,
    enemyCode: enemy.hereticFace,
    holderSeat: holder?.seat ?? null,
    locationId: enemy.location,
    enemySnapshot: structuredClone(enemy),
  }
  flagsFor(state).unfinishedBusiness = [...(flagsFor(state).unfinishedBusiness || []), entry]
  api.info?.(`🎭 异端者翻到「未了之事」面，进入${holder ? holder.name : '场上'}的威胁区。`)
  return entry
}

// 未了之事 → 敌人面（从威胁区移除剧情卡，重新进入战场）。
function flipBackToHeretic(state, entry, api) {
  const snapshot = entry.enemySnapshot || {}
  const storyCode = entry.storyCode
  const enemyCode = threatRule({ code: storyCode })?.enemyCode
  for (const inv of state.investigators || []) {
    if (Array.isArray(inv.threat)) inv.threat = inv.threat.filter(card => original(card) !== storyCode)
  }
  if (!enemyCode) return null
  snapshot.enemyRole = 'heretic'
  snapshot.side = 'unfinishedBusiness'
  ensureHereticFaces(state, snapshot)
  api.flipEnemy(snapshot, enemyCode)
  snapshot.side = 'enemy'
  flagsFor(state).unfinishedBusiness = (flagsFor(state).unfinishedBusiness || [])
    .filter(candidate => candidate.storyCode !== storyCode)
  api.info?.('🎭 「未了之事」翻回异端者面，重新进入战场。')
  return snapshot
}

// 放逐：把未了之事/异端者送进胜利区（不弃牌）。
function banishUnfinishedBusiness(state, storyCode, api, enemy = null) {
  const rule = threatRule({ code: storyCode })
  for (const inv of state.investigators || []) {
    if (Array.isArray(inv.threat)) inv.threat = inv.threat.filter(card => original(card) !== storyCode)
    if (Array.isArray(inv.engaged) && enemy) inv.engaged = inv.engaged.filter(id => id !== enemy.id)
  }
  if (enemy) {
    enemy.engagedSeat = null
    const index = (state.enemies || []).indexOf(enemy)
    if (index >= 0) state.enemies.splice(index, 1)
  }
  flagsFor(state).unfinishedBusiness = (flagsFor(state).unfinishedBusiness || [])
    .filter(candidate => candidate.storyCode !== storyCode)
  const victory = Number(rule?.storyVictory || 1)
  state.victory = (state.victory || 0) + victory
  state.victoryDisplay ||= []
  if (!state.victoryDisplay.some(card => original(card) === storyCode)) {
    state.victoryDisplay.push({ id: `story:${storyCode}`, code: storyCode, originalCode: storyCode, victory })
  }
  api.info?.(`🌫️ 「未了之事」被驱除，进入胜利区（+${victory}）。`)
}

// 未了之事的强制（轮末/石板标记共用）：数据表给出 harm 的 kind/amount/text。
const FORCED_APPLY = Object.freeze({
  horror: (state, inv, api, amount) => api.horror(inv.seat, amount),
  damage: (state, inv, api, amount) => api.damage(inv.seat, amount),
  resources: (state, inv, api, amount) => {
    const lose = Math.min(amount, Number(inv.resources) || 0)
    inv.resources -= lose
    api.info?.(`💸 ${inv.name} 失去 ${lose} 点资源。`)
  },
  discard: (state, inv, api, amount) => api.discardChosen(inv.seat, amount, '未了之事'),
})

export function unfinishedBusinessForced(state, inv, threat, api) {
  const rule = threatRule(threat)
  if (!rule?.forced) return false
  const entry = unfinishedBusinessEntry(state, original(threat))
  const answer = api.choose({
    kind: 'harm', source: original(threat), seat: inv.seat, forced: true,
    prompt: `未了之事（${rule.locationName}）：选择强制能力。`,
    options: [
      { id: 'harm', label: rule.forced.text },
      { id: 'flip', label: '把未了之事翻回敌人面' },
    ],
  })
  if (answer === 'flip') {
    if (entry) flipBackToHeretic(state, entry, api)
    return true
  }
  FORCED_APPLY[rule.forced.kind]?.(state, inv, api, rule.forced.amount || 1)
  return true
}

// J/L 的未了之事面：立刻翻回敌人面、立即攻击，并设置后续限制（数据表 immediate.kind 分派）。
const IMMEDIATE_RESOLVE = Object.freeze({
  cannotBeDefeated: (state, enemy, api, rule) => {
    enemy.hereticJResolved = true
    enemy.cannotBeDefeated = true
    enemy.hereticParleyCost = 1 + (Number(state.numInvestigators) || 1)
      + Number(rule.parleyClueBonus || 0)
    enemy.hereticParleySpectralOnly = rule.spectralParleyOnly === true
    api.info?.('📜 本场冒险接下来的时间里，这个异端者不能以任何方式被击败；其谈判只能位于幽灵地点时触发，且费用 +1×人数线索。')
  },
  banishNextDefeat: (state, enemy, api) => {
    enemy.hereticBanishNext = true
    api.info?.('📜 下次击败这个异端者时，它将被驱除。')
  },
})

function resolveImmediateUnfinishedBusiness(state, entry, api) {
  const holder = Number.isInteger(entry.holderSeat) ? state.investigators[entry.holderSeat] : null
  const rule = threatRule({ code: entry.storyCode })
  if (!rule?.immediate) return false
  const restored = flipBackToHeretic(state, entry, api)
  const inPlay = restored || entry.enemySnapshot
  if (!inPlay) return false
  ensureHereticFaces(state, inPlay)
  if (holder) {
    api.attack(inPlay, holder)
    api.info?.(`👻 「${inPlay.name}」翻回敌人面并立即攻击 ${holder.name}。`)
  }
  IMMEDIATE_RESOLVE[rule.immediate.kind]?.(state, inPlay, api, rule.immediate)
  return true
}

// ---------------------------------------------------------------------------
// 敌人角色同步
// ---------------------------------------------------------------------------
function syncHereticRestrictions(state) {
  for (const enemy of state.enemies || []) {
    if (!isHereticEnemy(state, enemy)) continue
    const atSpectral = isSpectralLocation(loc(state, enemy.location))
    enemy.aloof = !atSpectral
    enemy.hereticRestricted = !atSpectral
  }
}

function syncMalevolent(state) {
  for (const enemy of state.enemies || []) {
    if (enemyRoleOf(state, enemy) !== 'malevolentSpirit') continue
    const atSpectral = isSpectralLocation(loc(state, enemy.location))
    enemy.hunter = atSpectral ? true : Boolean(enemy.printedHunter)
  }
}

// 地点 defeatRule 数据分派：异端者墓地 172 面的「女巫敌人被击败 → 弃基础遭遇牌库顶 2 张」。
const LOCATION_DEFEAT_RULES = Object.freeze({
  discardStandardTwoOnWitchDefeat: (state, location, enemy, api) => {
    if (!hasTrait(enemy, 'witch')) return
    discardEncounterTop(state, api, 2)
    api.info?.(`🪦 「${location.name}」的强制：弃掉基础遭遇牌库顶 2 张卡牌。`)
  },
})

// ---------------------------------------------------------------------------
// 遭遇诡计（resolveRule / surgeRule 数据分派）
// ---------------------------------------------------------------------------
const RESOLVE_RULES = Object.freeze({
  punishment(state, inv, api) {
    // 惩罚：显现入威胁区；强制在任意敌人被击败后由 enemyDefeated 结算。
    api.threat(inv.seat, '05181')
    return { placed: true }
  },
  burdensOfThePast(state, inv, api) {
    // 往昔重担：威胁区有未了之事 → 逐张触发强制（如同轮末）；否则涌动（encounterGainsSurge）。
    const stories = (inv.threat || []).filter(isStoryThreat)
    if (!stories.length) {
      api.info?.('🌀 往昔重担：威胁区没有未了之事，本卡获得涌动。')
      return false
    }
    for (const story of stories) unfinishedBusinessForced(state, inv, story, api)
    return false
  },
  ominousPortents(state, inv, api) {
    // 凶兆：抽幽灵遭遇牌库顶（获得险境、效果不可取消）或意志(3)失败 2 恐惧。
    const choice = api.choose({
      kind: 'option', source: '05183', seat: inv.seat, peril: true,
      prompt: '凶兆：抽幽灵遭遇牌库顶 1 张（获得险境），或检定意志(3)？',
      options: [
        { id: 'draw', label: '抽幽灵遭遇牌库顶（获得险境、效果不能取消）' },
        { id: 'test', label: '检定意志(3)，失败受到 2 点恐惧' },
      ],
    })
    if (choice === 'test') {
      api.test(inv.seat, 'willpower', 3, result => {
        if (!result.success) api.horror(inv.seat, 2)
      }, 0, { type: 'encounter', name: '凶兆' })
      return false
    }
    flagsFor(state).lastEncounterDeck = 'spectral'
    api.drawExtra(inv.seat, 'spectral')
    return false
  },
  graveLight(state, inv, api) {
    // 长明灯：来源决定去向（来源由 encounterDeckFor / 显式 drawExtra 记录在 lastEncounterDeck）。
    const fromSpectral = flagsFor(state).lastEncounterDeck === 'spectral'
    flagsFor(state).graveLight = fromSpectral ? 'spectral' : 'standard'
    if (fromSpectral) {
      api.damage(inv.seat, 2)
      api.info?.('🕯️ 长明灯从幽灵牌库抽出：受到 2 点伤害，本卡放入基础遭遇弃牌堆。')
    } else {
      api.info?.('🕯️ 长明灯从基础牌库抽出：洗入幽灵遭遇牌库，并获得涌动。')
    }
    return false
  },
  baneOfTheLiving(state, inv, api) {
    // 祸害生者：险境二选一。
    const entries = flagsFor(state).unfinishedBusiness || []
    const choice = api.choose({
      kind: 'option', source: '05185', seat: inv.seat, peril: true,
      prompt: '祸害生者：把一张未了之事翻回异端者面并放置伤害，或从幽灵牌库顶弃到灵怪敌人并生成交战？',
      options: [
        ...(entries.length ? [{ id: 'flip', label: '把一张未了之事翻回异端者面并放置一半生命的伤害' }] : []),
        { id: 'geist', label: '从幽灵牌库顶弃到灵怪敌人，将其生成并与你交战' },
      ],
    })
    if (choice === 'flip' && entries.length) {
      const chosen = entries.length === 1 ? 0 : api.choose({
        kind: 'target', source: '05185', seat: inv.seat, peril: true,
        prompt: '选择要翻面的未了之事。',
        options: entries.map((entry, index) => ({ id: String(index), label: ALL_CARDS[entry.storyCode]?.nameZh || entry.storyCode })),
      })
      const entry = entries.find((candidate, index) => String(index) === String(chosen)) || entries[0]
      const enemy = flipBackToHeretic(state, entry, api)
      if (enemy) {
        const half = Math.floor((Number(enemy.health) || 0) / 2)
        enemy.damageTaken = (Number(enemy.damageTaken) || 0) + half
        api.info?.(`👻 未了之事翻回异端者面，并放置 ${half} 点伤害。`)
      }
      return false
    }
    const piles = extraDeckPiles(state, 'spectral')
    let found = null
    while (piles.deck.length) {
      const drawnCode = piles.deck.pop()
      if (ALL_CARDS[drawnCode]?.type === 'enemy' && hasTrait({ code: drawnCode }, 'geist')) {
        found = drawnCode
        break
      }
      piles.discard.push(drawnCode)
    }
    if (found) api.spawnEngaged(found, inv.location, inv.seat)
    else api.info?.('幽灵牌库被弃空，也没有出现灵怪敌人。')
    return false
  },
})

// 涌动规则数据分派。
const SURGE_RULES = Object.freeze({
  noUnfinishedBusiness(state) {
    return !alive(state).some(inv => (inv.threat || []).some(isStoryThreat))
  },
  graveLightStandardDraw(state) {
    const mode = flagsFor(state).graveLight
    delete flagsFor(state).graveLight
    const piles = extraDeckPiles(state, 'spectral')
    if (mode !== 'spectral') {
      // 基础弃牌堆里的长明灯移入幽灵牌库顶（“洗入”的确定性近似）。
      const index = state.encounterDiscard.lastIndexOf('05184')
      if (index >= 0) state.encounterDiscard.splice(index, 1)
      piles.deck.push('05184')
      return true
    }
    const spectralIndex = piles.discard.lastIndexOf('05184')
    if (spectralIndex >= 0) piles.discard.splice(spectralIndex, 1)
    state.encounterDiscard.push('05184')
    return false
  },
})

// 生成地点数据分派。
const SPAWN_RULES = Object.freeze({
  gallowsOrHereticsGraves(state, api) {
    const targets = [...placedGroup(state, 'theGallows'), ...placedGroup(state, 'hereticsGraves')]
    return choosePlacement(state, targets, api, '选择复仇女巫生成的地点。')
  },
  chapelAtticOrCrypt(state, api) {
    const targets = [...placedGroup(state, 'chapelAttic'), ...placedGroup(state, 'chapelCrypt')]
    return choosePlacement(state, targets, api, '选择恶毒邪灵生成的地点。')
  },
})

function choosePlacement(state, options, api = null, prompt = null) {
  if (!options.length) return null
  if (options.length === 1) return options[0].id
  const runtime = api || state.__runtime
  if (!runtime?.choose) return options[0].id
  const answer = runtime.choose({
    kind: 'location', source: '05161', seat: state.campaign?.leadSeat ?? 0,
    prompt: prompt || '选择一个地点。', options: options.map(location => ({ id: location.id, label: location.name })),
  })
  return (options.find(location => location.id === answer) || options[0]).id
}

// ---------------------------------------------------------------------------
// 行为对象
// ---------------------------------------------------------------------------
export const implementedEncounterCodes = [
  ...HERETIC_ENEMY_CODES, '05179', '05180',
  '05181', '05182', '05183', '05184', '05185',
  '05086', '05087',
  '05090', '05091', '05092', '05093', '05094',
  '05098', '05099', '05103', '05104', '05105', '05106', '05107', '05108',
]

export const behavior = {
  ...encounterRules,
  id: 'theWagesOfSin',
  implementedEncounterCodes,
  locationsStartRevealed: true,

  // ---- 布置 ----
  setupLocations(state, events, helper = {}) {
    return setupLocations(state, events, helper)
  },
  setupEnemies() {
    // 本章开局没有场上敌人：异端者在幕 1b 生成，看守人在议程 1b 生成。
  },
  afterChaosBagSetup(state) {
    syncHereticRestrictions(state)
    syncMalevolent(state)
  },

  // ---- 遭遇牌库路由（P8 新读点）：位于幽灵地点 → 幽灵遭遇牌库 ----
  encounterDeckFor(state, inv) {
    if (!state.extraEncounterDecks?.spectral) return null
    const spectral = isSpectralLocation(here(state, inv))
    // 记下本次抽牌来源：长明灯需要区分「从基础/幽灵牌库抽出」。
    flagsFor(state).lastEncounterDeck = spectral ? 'spectral' : 'encounter'
    return spectral ? 'spectral' : null
  },

  // ---- 幕 / 议程（advanceRule 数据分派） ----
  actReveal(state, act, api) {
    const rule = rulesOf(state, original(act))
    ACT_ADVANCE[act.advanceRule || rule.advanceRule]?.(state, act, api)
    syncHereticRestrictions(state)
    syncMalevolent(state)
  },
  agendaReveal(state, agenda, api) {
    const rule = rulesOf(state, original(agenda))
    AGENDA_ADVANCE[agenda.advanceRule || rule.advanceRule]?.(state, agenda, api)
    syncHereticRestrictions(state)
    syncMalevolent(state)
  },

  // ---- 遭遇诡计 ----
  resolveEncounter(state, inv, treachery, api) {
    const rule = rulesOf(state, original(treachery))
    const handler = RESOLVE_RULES[rule.resolveRule]
    if (handler) return handler(state, inv, api)
    return encounterRules.resolveEncounter?.(state, inv, treachery, api)
  },
  encounterGainsSurge(state, code) {
    const rule = rulesOf(state, code)
    const handler = SURGE_RULES[rule.surgeRule]
    return handler ? handler(state) : undefined
  },

  // ---- 地点 ----
  locationFlipped(state, location, api) {
    renderLocationRule(location, api)
    syncHereticRestrictions(state)
    syncMalevolent(state)
  },
  locationRevealed(state, location, api) {
    if (isSpectralLocation(location)) renderLocationRule(location, api)
  },
  locationShroudModifier(state, location) {
    return locationShroudModifier(state, location)
  },
  // 地点常驻技能修正（statRule）+ 幽灵面闹鬼的实例标记 + 调查加成。
  statModifier(state, inv, skill) {
    let total = encounterRules.statModifier?.(state, inv, skill) || 0
    const location = here(state, inv)
    if (state.phase === 'mythos' && location?.statRule === 'mythosPenalty') total -= 1
    if (inv.wosBaseWillpower && skill === 'willpower') {
      const base = Number(inv.willpower) || 0
      total += 1 - base
    }
    if (inv.wosRoundSkillPenalty && inv.wosRoundSkillPenalty >= state.round) total -= 1
    if (skill === 'intellect' && inv.wosInvestigateBonus) total += inv.wosInvestigateBonus.amount
    return total
  },
  beforeInvestigate(state, inv, location) {
    const bonus = INVESTIGATE_BONUS[location?.investigateBonus]
    if (bonus) inv.wosInvestigateBonus = { locationId: location.id, amount: bonus(state, inv) }
    return undefined
  },
  // 教堂阁楼：[reaction] 成功调查后把底下每张卡牌加入所有者的手牌。
  investigateResult(state, inv, location, result, api) {
    delete inv.wosInvestigateBonus
    if (!result?.success || !isAtAttic(state, location.id) || !hasAtticBelowRule(location)) return undefined
    const beneath = location.beneath || []
    if (!beneath.length) return undefined
    for (const entry of beneath) {
      const owner = state.investigators?.[entry.ownerSeat] || inv
      owner.hand.push(entry.code)
      api.info?.(`🗂️ ${owner.name} 取回教堂阁楼底下的 1 张卡牌。`)
    }
    location.beneath = []
    return undefined
  },
  // 教堂阁楼强制：在此地抽到非弱点卡牌后，将其正面朝下放在阁楼底下（beneathRule）。
  cardDrawn(state, inv, code, api) {
    const location = here(state, inv)
    if (!location || !isAtAttic(state, location.id) || !hasAtticBelowRule(location)) return
    const def = ALL_CARDS[code]
    if (!def || def.type === 'weakness' || /weakness/i.test(String(def.typeName || ''))) return
    const index = inv.hand.lastIndexOf(code)
    if (index < 0) return
    inv.hand.splice(index, 1)
    location.beneath ||= []
    location.beneath.push({ code, ownerSeat: inv.seat })
    api.info?.(`📦 ${inv.name} 抽到的卡牌被放在教堂阁楼底下。`)
  },

  // ---- 目标限制 / 异端者限制 ----
  canFightEnemy(state, inv, enemy) {
    if (encounterRules.canFightEnemy?.(state, inv, enemy) === false) return false
    if (isHereticEnemy(state, enemy) && !isSpectralLocation(here(state, inv))) return false
    return true
  },
  canEvadeEnemy(state, inv, enemy) {
    if (encounterRules.canEvadeEnemy?.(state, inv, enemy) === false) return false
    return true
  },
  enemyDamageAllowed(state, enemy) {
    if (isHereticEnemy(state, enemy) && !isSpectralLocation(loc(state, enemy.location))) return false
    return true
  },
  enemyCanBeDefeated(state, enemy) {
    if (enemy?.cannotBeDefeated) return false
    return true
  },

  // ---- 敌人（enemyRole / spawnRule 数据分派） ----
  spawnLocation(state, code, fallbackLoc, engagedSeat, api) {
    const rule = rulesOf(state, code)
    const handler = SPAWN_RULES[rule.spawnRule]
    return (handler && handler(state, api)) || fallbackLoc
  },
  enemySpawned(state, enemy, api) {
    ensureHereticFaces(state, enemy)
    enemy.enemyRole ||= rulesOf(state, original(enemy))?.enemyRole || null
    if (isHereticEnemy(state, enemy)) enemy.printedAloof = false
    syncHereticRestrictions(state)
    syncMalevolent(state)
    encounterRules.enemySpawned?.(state, enemy, api)
  },
  enemyMoved(state, enemy, newLocationId, api) {
    syncHereticRestrictions(state)
    syncMalevolent(state)
    encounterRules.enemyMoved?.(state, enemy, newLocationId, api)
  },
  // 闹鬼农田（horrorAura）：位于此地的幽灵敌人 +1 恐惧值；恶毒邪灵在幽灵地点 +1 伤害/+1 恐惧。
  enemyAttackModifier(state, enemy) {
    const location = loc(state, enemy?.location)
    if (location?.horrorAura && hasTrait(enemy, 'spectral')) return { horror: 1 }
    if (enemyRoleOf(state, enemy) === 'malevolentSpirit' && isSpectralLocation(location)) {
      return { damage: 1, horror: 1 }
    }
    return {}
  },
  // 恶毒邪灵：被非[[法术]]/[[遗物]]伤害击败时改为治愈、横置、移动到幽灵地点。
  enemyDamaged(state, enemy, api, seat, source) {
    encounterRules.enemyDamaged?.(state, enemy, api, seat, source)
    if (enemyRoleOf(state, enemy) !== 'malevolentSpirit') return
    const health = Number(enemy.health) || 0
    if ((Number(enemy.damageTaken) || 0) < health) return
    if (isSpellOrRelicSource(state, source)) return
    enemy.damageTaken = 0
    enemy.exhausted = true
    for (const inv of state.investigators || []) {
      if (Array.isArray(inv.engaged)) inv.engaged = inv.engaged.filter(id => id !== enemy.id)
    }
    enemy.engagedSeat = null
    const spectralLocations = (state.locations || []).filter(location => isSpectralLocation(location))
    const destinationId = choosePlacement(state, spectralLocations, api, '恶毒邪灵移动到哪个幽灵地点？')
    if (destinationId && destinationId !== enemy.location) api.moveEnemy(enemy, destinationId)
    api.info?.('🌫️ 恶毒邪灵没有被击败：治愈所有伤害、横置并移动到幽灵地点。')
  },
  // 敌人被击败：惩罚（威胁区强制）→ 复仇女巫（直接伤害/恐惧）→ 地点 defeatRule → 异端者翻面。
  enemyDefeated(state, enemy, api) {
    // 惩罚（05181）：任意地点有敌人被击败后，威胁区里有它的调查员受到 1 点伤害。
    for (const inv of alive(state)) {
      if (!threatHasRule(inv, 'punishment')) continue
      api.damage(inv.seat, 1)
      api.info?.(`⛓️ 惩罚：有敌人被击败，${inv.name} 受到 1 点伤害。`)
    }
    // 复仇女巫：被击败时对其地点每位调查员造成其伤害与恐惧（直接伤害/恐惧）。
    const role = enemyRoleOf(state, enemy)
    if (role === 'vengefulWitch') {
      for (const inv of alive(state).filter(target => target.location === enemy.location)) {
        api.directDamage(inv.seat, Number(enemy.damage) || 0)
        api.directHorror(inv.seat, Number(enemy.horror) || 0)
      }
      api.info?.('🔥 复仇女巫倒下：同地点的每位调查员受到其伤害与恐惧（直接）。')
    }
    // 地点被击败强制（数据表 defeatRule）。
    const location = loc(state, enemy.location)
    LOCATION_DEFEAT_RULES[location?.defeatRule]?.(state, location, enemy, api)
    if (role !== 'heretic') return encounterRules.enemyDefeated?.(state, enemy, api) || false
    if (!enemy.hereticStory) ensureHereticFaces(state, enemy)
    const holderSeat = Number.isInteger(enemy.engagedSeat) ? enemy.engagedSeat : null
    const storyRule = threatRule({ code: enemy.hereticStory })
    // J/L 的「下次击败即驱除」。
    if (enemy.hereticBanishNext || (enemy.hereticJResolved && enemy.cannotBeDefeated)) {
      banishUnfinishedBusiness(state, enemy.hereticStory, api, enemy)
      return true
    }
    const entry = flipToUnfinishedBusiness(state, enemy, api, holderSeat)
    if (!entry) return false
    if (storyRule?.immediate) {
      resolveImmediateUnfinishedBusiness(state, entry, api)
      return true
    }
    return true
  },
  enemyPhaseEnd(state, api) {
    encounterRules.enemyPhaseEnd?.(state, api)
  },
  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    // 未了之事的强制：一轮结束时每张威胁区未了之事都要二选一。
    for (const inv of state.investigators || []) {
      if (inv.defeated || inv.resigned) continue
      for (const threat of [...(inv.threat || [])]) {
        if (!isStoryThreat(threat)) continue
        unfinishedBusinessForced(state, inv, threat, api)
      }
    }
    flagsFor(state).flippedThisRound = { round: state.round, ids: [] }
    for (const inv of state.investigators || []) delete inv.wosRoundSkillPenalty
    syncHereticRestrictions(state)
    syncMalevolent(state)
  },
  turnBegins(state, inv, api) {
    encounterRules.turnBegins?.(state, inv, api)
    if (inv.wosBaseWillpower && inv.wosBaseWillpower.round < state.round - 1) delete inv.wosBaseWillpower
  },
  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
    delete inv.wosInvestigateBonus
    delete inv.wosResignLockedRound
  },

  // ---- 行动 ----
  actions(state, inv) {
    const moves = []
    const hereLocation = here(state, inv)
    if (!hereLocation) return moves
    // [action] 撤退（地点数据声明 resignAction；幽灵面闹鬼会锁定本轮）。
    if (hereLocation.resignAction && inv.wosResignLockedRound !== state.round) {
      moves.push({
        action: 'scenarioAction', rule: hereLocation.resignAction,
        label: '🚪 撤退：“这个好主意是谁想出来的？”',
      })
    }
    // 幕 2 面：[fast] 将你所在地点翻面（团队每轮每地点一次）。
    if (actStep(state) === 2 && canFlipHere(state, hereLocation)) {
      const flags = flagsFor(state)
      const flipped = flags.flippedThisRound?.round === state.round ? flags.flippedThisRound.ids : []
      if (!flipped.includes(inv.location)) {
        moves.push({ action: 'scenarioAction', rule: 'flipMyLocation', actions: 0, label: '🔄 将你所在地点翻面（本轮该地点首次）' })
      }
    }
    // 幽灵迷网（05177）：[action] 团队花费 1–3 个线索攻击灵怪敌人。
    const web = (inv.assets || []).find(asset => original(asset) === SPECTRAL_WEB)
    if (web) {
      const groupClues = alive(state).reduce((sum, owner) => sum + (Number(owner.clues) || 0), 0)
      if (groupClues >= 1) {
        moves.push({ action: 'scenarioAction', rule: 'spectralWebAttack', label: '🕸️ 幽灵迷网：团队花费 1–3 个线索攻击灵怪敌人' })
      }
    }
    // 异端者谈判：[fast] 花费线索查看另一面（J 之后费用/地点受限）。
    for (const enemy of state.enemies || []) {
      if (!isHereticEnemy(state, enemy) || enemy.location !== inv.location) continue
      let cost = 1
      if (enemy.hereticJResolved) {
        cost = Number(enemy.hereticParleyCost) || 2
        if (enemy.hereticParleySpectralOnly && !isSpectralLocation(hereLocation)) continue
      }
      const groupClues = alive(state).reduce((sum, owner) => sum + (Number(owner.clues) || 0), 0)
      if (groupClues < cost) continue
      moves.push({ action: 'scenarioAction', rule: 'hereticParley', enemyId: enemy.id, label: `🤝 谈判：花费 ${cost} 个线索查看异端者的另一面` })
    }
    // 未了之事的 [action] 驱除（数据表给出地点名与技能）。
    for (const threat of inv.threat || []) {
      const rule = threatRule(threat)
      if (!rule) continue
      const targetLocation = (state.locations || []).find(location => location.name === rule.locationName)
      if (!targetLocation || targetLocation.id !== inv.location) continue
      if ((targetLocation.clues || 0) > 0) continue
      for (const skill of rule.skills) {
        moves.push({
          action: 'scenarioAction', rule: 'banishUnfinishedBusiness', threatCode: original(threat), skill,
          label: `⚔️ 驱除未了之事：检定${skillLabel(skill)}(4)`,
        })
      }
    }
    return moves
  },
  performAction(state, inv, move, api) {
    if (move.rule === 'resignHangmansBrook') {
      api.resign(inv.seat)
      return
    }
    if (move.rule === 'flipMyLocation') {
      const flags = flagsFor(state)
      if (flags.flippedThisRound?.round !== state.round) flags.flippedThisRound = { round: state.round, ids: [] }
      flags.flippedThisRound.ids.push(inv.location)
      api.flipSpectral(inv.location, inv.seat)
      return
    }
    if (move.rule === 'spectralWebAttack') {
      performSpectralWebAttack(state, inv, api)
      return
    }
    if (move.rule === 'hereticParley') {
      performHereticParley(state, inv, move, api)
      return
    }
    if (move.rule === 'banishUnfinishedBusiness') {
      performBanish(state, inv, move, api)
      return
    }
    throw new Error(`未知恶罪报应行动：${move.rule}`)
  },

  // ---- 检定 / 混乱标记 ----
  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    delete inv.wosInvestigateBonus
    chaosAfterTest(state, inv, result, api, {
      triggerUnfinishedBusinessForced: (target, threat) => {
        unfinishedBusinessForced(state, target, threat, api)
      },
    })
  },
  resolveChaosToken(state, inv, token, api) {
    return resolveChaos(state, inv, token, api)
  },
  hauntedScript(state, payload, api) {
    return runHauntedScript(state, payload, api)
  },

  // 幕 2 目标：胜利区有 4 张未了之事 → 推进幕 2。
  checkObjectives(state, api) {
    if (actStep(state) !== 2) return
    if (unfinishedBusinessInVictory(state) >= 4) api.advanceAct()
  },

  // ---- 结局 ----
  resolution(state, key, events, api) {
    return applyResolution(state, key, events, api)
  },
  storyResolutionKey(state, key) {
    return key === 'noResolution' ? noResolutionKey(state) : key
  },

  scenarioGaps: [],
  scenarioApproximations: [
    '石板标记/轮末的「触发未了之事的强制能力」→ 由 behavior.unfinishedBusinessForced 按数据表 `forced.kind` 统一实现（威胁区卡实例 code 由 flipEnemyFace 写入）。',
    '异端者「在非幽灵地点获得冷漠且不能被交战」→ 引擎没有 canEngage 读点，用 enemy.aloof + canFightEnemy=false + enemyDamageAllowed=false 承载（不能被交战体现为不能被攻击/伤害；aloof 仍阻止未交战攻击）。',
    '异端者「[fast] 花费 1 线索：谈判，查看另一面」→ 谈判在 behavior.actions 里实现；B/D/F/H 只记录查看（剧情面直接揭示），I/K（J/L）按卡面 Forced 立刻翻回并攻击。',
    'J/L「翻回敌人面并立即攻击」→ 一次 enemyDefeated 结算内完成（flipEnemy 往返 + api.attack），并写这里标记；参数来自 UNFINISHED_BUSINESS_RULES[].immediate。',
    '05184 长明灯「从基础/幽灵牌库抽出」的区分 → 引擎不传抽牌来源；由 behavior.encounterDeckFor 在抽牌前写 scenarioFlags.lastEncounterDeck（显式 drawExtra 的卡由章节 resolver 写同一标记），encounterGainsSurge 的 surgeRule 完成「洗入幽灵牌库 + 涌动 / 放回基础弃牌堆」。',
    '05170/05170b 的隐藏值 X（灵怪敌人数量）→ 卡面扫描把 shroud 记成 -2 占位，definition 归零，由地点数据 shroudRule: perGeist 给出 X。',
    '教堂阁楼的「放在阁楼底下」→ 地点实例 beneath 数组（{code, ownerSeat}，纯 JSON）；cardDrawn 强制与 investigateResult 的取回反应只对 beneathRule: atticBottom 的 175/175b 面生效。',
    '异端者墓地 171「调查时把意志值加入技能值」与教堂阁楼 176「把手牌张数加入技能值」→ 地点数据 investigateBonus，beforeInvestigate 登记 wosInvestigateBonus、statModifier 在本次检定中加值（引擎 statModifier 没有 investigation 上下文）。',
    '闹鬼农田/废弃教堂/绞刑架/教堂地下室/教堂阁楼/异端者墓地的常驻与闹鬼文本 → 地点数据字段（horrorAura/statRule/shroudRule/beneathRule/defeatRule）+ HAUNTED_BY_LOCATION 数据表 + hauntedScript 承载（闭集子句无法表达移动敌人/弃遭遇牌/生成敌人/设定基础值）。',
    '「地点不能被翻到幽灵/非幽灵面」→ 引擎无 CannotBeFlipped 修正词表；behavior.actions 只在该幕允许的方向给出翻面行动（剧情脚本翻面不受影响）。',
    '未了之事的强制在「如同此时是一轮结束」时触发 → 与 roundEnded 共用同一函数（行为一致，触发源不同）。',
    '逐卡规则键放在单卡条目 flags（entryFlags 读点）；条目索引尚未重建时 behavior 回退 definition.CARD_RULES 的同一份键，因此章节行为零卡号分支且离线单测可跑。',
  ],
}

// ---------------------------------------------------------------------------
// 行动实现
// ---------------------------------------------------------------------------
const SKILL_LABELS = { willpower: '意志', intellect: '智识', combat: '战斗', agility: '敏捷' }
function skillLabel(skill) {
  return SKILL_LABELS[skill] || skill
}

function canFlipHere(state, location) {
  if (!location) return false
  // 幕 1 面：地点不能被翻到幽灵面；议程 2 面：地点不能翻到非幽灵面（玩家可见翻面路径）。
  if (actStep(state) === 1) return false
  const spectral = isSpectralLocation(location)
  if (agendaStep(state) >= 2 && spectral) return false
  return true
}

function performSpectralWebAttack(state, inv, api) {
  const groupClues = alive(state).reduce((sum, owner) => sum + (Number(owner.clues) || 0), 0)
  const max = Math.min(3, groupClues)
  const choice = api.choose({
    kind: 'option', source: SPECTRAL_WEB, seat: inv.seat,
    prompt: `幽灵迷网：团队花费几个线索（1–${max}）？`,
    options: Array.from({ length: max }, (_, index) => ({
      id: String(index + 1), label: `花费 ${index + 1} 个线索（+${index + 1} 技能值/+${index + 1} 伤害）`,
    })),
  })
  const spent = Math.max(1, Math.min(max, Number(choice) || 1))
  let remaining = spent
  for (const owner of alive(state)) {
    if (remaining <= 0) break
    const pay = Math.min(remaining, Number(owner.clues) || 0)
    owner.clues -= pay
    remaining -= pay
  }
  const targets = (state.enemies || []).filter(enemy => enemy.location === inv.location && hasTrait(enemy, 'geist'))
  if (!targets.length) {
    api.info?.('🕸️ 这里没有灵怪敌人，幽灵迷网没有目标（线索已花费）。')
    return
  }
  const targetId = api.choose({
    kind: 'target', source: SPECTRAL_WEB, seat: inv.seat,
    prompt: '幽灵迷网：选择攻击的灵怪敌人。',
    options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
  })
  const target = targets.find(enemy => enemy.id === targetId) || targets[0]
  const skillChoice = api.choose({
    kind: 'option', source: SPECTRAL_WEB, seat: inv.seat,
    prompt: '幽灵迷网：本次攻击使用战斗还是意志？',
    options: [{ id: 'combat', label: '使用战斗' }, { id: 'willpower', label: '使用意志' }],
  })
  const skill = skillChoice === 'willpower' ? 'willpower' : 'combat'
  api.test(inv.seat, skill, Number(target.fight) || 0, result => {
    if (result.success) api.damageEnemy(target.id, spent, inv.seat, 'spectralWeb')
  }, spent, { type: 'scenario', name: '幽灵迷网', ability: true })
  api.info?.(`🕸️ ${inv.name} 用幽灵迷网攻击「${target.name}」（+${spent} 技能值/+${spent} 伤害）。`)
}

function performHereticParley(state, inv, move, api) {
  const enemy = (state.enemies || []).find(candidate => candidate.id === move.enemyId)
  if (!enemy) return
  let cost = 1
  if (enemy.hereticJResolved) cost = Number(enemy.hereticParleyCost) || 2
  // 团队花费线索（尽量从线索多的人身上扣）。
  let remaining = cost
  for (const owner of [...alive(state)].sort((left, right) => (right.clues || 0) - (left.clues || 0))) {
    if (remaining <= 0) break
    const pay = Math.min(remaining, Number(owner.clues) || 0)
    owner.clues -= pay
    remaining -= pay
  }
  if (remaining > 0) {
    api.info?.('线索不足，谈判失败。')
    return
  }
  const storyCode = enemy.hereticStory
  const storyRule = threatRule({ code: storyCode })
  api.info?.(`🤝 谈判：查看「异端者」的另一面（${ALL_CARDS[storyCode]?.nameZh || storyCode}）。`)
  if (storyRule?.immediate?.kind === 'cannotBeDefeated' && enemy.hereticJResolved) {
    // J 面：「下次结算本面文本时，改为本幽灵被『驱除』」。
    banishUnfinishedBusiness(state, storyCode, api, enemy)
    return
  }
  if (storyRule?.immediate) {
    // J/L 的 Forced：如同你刚刚击败本异端者——翻回敌人面并立即攻击。
    const entry = flipToUnfinishedBusiness(state, enemy, api, inv.seat)
    if (entry) resolveImmediateUnfinishedBusiness(state, entry, api)
  } else {
    api.cardFlip?.(enemy.hereticFace || original(enemy), '异端者的另一面')
  }
}

function performBanish(state, inv, move, api) {
  const code = move.threatCode
  const rule = threatRule({ code })
  const threat = (inv.threat || []).find(card => original(card) === code)
  if (!rule || !threat) return
  const targetLocation = (state.locations || []).find(location => location.name === rule.locationName)
  if (!targetLocation || targetLocation.id !== inv.location || (targetLocation.clues || 0) > 0) return
  api.test(inv.seat, move.skill, 4, result => {
    if (result.success) banishUnfinishedBusiness(state, code, api)
  }, 0, { type: 'scenario', name: '驱除未了之事', ability: true })
}

// ---------------------------------------------------------------------------
// 幽灵面 haunted 的 script 子句（P2.1 escape）
// ---------------------------------------------------------------------------
const HAUNTED_SCRIPTS = Object.freeze({
  lockResignThisRound(state, inv) {
    inv.wosResignLockedRound = state.round
    return true
  },
  moveNearestSpectralToHere(state, inv, api) {
    const location = here(state, inv)
    const enemy = nearestEnemyWithTrait(state, location.id, 'Spectral')
    if (!enemy) return true
    const next = api.stepToward(enemy.location, location.id)
    if (next && next !== enemy.location) api.moveEnemy(enemy, next)
    return true
  },
  roundSkillPenalty(state, inv) {
    inv.wosRoundSkillPenalty = state.round
    return true
  },
  discardStandardForWitch(state, inv, api) {
    return discardEncounterForTrait(state, inv, api, { deckId: null, trait: 'witch' })
  },
  discardSpectralForGeist(state, inv, api) {
    return discardEncounterForTrait(state, inv, api, { deckId: 'spectral', trait: 'geist' })
  },
  baseWillpowerOne(state, inv) {
    inv.wosBaseWillpower = { round: state.round }
    return true
  },
  healHereticsAndWitches(state, inv) {
    for (const enemy of state.enemies || []) {
      if (!hasTrait(enemy, 'witch') && !isHereticEnemy(state, enemy)) continue
      enemy.damageTaken = Math.max(0, (Number(enemy.damageTaken) || 0) - 1)
    }
    return true
  },
  spawnReanimatedDead(state, inv, api) {
    const code = inv.deck?.pop()
    if (!code) return true
    inv.discard ||= []
    api.spawnStoryEnemy?.('xreanimated', inv.location, {
      fight: 1, health: 1, evade: 1, damage: 1, horror: 0, traits: ['Monster', 'Spectral'],
      name: '苏生亡者',
    }, { underlyingCard: code })
    api.info?.('🧟 你牌库顶的卡牌被生成成苏生亡者并与你交战。')
    return true
  },
  hexFromDiscardToThreat(state, inv, api) {
    const index = (state.encounterDiscard || []).findLastIndex(code => hasTrait({ code }, 'hex')
      && ALL_CARDS[code]?.type === 'treachery')
    if (index < 0) return true
    const code = state.encounterDiscard.splice(index, 1)[0]
    api.threat(inv.seat, code)
    api.info?.(`🕯️ 遭遇弃牌堆最顶部的巫术诡计进入 ${inv.name} 的威胁区。`)
    return true
  },
  discardBeneathAttic(state, inv, api) {
    const location = here(state, inv)
    const beneath = location?.beneath || []
    if (!beneath.length) return true
    const index = Math.floor((api.random ? api.random() : 0.5) * beneath.length)
    const entry = beneath.splice(index, 1)[0]
    const owner = state.investigators?.[entry.ownerSeat]
    ;(owner?.discard || inv.discard).push(entry.code)
    api.info?.('📦 教堂阁楼底下的一张卡牌被随机弃掉。')
    return true
  },
  randomDiscardAtAttic(state, inv, api) {
    const amount = (inv.hand || []).length >= 5 ? 2 : 1
    api.discardRandom(inv.seat, amount)
    return true
  },
})

// 「弃牌库顶 3 张；如果因此弃掉一个[[女巫]]/[[灵怪]]敌人，将其抽取」。
function discardEncounterForTrait(state, inv, api, { deckId, trait }) {
  const piles = deckId ? extraDeckPiles(state, deckId) : null
  const deck = piles ? piles.deck : state.encounterDeck
  const discard = piles ? piles.discard : state.encounterDiscard
  const drawnEnemies = []
  for (let index = 0; index < 3 && deck.length; index++) {
    const code = deck.pop()
    const isTraitEnemy = ALL_CARDS[code]?.type === 'enemy' && hasTrait({ code }, trait)
    if (isTraitEnemy) drawnEnemies.push(code)
    else discard.push(code)
  }
  for (const code of drawnEnemies) {
    if (inv.defeated || inv.resigned) break
    api.spawnEngaged(code, inv.location, inv.seat)
    api.info?.(`👁️ 「${ALL_CARDS[code]?.nameZh || code}」因闹鬼效果被抽出并与 ${inv.name} 交战。`)
  }
  return true
}

function runHauntedScript(state, payload, api) {
  const scriptId = String(payload?.scriptId || payload?.id || '')
  const seat = Number(payload?.seat)
  const inv = state.investigators?.[seat]
  if (!inv || !here(state, inv)) return false
  const handler = HAUNTED_SCRIPTS[scriptId]
  return handler ? handler(state, inv, api) === true : false
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
const RESOLUTION_KEYS = ['noResolution', 'r1', 'r2', 'r3']

function noResolutionKey(state) {
  return (state.investigators || []).some(inv => inv.resigned) ? 'r1' : 'r2'
}

function hereticCountInPlay(state) {
  return (state.enemies || []).filter(enemy => isHereticEnemy(state, enemy)).length
}

function recordHereicsUnleashed(state, api) {
  // 参考实现：remained = act step 1 时固定 4，否则场上异端者数量。
  const count = actStep(state) === 1 ? 4 : hereticCountInPlay(state)
  recordsFor(state).hereticsWereUnleashedUntoArkham = count
  flagsFor(state).hereticsUnleashedCount = count
  api.info?.(`📓 有 ${count} 名异端者被释放到阿卡姆。`)
  if (count <= 3) recordMemento(state, 'wispOfSpectralMist')
  return count
}

function applyResolution(state, key, events, api) {
  if (!RESOLUTION_KEYS.includes(key)) throw new Error(`未知恶罪报应结局：${key}`)
  const finalKey = key === 'noResolution' ? noResolutionKey(state) : key
  const records = recordsFor(state)
  if (finalKey === 'r1') {
    recordHereicsUnleashed(state, api)
    api.info?.('📓 结局 1：异端者被释放，绞刑者山丘恢复了原样。')
    return { award: true, bonus: 0 }
  }
  if (finalKey === 'r2') {
    records.theInvestigatorsSurvivedTheWatchersEmbrace = true
    recordHereicsUnleashed(state, api)
    api.info?.('📓 结局 2：调查员从看守人之拥下存活。')
    return { award: true, bonus: 0 }
  }
  records.hereticsWereUnleashedUntoArkham = 1
  records.erynnJoinedTheInvestigators = true
  recordMemento(state, 'bloodyTreeCarvings')
  api.info?.('📓 结局 3：艾琳加入了调查员；记录血染树雕。')
  return { award: true, bonus: 0 }
}

export {
  applyResolution, canFlipHere, flipBackToHeretic, flipToUnfinishedBusiness, locationGroupOf,
  locationShroudModifier, noResolutionKey, renderLocationRule, rulesOf,
  setupLocations as buildSetupPlan, threatRule, unfinishedBusinessEntry,
}
