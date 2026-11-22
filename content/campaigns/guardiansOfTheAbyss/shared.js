// 批次 4 · Beta 支线《深渊守卫》共享数据（Guardians of the Abyss · 83001 + 83016）。
//
// 参考（权威）：
//   Scenario/Scenarios/GuardiansOfTheAbyss/{TheEternalSlumber,TheNightsUsurper}.hs
//   Campaign/Campaigns/GuardiansOfTheAbyss.hs + Campaigns/GuardiansOfTheAbyss/Helpers.hs
//   Location/CardDefs/GuardiansOfTheAbyss/{TheEternalSlumber,SandsOfEgypt,TheNightsUsurper}.hs（符号连接图）
//   frontend/src/locales/en/standalone/{guardiansOfTheAbyss,theEternalSlumber,theNightsUsurper}.json
//   frontend/src/arkham/data/side-stories.json（83001：xp 2 / Standard,Hard / beta）
//
// 这里只放两个章节共用的：混乱袋、战役记录 schema、印刷卡数据助手、符号地点连接图。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../identities.js'

export const CAMPAIGN_ID = 'guardiansOfTheAbyss'
export const CHAPTER_IDS = Object.freeze(['theEternalSlumber', 'theNightsUsurper'])
export const PACK_ID = 'guardiansCampaign'

// side-stories.json 的 difficultyLevels（Standard 21 枚 / Hard 23 枚，含 +1 两枚与 ElderSign）。
export const CHAOS_BAGS = Object.freeze({
  standard: Object.freeze([
    '+1', '+1', '0', '0', '-1', '-1', '-1', '-2', '-2',
    '-3', '-3', '-4', '-6', 'skull', 'skull', 'skull', 'cultist', 'tablet',
    'elderthing', 'autofail', 'eldersign',
  ]),
  hard: Object.freeze([
    '+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-2',
    '-3', '-3', '-4', '-4', '-5', '-7', 'skull', 'skull',
    'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
})

// Haskell CampaignLogKey（两个章节的结局记录 + 跨章记录）。
export const RECORD_TYPES = Object.freeze({
  theCurseOfSlumberWasLifted: 'boolean',
  youAreAwareOfXzharahsPlans: 'boolean',
  theBrotherhoodsSchemesContinueUnabated: 'boolean',
  theDayOfReckoningIsComing: 'boolean',
  theAbyssWasSaved: 'boolean',
  youJoinedForcesWithXzharah: 'boolean',
  dreamersInTheAbyss: 'number',
  brotherhoodAgentsWhoEscaped: 'string[]',
  wasTakenByTheAbyss: 'string[]',
  foundADoorMarkedWithBlood: 'boolean',
  boughtAnOddTrinket: 'boolean',
  discoveredAnAncientTablet: 'boolean',
  sabotagedTheTrain: 'boolean',
  brokenIntoADesertTemple: 'boolean',
  freedTheNightgaunts: 'boolean',
  executedTheNightgaunts: 'boolean',
  warnedTheDenizensOfSarkomand: 'boolean',
  cutOffAllEscape: 'boolean',
  pledForHelp: 'boolean',
  affrontedTheRulerOfThisRealm: 'boolean',
})

export const RECORD_LABELS = Object.freeze({
  theCurseOfSlumberWasLifted: '长眠诅咒已被解除',
  youAreAwareOfXzharahsPlans: '你们已知晓伊扎法拉的阴谋',
  theBrotherhoodsSchemesContinueUnabated: '兄弟会的阴谋仍在继续',
  theDayOfReckoningIsComing: '清算之日即将到来',
  theAbyssWasSaved: '深渊已被拯救',
  youJoinedForcesWithXzharah: '你们与伊扎法拉联手',
  dreamersInTheAbyss: '深渊中的沉梦者',
  brotherhoodAgentsWhoEscaped: '逃脱的兄弟会特工',
  wasTakenByTheAbyss: '被深渊吞没',
  foundADoorMarkedWithBlood: '找到一扇用血标记的门',
  boughtAnOddTrinket: '买下一件古怪的小饰物',
  discoveredAnAncientTablet: '发现一块古老石板',
  sabotagedTheTrain: '破坏了火车',
  brokenIntoADesertTemple: '闯入一座废弃神庙',
  freedTheNightgaunts: '释放了夜魇',
  executedTheNightgaunts: '处决了夜魇',
  warnedTheDenizensOfSarkomand: '警告了萨尔科曼德的居民',
  cutOffAllEscape: '切断所有退路',
  pledForHelp: '恳求援助',
  affrontedTheRulerOfThisRealm: '冒犯了此界的主宰',
})

// 兄弟会双面敌人（正面敌人 83031a–83036a / 背面证据故事 83031b–83036b）。
export const BROTHERHOOD_PAIRS = Object.freeze({
  83031: Object.freeze({ enemy: '83031a', story: '83031b', name: '莱拉·艾尔·马斯里博士' }),
  83032: Object.freeze({ enemy: '83032a', story: '83032b', name: '温特沃斯·摩尔博士' }),
  83033: Object.freeze({ enemy: '83033a', story: '83033b', name: '纳迪娅·尼姆尔' }),
  83034: Object.freeze({ enemy: '83034a', story: '83034b', name: '法里德' }),
  83035: Object.freeze({ enemy: '83035a', story: '83035b', name: '纳索尔' }),
  83036: Object.freeze({ enemy: '83036a', story: '83036b', name: '纳撒尼尔·泰勒教授' }),
})
export const BROTHERHOOD_ENEMY_CODES = Object.freeze(Object.values(BROTHERHOOD_PAIRS).map(pair => pair.enemy))
export const BROTHERHOOD_STORY_CODES = Object.freeze(Object.values(BROTHERHOOD_PAIRS).map(pair => pair.story))
export const BROTHERHOOD_STORY_BY_ENEMY = Object.freeze(Object.fromEntries(
  Object.values(BROTHERHOOD_PAIRS).map(pair => [pair.enemy, pair.story])))

// ---------------------------------------------------------------------------
// 卡面数据助手（与《精益酒店谋杀案》同一口径：权威数据来自 cards-data）
// ---------------------------------------------------------------------------
export function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Guardians of the Abyss card: ${code}`)
  return {
    code, originalCode: code,
    name: card.nameZh || card.name, nameEn: card.name,
    subname: card.subnameZh || card.subname || '', subnameEn: card.subname || '',
    text: card.textZh || card.text || '', textEn: card.text || '',
    backText: card.backTextZh || card.backText || '', backTextEn: card.backText || '',
    backName: card.backNameZh || card.backName || '', backNameEn: card.backName || '',
    type: card.type, traits: [...(card.traits || [])],
    ...(card.victory != null ? { victory: card.victory } : {}),
    ...(card.health != null ? { health: card.health } : {}),
    ...(card.fight != null ? { fight: card.fight } : {}),
    ...(card.evade != null ? { evade: card.evade } : {}),
    ...(card.shroud != null ? { shroud: card.shroud } : {}),
    ...(card.clues != null ? { clues: card.clues } : {}),
    ...(card.doom != null ? { doom: card.doom } : {}),
    ...(card.stage != null ? { stage: card.stage } : {}),
  }
}

// 地点：id 为稳定 ASCII ID（schema 要求小写字母开头），code 为印刷卡号；
// symbols 供引擎 doExplore 的符号连接判定（campaign-plugin.js#doExplore）。
export function location({ id, code, connections = [], symbol = null, links = [], extra = {} }) {
  const data = printed(code)
  const card = ALL_CARDS[code]
  return {
    ...data, id, code,
    shroud: card.shroud,
    connections: [...connections],
    ...(symbol ? { symbols: { front: { symbol, links: [...links] } } } : {}),
    ...extra,
  }
}

export function stage(code, { number, doom = null, backNameAsText = true } = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new RangeError(`Unknown Guardians of the Abyss stage: ${code}`)
  const data = printed(code)
  return {
    ...data,
    id: `${card.type}${code}`,
    type: card.type,
    stage: `${number ?? card.stage ?? 1}a`,
    reveal: { type: 'campaignRule' },
    ...(card.type === 'agenda' ? { doomThresholdPerInvestigator: Number(doom ?? card.doom) || 1 } : {}),
    ...(backNameAsText ? {} : {}),
  }
}

// 符号连接图 → 显式连接（Haskell 用符号互相连接；本 Mod 引擎按地点 id 连接）。
export function connectionsFromSymbols(rows) {
  const bySymbol = new Map()
  for (const row of rows) {
    if (!row.symbol) continue
    if (!bySymbol.has(row.symbol)) bySymbol.set(row.symbol, [])
    bySymbol.get(row.symbol).push(row.id)
  }
  const connections = Object.fromEntries(rows.map(row => [row.id, new Set()]))
  for (const row of rows) {
    for (const link of row.links || []) {
      for (const target of bySymbol.get(link) || []) {
        if (target === row.id) continue
        connections[row.id].add(target)
        connections[target].add(row.id)
      }
    }
  }
  return Object.fromEntries(Object.entries(connections).map(([id, set]) => [id, [...set].sort()]))
}

export function encounterDefinitions(codes) {
  const enemies = {}
  const treacheries = {}
  const storyAssets = {}
  for (const code of new Set(codes)) {
    const card = ALL_CARDS[code]
    if (!card) throw new RangeError(`Unknown Guardians of the Abyss encounter definition: ${code}`)
    const base = printed(code)
    if (card.type === 'enemy') {
      const keywords = String(card.text || '')
      enemies[code] = {
        ...base,
        fight: card.fight ?? null, evade: card.evade ?? null,
        health: card.health ?? null, damage: card.damage || 0, horror: card.horror || 0,
        ...(card.victory != null ? { victory: card.victory } : {}),
        ...Object.fromEntries(['Hunter', 'Aloof', 'Massive', 'Retaliate', 'Alert']
          .filter(keyword => new RegExp(`\\b${keyword}\\.`).test(keywords)).map(keyword => [keyword.toLowerCase(), true])),
        elite: (card.traits || []).includes('Elite'),
      }
    } else if (card.type === 'treachery') {
      treacheries[code] = { ...base, entryRevelation: true, surge: /^Surge\./m.test(card.text || '') }
    } else if (card.type === 'asset' || card.type === 'story') {
      storyAssets[code] = { ...base, global: true, ...(card.health != null ? { health: card.health } : {}) }
    }
  }
  return { enemies, treacheries, storyAssets }
}

export function identitiesFor(scenarioData) {
  const identity = value => ({ originalCode: value.originalCode || value.code, artCode: value.originalCode || value.code })
  return Object.fromEntries(['locations', 'enemies', 'treacheries', 'storyAssets', 'acts', 'agendas']
    .map(category => [category, Object.fromEntries(Object.values(scenarioData[category] || {})
      .map(value => [value.id || value.code, identity(value)]))]))
}

export function bindIdentities(scenarioData) {
  const identities = identitiesFor(scenarioData)
  bindScenarioIdentities(scenarioData, identities)
  return identities
}

// 通用只读工具（behavior 与测试共用）。
export const codeOf = value => String(value?.originalCode || value?.code || '')
export const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
export const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
export const isHardSide = state => state.difficulty === 'hard' || state.difficulty === 'expert'
export const flagsFor = state => (state.scenarioFlags ||= {})
export const guardiansOf = state => (flagsFor(state).guardians || {})
export const setGuardians = (state, patch) => {
  flagsFor(state).guardians = { ...guardiansOf(state), ...patch }
  return flagsFor(state).guardians
}
export const locationOf = (state, id) => (state?.locations || []).find(item => item.id === id) || null
export const shuffleWith = (api, list) => {
  if (typeof api?.shuffle === 'function') return api.shuffle([...list])
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

// 沉梦者（damage on locations 代表 dreamers）工具：记录在 location.dreamers，同 B 面文本。
export const DREAMER_LOCATIONS = Object.freeze(['83008', '83009', '83010', '83011', '83012'])
