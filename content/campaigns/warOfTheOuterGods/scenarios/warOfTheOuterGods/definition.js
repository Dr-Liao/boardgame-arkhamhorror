// 外神之战（War of the Outer Gods · 86001）· 章节数据。
//
// 参考（权威）：
//   Scenario/Scenarios/WarOfTheOuterGods.hs（三方阵营 / 三套议程 / warIsOver / 结局 / 混乱标记）
//   Act|Agenda|Location|Enemy|Treachery/CardDefs/WarOfTheOuterGods.hs
//   frontend/src/locales/en/standalone/warOfTheOuterGods.json（intro/setup/rules/resolutions）
//   frontend/src/arkham/data/side-stories.json（86001：xp 3、Easy/Standard/Hard/Expert、epicMultiplayer）
//
// 单桌普通流程口径（跨桌 epic multiplayer 走 primitive request，见 behavior 注释）：
//   1. 三方阵营（绿 Children of Paradise / 蓝 Death of Stars / 红 Swarm of Assimilation）
//      各自一套 3 张议程 + 指向终局议程（The Egg Hatches 86040 / Silenus Descends 86034 /
//      Ezel-zen-rezl Emerges 86046）。引擎只有单议程轨，behavior 用 scenarioFlags 记账三套进度，
//      并把三张 1a 议程同时放进 state.agendas 供 UI 展示。
//   2. 每套议程的全球毁灭阈值为 6（每桌）；推进时清 6 毁灭、超额毁灭给同阵营下一张；
//      到达终局议程即「战争结束」：Hub Dimension 翻面入场、该阵营上古存在生成、另两阵营退场。
//   3. 幕 1 目标：战争结束（任一终局议程入场）；幕 2/3 通过把线索放到 Hub Dimension「周围」推进。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { bindScenarioIdentities } from '../../../../identities.js'

export const CHAPTER_ID = 'warOfTheOuterGods'
export const REFERENCE_CODE = '86001'
export const ENCOUNTER_CODE = 'warOfTheOuterGods'

// ---------------------------------------------------------------------------
// 幕 / 议程 / 阵营
// ---------------------------------------------------------------------------
export const ACT1_CODE = '86011' // War of the Outer Gods
export const ACT2_CODE = '86012' // Close the Portal
export const ACT3_CODE = '86013' // Close All Portals
export const ACT_CODES = Object.freeze([ACT1_CODE, ACT2_CODE, ACT3_CODE])
export const FACTION_KEYS = Object.freeze(['green', 'blue', 'red'])
export const FACTION_ORDER = FACTION_KEYS
export const FACTION_LABEL = Object.freeze({ green: '绿', blue: '蓝', red: '红' })
export const FACTION_AGENDA_CODES = Object.freeze({
  green: Object.freeze(['86005', '86006', '86007']),
  blue: Object.freeze(['86002', '86003', '86004']),
  red: Object.freeze(['86008', '86009', '86010']),
})
export const FACTION_FINAL_AGENDA = Object.freeze({ green: '86040', blue: '86034', red: '86046' })
export const FACTION_ANCIENT_ONE = Object.freeze({ green: '86041', blue: '86035', red: '86047' })
export const FACTION_LEADER = Object.freeze({ green: '86044', blue: '86038', red: '86049' }) // 各阵营代表敌人
export const FACTION_ENEMIES = Object.freeze({
  green: Object.freeze(['86044', '86041', '86042', '86043', '86027']),
  blue: Object.freeze(['86038', '86035', '86036', '86037', '86025']),
  red: Object.freeze(['86049', '86047', '86048', '86029']),
})
export const FACTION_TREACHERIES = Object.freeze({
  green: Object.freeze(['86045', '86028']),
  blue: Object.freeze(['86039', '86026']),
  red: Object.freeze(['86050', '86030']),
})
export const AGENDA_CODES = Object.freeze(FACTION_KEYS.flatMap(key => FACTION_AGENDA_CODES[key]))
export const RESOLUTION_KEYS = Object.freeze([
  'noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4',
  'resolution5', 'resolution6', 'resolution7',
])

// ---------------------------------------------------------------------------
// 地点
// ---------------------------------------------------------------------------
export const START_LOCATION = 'arkham'
export const HUB_CODE = '86024'
export const HUB_REVEALED_CODE = '86024b'
export const RITUAL_SITE_IDS = Object.freeze(['arkham', 'athenaeumOfTheEmptySky', 'shrineOfMaghanArkat', 'theBurningPit'])

export const LOCATION_TABLE = Object.freeze([
  Object.freeze(['arkham', '86014', false]),
  Object.freeze(['streetsOfProvidence', '86015', false]),
  Object.freeze(['athenaeumOfTheEmptySky', '86016', false]),
  Object.freeze(['theArcade', '86017', false]),
  Object.freeze(['streetsOfMontreal', '86018', false]),
  Object.freeze(['chateauRamezay', '86019', false]),
  Object.freeze(['shrineOfMaghanArkat', '86020', false]),
  Object.freeze(['streetsOfNewYorkCity', '86021', false]),
  Object.freeze(['theBurningPit', '86022', false]),
  Object.freeze(['thePenthouse', '86023', false]),
  Object.freeze(['hubDimension', HUB_CODE, true]),
])

export const LOCATION_COORDINATES = Object.freeze({
  arkham: { x: 2, y: 4 },
  streetsOfProvidence: { x: 1, y: 5 },
  athenaeumOfTheEmptySky: { x: 0, y: 6 },
  theArcade: { x: 2, y: 6 },
  streetsOfMontreal: { x: 1, y: 3 },
  chateauRamezay: { x: 0, y: 2 },
  shrineOfMaghanArkat: { x: 2, y: 2 },
  streetsOfNewYorkCity: { x: 4, y: 5 },
  theBurningPit: { x: 3, y: 6 },
  thePenthouse: { x: 5, y: 6 },
  hubDimension: { x: 6, y: 4 },
})

// 图标连接（Location CardDefs 的 connections 符号展开；Hub 与每个 Ritual Site 相连由 behavior 追加）。
const ICON_CONNECTIONS = {
  arkham: ['streetsOfProvidence', 'streetsOfMontreal', 'streetsOfNewYorkCity'],
  streetsOfProvidence: ['arkham', 'theArcade', 'athenaeumOfTheEmptySky'],
  athenaeumOfTheEmptySky: ['streetsOfProvidence', 'theArcade'],
  theArcade: ['streetsOfProvidence', 'athenaeumOfTheEmptySky'],
  streetsOfMontreal: ['arkham', 'chateauRamezay', 'shrineOfMaghanArkat'],
  chateauRamezay: ['streetsOfMontreal', 'shrineOfMaghanArkat'],
  shrineOfMaghanArkat: ['streetsOfMontreal', 'chateauRamezay'],
  streetsOfNewYorkCity: ['arkham', 'theBurningPit', 'thePenthouse'],
  theBurningPit: ['streetsOfNewYorkCity', 'thePenthouse'],
  thePenthouse: ['streetsOfNewYorkCity', 'theBurningPit'],
  hubDimension: [],
}
export const STATIC_CONNECTIONS = Object.freeze(Object.fromEntries(Object.entries(ICON_CONNECTIONS)
  .map(([id, connections]) => [id, Object.freeze([...connections])])))
export const HUB_CONNECTIONS = Object.freeze([...RITUAL_SITE_IDS])

// ---------------------------------------------------------------------------
// 卡面数据助手
// ---------------------------------------------------------------------------
export function printed(code) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown War of the Outer Gods card: ${code}`)
  return {
    code, originalCode: c.originalCode || code,
    name: c.nameZh || c.name, nameEn: c.name,
    subname: c.subnameZh || c.subname || '', subnameEn: c.subname || '',
    text: c.textZh || c.text || '', textEn: c.text || '',
    backText: c.backTextZh || c.backText || '', backTextEn: c.backText || '',
    type: c.type, traits: [...(c.traits || [])],
    ...(c.victory != null ? { victory: c.victory } : {}),
  }
}

export function location(data) {
  const { id, code, connections, setAside } = data
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown War of the Outer Gods location: ${code}`)
  return {
    ...printed(code), id, shroud: c.shroud ?? 0,
    connections: [...(connections || [])],
    ...(setAside ? { setAside: true } : {}),
    ...(id === 'hubDimension'
      ? { linkedOriginalCode: HUB_REVEALED_CODE, revealed: false, cannotHaveAttachments: true }
      : {}),
    ...(RITUAL_SITE_IDS.includes(id) ? { isRitualSite: true } : {}),
  }
}

export function stage(code, extra = {}) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown War of the Outer Gods stage: ${code}`)
  const { number, doom, ...rest } = extra
  return {
    ...printed(code),
    id: `${c.type}${code}`,
    type: c.type,
    stage: `${number ?? 1}a`,
    reveal: { type: 'campaignRule' },
    ...rest,
    ...(c.type === 'agenda' ? { doomThreshold: doom ?? 6 } : {}),
  }
}

export function encounterDefinitions(codes) {
  const enemies = {}, treacheries = {}, storyAssets = {}
  for (const code of new Set(codes)) {
    const c = ALL_CARDS[code]
    if (!c) throw new RangeError(`Unknown War of the Outer Gods encounter definition: ${code}`)
    const base = printed(code)
    const text = String(c.text || '')
    if (c.type === 'enemy') {
      const faction = FACTION_KEYS.find(key => FACTION_ENEMIES[key].includes(code)) || null
      enemies[code] = {
        ...base,
        fight: c.fight ?? null, evade: c.evade ?? null,
        health: c.health ?? null, damage: c.damage || 0, horror: c.horror || 0,
        elite: (c.traits || []).includes('Elite'),
        ...(faction ? { faction } : {}),
        ...Object.fromEntries(['Hunter', 'Aloof', 'Massive', 'Retaliate', 'Alert']
          .filter(keyword => new RegExp(`\\b${keyword}\\.`).test(text)).map(keyword => [keyword.toLowerCase(), true])),
        ...(/(Swarming|swarming)\s+(\d+)/.exec(text) ? { swarming: Number(/(Swarming|swarming)\s+(\d+)/.exec(text)[2]) } : {}),
        ...(code === '86035' || code === '86041' || code === '86047'
          ? { ancientOne: true, global: true, healthPool: code === '86047' ? 7 : 8 } : {}),
      }
    } else if (c.type === 'treachery') {
      treacheries[code] = { ...base, entryRevelation: true, surge: /^Surge\./m.test(text) }
    } else if (c.type === 'asset' || c.type === 'story') {
      storyAssets[code] = { ...base, global: true, ...(c.health != null ? { health: c.health } : {}) }
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

// ---------------------------------------------------------------------------
// 遭遇牌库 / 放一边
// ---------------------------------------------------------------------------
const SETUP_CULTISTS = Object.freeze(['86025', '86027', '86029'])
export const STORY_ASSET_CODES = Object.freeze(['86051', '86052', '86053', '86054', '86055'])
export const ANCIENT_ONE_CODES = Object.freeze(['86035', '86041', '86047'])
export const FINAL_AGENDA_CODES = Object.freeze(['86034', '86040', '86046'])
export const SET_ASIDE_CODES = Object.freeze([
  HUB_CODE, ...STORY_ASSET_CODES, ...ANCIENT_ONE_CODES, ...FINAL_AGENDA_CODES,
])
export const SET_ASIDE_ALIASES = Object.freeze([...SET_ASIDE_CODES])
export const ENCOUNTER_GROUPS = Object.freeze(['warOfTheOuterGods'])
export const ENCOUNTER_DECK_CODES = Object.freeze([
  // War of the Outer Gods 遭遇组（去掉 3 张入场邪教徒）。
  '86026', '86028', '86030', '86031', '86032', '86033',
  // Children of Paradise / Death of Stars / Swarm of Assimilation 三套阵营遭遇卡。
  '86045', '86042', '86043', '86044',
  '86039', '86036', '86037', '86038',
  '86050', '86048', '86049',
])
export const ENCOUNTER_DECK = Object.freeze(ENCOUNTER_DECK_CODES.flatMap(code =>
  Array(Math.max(1, Number(ALL_CARDS[code]?.quantity) || 1)).fill(code)))

// ---------------------------------------------------------------------------
// 幕 / 议程阶段
// ---------------------------------------------------------------------------
export const ACT_STAGES = Object.freeze({
  [ACT1_CODE]: Object.freeze({ ...stage(ACT1_CODE, { number: 1 }), objective: { type: 'custom' } }),
  [ACT2_CODE]: Object.freeze({ ...stage(ACT2_CODE, { number: 2 }), objective: { type: 'custom' } }),
  [ACT3_CODE]: Object.freeze({ ...stage(ACT3_CODE, { number: 3 }), objective: { type: 'custom' } }),
})
export const AGENDA_STAGES = Object.freeze(Object.fromEntries(
  FACTION_KEYS.flatMap(key => Object.entries(FACTION_AGENDA_CODES[key]).map(([, code], index) =>
    [code, Object.freeze({ ...stage(code, { number: index + 1 }), faction: key })]))))
export const FINAL_AGENDAS = Object.freeze(Object.fromEntries(FACTION_KEYS.map(key =>
  [FACTION_FINAL_AGENDA[key], Object.freeze({ ...stage(FACTION_FINAL_AGENDA[key], { number: 4 }), faction: key })])))
export const ACTS = Object.freeze(ACT_CODES.map(code => structuredClone(ACT_STAGES[code])))
export const INITIAL_AGENDAS = Object.freeze(FACTION_KEYS.map(key => structuredClone(AGENDA_STAGES[FACTION_AGENDA_CODES[key][0]])))
export const AGENDAS = Object.freeze(Object.values(AGENDA_STAGES).map(value => structuredClone(value)))
export const STAGE_CARDS = Object.freeze({ ...ACT_STAGES, ...AGENDA_STAGES, ...FINAL_AGENDAS })

// ---------------------------------------------------------------------------
// 剧情正文（英文与印刷 locale 同口径；中文正文在指南源 warpOfTheOuterGods.json）
// ---------------------------------------------------------------------------
const TOKEN_MEANINGS = Object.freeze({
  easyStandard: Object.freeze({
    skull: { kind: 'count', count: 'clues', base: 1, delta: -1, text: '-1 for each clue you have.' },
    cultist: { delta: -3, text: '-3. If you fail, place 1 resource on the nearest [[Mutated]] enemy, as a mutation.' },
    tablet: { delta: -3, text: '-3. If you fail, draw the top [[Hex]] card in the encounter discard pile.' },
    elderthing: { delta: -4, text: '-4. If you fail, place one card committed to this test facedown underneath an [[Insect]] enemy, as a swarm card.' },
  }),
  hardExpert: Object.freeze({
    skull: { kind: 'count', count: 'clues', base: 2, delta: -1, text: '-2 for each clue you have.' },
    cultist: { delta: -4, text: '-4. Place 1 resource on each [[Mutated]] enemy, as a mutation.' },
    tablet: { delta: -4, text: '-4. Draw the top [[Hex]] card in the encounter discard pile.' },
    elderthing: { delta: -5, text: '-5. Place each card committed to this test facedown underneath an [[Insect]] enemy, as a swarm card.' },
  }),
})

export const SCENARIO_TEXT = Object.freeze({
  textLanguage: 'en',
  textStatus: 'authored-en (mirrors printed English locale; Chinese guide in content/scenario-guide-sources/warOfTheOuterGods.json)',
  heading: 'War of the Outer Gods',
  intro: 'Over a decade after the Great War, another kind of war has come to Earth—a conflict wrought by factions long hidden in the shadows of society. It began with the murders in Arkham. In Providence, Montréal, and New York City, the victims sorted into three distinct groups. You have spent weeks unearthing the truth behind these murders and the various factions carrying them out. The conflict has grown: massacres, bombings, strange ceremonies in the streets, entities blotting out the stars, swarms of locust-like insects, and mutated lizard creatures prowling the sewers. Arkham is the conflict\'s epicenter, and the incidents are spreading across the world. Somehow you must find out what these factions are fighting over, and put a stop to the conflict before it consumes the world.',
  setupSteps: Object.freeze([
    { key: 'gatherSets', text: 'Gather all cards from the War of the Outer Gods encounter set.' },
    { key: 'gatherFactionSets', text: 'Gather all 9 cards from each of the three other encounter sets: Children of Paradise, Swarm of Assimilation, and Death of Stars. Set these encounter sets aside, out of play.' },
    { key: 'agendaDecks', text: 'Put all three agenda decks into play, in this order (from top to bottom): green, blue, then red.' },
    { key: 'placeLocations', text: 'Set the Hub Dimension location aside and put the remaining 10 locations into play.' },
    { key: 'beginAtArkham', text: 'Each investigator begins play at Arkham.' },
    { key: 'spawnCultists', text: 'Search the War of the Outer Gods encounter set for 1 copy of Disciple of the Swarm, 1 copy of Nihilistic Stargazer, and 1 copy of Zealot of Paradise. Spawn each of those enemies (as directed by their "Spawn -" instructions).' },
    { key: 'setAsideAssets', text: 'Set the 5 following story assets aside, out of play: Cloak of the Outer Realm, Pocket Portal, Dreaded End, Blade of Arkat, and Enchanted Skull.' },
    { key: 'shuffleRemainder', text: 'Shuffle the remaining 19 encounter cards to form the encounter deck.' },
  ]),
  specialRules: Object.freeze([
    'Factions: three warring factions (green Children of Paradise, blue Death of Stars, red Swarm of Assimilation). Cards resolve in faction order: green, blue, red.',
    'Faction Agendas: three agenda decks are in play simultaneously. Place 1 doom on each agenda in faction order during the mythos phase, then check each global doom threshold (6) in faction order. Excess doom moves to the next agenda of that faction.',
    '"In the lead": the faction that has advanced farthest; tie-break by most doom, then most enemies in play.',
    'Warring: ready unengaged warring enemies move toward the nearest warring enemy of another faction, then attack warring enemies at their location. A warring enemy defeating another enemy (other than a swarm card) places 1 doom on the attacker\'s faction agenda.',
    'Wards: each ward on an agenda prevents 1 doom, then is removed.',
    '"Around this location": clues around a location are not on it and cannot be discovered. Hub Dimension is connected to each Ritual Site and vice versa.',
    'Swarming X: after a swarming enemy enters play, place the top X cards of your deck facedown underneath it as swarm cards.',
  ]),
  rules: Object.freeze({}),
  tokens: TOKEN_MEANINGS,
  resolutions: Object.freeze({
    noResolution: 'If no resolution was reached (each investigator was defeated): find the faction that is in the lead. If the red faction was in the lead, skip to Resolution 5. If the blue faction was in the lead, skip to Resolution 6. If the green faction was in the lead, skip to Resolution 7.',
    resolution1: 'Resolution 1: The hub\'s many doorways are now sealed tight under your stern control. With the hub sealed, the cults fighting over its ownership should hopefully return to operating in secrecy. Until then, the Earth is safe…relatively speaking. Any one investigator may choose to add the Cloak of the Outer Realms story asset to their deck. Any one investigator may choose to add the Pocket Portal story asset to their deck. Each investigator earns experience equal to the Victory X value of each card in the victory display, and 2 bonus experience for preventing all of the Outer Gods from completing their schemes.',
    resolution2: 'Resolution 2: The swarm of Ezel is too countless to defeat through normal means, but the insects nonetheless have a queen. Using all of your ingenuity, you crush the queen and scatter the swarm; the myriad creatures descend once more into the pit whence they came. Any one investigator may choose to add the Cloak of the Outer Realms story asset to their deck, and any one investigator may add the Enchanted Skull story asset. Each investigator earns experience equal to the Victory X value of each card in the victory display.',
    resolution3: 'Resolution 3: The shape of Silenus is formless, but not without weakness. Using the rituals of its own cult against it, you devise a spell of such incandescent heat that not even the emptiness of space can devour it. The mists retreat in anguish, and familiar stars once more fill the night sky. Any one investigator may choose to add the Cloak of the Outer Realms story asset to their deck, and any one investigator may add the Dreaded End story asset. Each investigator earns experience equal to the Victory X value of each card in the victory display.',
    resolution4: 'Resolution 4: Green blood and sticky pus erupt from the beast\'s carapace as it collapses. Thanks to your haste, you have felled the beast before it could grow too powerful to stop. With the egg hatched and the thing inside destroyed, you hope that the cult of Arkat will disperse. Any one investigator may choose to add the Cloak of the Outer Realms story asset to their deck, and any one investigator may add the Blade of Arkat story asset. Each investigator earns experience equal to the Victory X value of each card in the victory display.',
    resolution5: 'Resolution 5: Little by little, the swarm deconstructs all matter on Earth, transforming each and every molecule to resemble their own. Your consciousness remains, trapped eternally in the awful, buzzing swarm. But all is well. You are with the queen now. Each investigator is killed. The investigators lose the campaign.',
    resolution6: 'Resolution 6: The Earth is just the first planet to be engulfed by Silenus, embodiment of the Empty Sky, the ravenous end of all things. As the planet\'s core plunges to absolute zero, all life is instantly snuffed out. Each investigator is killed. The investigators lose the campaign.',
    resolution7: 'Resolution 7: The beast\'s rampage is impossible to stop. One by one, as it makes its way across the continents and through the oceans, cities fall. Armies are obliterated. Governments collapse. The "paradise" they so willingly killed for has come. Each investigator is killed. The investigators lose the campaign.',
  }),
  resolutionBranches: Object.freeze({
    failedResolutions: 'If the investigators are defeated: find the faction that is in the lead. Red -> Resolution 5, Blue -> Resolution 6, Green -> Resolution 7.',
  }),
})

// ---------------------------------------------------------------------------
// 场景数据
// ---------------------------------------------------------------------------
const ALL_CODES = Object.freeze(Object.keys(ALL_CARDS).filter(code => /^860[0-5][0-9]/.test(code)))
const definitions = encounterDefinitions([
  ...ENCOUNTER_DECK_CODES, ...ANCIENT_ONE_CODES, ...SETUP_CULTISTS,
])
export const CARD_DATA = Object.freeze(Object.fromEntries(ALL_CODES.map(code => [code, ALL_CARDS[code]])))

export const scenario = {
  id: CHAPTER_ID,
  originalCode: REFERENCE_CODE,
  referenceCode: REFERENCE_CODE,
  name: '外神之战 · War of the Outer Gods',
  nameEn: 'War of the Outer Gods',
  encounterCode: ENCOUNTER_CODE,
  intro: SCENARIO_TEXT.intro,
  setup: SCENARIO_TEXT.setupSteps.map(step => step.text).join('\n\n'),
  setupNote: '依照 86001 设置页布置：10 张地点入场、Hub Dimension 放一边、三方阵营各 1 张 1a 议程同时在场、3 名邪教徒按 Spawn 指示生成；独立开局每人 3 XP。',
  setupSteps: SCENARIO_TEXT.setupSteps,
  specialRules: Object.freeze([...SCENARIO_TEXT.specialRules]),
  rules: SCENARIO_TEXT.rules,
  tokens: SCENARIO_TEXT.tokens,
  tokenMeanings: TOKEN_MEANINGS,
  startLocation: START_LOCATION,
  locations: Object.freeze(Object.fromEntries(LOCATION_TABLE.map(([id, code, setAside]) =>
    [id, location({ id, code, connections: STATIC_CONNECTIONS[id] || [], setAside })]))),
  acts: ACTS,
  agendas: INITIAL_AGENDAS,
  stageCards: STAGE_CARDS,
  ...definitions,
  encounterDeck: [...ENCOUNTER_DECK],
  encounterGroups: [...ENCOUNTER_GROUPS],
  resolutions: { ...SCENARIO_TEXT.resolutions },
  resolutionBranches: { ...SCENARIO_TEXT.resolutionBranches },
  setAsideAliases: [...SET_ASIDE_ALIASES],
  factionKeys: [...FACTION_KEYS],
  factionAgendaCodes: { ...FACTION_AGENDA_CODES },
  factionFinalAgenda: { ...FACTION_FINAL_AGENDA },
  factionAncientOne: { ...FACTION_ANCIENT_ONE },
  hubCode: HUB_CODE,
  hubRevealedCode: HUB_REVEALED_CODE,
  ritualSiteIds: [...RITUAL_SITE_IDS],
  textLanguage: SCENARIO_TEXT.textLanguage,
  textStatus: SCENARIO_TEXT.textStatus,
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)

export const LOCATIONS = scenario.locations

export default scenario
