// 重返敦威治遗产 · 共享数据与助手。
//
// 参考（权威）：
//   Scenario/Scenarios/ReturnToTheDunwichLegacy/*.hs（8 章 setup 包装与布局）
//   Scenario/Scenarios/TheDunwichLegacy/*.hs（基础 setup）
//   Act|Agenda|Enemy|Location|Treachery/Cards/ReturnToTheDunwichLegacy/**（新卡规则）
//   卡面数据：src/cards/cards-data.js pack=rtdwl（51012–51072）
//
// 本战役的 ReturnTo 章以「基础章 + 重返覆盖」组合：基础章的资料与行为只读复用，
// 差异清单来自上面的包装 setup。所有单卡规则仍在 encounter-entries/ 维护。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { printed, location, stages, identitiesFor } from '../theDunwichLegacy/card-data.js'
import { locationSymbols as BASE_LOCATION_SYMBOLS } from '../theDunwichLegacy/location-symbols.js'
import { buildChapter } from '../theDunwichLegacy/chapters.js'
import { scenario as extracurricularScenario } from '../theDunwichLegacy/scenarios/extracurricularActivity/definition.js'
import { scenario as houseScenario } from '../theDunwichLegacy/scenarios/theHouseAlwaysWins/definition.js'
import { behavior as extracurricularBehavior } from '../theDunwichLegacy/scenarios/extracurricularActivity/behavior.js'
import { behavior as houseBehavior } from '../theDunwichLegacy/scenarios/theHouseAlwaysWins/behavior.js'
import { laterBehavior } from '../theDunwichLegacy/later-behaviors.js'

export { ALL_CARDS, printed, location, stages, identitiesFor, BASE_LOCATION_SYMBOLS }

// 基础章：新式两章直接取 definition；其余六章由 buildChapter 的 spec 生成。
export const BASE_SCENARIOS = Object.freeze({
  extracurricularActivity: extracurricularScenario,
  theHouseAlwaysWins: houseScenario,
  theMiskatonicMuseum: buildChapter('theMiskatonicMuseum').scenario,
  theEssexCountyExpress: buildChapter('theEssexCountyExpress').scenario,
  bloodOnTheAltar: buildChapter('bloodOnTheAltar').scenario,
  undimensionedAndUnseen: buildChapter('undimensionedAndUnseen').scenario,
  whereDoomAwaits: buildChapter('whereDoomAwaits').scenario,
  lostInTimeAndSpace: buildChapter('lostInTimeAndSpace').scenario,
})

// 基础章行为：ReturnTo 章只覆盖布置与重返差异，其余钩子沿用基础实现。
export const BASE_BEHAVIORS = Object.freeze({
  extracurricularActivity: extracurricularBehavior,
  theHouseAlwaysWins: houseBehavior,
  theMiskatonicMuseum: laterBehavior('theMiskatonicMuseum'),
  theEssexCountyExpress: laterBehavior('theEssexCountyExpress'),
  bloodOnTheAltar: laterBehavior('bloodOnTheAltar'),
  undimensionedAndUnseen: laterBehavior('undimensionedAndUnseen'),
  whereDoomAwaits: laterBehavior('whereDoomAwaits'),
  lostInTimeAndSpace: laterBehavior('lostInTimeAndSpace'),
})

// 收起 AllCards 中的 5 位印刷战役参考卡号（type==='scenario'）。
export const CHAPTERS = Object.freeze([
  { id: 'returnToExtracurricularActivities', baseId: 'extracurricularActivity', code: '51012', name: '重返课外活动', nameEn: 'Return to Extracurricular Activities' },
  { id: 'returnToTheHouseAlwaysWins', baseId: 'theHouseAlwaysWins', code: '51015', name: '重返百赌百胜', nameEn: 'Return to The House Always Wins' },
  { id: 'returnToTheMiskatonicMuseum', baseId: 'theMiskatonicMuseum', code: '51020', name: '重返博物馆之夜', nameEn: 'Return to The Miskatonic Museum' },
  { id: 'returnToTheEssexCountyExpress', baseId: 'theEssexCountyExpress', code: '51025', name: '重返疯狂列车', nameEn: 'Return to The Essex County Express' },
  { id: 'returnToBloodOnTheAltar', baseId: 'bloodOnTheAltar', code: '51032', name: '重返血色祭坛', nameEn: 'Return to Blood on the Altar' },
  { id: 'returnToUndimensionedAndUnseen', baseId: 'undimensionedAndUnseen', code: '51041', name: '重返无人知晓', nameEn: 'Return to Undimensioned and Unseen' },
  { id: 'returnToWhereDoomAwaits', baseId: 'whereDoomAwaits', code: '51047', name: '重返毁灭之地', nameEn: 'Return to Where Doom Awaits' },
  { id: 'returnToLostInTimeAndSpace', baseId: 'lostInTimeAndSpace', code: '51053', name: '重返迷失时空', nameEn: 'Return to Lost in Time and Space' },
])

export const CHAPTER_BY_ID = Object.freeze(Object.fromEntries(CHAPTERS.map(chapter => [chapter.id, chapter])))

// 每个重返章「收集的遭遇组」。snake 对应卡面 encounterCode；camel 用于 manifest。
export const CHAPTER_ENCOUNTER_GROUPS = Object.freeze({
  returnToExtracurricularActivities: [
    'return_to_extracurricular_activities', 'extracurricular_activity', 'sorcery', 'beyond_the_threshold',
    'bishops_thralls', 'whippoorwills', 'resurgent_evils', 'secret_doors', 'yog_sothoths_emissaries',
  ],
  returnToTheHouseAlwaysWins: [
    'the_house_always_wins', 'return_to_the_house_always_wins', 'bad_luck', 'naomis_crew', 'rats',
  ],
  returnToTheMiskatonicMuseum: [
    'the_miskatonic_museum', 'return_to_the_miskatonic_museum', 'bad_luck', 'sorcery',
    'beyond_the_threshold', 'creeping_cold', 'secret_doors',
  ],
  returnToTheEssexCountyExpress: [
    'essex_county_express', 'return_to_the_essex_county_express', 'beyond_the_threshold',
    'erratic_fear', 'resurgent_evils', 'pentagram',
  ],
  returnToBloodOnTheAltar: [
    'blood_on_the_altar', 'return_to_blood_on_the_altar', 'dunwich', 'whippoorwills',
    'nightgaunts', 'resurgent_evils',
  ],
  returnToUndimensionedAndUnseen: [
    'undimensioned_and_unseen', 'return_to_undimensioned_and_unseen', 'whippoorwills',
    'beast_thralls', 'dunwich', 'erratic_fear',
  ],
  returnToWhereDoomAwaits: [
    'where_doom_awaits', 'return_to_where_doom_awaits', 'beast_thralls', 'sorcery',
    'bishops_thralls', 'erratic_fear', 'resurgent_evils', 'creeping_cold',
  ],
  returnToLostInTimeAndSpace: [
    'lost_in_time_and_space', 'return_to_lost_in_time_and_space', 'sorcery',
    'beyond_the_threshold', 'hideous_abominations', 'yog_sothoths_emissaries',
  ],
})

const CAMEL_OVERRIDES = Object.freeze({ agents_of_yog: 'agentsOfYogSothoth', essex_county_express: 'theEssexCountyExpress' })
export function camelGroup(snake) {
  if (CAMEL_OVERRIDES[snake]) return CAMEL_OVERRIDES[snake]
  return snake.replace(/_([a-z0-9])/g, (_, ch) => ch.toUpperCase())
}
export function chapterGroups(chapterId) {
  return CHAPTER_ENCOUNTER_GROUPS[chapterId].map(camelGroup)
}

// 卡面数据助手：rtdwl 与基础包一并纳入。
const RET_PACKS = new Set(['core', 'dwl', 'tmm', 'tece', 'bota', 'uau', 'wda', 'litas', 'rtdwl'])
export function retEncounterCards(groups) {
  for (const group of groups) {
    if (!Object.values(ALL_CARDS).some(card => RET_PACKS.has(card.pack) && card.encounterCode === group)) {
      throw new Error(`缺少重返敦威治遭遇组：${group}`)
    }
  }
  return Object.values(ALL_CARDS).filter(card => RET_PACKS.has(card.pack)
    && groups.includes(card.encounterCode) && ['enemy', 'treachery'].includes(card.type))
}
export function retEncounterDeck(cards) {
  return cards.flatMap(card => Array(card.quantity || 1).fill(card.code))
}
// 基础卡的条目已经由基础包实现；rtdwl 卡若无条目则标记 rulesPending，由单卡文件逐步接管。
import { implementedFor, threatEffectFor } from '../../../src/cards/card-rules.js'
export function retEncounterDefinitions(cards) {
  const enemies = {}, treacheries = {}
  for (const card of cards) {
    const pending = card.pack === 'rtdwl' || !implementedFor(card.code)
    const result = { ...printed(card.code), rulesPending: pending,
      ...(card.type === 'enemy' ? {
        fight: card.fight, evade: card.evade, health: card.health,
        damage: card.damage, horror: card.horror,
        ...(card.healthPerInvestigator ? { healthPerInvestigator: card.health } : {}),
        hunter: /\bHunter\./.test(card.text), aloof: /\bAloof[. ]/.test(card.text),
        massive: /\bMassive\./.test(card.text), retaliate: /\bRetaliate\./.test(card.text),
        victory: card.victory || 0, elite: card.traits.includes('Elite'),
      } : {}),
    }
    if (implementedFor(card.code) && card.pack !== 'core') {
      result.rulesPending = false
      result.surge = /^Surge\./m.test(card.text || '')
      result.peril = /(?:^|\n|\. )Peril\./.test(card.text || '')
      result.effect = { kind: 'campaignRule' }
      const threat = threatEffectFor(card.code)
      if (threat) result.threatEffect = threat
    }
    ;(card.type === 'enemy' ? enemies : treacheries)[result.code] = result
  }
  return { enemies, treacheries }
}

// 重返新地点的印刷连接图标（Location/CardDefs/ReturnToTheDunwichLegacy/**）。
// 值：[卡号, 特性, 正面符号, 正面连接符号, 背面符号, 背面连接符号, 额外字段]
export const RET_LOCATION_SYMBOLS = Object.freeze({
  '51013': ['Warren Observatory', ['Miskatonic'], 'Triangle', ['Plus', 'Square']],
  '51016': ['Clover Club Lounge', ['CloverClub'], 'Circle', ['Moon', 'Square', 'Triangle']],
  '51017': ['Clover Club Stage', ['CloverClub'], 'Heart', ['Circle', 'Square']],
  '51021': ['Exhibit Hall', ['Miskatonic', 'Exhibit'], 'NoSymbol', ['Square'], 'hourglass', ['Square']],
  '51022': ['Exhibit Hall', ['Miskatonic', 'Exhibit'], 'NoSymbol', ['Square'], 'Hourglass', ['Square', 'Equals']],
  '51028': ['Engine Car', ['Train'], 'NoSymbol', []],
  '51029': ['Train Car', ['Train'], 'NoSymbol', []],
  '51030': ['Train Car', ['Train'], 'NoSymbol', []],
  '51033': ['Village Commons', ['Dunwich', 'Central'], 'Plus', ['Square', 'Diamond', 'Moon']],
  '51034': ["Bishop's Brook", ['Dunwich'], 'Square', ['Plus', 'Circle', 'Triangle']],
  '51035': ['Burned Ruins', ['Dunwich'], 'Triangle', ['Square', 'Diamond']],
  '51036': ["Osborn's General Store", ['Dunwich'], 'Circle', ['Moon', 'Square']],
  '51037': ['Congregational Church', ['Dunwich'], 'Diamond', ['Plus', 'Triangle', 'Squiggle']],
  '51038': ['House in the Reeds', ['Dunwich'], 'Squiggle', ['Diamond', 'Moon']],
  '51039': ['Schoolhouse', ['Dunwich'], 'Moon', ['Plus', 'Squiggle', 'Circle']],
  '51048': ['Base of the Hill', ['Dunwich', 'SentinelHill'], 'Triangle', ['Square', 'Plus', 'Squiggle', 'Hourglass', 'Droplet']],
  '51049': ['Ascending Path', ['Dunwich', 'SentinelHill'], 'Square', ['Triangle', 'Diamond', 'T', 'Equals', 'Moon', 'Trefoil']],
  '51050': ['Diverging Path', ['Dunwich', 'Woods'], 'NoSymbol', [], 'Droplet', ['Triangle', 'Trefoil']],
  '51051': ['Altered Path', ['Dunwich', 'Woods', 'Altered'], 'NoSymbol', [], 'Trefoil', ['Square', 'Droplet']],
  '51057': ['Realms Beyond', ['Otherworld'], 'Droplet', ['Circle']],
  '51058': ['Indecipherable Stairs', ['Otherworld', 'Extradimensional'], 'Triangle', ['Square', 'Equals']],
  '51059': ['Towering Luminosity', ['Otherworld', 'Extradimensional'], 'Diamond', ['Square', 'Equals']],
  '51060': ['Unstable Vortex', ['Otherworld', 'Extradimensional'], 'Equals', ['Square', 'Moon', 'Plus', 'Squiggle']],
})

// 由印刷图标计算连接：returns { [id]: [id, ...] }；ids 形如 location<code>。
export function connectBySymbols(codes, extraSymbols = {}) {
  const symbolOf = code => (extraSymbols[code] || BASE_LOCATION_SYMBOLS[code] || { front: { symbol: 'NoSymbol', links: [] } })
  const ids = codes.map(code => `location${code}`)
  const result = {}
  for (const code of codes) {
    const symbol = symbolOf(code).front
    const connections = []
    for (const other of codes) {
      if (other === code) continue
      const otherSymbol = symbolOf(other).front
      if (symbol.links.includes(otherSymbol.symbol) || otherSymbol.links.includes(symbol.symbol)) {
        connections.push(`location${other}`)
      }
    }
    result[`location${code}`] = connections
  }
  return result
}

// 基础任务/密谋（用于把基础阶段数据与新卡号混排）。
export function baseStage(codes, type) { return stages(codes, type) }

// 合并基础章定义与重返覆盖；只做浅拷贝，避免 clone 掉基础卡定义里的函数。
export function patchScenario(base, overrides) {
  return { ...base, ...overrides }
}

// 按角色记录判定「已完成某章」（重返战役的 scenarioResults 记录的是重返章节 id）。
export function completedScenario(state, id) {
  return state.campaign.scenarioResults.some(result => result.scenarioId === id)
}

export function shuffleWith(list, rng) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// 剧本参考卡在 cards-data 中的名称/正文（setup 面板用）。
export function chapterPrint(chapterId) {
  const chapter = CHAPTER_BY_ID[chapterId]
  return printed(chapter.code)
}
