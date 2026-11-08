# 章节 toTheForbiddenPeaks · To the Forbidden Peaks · 参考卡 08596

## 文件清单
- definition: content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/definition.js (11398B)
- behavior: content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/behavior.js (25384B)
- chaos: content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/chaos.js (3914B)
- index: content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/index.js (1526B)
- layout: content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/layout.js (870B)
- texts: content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/texts.js (1865B)

## 章节卡号
08596 08597 08598 08599 08600 08601 08602 08603 08604 08605 08606 08607 08608 08609 08610 08611 08612 08613 08614 08615 08616 08617 08618 08619 08620

## 指南来源
- en: frontend/src/locales/en/edgeOfTheEarth/scenarios/toTheForbiddenPeaks.json (16090B, keys=51)
- zh: frontend/src/locales/zh/edgeOfTheEarth/scenarios/toTheForbiddenPeaks.json (12443B, keys=32)

## 相关测试
- tests/eote-scenario-toTheForbiddenPeaks.test.mjs

## content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/definition.js
```js
// 失落之峰（To the Forbidden Peaks · 08596）· 剧本数据（scenario 对象只含数据，不含函数）。
//
// 参考：参考实现 `Scenarios/EdgeOfTheEarth/ToTheForbiddenPeaks/Helpers.hs`（row = level，
// `below` = row-1）、locale `scenarios/toTheForbiddenPeaks.json`（setup/resolutions/tokens）、
// `Campaigns/EdgeOfTheEarth/Helpers.hs`（记录键）。卡面数据来自 `src/cards/cards-data.js`，
// 卡牌行为在 `src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/<code>.js`。
//
// 文本来源（P7）：`content/campaigns/edgeOfTheEarth/story-access.js` 的 `chapterSection`；
// story-text 章节正文由 p2-flow 生成，本章不写死剧情正文（缺失时 texts.js 回退到卡片印刷文本）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { location, stage, printed, identitiesFor } from '../../card-data.js'
import { flattenStory } from '../../story-access.js'
import { storySections, storyTextOf, resolutionTextOf, sectionCountOf } from './texts.js'
import { TO_THE_FORBIDDEN_PEAKS_TOKEN_MEANINGS } from './chaos.js'

export const CHAPTER_ID = 'toTheForbiddenPeaks'
export const REFERENCE_CODE = '08596'

// —— 卡号常量（只做命名，不按卡号写流程分支）——
export const RAW_CODES = Object.freeze({
  scenario: '08596', agenda1: '08597', agenda2: '08598', act1: '08599',
  deepDrifts: '08600', whiteBluff: '08601', steepIncline: '08602', narrowRidge: '08603',
  rockyLedge: '08604', snowCoveredCrag: '08605', windsweptPath: '08606', summit: '08607',
  terrorOfTheStars: '08608', constrictingElderThing: '08609',
  snowfall: '08610', avalanche: '08611', hangingOnTheEdge: '08612', hypothermia: '08613',
  greenSoapstone: '08614', woodenSledge: '08615', dynamite: '08616', miasmicCrystal: '08617',
  mineralSpecimen: '08618', smallRadio: '08619', spareParts: '08620',
})

// 本章遭遇组（camelCase）。其余四个组（Deadly Weather / Elder Things / Hazards of Antarctica /
// Nameless Horrors）与 Tekeli-li 牌库是战役级共享组，由 requiredEncounterGroupIds 声明。
export const GATHER_GROUPS = Object.freeze(['toTheForbiddenPeaks'])
export const SHARED_GROUPS = Object.freeze([
  'deadlyWeather', 'elderThings', 'hazardsOfAntarctica', 'namelessHorrors', 'tekelili',
])

// 山腰地点里随机取 5 个排成斜线（level 0–4），其余 2 个放一边。参考实现是洗牌随机；
// 本实现固定取 08600/08602/08603/08604/08605 作为在场斜线，08601/08606 放一边
// （deterministic 开局的近似，见 behavior.scenarioApproximations）。
export const MOUNTAINSIDE_IN_PLAY = Object.freeze([
  'deepDrifts', 'steepIncline', 'narrowRidge', 'rockyLedge', 'snowCoveredCrag',
])
export const MOUNTAINSIDE_SET_ASIDE = Object.freeze(['whiteBluff', 'windsweptPath'])
export const SUMMIT = 'summit'
export const START_LOCATION = 'deepDrifts'

// 七件 Expedition 剧情支援：开局放一边；按 Campaign Log「Supplies Recovered」入场。
export const EXPEDITION_ASSETS = Object.freeze([
  'greenSoapstone', 'woodenSledge', 'dynamite', 'miasmicCrystal',
  'mineralSpecimen', 'smallRadio', 'spareParts',
])

// 地点：id → 印刷卡号 / level / 连接 / 胜负点。level 就是参考实现的 row（底部 0 → 山顶 5）。
const chain = [START_LOCATION, ...MOUNTAINSIDE_IN_PLAY.slice(1), SUMMIT]
const locationData = (id, code, level, extra = {}) => location({
  id, code,
  cluesFixed: true, clues: ALL_CARDS[code].clues || 0,
  level, connections: [], ...extra,
})
export const LOCATIONS = Object.freeze({
  deepDrifts: locationData('deepDrifts', RAW_CODES.deepDrifts, 0),
  steepIncline: locationData('steepIncline', RAW_CODES.steepIncline, 1),
  narrowRidge: locationData('narrowRidge', RAW_CODES.narrowRidge, 2),
  rockyLedge: locationData('rockyLedge', RAW_CODES.rockyLedge, 3),
  snowCoveredCrag: locationData('snowCoveredCrag', RAW_CODES.snowCoveredCrag, 4),
  summit: locationData('summit', RAW_CODES.summit, 5),
  whiteBluff: locationData('whiteBluff', RAW_CODES.whiteBluff, null),
  windsweptPath: locationData('windsweptPath', RAW_CODES.windsweptPath, null),
})
// 斜线连接：每个地点与上下相邻地点相连（参考 helpers 的 below/inRow；跨一层是攀登原语契约）。
for (let index = 0; index < chain.length; index += 1) {
  const id = chain[index]
  const next = chain[index + 1]
  if (next) {
    LOCATIONS[id].connections.push(next)
    LOCATIONS[next].connections.push(id)
  }
}
for (const [, location] of Object.entries(LOCATIONS)) {
  const card = ALL_CARDS[location.originalCode]
  if (card?.shroud != null) location.shroud = card.shroud
  if (card && Object.hasOwn(card, 'victory')) location.victory = card.victory
}

export const START_LOCATION_ID = START_LOCATION
export const SET_ASIDE_LOCATIONS = Object.freeze([...MOUNTAINSIDE_SET_ASIDE])

// —— 遭遇牌定义（只取本章卡号段内的敌人/诡计；共享组由 group 声明）——
const IN_RANGE_ENEMIES = [RAW_CODES.terrorOfTheStars, RAW_CODES.constrictingElderThing]
const IN_RANGE_TREACHERIES = [RAW_CODES.snowfall, RAW_CODES.avalanche, RAW_CODES.hangingOnTheEdge, RAW_CODES.hypothermia]
const IN_RANGE_STORY_ASSETS = EXPEDITION_ASSETS.map(id => LOCATIONS[id] ? null : RAW_CODES[id]).filter(Boolean)
export const ENEMY_CODES = Object.freeze(IN_RANGE_ENEMIES)
export const TREACHERY_CODES = Object.freeze(IN_RANGE_TREACHERIES)
export const ASSET_CODES = Object.freeze(IN_RANGE_STORY_ASSETS)

const enemyDefinition = code => {
  const card = ALL_CARDS[code]
  return {
    code, originalCode: code, name: card.nameZh || card.name, nameEn: card.name,
    subname: card.subnameZh || card.subname || '', text: card.textZh || card.text || '',
    traits: [...(card.traits || [])], fight: card.fight ?? null, evade: card.evade ?? null,
    health: card.health ?? null, ...(card.healthPerInvestigator ? { healthPerInvestigator: true } : {}),
    damage: card.damage || 0, horror: card.horror || 0,
    ...(Object.hasOwn(card, 'victory') ? { victory: card.victory } : {}),
    elite: (card.traits || []).includes('Elite'),
    hunter: /\bHunter\b/.test(card.text || ''),
    massive: /\bMassive\b/.test(card.text || ''),
  }
}
const treacheryDefinition = code => {
  const card = ALL_CARDS[code]
  return {
    code, originalCode: code, name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '', traits: [...(card.traits || [])],
    textEn: card.text || '',
  }
}
const assetDefinition = code => {
  const card = ALL_CARDS[code]
  return {
    code, originalCode: code, name: card.nameZh || card.name, nameEn: card.name,
    subname: card.subnameZh || card.subname || '', text: card.textZh || card.text || '',
    traits: [...(card.traits || [])], global: true, clues: 0,
    ...(card.health != null ? { health: card.health } : {}),
    ...(card.sanity != null ? { sanity: card.sanity } : {}),
  }
}

export const enemies = Object.freeze(Object.fromEntries(ENEMY_CODES.map(code => [code, enemyDefinition(code)])))
export const treacheries = Object.freeze(Object.fromEntries(TREACHERY_CODES.map(code => [code, treacheryDefinition(code)])))
export const storyAssets = Object.freeze(Object.fromEntries(ASSET_CODES.map(code => [code, assetDefinition(code)])))

// 初始遭遇牌库（本章段内）：3×降雪 + 2×雪崩 + 3×悬于边缘 + 3×低温症 + 3×拘束型古老者。
const deckList = []
for (const code of IN_RANGE_TREACHERIES) for (let i = 0; i < (ALL_CARDS[code].quantity || 1); i += 1) deckList.push(code)
for (const code of IN_RANGE_ENEMIES.filter(code => code !== RAW_CODES.terrorOfTheStars)) {
  for (let i = 0; i < (ALL_CARDS[code].quantity || 1); i += 1) deckList.push(code)
}
export const ENCOUNTER_DECK = Object.freeze(deckList)

// 开局放一边：2 个山腰地点 + 星之恐怖 + 7 件 Expedition 支援。
export const SET_ASIDE_CODES = Object.freeze([
  ...MOUNTAINSIDE_SET_ASIDE.map(id => LOCATIONS[id].code),
  RAW_CODES.terrorOfTheStars,
  ...IN_RANGE_STORY_ASSETS,
])
export const SET_ASIDE_ALIASES = SET_ASIDE_CODES

// —— 幕 / 议程（纯数据；chapterFlow 由 behavior 读）——
const actDefinition = (code, extra) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number: 1 }), id: 'act1', originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '',
    ...extra,
  }
}
const agendaDefinition = (code, number, extra) => {
  const card = ALL_CARDS[code]
  return {
    ...stage(code, { number, doom: card.doom }), id: `agenda${number}`, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    text: card.textZh || card.text || '',
    backText: card.backTextZh || card.backText || '',
    ...extra,
  }
}
export const acts = Object.freeze([
  actDefinition(RAW_CODES.act1, { objective: { type: 'allResigned' }, chapterFlow: 'ascendTheMountain' }),
])
export const agendas = Object.freeze([
  agendaDefinition(RAW_CODES.agenda1, 1, { chapterFlow: 'forbiddenPeaks' }),
  agendaDefinition(RAW_CODES.agenda2, 2, { chapterFlow: 'terrorPrevails' }),
])

// —— 结局：参考 locale resolutions；正文来自 story-access（p2-flow 生成） ——
const sections = storySections(CHAPTER_ID) || {}
const introText = [flattenStory(sections.intro1), flattenStory(sections.intro2)].filter(Boolean).join('\n\n')
export const resolutions = Object.freeze({
  noResolution: resolutionTextOf(CHAPTER_ID, 'resolutions.noResolution', '所有调查员都被击败。'),
  resolution1: resolutionTextOf(CHAPTER_ID, 'resolutions.resolution1', '调查员们找到了通路。'),
  resolution2: resolutionTextOf(CHAPTER_ID, 'resolutions.resolution2', '调查员们未能到达山顶。'),
})

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'zh-CN',
  textStatus: 'translated (self-translated)',
  sectionCount: sectionCountOf(CHAPTER_ID),
  introTitle: flattenStory(sections.heading) || '失落之峰',
  intro: introText,
  setup: storyTextOf(CHAPTER_ID, 'setup', ''),
  specialRules: storyTextOf(CHAPTER_ID, 'interlude', ''),
})

export const scenario = Object.freeze({
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  name: ALL_CARDS[REFERENCE_CODE].nameZh || ALL_CARDS[REFERENCE_CODE].name,
  nameEn: ALL_CARDS[REFERENCE_CODE].name,
  referenceCode: REFERENCE_CODE,
  migrationStatus: 'development',
  startLocation: START_LOCATION,
  locations: LOCATIONS,
  setAsideLocations: SET_ASIDE_LOCATIONS,
  enemies, treacheries, storyAssets,
  acts, agendas, resolutions,
  encounterDeck: ENCOUNTER_DECK,
  tokenMeanings: TO_THE_FORBIDDEN_PEAKS_TOKEN_MEANINGS,
  ...SCENARIO_TEXT,
})

export const identities = Object.freeze(identitiesFor(scenario))

// 审计/覆盖用：本章单卡条目的原卡号（参考卡 08596 不建条目）。
export const CHAPTER_ENTRY_CODES = Object.freeze([
  RAW_CODES.agenda1, RAW_CODES.agenda2, RAW_CODES.act1,
  ...Object.values(LOCATIONS).map(location => location.originalCode),
  ...ENEMY_CODES, ...TREACHERY_CODES, ...ASSET_CODES,
])
export const entryCodes = () => CHAPTER_ENTRY_CODES
export const enemyCodesFor = () => ENEMY_CODES

// 供 manifest / 测试复用的常量。
export const RECORD_READS = Object.freeze(['suppliesRecovered', 'theInvestigatorsScoutedTheMountainPass'])
export const RECORD_WRITES = Object.freeze(['theInvestigatorsScoutedTheMountainPass'])
export { printed }

```

## content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/behavior.js
```js
// 失落之峰（To the Forbidden Peaks · 08596）· 引擎钩子（章节流程 + 攀登/高度机械）。
//
// 约定（与 TDE 章节 behavior 相同）：
//   · 逐卡规则在单卡条目的 actRule / agendaRule / locationRule / enemyRule / encounterResolve / flags；
//     behavior 只做分派与本章专属机械（攀登、高度、探险支援丢失、结局记录），不按卡号写分支。
//   · 内容层（behavior）允许直接读写 state；卡条目禁止，只拿 ctx.api。
//   · 攀登/高度统一走 P2 原语：`src/engine/vertical-chain.js`（location.level ↔ row）与
//     `src/engine/eote-climb.js`（ascend/descend/enterFromBelow/cluesLostOnMove/dropExpeditionAssets）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  actRuleFor, agendaRuleFor, encounterResolveFor, enemyRuleFor, entryFlags, locationRuleFor,
  resolveDeclarativeTreacheryTest, treacheryRuleFor, treacheryTestFor,
} from '../../../../../src/cards/card-rules.js'
import {
  ascend as climbAscend, climbState, descend as climbDescend, cluesLostOnMove, dropExpeditionAssets,
} from '../../../../../src/engine/eote-climb.js'
import { locationLevel, setLocationLevel } from '../../../../../src/engine/vertical-chain.js'
import { tekeliShuffleIn } from '../../../../../src/engine/eote-tekeli.js'
import {
  TO_THE_FORBIDDEN_PEAKS_TOKEN_MEANINGS, toTheForbiddenPeaksAfterTest, toTheForbiddenPeaksChaosToken, cardNameOf,
} from './chaos.js'
import {
  EXPEDITION_ASSETS, MOUNTAINSIDE_IN_PLAY, RAW_CODES, SET_ASIDE_CODES, SET_ASIDE_LOCATIONS,
  START_LOCATION, SUMMIT, enemyCodesFor, entryCodes,
} from './definition.js'

const CHAPTER_ID = 'toTheForbiddenPeaks'
const codeOf = card => card?.originalCode || card?.code || card
const locationOf = (state, inv) => (state.locations || []).find(item => item.id === inv?.location) || null
const codeOfLocationId = (state, id) => codeOf((state.scenario?.locations || {})[id])
const locationIdOfCode = (state, code) => Object.entries(state.scenario?.locations || {})
  .find(([, definition]) => codeOf(definition) === code)?.[0] || null
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const levelOf = (state, id) => {
  const location = (state.locations || []).find(item => item.id === id)
  const level = location ? locationLevel(location) : null
  return Number.isSafeInteger(level) ? level : 0
}
const belowIdOf = (state, id) => (state.locations || [])
  .find(item => locationLevel(item) === levelOf(state, id) - 1)?.id || null
const aliveInvestigators = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const engagedEnemies = (state, seat) => (state.enemies || []).filter(enemy => enemy.engagedSeat === seat)
const isExpeditionAsset = asset => {
  const code = codeOf(asset?.code ? { code: asset.code } : asset)
  return EXPEDITION_ASSETS.some(id => RAW_CODES[id] === code)
    || String(asset?.traits || ALL_CARDS[asset?.code]?.traits || []).toLowerCase().includes('expedition')
}

// —— 开场/布置 ——
export const scenarioApproximations = Object.freeze([
  '七个山腰地点印刷为「洗牌后随机取 5 个排成斜线」；本实现固定 08600/08602/08603/08604/08605 入场，08601/08606 放一边（确定性开局）。',
])
export const scenarioGaps = Object.freeze([])

export const implementedEncounterCodes = Object.freeze([...entryCodes()])

export const behavior = {
  id: CHAPTER_ID,
  implementedEncounterCodes,
  scenarioApproximations,
  scenarioGaps,
  tokenMeanings: TO_THE_FORBIDDEN_PEAKS_TOKEN_MEANINGS,

  // ---- 开局介绍：是否勘察过山口（Campaign Log） ----
  preScenarioSetup(state, events, api) {
    const flags = (state.scenarioFlags ||= {})
    if (flags.introResolved) return
    flags.introResolved = true
    const scouted = recordsFor(state).theInvestigatorsScoutedTheMountainPass === true
    flags.scoutedTheMountainPass = scouted
    api?.info?.(scouted
      ? '🏔️ 队伍已勘察过山口：跳过开场，直接布置。'
      : '🏔️ 队伍尚未勘察山口：按序幕进入失落之峰。')
  },

  // ---- 布置：5 个山腰地点斜线 + 山顶；其余地点/星之恐怖/7 件探险支援放一边 ----
  setupLocations(state, events, helper = {}) {
    const zones = (state.scenarioZones ||= {})
    const flags = (state.scenarioFlags ||= {})
    const placed = [...MOUNTAINSIDE_IN_PLAY.map(id => locationIdOfCode(state, RAW_CODES[id]) || id), SUMMIT]
    // level 与连接由数据声明；这里把 level 写回运行时 location（vertical-chain 读点）。
    for (const id of placed) {
      const location = (state.locations || []).find(item => item.id === id)
      if (!location) continue
      const level = state.scenario?.locations?.[id]?.level
      if (Number.isSafeInteger(level)) setLocationLevel(location, level)
      location.revealed = id === locationIdOfCode(state, RAW_CODES.deepDrifts)
      if (location.revealed) flags.revealedLevel = 0
    }
    zones.setAside = [...SET_ASIDE_CODES]
    zones.removed = []
    zones.victory = zones.victory || []
    flags.encounterDeckReady = true
    helper.info?.(state, events, '🏔️ 失落之峰：五个山腰地点排成斜线，山顶位于顶端；其余地点、星之恐怖与探险支援放在一边。')
    return placed
  },

  setupEnemies() {},

  // ---- 幕/议程钩子：逐卡 actRule/agendaRule.onReveal 分派 ----
  actReveal(state, act, api) {
    const rule = actRuleFor(codeOf(act))
    if (!rule) return false
    if (rule.onReveal === 'resolution1') {
      api?.finish?.('resolution1')
      return true
    }
    if (typeof rule.onReveal === 'function') return rule.onReveal(state, act, api) === true
    return false
  },

  agendaReveal(state, agenda, api) {
    const rule = agendaRuleFor(codeOf(agenda))
    if (!rule) return false
    const action = rule.onReveal
    if (action === 'spawnTerrorOfTheStars') return Boolean(behavior.spawnTerrorOfTheStars(state, api))
    if (action === 'finalResolution') {
      const key = behavior.finalResolution(state)
      behavior.resolution(state, key, [], api)
      api?.finish?.(key)
      return true
    }
    if (action === 'addFrostToken') return behavior.addFrostToken(state, api) != null
    if (typeof action === 'function') return action(state, agenda, api) === true
    return false
  },

  // 山顶揭示：混乱袋加入 1 个 frost 标记。
  addFrostToken(state, api) {
    state.chaosBag ||= []
    state.chaosBag.push('frost')
    api?.addChaosToken?.('frost')
    api?.info?.('❄️ 山顶被揭示：混乱袋加入 1 个 [frost] 标记。')
    return 'frost'
  },

  // 地点揭示钩子：山顶加 frost；迎风通路按人数放线索。
  locationRevealed(state, location, api) {
    const id = typeof location === 'string' ? location : location?.id
    const rule = locationRuleFor(codeOfLocationId(state, id))
    if (!rule?.onReveal) return null
    if (rule.onReveal === 'addFrostToken') return behavior.addFrostToken(state, api)
    if (rule.onReveal?.effect === 'placeCluesPerInvestigator') {
      const target = (state.locations || []).find(item => item.id === id)
      const amount = (Number(state.numInvestigators) || (state.investigators || []).length || 1) * (rule.onReveal.amount || 1)
      if (target) target.clues = (target.clues || 0) + amount
      api?.info?.(`❄️ 迎风通路揭示：放置 ${amount} 个线索。`)
      return amount
    }
    return null
  },

  // 议程 1 背面（08597）：在最高且有调查员的地点放置星之恐怖；该地点所有调查员失去探险支援。
  spawnTerrorOfTheStars(state, api) {
    const occupied = (state.investigators || []).filter(inv => inv.location)
    if (!occupied.length) return null
    const highest = occupied.map(inv => locationOf(state, inv)).filter(Boolean)
      .sort((a, b) => locationLevel(b) - locationLevel(a))[0]
    if (!highest) return null
    const enemy = {
      id: `enemy-${RAW_CODES.terrorOfTheStars}`, code: RAW_CODES.terrorOfTheStars,
      originalCode: RAW_CODES.terrorOfTheStars, location: highest.id, engagedSeat: null,
      exhausted: false, damageTaken: 0, spawned: true,
    }
    state.enemies ||= []
    state.enemies.push(enemy)
    for (const inv of occupied.filter(inv => inv.location === highest.id)) dropExpeditionAssetsOf(state, inv, api)
    api?.info?.(`🌠 「星之恐怖」在 ${highest.id}（最高处）入场；该地点的调查员失去所有探险支援。`)
    return enemy
  },

  // ---- 目标检查：所有未被击败的调查员都撤退 → 推进（幕 1 目标） ----
  checkObjectives(state, api) {
    const act = state.acts?.[state.actIndex ?? 0]
    const rule = actRuleFor(codeOf(act))
    if (rule?.objective?.type === 'allResigned') {
      const alive = (state.investigators || []).filter(inv => !inv.defeated)
      if (!alive.length) return true
      return alive.every(inv => inv.resigned === true)
    }
    return false
  },

  // ---- 地点进入（攀登「从下方进入」的强制效果） ----
  locationEntered(state, inv, location, api) {
    const id = typeof location === 'string' ? location : location?.id
    const climb = climbState(state)?.seats?.[String(inv.seat)]
    const fromBelow = climb?.enterFromBelow === true && String(climb.to) === String(id)
    if (!fromBelow) return null
    const code = codeOfLocationId(state, id)
    const rule = locationRuleFor(code)
    if (!rule?.enterFromBelow) return null
    return applyEnterFromBelow(state, inv, id, rule.enterFromBelow, api)
  },

  // ---- 移动校验：跨层只能走攀登原语；山腰背面「下方地点无线索」限制 ----
  moveError(state, inv, destination, id) {
    // 引擎/投影传地点对象（TCU/TDE 同口径），测试/旧调用可能传字符串；两种都接受。
    const toId = typeof destination === 'string' ? destination : (destination?.id ?? id)
    const from = locationOf(state, inv)
    if (!from) return '当前地点不存在'
    const target = (state.locations || []).find(item => item.id === toId)
    if (!target) return '目标地点不存在'
    const fromLevel = locationLevel(from)
    const toLevel = locationLevel(target)
    if (Number.isSafeInteger(fromLevel) && Number.isSafeInteger(toLevel)) {
      if (toLevel === fromLevel) return null
      if (Math.abs(toLevel - fromLevel) !== 1) return '只能沿山腰逐层移动（Level ±1）'
      if (toLevel > fromLevel) {
        const rule = locationRuleFor(codeOfLocationId(state, toId))
        if (rule?.blocksUntilBelowClear) {
          const below = belowIdOf(state, toId)
          const belowLocation = below && (state.locations || []).find(item => item.id === below)
          if (belowLocation && (belowLocation.clues || 0) > 0) return '下方地点的线索尚未全部发现，不能进入'
        }
      }
    }
    return null
  },

  // ---- 攀登包装（测试与章节流程共用；真正位移仍由调用方走权威移动管线） ----
  ascend(state, inv, toId) {
    const transition = climbAscend(state, inv, toId)
    if (transition) recordMove(state, inv, toId)
    return transition
  },

  descend(state, inv, toId) {
    const transition = climbDescend(state, inv, toId)
    if (transition) recordMove(state, inv, toId)
    return transition
  },

  climbLevel(state, inv) {
    const location = locationOf(state, inv)
    return location ? locationLevel(location) : 0
  },

  // 移动后：议程 1/2 正面强制「将你的全部线索放回供应堆」。
  afterMove(state, inv, api) {
    const agenda = state.agendas?.[state.agendaIndex ?? 0]
    const forced = agendaRuleFor(codeOf(agenda))?.onMove
    if (forced === 'returnClues') {
      const amount = cluesLostOnMove(state, inv)
      if (amount) {
        inv.clues = 0
        api?.info?.('❄️ 移动后：将全部线索放回供应堆（议程强制）。')
      }
    }
    return behavior.locationEntered(state, inv, inv.location, api)
  },

  // ---- 遭遇卡结算（treacheryRule.resolveKind 数据驱动；behavior 只做分派） ----
  resolveEncounter(state, inv, card, api) {
    const code = codeOf(card)
    const entryResolve = encounterResolveFor(code)
    if (entryResolve) return entryResolve(state, inv, card, api, { location: locationOf(state, inv) })
    const kind = treacheryRuleFor(code)?.resolveKind
    const handler = kind && TREACHERY_HANDLERS[kind]
    if (handler) return handler(state, inv, card, api) !== false
    const declarative = treacheryTestFor(code)
    if (declarative) return resolveDeclarativeTreacheryTest(state, inv, card, api, declarative)
    return false
  },

  // ---- 混乱标记 ----
  resolveChaosToken(state, inv, token) {
    return toTheForbiddenPeaksChaosToken(state, inv, token)
  },

  afterTest(state, inv, result, api) {
    const riders = toTheForbiddenPeaksAfterTest(state, inv, result) || []
    for (const rider of riders) {
      if (rider === 'moveBelow') moveBelow(state, inv, api)
      else if (rider === 'dropExpedition') dropExpeditionAssetsOf(state, inv, api)
      else if (rider === 'elderThing') nearestElderThingMovesAndAttacks(state, inv, api)
    }
    return riders
  },

  // ---- 敌人修正：X = 所在地点 level（08609）；08608 生命 +3/人 ----
  enemyStatModifier(state, enemy, stat) {
    const rule = enemyRuleFor(codeOf(enemy))
    if (!rule?.levelStats) return 0
    if (stat === 'health' && (rule.perInvestigatorHealth === true || rule.levelStats === 'perInvestigator')) {
      return 3 * (Number(state.numInvestigators) || (state.investigators || []).length || 1)
    }
    return levelOf(state, enemy?.location || '') || 1
  },

  // ---- 轮末：星之恐怖强制把同地点调查员移到下方 ----
  roundEnded(state, api) {
    const terror = (state.enemies || []).find(enemy => codeOf(enemy) === RAW_CODES.terrorOfTheStars && !enemy.defeated)
    if (!terror?.location) return false
    for (const inv of (state.investigators || [])) {
      if (inv.location !== terror.location || inv.defeated || inv.resigned) continue
      moveBelow(state, inv, api)
    }
    return true
  },

  // ---- 行动：山顶撤退；幕 1「控制本地点一个探险支援」 ----
  actions(state, inv, api) {
    const moves = []
    const id = inv?.location
    if (id === locationIdOfCode(state, RAW_CODES.summit)) {
      moves.push({ action: 'scenarioAction', rule: 'summitResign', actions: 1, label: '🏔️ 山顶：撤退（探险支援加入胜利区）' })
    }
    if ((inv?.assets || []).some(asset => isExpeditionAsset(asset)) === false) {
      const hasLocal = (state.storyAssets || []).some(asset => asset.location === id && isExpeditionAsset(asset))
      if (hasLocal) moves.push({ action: 'scenarioAction', rule: 'takeExpeditionAsset', actions: 1, label: '🎒 控制本地点的一件探险支援' })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    if (!move) return false
    if (move.rule === 'summitResign') {
      const victory = (state.victoryDisplay ||= [])
      for (const asset of inv.assets || []) {
        if (!isExpeditionAsset(asset)) continue
        victory.push({ code: asset.code, originalCode: asset.code, victory: 0 })
      }
      inv.assets = (inv.assets || []).filter(asset => !isExpeditionAsset(asset))
      inv.clues = 0
      inv.resigned = true
      api?.resign?.(inv.seat)
      api?.info?.('🏔️ 从山顶撤退：探险支援加入胜利区，线索放回供应堆。')
      return true
    }
    if (move.rule === 'takeExpeditionAsset') {
      const asset = (state.storyAssets || []).find(item => item.location === inv.location && isExpeditionAsset(item))
      if (!asset) return false
      state.storyAssets = state.storyAssets.filter(item => item !== asset)
      inv.assets ||= []
      inv.assets.push(asset)
      api?.info?.(`🎒 ${inv.name} 控制「${cardNameOf(asset.code)}」。`)
      return true
    }
    return false
  },

  // 引擎签名：resolution(state, resolutionKey, events, api)（同 TIC/TDE/Heart of Madness）。
  resolution(state, key, events, api = {}) {
    const records = recordsFor(state)
    records.theInvestigatorsScoutedTheMountainPass = state.scenarioFlags?.scoutedTheMountainPass === true
    return key
  },

  // 结局分派（由 agenda2 背面调用）：有调查员撤退 → 结局 1，否则结局 2。
  finalResolution(state) {
    const resigned = (state.investigators || []).some(inv => inv.resigned)
    return resigned ? 'resolution1' : 'resolution2'
  },

  // 完整结局列表（manifest 用）。
  resolutionIds: ['noResolution', 'resolution1', 'resolution2'],
}

// —— 章节内部工具（不按卡号分支；entry 数据驱动）——

function recordMove(state, inv, toId) {
  const fromId = inv.location
  const fromLevel = levelOf(state, fromId)
  const toLevel = levelOf(state, toId)
  inv.location = toId
  const flags = (state.scenarioFlags ||= {})
  flags.lastClimb = { from: fromId, to: toId, fromLevel, toLevel, direction: toLevel >= fromLevel ? 'up' : 'down' }
  const target = (state.locations || []).find(item => item.id === toId)
  if (target && !target.revealed) target.revealed = true
  return flags.lastClimb
}

function applyEnterFromBelow(state, inv, id, spec, api) {
  const kind = spec.effect || spec
  if (kind === 'discardTop3ThenDrawWeaknesses') {
    const deck = inv.deck || []
    const discarded = deck.splice(Math.max(0, deck.length - 3), 3)
    const weaknesses = discarded.filter(code => ALL_CARDS[code]?.type === 'treachery' && ALL_CARDS[code]?.subtype === 'weakness')
    inv.discard = [...(inv.discard || []), ...discarded.filter(code => !weaknesses.includes(code))]
    for (const code of weaknesses) {
      inv.deck.push(code)
      api?.drawCards?.(inv.seat, 1)
    }
    api?.info?.(`❄️ 从下方进入「${cardNameOf(codeOfLocationId(state, id))}」：弃掉牌库顶 3 张。`)
    return { effect: kind, discarded, weaknesses }
  }
  if (kind === 'agilityTestLevelPlus1OnFailDropExpedition') {
    const difficulty = levelOf(state, id) + 1
    api?.test?.(inv.seat, 'agility', difficulty, result => {
      if (!result?.success) dropExpeditionAssetsOf(state, inv, api)
    })
    return { effect: kind, difficulty }
  }
  if (kind === 'damage1') {
    inv.damage = (inv.damage || 0) + 1
    api?.info?.('❄️ 从下方进入：受到 1 点伤害。')
    return { effect: kind, damage: 1 }
  }
  if (kind === 'horror1') {
    inv.horror = (inv.horror || 0) + 1
    api?.info?.('❄️ 从下方进入：受到 1 点恐惧。')
    return { effect: kind, horror: 1 }
  }
  if (kind === 'tekeliShuffleIntoDeck') {
    const result = tekeliShuffleIn(state, inv.seat, 1)
    api?.info?.('❄️ 从下方进入：忒咳哩-哩牌库顶 1 张混洗入你的牌库。')
    return { effect: kind, shuffled: result !== false }
  }
  if (kind === 'exhaustAllAssets') {
    for (const asset of inv.assets || []) asset.exhausted = true
    api?.info?.('❄️ 从下方进入：横置你控制的所有支援。')
    return { effect: kind }
  }
  if (kind === 'placeClues') {
    const location = (state.locations || []).find(item => item.id === id)
    if (location) location.clues = (location.clues || 0) + (spec.amount ?? 1)
    api?.info?.('❄️ 从下方进入：在该地点放置 1 个线索。')
    return { effect: kind, amount: spec.amount ?? 1 }
  }
  return null
}

function moveBelow(state, inv, api) {
  const from = locationOf(state, inv)
  if (!from) return false
  const target = belowIdOf(state, from.id)
  if (!target) {
    api?.info?.('❄️ 下方没有可移动的地点。')
    return false
  }
  inv.location = target
  api?.info?.(`❄️ ${inv.name} 移动到了下方紧挨着的地点（${target}）。`)
  return true
}

function dropExpeditionAssetsOf(state, inv, api) {
  const ids = (inv.assets || []).filter(asset => isExpeditionAsset(asset)).map(asset => String(asset.id))
  const records = dropExpeditionAssets(state, inv, { assetIds: ids })
  if (!Array.isArray(records) || !records.length) return []
  inv.assets = (inv.assets || []).filter(asset => !ids.includes(String(asset.id)))
  state.storyAssets ||= []
  for (const record of records) state.storyAssets.push({ code: record.code, originalCode: record.code, location: record.location })
  api?.info?.(`🎒 ${inv.name} 失去对探险支援的控制，支援留在原地。`)
  return records
}

function nearestElderThingMovesAndAttacks(state, inv, api) {
  const elderThings = (state.enemies || []).filter(enemy => !enemy.defeated
    && String(ALL_CARDS[codeOf(enemy)]?.traits || '').toLowerCase().includes('elder'))
  if (!elderThings.length) return false
  const target = elderThings[0]
  const dist = neighborDistance(state, target.location, inv.location)
  if (dist != null) {
    const next = (state.locations || []).find(item => item.id === inv.location)
    if (next && dist > 0) target.location = inv.location
  }
  if (target.location === inv.location) {
    inv.damage = (inv.damage || 0) + (ALL_CARDS[codeOf(target)]?.damage || 1)
    inv.horror = (inv.horror || 0) + (ALL_CARDS[codeOf(target)]?.horror || 0)
    target.engagedSeat = inv.seat
    api?.info?.(`🌠 最近的古老者向 ${inv.name} 移动并攻击。`)
  }
  return true
}

function neighborDistance(state, fromId, toId) {
  if (!fromId || !toId) return null
  const from = (state.locations || []).find(item => item.id === fromId)
  if (!from) return null
  if (fromId === toId) return 0
  return (from.connections || []).includes(toId) ? 1 : 2
}

export { RAW_CODES, START_LOCATION, SUMMIT, SET_ASIDE_LOCATIONS, EXPEDITION_ASSETS, SET_ASIDE_CODES }
export const enemyCodes = enemyCodesFor


// ---------------------------------------------------------------------------
// 逐卡 treacheryRule.resolveKind 的结算实现（behavior 只按 kind 分派，不再按卡号分支）。
// 检定失败分支统一走 api.test 的 resolve 回调；测试/引擎都提供同一形参的 api。
// ---------------------------------------------------------------------------

export const TREACHERY_HANDLERS = Object.freeze({
  // 08610 降雪：在你所在地点放置 2 个线索（从供应堆拿取）。
  snowfall(state, inv, card, api) {
    const location = locationOf(state, inv)
    if (!location) return false
    location.clues = (location.clues || 0) + 2
    api?.info?.('❄️ 降雪：在你所在地点放置 2 个线索。')
    return true
  },

  // 08611 雪崩：高度 1–4 时先移到下方，再检定意志（X=新高度）；失败重复；没移动则涌动。
  avalanche(state, inv, card, api) {
    let moved = false
    const step = () => {
      const level = levelOf(state, inv.location)
      if (!(level >= 1 && level <= 4)) return
      if (moveBelow(state, inv, api)) moved = true
      const difficulty = levelOf(state, inv.location)
      api?.test?.(inv.seat, 'willpower', difficulty, {
        source: { type: 'scenario', code: '08611', name: '雪崩', action: 'revelation', ability: true },
        resolve: result => { if (!result?.success) step() },
      })
    }
    step()
    if (!moved) {
      if (api?.surge) api.surge(card)
      else (state.scenarioFlags ||= {}).avalancheSurge = true
    }
    return true
  },

  // 08612 悬于边缘：敏捷(3)；失败 2 伤害 + 失去所有探险支援 + 移到下方。
  hangingOnTheEdge(state, inv, card, api) {
    api?.test?.(inv.seat, 'agility', 3, {
      source: { type: 'scenario', code: '08612', name: '悬于边缘', action: 'revelation', ability: true },
      resolve: result => {
        if (result?.success) return
        inv.damage = (inv.damage || 0) + 2
        dropExpeditionAssetsOf(state, inv, api)
        moveBelow(state, inv, api)
        api?.info?.('❄️ 悬于边缘：受到 2 点伤害，失去探险支援并移动到下方。')
      },
    })
    return true
  },

  // 08613 低温症：意志(3)；高度 4–5 额外揭示 1 枚（近似：难度 +2）；失败加 frost 或按差值受恐惧。
  hypothermia(state, inv, card, api) {
    const level = levelOf(state, inv.location)
    const difficulty = 3 + (level >= 4 ? 2 : 0)
    api?.test?.(inv.seat, 'willpower', difficulty, {
      source: { type: 'scenario', code: '08613', name: '低温症', action: 'revelation', ability: true },
      resolve: result => {
        if (result?.success) return
        const failedBy = Math.max(0, Number(result?.difficulty ?? difficulty) - Number(result?.value ?? 0))
        const answer = api?.choice?.({
          kind: 'effect', source: '08613', seat: inv.seat,
          prompt: '低温症：在混乱袋加入 1 个 [frost] 标记，或受到等同于失败差值的恐惧？',
          options: [{ id: 'frost', label: '加入 1 个 [frost] 标记' }, { id: 'horror', label: `受到 ${failedBy} 点恐惧` }],
        })
        if (answer === 'horror') {
          inv.horror = (inv.horror || 0) + failedBy
          api?.info?.(`❄️ 低温症：${inv.name} 受到 ${failedBy} 点恐惧。`)
        } else {
          state.chaosBag ||= []
          state.chaosBag.push('frost')
          api?.addChaosToken?.('frost')
          api?.info?.('❄️ 低温症：混乱袋加入 1 个 [frost] 标记。')
        }
      },
    })
    return true
  },
})

```

## content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/chaos.js
```js
// 失落之峰（To the Forbidden Peaks · 08596）· 混乱标记取值与后果。
//
// 参考：08596 卡面（简单/普通 vs 困难/专家两档）+ locale `scenarios/toTheForbiddenPeaks.json#tokens`。
// 口径：`resolveChaosToken` 只返回数值（`{ delta, autoFail?, drawAnother? }`）与需要章节执行的
// 标记后果标记（`rider` 字段）；真正结算在 `behavior.afterTest`（引擎会在正常/自动失败两条路径
// 各调一次，behavior 必须幂等）。X = 所在地点 level；困难/专家骷髅再 +2。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'

const hardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
const levelOf = (state, inv) => {
  const location = (state?.locations || []).find(item => item.id === inv?.location)
  const level = Number(location?.level)
  return Number.isSafeInteger(level) && level >= 0 ? level : 0
}

export const TO_THE_FORBIDDEN_PEAKS_TOKEN_MEANINGS = Object.freeze({
  standard: {
    skull: { text: '-X。X等于所在地点的高度。', delta: 0 },
    cultist: { text: '-1。如果你检定失败，在本次检定结束后，移动到你下方紧挨着的地点。(FAQ, v2.1)', delta: -1, rider: 'moveBelowOnFail' },
    tablet: { text: '-3。如果你检定失败，失去你对一个[[探险]]支援的控制权，并将其放在你所在地点。', delta: -3, rider: 'dropExpeditionOnFail' },
    elderthing: { text: '-4。如果你检定失败，最近的[[古老者]]敌人向你移动一次。如果其与你交战，其攻击。', delta: -4, rider: 'elderThingOnFail' },
  },
  hard: {
    skull: { text: '-X。X等于所在地点的高度加2。', delta: 0 },
    cultist: { text: '-1。在本次检定结束后，移动到你下方紧挨着的地点。(FAQ, v2.1)', delta: -1, rider: 'moveBelow' },
    tablet: { text: '-4。如果你检定失败，失去你对一个[[探险]]支援的控制权，并将其放在你所在地点。', delta: -4, rider: 'dropExpeditionOnFail' },
    elderthing: { text: '-5。如果你检定失败，最近的[[古老者]]敌人向你移动一次。如果其与你交战，其攻击。', delta: -5, rider: 'elderThingOnFail' },
  },
})

/** 逐标记取值：返回 `{ delta, rider? }`；未声明的标记交回引擎默认表（null）。 */
export function toTheForbiddenPeaksChaosToken(state, inv, token) {
  const hard = hardSide(state)
  if (token === 'skull') return { delta: -(levelOf(state, inv) + (hard ? 2 : 0)) }
  if (token === 'cultist') return { delta: -1, rider: hard ? 'moveBelow' : 'moveBelowOnFail' }
  if (token === 'tablet') return { delta: hard ? -4 : -3, rider: 'dropExpeditionOnFail' }
  if (token === 'elderthing') return { delta: hard ? -5 : -4, rider: 'elderThingOnFail' }
  return null
}

/** 检定结束后需要结算的骷髅/符号后果（由 behavior.afterTest 读取；纯数据、幂等）。 */
export function toTheForbiddenPeaksAfterTest(state, inv, result) {
  if (!inv || !result) return null
  const cancelled = new Set(result.cancelledTokens || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(token))
  const riders = []
  for (const token of tokens) {
    const meaning = TO_THE_FORBIDDEN_PEAKS_TOKEN_MEANINGS[hardSide(state) ? 'hard' : 'standard'][token]
    if (!meaning?.rider) continue
    if (meaning.rider === 'moveBelow') riders.push('moveBelow')
    else if (meaning.rider === 'moveBelowOnFail' && !result.success) riders.push('moveBelow')
    else if (meaning.rider === 'dropExpeditionOnFail' && !result.success) riders.push('dropExpedition')
    else if (meaning.rider === 'elderThingOnFail' && !result.success) riders.push('elderThing')
  }
  return [...new Set(riders)]
}

/** 实体名（日志用；不在卡文件里重复印刷事实）。 */
export const cardNameOf = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || String(code)

```