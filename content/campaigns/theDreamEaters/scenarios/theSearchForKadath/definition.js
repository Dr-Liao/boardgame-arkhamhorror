// 寻觅卡达斯（The Search for Kadath · A2 · 06119）· 剧本数据（纯 JSON，无函数）。
//
// 来源：
//   · 英文原文：`参考资源/ArkhamHorror-main/frontend/src/locales/en/theDreamEaters/scenarios/theSearchForKadath.json`
//     （intro / setup / rules / resolutions 逐字照抄去 HTML；`textLanguage:'en'` + `textStatus:'pending-self-translation'`）
//   · 印刷数据：`content/campaigns/theDreamEaters/card-data.js`（本文件不重复录入卡面）
//   · 行为对齐：Haskell `Scenario/Scenarios/TheDreamEaters/TheSearchForKadath.hs` 与各 `CardDefs` 同名文件。
//
// 铁律：state.scenario = structuredClone(definition)，本文件只能有数据 + 卡号常量。
import { bindScenarioIdentities } from '../../../../identities.js'
import {
  location, veiledLocation, stages, encounterCards, encounterDefinitions, encounterDeck, storyCards,
  storyFace, veiledStoryFaces, identitiesFor,
} from '../../card-data.js'
import { THE_SEARCH_FOR_KADATH_TOKEN_MEANINGS } from './chaos.js'

// ---------------------------------------------------------------------------
// 卡号常量（行为里只用常量，不写裸卡号）
// ---------------------------------------------------------------------------
export const REFERENCE_CODE = '06119'
export const VIRGIL_GRAY = '06144'
export const CATS_OF_ULTHAR = '06145'
export const STALKING_MANTICORE = '06146'
export const HORDE_OF_NIGHT = '06147'
export const BEINGS_OF_IB = '06148'
export const PRIEST_OF_A_THOUSAND_MASKS = '06149'
export const TENEBROUS_NIGHTGAUNT = '06150'
export const PACK_OF_VOONITHS = '06151'
export const NIGHTRIDERS = '06152'
export const SONG_OF_THE_MAGAH_BIRD = '06153'
export const WONDROUS_LANDS = '06154'
export const CRAWLING_MIST = '06086'
export const CORSAIR_OF_LENG = '06105'
export const ZOOG_SET = Object.freeze(['06106', '06107', '06108', '06109'])

// 区域（4 个）：键与 Haskell Region 构造子一致。
export const REGIONS = Object.freeze([
  { id: 'oriab', actIndex: 1, hub: 'baharna', locations: ['baharna', 'mtNgranek', 'namelessRuins'], label: '奥瑞巴岛（南）' },
  { id: 'mnar', actIndex: 2, hub: 'kadatheron', locations: ['kadatheron', 'sarnath', 'ruinsOfIb'], label: '米纳尔古地（西）' },
  { id: 'forbiddenLands', actIndex: 3, hub: 'ilekVad', locations: ['ilekVad', 'forbiddenLands', 'zulanThek'], label: '禁闭之地（北）' },
  { id: 'timelessRealm', actIndex: 4, hub: 'celephais', locations: ['celephais', 'serannian', 'hazuthKleg'], label: '永恒之国（东）' },
])
export const REGION_BY_ID = Object.freeze(Object.fromEntries(REGIONS.map(region => [region.id, region])))

// 港口地点（印刷 [[Port]]；正面议程的「撤退」行动由这些地点的 resign 提供）。
export const PORT_LOCATIONS = Object.freeze([
  'dylathLeen', 'kadatheron', 'ilekVad', 'baharna', 'celephais', 'serannian',
])

// ---------------------------------------------------------------------------
// 地点（17）：15 张 Veiled + 斯凯河 / 禁闭之地（由自身能力翻面）
// ---------------------------------------------------------------------------
// 5×6 网格的正交邻接（Haskell 地图文本，见 layout.js 注释）。
const CONNECTIONS = Object.freeze({
  baharna: ['ulthar', 'mtNgranek'],
  ulthar: ['baharna', 'skaiRiver'],
  serannian: ['celephais'],
  namelessRuins: ['mtNgranek'],
  mtNgranek: ['namelessRuins', 'skaiRiver', 'baharna'],
  skaiRiver: ['mtNgranek', 'dylathLeen', 'ulthar', 'sarnath'],
  dylathLeen: ['skaiRiver', 'celephais', 'kadatheron'],
  celephais: ['dylathLeen', 'cityWhichAppearsOnNoMap', 'serannian', 'hazuthKleg'],
  cityWhichAppearsOnNoMap: ['celephais', 'templeOfUnattainableDesires'],
  sarnath: ['skaiRiver', 'kadatheron', 'ruinsOfIb'],
  kadatheron: ['sarnath', 'dylathLeen', 'hazuthKleg'],
  hazuthKleg: ['kadatheron', 'celephais', 'templeOfUnattainableDesires'],
  templeOfUnattainableDesires: ['hazuthKleg', 'cityWhichAppearsOnNoMap'],
  ruinsOfIb: ['sarnath', 'ilekVad'],
  zulanThek: ['forbiddenLands'],
  forbiddenLands: ['zulanThek', 'ilekVad'],
  ilekVad: ['forbiddenLands', 'ruinsOfIb'],
})

const V = (id, code, extra = {}) => veiledLocation(id, code, {
  connections: CONNECTIONS[id],
  ...(PORT_LOCATIONS.includes(id) ? { resign: true } : {}),
  ...extra,
})

const locations = {
  ulthar: V('ulthar', '06127'),
  skaiRiver: location('skaiRiver', '06128', {
    connections: CONNECTIONS.skaiRiver, backCode: '06128b',
  }),
  dylathLeen: V('dylathLeen', '06129'),
  kadatheron: V('kadatheron', '06130'),
  sarnath: V('sarnath', '06131'),
  ruinsOfIb: V('ruinsOfIb', '06132'),
  ilekVad: V('ilekVad', '06133'),
  forbiddenLands: location('forbiddenLands', '06134', {
    connections: CONNECTIONS.forbiddenLands, backCode: '06134b',
  }),
  zulanThek: V('zulanThek', '06135'),
  baharna: V('baharna', '06136'),
  mtNgranek: V('mtNgranek', '06137'),
  namelessRuins: V('namelessRuins', '06138'),
  celephais: V('celephais', '06139'),
  serannian: V('serannian', '06140'),
  hazuthKleg: V('hazuthKleg', '06141'),
  templeOfUnattainableDesires: V('templeOfUnattainableDesires', '06142'),
  cityWhichAppearsOnNoMap: V('cityWhichAppearsOnNoMap', '06143'),
}

// 开局在场的 3 处；其余 14 处放在一边（区域设置才入场）。
export const START_LOCATION_IDS = Object.freeze(['ulthar', 'skaiRiver', 'dylathLeen'])
export const SET_ASIDE_LOCATION_IDS = Object.freeze(Object.keys(locations).filter(id => !START_LOCATION_IDS.includes(id)))

// 背面故事卡：15 张 Veiled 地带出 + 斯凯河 / 禁闭之地由自身翻面能力带出。
const storyFaces = {
  ...veiledStoryFaces(locations),
  '06128b': storyFace('06128b'),
  '06134b': storyFace('06134b'),
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
const ACT_CODES = Object.freeze(['06122', '06123', '06124', '06125', '06126'])
const AGENDA_CODES = Object.freeze(['06120', '06121'])

// 幕 1：轮末、位于[[港口]]地点的调查员团队花费 2×人数线索推进（引擎 objective + roundEndActIndex）。
const ACT_EXTRA = Object.freeze({
  '06122': { objective: { type: 'clues', perInvestigator: 2, atLocation: 'dylathLeen' } },
})
const AGENDA_EXTRA = Object.freeze({
  '06120': {},
  '06121': {},
})

// ---------------------------------------------------------------------------
// 遭遇牌库（6 个组）：单个卡号在 definition 与 manifest 区域里只出现一次
// ---------------------------------------------------------------------------
const DECK_GROUPS = Object.freeze([
  'theSearchForKadath', 'agentsOfNyarlathotep', 'corsairs', 'dreamlands', 'whispersOfHypnos', 'zoogs',
])
// setup 放在一边的敌人（数量按印刷 quantity）。
export const SET_ASIDE_ALIASES = Object.freeze([
  CATS_OF_ULTHAR, STALKING_MANTICORE, CRAWLING_MIST, HORDE_OF_NIGHT, BEINGS_OF_IB,
  TENEBROUS_NIGHTGAUNT, TENEBROUS_NIGHTGAUNT, CORSAIR_OF_LENG, CORSAIR_OF_LENG,
  PRIEST_OF_A_THOUSAND_MASKS, PRIEST_OF_A_THOUSAND_MASKS, PRIEST_OF_A_THOUSAND_MASKS,
])
const SET_ASIDE_ENEMY_CODE_SET = new Set(SET_ASIDE_ALIASES)
const deckCards = encounterCards(DECK_GROUPS).filter(card => !SET_ASIDE_ENEMY_CODE_SET.has(card.code))
const definitions = encounterDefinitions(encounterCards(DECK_GROUPS))

// ---------------------------------------------------------------------------
// 英文原文（逐字照抄，去 HTML；P8-T 前不改写、不翻译）
// ---------------------------------------------------------------------------
const INTRO = [
  '_Intro 1:_ You stay the night at Einar’s Place. Your rest is anything but peaceful. Even if one could sleep within a dream, you certainly do not. Your mind teems with anxiety over the quest looming ahead. You reflect on the black cat’s warning about danger in the waking world, and you wonder about the others who have followed Virgil Gray down the steps of slumber and through the Enchanted Woods. Are they here now, too? Perhaps if you find this castle and return with proof of the Dreamlands, you can save everyone: yourself, your friends, and the other dreamers as well.',
  'Check Campaign Log.',
  '- *If the black cat is at your side*, proceed to _Intro 2_.',
  '- *If the above is not true, and Luke Robinson is in this group*, skip to _Intro 3_.',
  '- *If neither of the above is true*, skip to _Intro 4_.',
].join('\n')

const SETUP = [
  'Gather all cards from the following encounter sets: *The Search for Kadath*, *Agents of Nyarlathotep*, *Corsairs*, *Dreamlands*, *Whispers of Hypnos*, and *Zoogs*.',
  'Put Ulthar, Skai River, and Dylath-Leen into play. Each investigator begins play in Ulthar.',
  'Set each other location aside, out of play.',
  'Set the following enemies aside, out of play: Cats of Ulthar, Stalking Manticore, The Crawling Mist, Horde of Night, Beings of Ib, both copies of Tenebrous Nightgaunt, both copies of Corsair of Leng, and all 3 copies of Priest of a Thousand Masks.',
  'Search the gathered encounter cards for 1 copy of Pack of Vooniths and spawn it at Skai River. If there are 3 or 4 investigators in the game, search the gathered encounter cards for another copy of Pack of Vooniths and spawn it at Dylath-Leen, as well.',
  'The lead investigator takes control of the Virgil Gray *(Writer of Strange Tales)* story asset and puts him into play.',
  'Shuffle the remainder of the encounter cards to build the encounter deck.',
].join('\n')

const REGION_SETUP = {
  oriab: [
    'Each investigator loses each of their clues.',
    'Remove each location in play from the game (or place it in the victory display if it has Victory X and no clues on it). Each enemy and attachment at those locations is discarded. Investigators are not defeated during this process.',
    'Put each set-aside Oriab location into play (Baharna, Mt. Ngranek, and Nameless Ruins). Place each investigator at Baharna.',
    'Search the encounter deck for 1 copy of Nightriders and spawn it at Mt. Ngranek. If there are 3 or 4 investigators in the game, search the encounter deck for another copy of Nightriders and spawn it at Nameless Ruins, as well. Shuffle the encounter deck.',
    'Advance to Act 2a—“The Isle of Oriab.”',
  ],
  mnar: [
    'Each investigator loses each of their clues.',
    'Remove each location in play from the game (or place it in the victory display if it has Victory X and no clues on it). Each enemy and attachment at those locations is discarded. Investigators are not defeated during this process.',
    'Put each set-aside Mnar location into play (Kadatheron, Sarnath, and Ruins of Ib). Place each investigator at Kadatheron.',
    'Spawn the set-aside Beings of Ib enemy at Ruins of Ib.',
    'Advance to Act 2a—“The Doom That Came Before.”',
  ],
  forbiddenLands: [
    'Each investigator loses each of their clues.',
    'Remove each location in play from the game (or place it in the victory display if it has Victory X and no clues on it). Each enemy and attachment at those locations is discarded. Investigators are not defeated during this process.',
    'Put each set-aside Forbidden location into play (Ilek-Vad, Forbidden Lands, and Zulan-Thek). Place each investigator at Ilek-Vad.',
    'Spawn the set-aside Stalking Manticore enemy at Forbidden Lands. Spawn the set-aside Horde of Night enemy at Zulan-Thek.',
    'Advance to Act 2a—“Seek Out the Night.”',
  ],
  timelessRealm: [
    'Each investigator loses each of their clues.',
    'Remove each location in play from the game (or place it in the victory display if it has Victory X and no clues on it). Each enemy and attachment at those locations is discarded. Investigators are not defeated during this process.',
    'Put Celephaïs, Serannian, and Hazuth-Kleg into play. Place each investigator at Celephaïs.',
    'Shuffle the set-aside The Crawling Mist into the encounter deck.',
    'Search the encounter deck for 1 copy of Priest of a Thousand Masks and spawn it at Hazuth-Kleg. If there are 3 or 4 investigators in the game, search the encounter deck for another copy of Priest of a Thousand Masks and spawn it at Celephaïs, as well. Shuffle the encounter deck.',
    'Advance to Act 2a—“The King’s Decree.”',
  ],
}

const RULES = {
  locations: 'Each of the locations in this scenario have no unrevealed side, and therefore they enter play with their revealed side faceup. Instead of an unrevealed side, these locations have story cards on their reverse sides. Whenever a location in this scenario enters play (including during setup), place clues on that location equal to its clue value, as normal. Locations can be flipped over in one of two ways. Most are flipped over by the veiled keyword, as described below. Some locations are instead flipped over by an ability printed on that location. Once a location has been flipped over and its story text has been read, it cannot be flipped over again for the remainder of the game unless otherwise noted.',
  veiled: 'Many of the locations in this scenario have the veiled keyword. This keyword represents that a location contains unknown lore or assistance that must be sought out by the investigators before it can be of use to them. As a {fast} ability, an investigator at a veiled location with no clues on it may flip that location over, resolving the text on its other side.',
  swarmingAndVictory: 'When Victory X appears on a swarming enemy, this text is only active for the host card. Swarm cards cannot enter the victory display and are never worth victory points.',
}

const RESOLUTION_1 = [
  '_Resolution 1 (each defeated investigator should resolve Investigator Defeat first):_ You have ventured far and wide, from the quaint cobbled villages of the kingdom of the Skai to wondrous lands you could have never in a hundred years imagined. You learned much of the Dreamlands and of the gods who dwell atop unknown Kadath. Though you are closer to your goal, you still don’t know its precise location. In the meantime, your quest grows deadlier with each passing day. No matter where you go, foul, nightmarish creatures pursue you across land and sea. Winged beasts with no faces, horned Corsairs wielding razor-sharp cutlasses and commanding great black galleys—the agents of your demise bear many shapes. You decide to return to your ship, safe from the many dangers of the Dreamlands…or so you thought.',
  'Unfortunately, your ship is no safe haven. When you return, the crew and captain are nowhere to be found. There are no signs of struggle, but Virgil, who returned to the ship earlier to prepare for your next departure, is also missing.',
  '“I fear the worst,” Randolph mourns. “If those fiendish Corsairs captured them, they are in dire trouble. They are agents of the Other Gods from the Outside, whose soul and messenger is the crawling chaos Nyarlathotep.” The mere utterance of the name causes you to shudder, though you do not know why. You ask where they might have been taken. As if discussing any other port of call, he replies: “The beasts who command their black galleys sail from the Moon. If we are to rescue Virgil and our other companions, that is where we must go.”',
  '- Each investigator earns experience equal to the Victory X value of each card in the victory display.',
  '- For each Sign of the Gods the investigators unveiled during this scenario, record 1 tally mark next to “Evidence of Kadath” in your Campaign Log.',
  '- In your Campaign Log, record *Virgil was captured*.',
  '- In your Campaign Log, record *Randolph eluded capture*.',
  '- If you are playing The Dream-Quest as a four-part campaign, proceed to _Scenario 3–A: Dark Side of the Moon_.',
  '- If you are playing The Dream-Quest and The Web of Dreams as an interconnected eight-part campaign…',
  '- …and you have not yet played _Scenario 2–B: A Thousand Shapes of Horror_, proceed to that scenario.',
  '- …and you have already played _Scenario 2–B: A Thousand Shapes of Horror_, proceed instead to _Interlude II: The Oneironauts_.',
].join('\n')

const RESOLUTION_2 = [
  '_Resolution 2:_ As you examine your surroundings, you notice that your other companions, including Virgil and Randolph, have been captured as well. They are unconscious at the moment, but maybe when they awaken you can formulate a plan to free yourselves. After all, despite this setback, you have learned much of the Dreamlands and of the gods who dwell atop unknown Kadath. Though you still don’t know its precise location, if you are able to escape from this wretched galley, perhaps there is hope for your quest. You swallow a ball of despair and hope that this is not the end of your journey…',
  '- Each investigator earns experience equal to the Victory X value of each card in the victory display.',
  '- For each Sign of the Gods the investigators unveiled during this scenario, record 1 tally mark next to “Evidence of Kadath” in your Campaign Log.',
  '- In your Campaign Log, record *Virgil was captured*.',
  '- In your Campaign Log, record *Randolph was captured*.',
  '- If you are playing The Dream-Quest as a four-part campaign, proceed to _Scenario 3–A: Dark Side of the Moon_.',
  '- If you are playing The Dream-Quest and The Web of Dreams as an interconnected eight-part campaign…',
  '- …and you have not yet played _Scenario 2–B: A Thousand Shapes of Horror_, proceed to that scenario.',
  '- …and you have already played _Scenario 2–B: A Thousand Shapes of Horror_, proceed instead to _Interlude II: The Oneironauts_.',
].join('\n')

const NO_RESOLUTION = [
  '_If no resolution was reached:_',
  '- If at least 1 investigator resigned, proceed to _Resolution 1_.',
  '- If each investigator was defeated, skip to _Resolution 2_.',
].join('\n')

const INVESTIGATOR_DEFEAT = [
  'Before resolving any other resolution, if at least one investigator was defeated: The defeated investigators read _Investigator Defeat_ first.',
  '_Investigator Defeat:_ You wake to find yourself restrained by thick cords of hempen rope, lying on top of hard, moist wood. The floor rocks steadily back and forth, and you hear ocean waves crashing against the walls. You are captive aboard some kind of galley. But why?',
  '- In your Campaign Log, each defeated investigator records *(your investigator name) was captured*.',
  '- If a defeated investigator’s deck contains Randolph Carter and at least 1 investigator resigned, give ownership of Randolph Carter to an investigator who resigned.',
  '- Proceed to the resolution the investigators reached. If no resolution was reached…',
  '- …and at least 1 investigator resigned, proceed to _Resolution 1_.',
  '- …and each investigator was defeated, skip to _Resolution 2_.',
].join('\n')

// ---------------------------------------------------------------------------
// 剧本对象
// ---------------------------------------------------------------------------
export const scenario = {
  id: 'theSearchForKadath',
  originalCode: REFERENCE_CODE,
  name: '寻觅卡达斯',
  nameEn: 'The Search for Kadath',
  // P8：英文原文，P8-T 前不译（textLanguage/textStatus 供审计）。
  textLanguage: 'en',
  textStatus: 'pending-self-translation',
  intro: INTRO,
  setup: SETUP,
  startLocation: 'ulthar',
  locations,
  setAsideLocations: SET_ASIDE_LOCATION_IDS,
  acts: stages(ACT_CODES, 'act').map(act => ({
    ...act,
    reveal: { type: 'campaignRule' },
    ...(ACT_EXTRA[act.originalCode] || {}),
  })),
  agendas: stages(AGENDA_CODES, 'agenda').map(agenda => ({
    ...agenda,
    reveal: { type: 'campaignRule' },
    ...(AGENDA_EXTRA[agenda.originalCode] || {}),
  })),
  ...definitions,
  storyAssets: storyCards([VIRGIL_GRAY]),
  storyFaces,
  encounterDeck: encounterDeck(deckCards),
  tokenMeanings: THE_SEARCH_FOR_KADATH_TOKEN_MEANINGS,
  rules: RULES,
  regionSetup: REGION_SETUP,
  specialRules: [
    { id: 'locations', title: 'Locations in The Search for Kadath', body: RULES.locations },
    { id: 'veiled', title: 'Veiled', body: RULES.veiled },
    { id: 'swarmingAndVictory', title: 'Enemies with Swarming and Victory', body: RULES.swarmingAndVictory },
  ],
  flavorText: {
    investigatorDefeat: INVESTIGATOR_DEFEAT,
  },
  resolutions: {
    noResolution: NO_RESOLUTION,
    resolution1: RESOLUTION_1,
    resolution2: RESOLUTION_2,
  },
}

export const identities = identitiesFor(scenario)
bindScenarioIdentities(scenario, identities)


// P8：本章 behavior.js 引用的印刷卡号统一放数据表（content 章节流程不写卡号字面量）。
export const RAW_CODES = Object.freeze({
  c06120: '06120',
  c06121: '06121',
  c06122: '06122',
  c06123: '06123',
  c06124: '06124',
  c06125: '06125',
  c06126: '06126',
  c06127: '06127',
  c06127b: '06127b',
  c06128: '06128',
  c06128b: '06128b',
  c06129: '06129',
  c06129b: '06129b',
  c06130: '06130',
  c06130b: '06130b',
  c06131: '06131',
  c06131b: '06131b',
  c06132: '06132',
  c06132b: '06132b',
  c06133: '06133',
  c06133b: '06133b',
  c06134: '06134',
  c06134b: '06134b',
  c06135: '06135',
  c06135b: '06135b',
  c06136: '06136',
  c06136b: '06136b',
  c06137: '06137',
  c06137b: '06137b',
  c06138: '06138',
  c06138b: '06138b',
  c06139: '06139',
  c06139b: '06139b',
  c06140: '06140',
  c06140b: '06140b',
  c06141: '06141',
  c06141b: '06141b',
  c06142: '06142',
  c06142b: '06142b',
  c06143: '06143',
  c06143b: '06143b',
  c06144: '06144',
  c06145: '06145',
  c06146: '06146',
  c06147: '06147',
  c06148: '06148',
  c06149: '06149',
  c06150: '06150',
  c06151: '06151',
  c06152: '06152',
  c06153: '06153',
  c06154: '06154',
})
